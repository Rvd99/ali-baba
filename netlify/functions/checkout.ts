import type { Handler, HandlerEvent } from "@netlify/functions";
import Stripe from "stripe";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const user = getUserFromHeader(event.headers.authorization);
  if (!user) return jsonResponse(401, { error: "Authentication required" });

  const prisma = getPrisma();

  try {
    const body = JSON.parse(event.body || "{}");
    const { items, shippingAddress } = body;

    // items: [{ productId, quantity }]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(400, { error: "Cart items are required" });
    }

    // Fetch products and validate stock
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let total = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return jsonResponse(400, { error: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return jsonResponse(400, { error: `Insufficient stock for "${product.name}"` });
      }

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description.slice(0, 200),
            images: product.images.slice(0, 1),
          },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.quantity,
      });

      total += product.price * item.quantity;
    }

    // Create order in PENDING state
    const orderItemsData = items.map((item: { productId: string; quantity: number }) => {
      const product = productMap.get(item.productId)!;
      return { productId: item.productId, quantity: item.quantity, price: product.price };
    });

    const order = await prisma.order.create({
      data: {
        buyerId: user.userId,
        total,
        shippingAddress: shippingAddress || null,
        items: { create: orderItemsData },
      },
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.VITE_API_URL || "http://localhost:8888"}/orders?success=true&orderId=${order.id}`,
      cancel_url: `${process.env.VITE_API_URL || "http://localhost:8888"}/cart?cancelled=true`,
      metadata: { orderId: order.id, userId: user.userId },
    });

    // Store payment intent ID
    if (session.payment_intent) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentIntentId: session.payment_intent as string },
      });
    }

    return jsonResponse(200, { sessionId: session.id, url: session.url, orderId: order.id });
  } catch (err) {
    console.error("Checkout error:", err);
    return jsonResponse(500, { error: "Failed to create checkout session" });
  }
};

export { handler };
