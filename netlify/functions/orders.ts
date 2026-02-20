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
    // GET — list orders for buyer, or single order
    if (event.httpMethod === "GET") {
      if (params.id) {
        const { data: order } = await supabase
          .from("Order")
          .select("*, items:OrderItem(*, product:Product!productId(id,name,slug,images)), buyer:User!buyerId(id,name,email)")
          .eq("id", params.id)
          .maybeSingle();
        if (!order) return jsonResponse(404, { error: "Order not found" });
        if (order.buyerId !== user.userId && user.role !== "ADMIN") return jsonResponse(403, { error: "Access denied" });
        return jsonResponse(200, order);
      }

      const page = Math.max(1, parseInt(params.page || "1"));
      const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20")));
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("Order")
        .select("*, items:OrderItem(*, product:Product!productId(id,name,slug,images))", { count: "exact" })
        .order("createdAt", { ascending: false })
        .range(from, to);

      if (user.role === "BUYER") query = query.eq("buyerId", user.userId);
      if (params.status) query = query.eq("status", params.status);

      const { data: orders, count } = await query;
      return jsonResponse(200, { orders: orders || [], total: count || 0, page, limit });
    }

    // POST — create order from cart items
    if (event.httpMethod === "POST") {
      const { items, shippingAddress } = JSON.parse(event.body || "{}");
      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonResponse(400, { error: "Order items are required" });
      }

      const productIds = items.map((i: { productId: string }) => i.productId);
      const { data: products } = await supabase.from("Product").select("id, name, price, stock").in("id", productIds);
      const productMap = new Map((products || []).map((p: { id: string; name: string; price: number; stock: number }) => [p.id, p]));

      let orderTotal = 0;
      const orderItemsData: { productId: string; quantity: number; price: number }[] = [];

      for (const item of items) {
        const product = productMap.get(item.productId) as { id: string; name: string; price: number; stock: number } | undefined;
        if (!product) return jsonResponse(400, { error: `Product ${item.productId} not found` });
        if (product.stock < item.quantity) return jsonResponse(400, { error: `Insufficient stock for "${product.name}"` });
        orderItemsData.push({ productId: item.productId, quantity: item.quantity, price: product.price });
        orderTotal += product.price * item.quantity;
      }

      const { data: newOrder, error: orderError } = await supabase
        .from("Order")
        .insert({ id: randomUUID(), buyerId: user.userId, total: orderTotal, shippingAddress: shippingAddress || null })
        .select("id")
        .single();

      if (orderError || !newOrder) return jsonResponse(500, { error: "Failed to create order" });

      await supabase.from("OrderItem").insert(orderItemsData.map((i) => ({ id: randomUUID(), ...i, orderId: newOrder.id })));

      // Decrement stock
      for (const item of orderItemsData) {
        const product = productMap.get(item.productId) as { stock: number };
        await supabase.from("Product").update({ stock: product.stock - item.quantity }).eq("id", item.productId);
      }

      // Clear cart
      const { data: cart } = await supabase.from("Cart").select("id").eq("userId", user.userId).maybeSingle();
      if (cart) await supabase.from("CartItem").delete().eq("cartId", cart.id);

      const { data: order } = await supabase
        .from("Order")
        .select("*, items:OrderItem(*, product:Product!productId(id,name,images))")
        .eq("id", newOrder.id)
        .single();

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

      const { data: existing } = await supabase.from("Order").select("id").eq("id", id).maybeSingle();
      if (!existing) return jsonResponse(404, { error: "Order not found" });
      if (user.role === "BUYER" && status !== "CANCELLED") return jsonResponse(403, { error: "Buyers can only cancel orders" });

      const { data: order } = await supabase
        .from("Order")
        .update({ status })
        .eq("id", id)
        .select("*, items:OrderItem(*, product:Product!productId(id,name,images))")
        .single();

      return jsonResponse(200, order);
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Orders error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
