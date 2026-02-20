import type { Handler, HandlerEvent } from "@netlify/functions";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const params = event.queryStringParameters || {};

  try {
    // GET — get reviews for a product
    if (event.httpMethod === "GET") {
      const productId = params.productId;
      if (!productId) return jsonResponse(400, { error: "productId is required" });

      const { data: reviews } = await supabase
        .from("Review")
        .select("*, user:User!userId(id,name,avatar)")
        .eq("productId", productId)
        .order("createdAt", { ascending: false });

      return jsonResponse(200, reviews || []);
    }

    // POST — create or update a review
    if (event.httpMethod === "POST") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const { productId, rating, comment } = JSON.parse(event.body || "{}");
      if (!productId || rating == null) return jsonResponse(400, { error: "productId and rating are required" });

      const ratingNum = Math.min(5, Math.max(1, parseInt(rating)));

      const { data: existing } = await supabase
        .from("Review")
        .select("id")
        .eq("productId", productId)
        .eq("userId", user.userId)
        .maybeSingle();

      if (existing) {
        const { data: review } = await supabase
          .from("Review")
          .update({ rating: ratingNum, comment: comment || null })
          .eq("id", existing.id)
          .select("*, user:User!userId(id,name,avatar)")
          .single();
        return jsonResponse(200, review);
      }

      const { data: review, error } = await supabase
        .from("Review")
        .insert({ id: randomUUID(), productId, userId: user.userId, rating: ratingNum, comment: comment || null })
        .select("*, user:User!userId(id,name,avatar)")
        .single();

      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(201, review);
    }

    // DELETE — delete own review
    if (event.httpMethod === "DELETE") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const reviewId = params.id;
      if (!reviewId) return jsonResponse(400, { error: "Review id is required" });

      const { data: review } = await supabase.from("Review").select("userId").eq("id", reviewId).maybeSingle();
      if (!review) return jsonResponse(404, { error: "Review not found" });
      if (review.userId !== user.userId && user.role !== "ADMIN") {
        return jsonResponse(403, { error: "You can only delete your own reviews" });
      }

      await supabase.from("Review").delete().eq("id", reviewId);
      return jsonResponse(200, { message: "Review deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Reviews error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
