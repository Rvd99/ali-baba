import type { Handler, HandlerEvent } from "@netlify/functions";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const user = getUserFromHeader(event.headers.authorization);
  if (!user) return jsonResponse(401, { error: "Authentication required" });

  const params = event.queryStringParameters || {};

  try {
    // GET — get wishlist with product details
    if (event.httpMethod === "GET") {
      let { data: wishlist } = await supabase
        .from("Wishlist")
        .select("id, items:WishlistItem(id, productId, createdAt)")
        .eq("userId", user.userId)
        .maybeSingle();

      if (!wishlist) {
        const { data: newWishlist } = await supabase.from("Wishlist").insert({ id: randomUUID(), userId: user.userId }).select("id").single();
        wishlist = { id: newWishlist?.id, items: [] };
      }

      const items = (wishlist.items || []) as Array<{ id: string; productId: string; createdAt: string }>;
      const productIds = items.map((i) => i.productId);
      let productMap = new Map();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("Product")
          .select("id, name, slug, price, compareAt, images, stock")
          .in("id", productIds);
        productMap = new Map((products || []).map((p: { id: string }) => [p.id, p]));
      }

      const enrichedItems = items.map((item) => ({
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

      const { data: product } = await supabase.from("Product").select("id").eq("id", productId).maybeSingle();
      if (!product) return jsonResponse(404, { error: "Product not found" });

      let { data: wishlist } = await supabase.from("Wishlist").select("id").eq("userId", user.userId).maybeSingle();
      if (!wishlist) {
        const { data: newWishlist } = await supabase.from("Wishlist").insert({ id: randomUUID(), userId: user.userId }).select("id").single();
        wishlist = newWishlist;
      }

      const { data: existing } = await supabase
        .from("WishlistItem")
        .select("id")
        .eq("wishlistId", wishlist!.id)
        .eq("productId", productId)
        .maybeSingle();

      if (existing) return jsonResponse(200, { message: "Already in wishlist" });

      await supabase.from("WishlistItem").insert({ id: randomUUID(), wishlistId: wishlist!.id, productId });
      return jsonResponse(201, { message: "Added to wishlist" });
    }

    // DELETE — remove item from wishlist
    if (event.httpMethod === "DELETE") {
      const productId = params.productId;
      if (!productId) return jsonResponse(400, { error: "productId query param is required" });

      const { data: wishlist } = await supabase.from("Wishlist").select("id").eq("userId", user.userId).maybeSingle();
      if (!wishlist) return jsonResponse(404, { error: "Wishlist not found" });

      await supabase.from("WishlistItem").delete().eq("wishlistId", wishlist.id).eq("productId", productId);
      return jsonResponse(200, { message: "Removed from wishlist" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Wishlist error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
