import type { Handler, HandlerEvent } from "@netlify/functions";
import Stripe from "stripe";
import { getPrisma } from "./lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const sig = event.headers["stripe-signature"];
  if (!sig) {
    return { statusCode: 400, body: "Missing stripe-signature header" };
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body || "", sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return { statusCode: 400, body: "Webhook signature verification failed" };
  }

  const prisma = getPrisma();

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          // Update order status to PAID and decrement stock
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });

          if (order && order.status === "PENDING") {
            await prisma.$transaction(async (tx) => {
              await tx.order.update({
                where: { id: orderId },
                data: {
                  status: "PAID",
                  paymentIntentId: session.payment_intent as string || undefined,
                },
              });

              // Decrement stock for each item
              for (const item of order.items) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { decrement: item.quantity } },
                });
              }

              // Clear the buyer's cart
              const cart = await tx.cart.findUnique({ where: { userId: order.buyerId } });
              if (cart) {
                await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
              }
            });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = stripeEvent.data.object as Stripe.PaymentIntent;
        console.error("Payment failed for intent:", intent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error("Webhook handler error:", err);
    return { statusCode: 500, body: "Webhook handler error" };
  }
};

export { handler };
