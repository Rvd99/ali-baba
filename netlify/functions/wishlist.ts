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
    // GET — get wishlist with product details
    if (event.httpMethod === "GET") {
      let wishlist = await prisma.wishlist.findUnique({
        where: { userId: user.userId },
        include: { items: true },
      });

      if (!wishlist) {
        wishlist = await prisma.wishlist.create({
          data: { userId: user.userId },
          include: { items: true },
        });
      }

      // Fetch product details
      const productIds = wishlist.items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true, price: true, compareAt: true, images: true, stock: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const enrichedItems = wishlist.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        product: productMap.get(item.productId) || null,
      }));

      return jsonResponse(200, { id: wishlist.id, items: enrichedItems });
    }

    // POST — add item to wishlist
    if (event.httpMethod === "POST") {
      const { productId } = JSON.parse(event.body || "{}");
      if (!productId) return jsonResponse(400, { error: "productId is required" });

      // Validate product exists
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return jsonResponse(404, { error: "Product not found" });

      let wishlist = await prisma.wishlist.findUnique({ where: { userId: user.userId } });
      if (!wishlist) {
        wishlist = await prisma.wishlist.create({ data: { userId: user.userId } });
      }

      // Check if already in wishlist
      const existing = await prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      });
      if (existing) {
        return jsonResponse(200, { message: "Already in wishlist" });
      }

      await prisma.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId },
      });

      return jsonResponse(201, { message: "Added to wishlist" });
    }

    // DELETE — remove item from wishlist
    if (event.httpMethod === "DELETE") {
      const productId = params.productId;
      if (!productId) return jsonResponse(400, { error: "productId query param is required" });

      const wishlist = await prisma.wishlist.findUnique({ where: { userId: user.userId } });
      if (!wishlist) return jsonResponse(404, { error: "Wishlist not found" });

      await prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id, productId },
      });

      return jsonResponse(200, { message: "Removed from wishlist" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Wishlist error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
