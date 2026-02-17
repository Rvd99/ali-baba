import type { Handler, HandlerEvent } from "@netlify/functions";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const prisma = getPrisma();
  const params = event.queryStringParameters || {};

  try {
    // GET — get reviews for a product
    if (event.httpMethod === "GET") {
      const productId = params.productId;
      if (!productId) return jsonResponse(400, { error: "productId is required" });

      const reviews = await prisma.review.findMany({
        where: { productId },
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
      });

      return jsonResponse(200, reviews);
    }

    // POST — create a review
    if (event.httpMethod === "POST") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const { productId, rating, comment } = JSON.parse(event.body || "{}");

      if (!productId || rating == null) {
        return jsonResponse(400, { error: "productId and rating are required" });
      }

      const ratingNum = Math.min(5, Math.max(1, parseInt(rating)));

      // Check if user already reviewed this product
      const existing = await prisma.review.findUnique({
        where: { productId_userId: { productId, userId: user.userId } },
      });

      if (existing) {
        // Update existing review
        const review = await prisma.review.update({
          where: { id: existing.id },
          data: { rating: ratingNum, comment: comment || null },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        });
        return jsonResponse(200, review);
      }

      const review = await prisma.review.create({
        data: {
          productId,
          userId: user.userId,
          rating: ratingNum,
          comment: comment || null,
        },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      });

      return jsonResponse(201, review);
    }

    // DELETE — delete own review
    if (event.httpMethod === "DELETE") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const reviewId = params.id;
      if (!reviewId) return jsonResponse(400, { error: "Review id is required" });

      const review = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!review) return jsonResponse(404, { error: "Review not found" });
      if (review.userId !== user.userId && user.role !== "ADMIN") {
        return jsonResponse(403, { error: "You can only delete your own reviews" });
      }

      await prisma.review.delete({ where: { id: reviewId } });
      return jsonResponse(200, { message: "Review deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Reviews error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
