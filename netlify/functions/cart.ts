import type { Handler, HandlerEvent } from "@netlify/functions";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const user = getUserFromHeader(event.headers.authorization);
  if (!user) return jsonResponse(401, { error: "Authentication required" });

  try {
    // GET — get current user's cart
    if (event.httpMethod === "GET") {
      let { data: cart } = await supabase.from("Cart").select("id, items:CartItem(*)").eq("userId", user.userId).maybeSingle();

      if (!cart) {
        const { data: newCart } = await supabase.from("Cart").insert({ id: randomUUID(), userId: user.userId }).select("id").single();
        cart = { id: newCart?.id, items: [] };
      }

      const items = (cart.items || []) as Array<{ id: string; productId: string; quantity: number }>;
      const productIds = items.map((i) => i.productId);
      let productMap = new Map();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("Product")
          .select("id, name, slug, price, images, stock")
          .in("id", productIds);
        productMap = new Map((products || []).map((p: { id: string }) => [p.id, p]));
      }

      const enrichedItems = items.map((item) => ({
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

      const { data: product } = await supabase.from("Product").select("id, stock").eq("id", productId).maybeSingle();
      if (!product) return jsonResponse(404, { error: "Product not found" });
      if (product.stock < qty) return jsonResponse(400, { error: `Insufficient stock. Available: ${product.stock}` });

      let { data: cart } = await supabase.from("Cart").select("id").eq("userId", user.userId).maybeSingle();
      if (!cart) {
        const { data: newCart } = await supabase.from("Cart").insert({ id: randomUUID(), userId: user.userId }).select("id").single();
        cart = newCart;
      }

      const { data: existingItem } = await supabase
        .from("CartItem")
        .select("id, quantity")
        .eq("cartId", cart!.id)
        .eq("productId", productId)
        .maybeSingle();

      if (existingItem) {
        await supabase.from("CartItem").update({ quantity: existingItem.quantity + qty }).eq("id", existingItem.id);
      } else {
        await supabase.from("CartItem").insert({ id: randomUUID(), cartId: cart!.id, productId, quantity: qty });
      }

      return jsonResponse(200, { message: "Item added to cart" });
    }

    // PUT — update cart item quantity
    if (event.httpMethod === "PUT") {
      const { productId, quantity } = JSON.parse(event.body || "{}");
      if (!productId) return jsonResponse(400, { error: "productId is required" });

      const { data: cart } = await supabase.from("Cart").select("id").eq("userId", user.userId).maybeSingle();
      if (!cart) return jsonResponse(404, { error: "Cart not found" });

      const qty = parseInt(quantity || "0");
      if (qty <= 0) {
        await supabase.from("CartItem").delete().eq("cartId", cart.id).eq("productId", productId);
      } else {
        const { data: existing } = await supabase.from("CartItem").select("id").eq("cartId", cart.id).eq("productId", productId).maybeSingle();
        if (existing) {
          await supabase.from("CartItem").update({ quantity: qty }).eq("id", existing.id);
        } else {
          await supabase.from("CartItem").insert({ id: randomUUID(), cartId: cart.id, productId, quantity: qty });
        }
      }
      return jsonResponse(200, { message: "Cart updated" });
    }

    // DELETE — remove item or clear cart
    if (event.httpMethod === "DELETE") {
      const params = event.queryStringParameters || {};
      const { data: cart } = await supabase.from("Cart").select("id").eq("userId", user.userId).maybeSingle();
      if (!cart) return jsonResponse(404, { error: "Cart not found" });

      if (params.productId) {
        await supabase.from("CartItem").delete().eq("cartId", cart.id).eq("productId", params.productId);
        return jsonResponse(200, { message: "Item removed from cart" });
      }
      await supabase.from("CartItem").delete().eq("cartId", cart.id);
      return jsonResponse(200, { message: "Cart cleared" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Cart error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
