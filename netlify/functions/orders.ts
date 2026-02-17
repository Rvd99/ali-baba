import type { Handler, HandlerEvent } from "@netlify/functions";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const user = getUserFromHeader(event.headers.authorization);
  if (!user) return jsonResponse(401, { error: "Authentication required" });

  const prisma = getPrisma();
  const params = event.queryStringParameters || {};

  try {
    // GET — list orders for buyer, or single order
    if (event.httpMethod === "GET") {
      if (params.id) {
        const order = await prisma.order.findUnique({
          where: { id: params.id },
          include: {
            items: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
            buyer: { select: { id: true, name: true, email: true } },
          },
        });
        if (!order) return jsonResponse(404, { error: "Order not found" });
        if (order.buyerId !== user.userId && user.role !== "ADMIN") {
          return jsonResponse(403, { error: "Access denied" });
        }
        return jsonResponse(200, order);
      }

      // List orders — buyer sees own, admin sees all, seller sees orders with their products
      const where: Record<string, unknown> = {};
      if (user.role === "BUYER") {
        where.buyerId = user.userId;
      } else if (user.role === "SELLER") {
        where.items = { some: { product: { sellerId: user.userId } } };
      }

      if (params.status) {
        where.status = params.status;
      }

      const page = Math.max(1, parseInt(params.page || "1"));
      const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20")));
      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            items: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

      return jsonResponse(200, { orders, total, page, limit });
    }

    // POST — create order from cart items
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { items, shippingAddress } = body;

      // items: [{ productId, quantity }]
      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonResponse(400, { error: "Order items are required" });
      }

      // Fetch products and validate stock
      const productIds = items.map((i: { productId: string }) => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

      const productMap = new Map(products.map((p) => [p.id, p]));
      let total = 0;
      const orderItemsData: { productId: string; quantity: number; price: number }[] = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          return jsonResponse(400, { error: `Product ${item.productId} not found` });
        }
        if (product.stock < item.quantity) {
          return jsonResponse(400, { error: `Insufficient stock for "${product.name}". Available: ${product.stock}` });
        }
        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
        total += product.price * item.quantity;
      }

      // Create order + items in a transaction, decrement stock
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            buyerId: user.userId,
            total,
            shippingAddress: shippingAddress || null,
            items: {
              create: orderItemsData,
            },
          },
          include: {
            items: { include: { product: { select: { id: true, name: true, images: true } } } },
          },
        });

        // Decrement stock
        for (const item of orderItemsData) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        // Clear the buyer's cart
        const cart = await tx.cart.findUnique({ where: { userId: user.userId } });
        if (cart) {
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }

        return newOrder;
      });

      return jsonResponse(201, order);
    }

    // PUT — update order status (seller/admin)
    if (event.httpMethod === "PUT") {
      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Order id is required" });

      const { status } = JSON.parse(event.body || "{}");
      const validStatuses = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
      if (!status || !validStatuses.includes(status)) {
        return jsonResponse(400, { error: `Status must be one of: ${validStatuses.join(", ")}` });
      }

      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing) return jsonResponse(404, { error: "Order not found" });

      // Only the buyer (for cancel), seller, or admin can update
      if (user.role === "BUYER" && status !== "CANCELLED") {
        return jsonResponse(403, { error: "Buyers can only cancel orders" });
      }

      const order = await prisma.order.update({
        where: { id },
        data: { status },
        include: { items: { include: { product: { select: { id: true, name: true, images: true } } } } },
      });

      return jsonResponse(200, order);
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Orders error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
