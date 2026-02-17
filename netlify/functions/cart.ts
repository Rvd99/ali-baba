import type { Handler, HandlerEvent } from "@netlify/functions";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const user = getUserFromHeader(event.headers.authorization);
  if (!user) return jsonResponse(401, { error: "Authentication required" });

  const prisma = getPrisma();

  try {
    // GET — get current user's cart
    if (event.httpMethod === "GET") {
      let cart = await prisma.cart.findUnique({
        where: { userId: user.userId },
        include: {
          items: {
            include: {
              cart: false,
              // We can't include product directly on CartItem since there's no relation,
              // so we'll do a manual lookup below
            },
          },
        },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId: user.userId },
          include: { items: true },
        });
      }

      // Fetch product details for each cart item
      const productIds = cart.items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true, price: true, images: true, stock: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const enrichedItems = cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: productMap.get(item.productId) || null,
      }));

      return jsonResponse(200, { id: cart.id, items: enrichedItems });
    }

    // POST — add item to cart
    if (event.httpMethod === "POST") {
      const { productId, quantity } = JSON.parse(event.body || "{}");

      if (!productId) return jsonResponse(400, { error: "productId is required" });
      const qty = Math.max(1, parseInt(quantity || "1"));

      // Validate product exists and has stock
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return jsonResponse(404, { error: "Product not found" });
      if (product.stock < qty) {
        return jsonResponse(400, { error: `Insufficient stock. Available: ${product.stock}` });
      }

      // Upsert cart
      let cart = await prisma.cart.findUnique({ where: { userId: user.userId } });
      if (!cart) {
        cart = await prisma.cart.create({ data: { userId: user.userId } });
      }

      // Upsert cart item
      const existingItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + qty },
        });
      } else {
        await prisma.cartItem.create({
          data: { cartId: cart.id, productId, quantity: qty },
        });
      }

      // Touch the cart updatedAt
      await prisma.cart.update({ where: { id: cart.id }, data: {} });

      return jsonResponse(200, { message: "Item added to cart" });
    }

    // PUT — update cart item quantity
    if (event.httpMethod === "PUT") {
      const { productId, quantity } = JSON.parse(event.body || "{}");
      if (!productId) return jsonResponse(400, { error: "productId is required" });

      const cart = await prisma.cart.findUnique({ where: { userId: user.userId } });
      if (!cart) return jsonResponse(404, { error: "Cart not found" });

      const qty = parseInt(quantity || "0");
      if (qty <= 0) {
        // Remove item
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
      } else {
        await prisma.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId } },
          update: { quantity: qty },
          create: { cartId: cart.id, productId, quantity: qty },
        });
      }

      await prisma.cart.update({ where: { id: cart.id }, data: {} });
      return jsonResponse(200, { message: "Cart updated" });
    }

    // DELETE — remove item or clear cart
    if (event.httpMethod === "DELETE") {
      const params = event.queryStringParameters || {};
      const cart = await prisma.cart.findUnique({ where: { userId: user.userId } });
      if (!cart) return jsonResponse(404, { error: "Cart not found" });

      if (params.productId) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: params.productId } });
        return jsonResponse(200, { message: "Item removed from cart" });
      }

      // Clear entire cart
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      return jsonResponse(200, { message: "Cart cleared" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Cart error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
