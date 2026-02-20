import type { Handler, HandlerEvent } from "@netlify/functions";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const params = event.queryStringParameters || {};

  try {
    // GET — list products or get single product
    if (event.httpMethod === "GET") {
      if (params.id) {
        const { data: product } = await supabase
          .from("Product")
          .select("*, category:Category(*), seller:User!sellerId(id,name,company,avatar), reviews:Review(*, user:User!userId(id,name,avatar))")
          .eq("id", params.id)
          .maybeSingle();
        if (!product) return jsonResponse(404, { error: "Product not found" });
        return jsonResponse(200, product);
      }

      if (params.slug) {
        const { data: product } = await supabase
          .from("Product")
          .select("*, category:Category(*), seller:User!sellerId(id,name,company,avatar), reviews:Review(*, user:User!userId(id,name,avatar))")
          .eq("slug", params.slug)
          .maybeSingle();
        if (!product) return jsonResponse(404, { error: "Product not found" });
        return jsonResponse(200, product);
      }

      const page = Math.max(1, parseInt(params.page || "1"));
      const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20")));
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("Product")
        .select("*, category:Category(*), seller:User!sellerId(id,name,company)", { count: "exact" })
        .eq("published", true)
        .range(from, to);

      if (params.search) query = query.ilike("name", `%${params.search}%`);
      if (params.categoryId) query = query.eq("categoryId", params.categoryId);
      if (params.sellerId) query = query.eq("sellerId", params.sellerId);
      if (params.minPrice) query = query.gte("price", parseFloat(params.minPrice));
      if (params.maxPrice) query = query.lte("price", parseFloat(params.maxPrice));

      const sortMap: Record<string, { column: string; ascending: boolean }> = {
        price_asc: { column: "price", ascending: true },
        price_desc: { column: "price", ascending: false },
        newest: { column: "createdAt", ascending: false },
        name: { column: "name", ascending: true },
      };
      const sort = sortMap[params.sort || ""] || { column: "createdAt", ascending: false };
      query = query.order(sort.column, { ascending: sort.ascending });

      const { data: products, count } = await query;
      const total = count || 0;
      return jsonResponse(200, { products: products || [], total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    // POST — create product (seller only)
    if (event.httpMethod === "POST") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });
      if (user.role !== "SELLER" && user.role !== "ADMIN") {
        return jsonResponse(403, { error: "Only sellers can create products" });
      }

      const body = JSON.parse(event.body || "{}");
      const { name, description, price, images, stock, categoryId, minOrder, sku, tags, compareAt } = body;

      if (!name || !description || price == null || !categoryId) {
        return jsonResponse(400, { error: "name, description, price, and categoryId are required" });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

      const { data: product, error } = await supabase
        .from("Product")
        .insert({
          id: randomUUID(),
          name, slug, description,
          price: parseFloat(price),
          compareAt: compareAt ? parseFloat(compareAt) : null,
          images: images || [],
          stock: parseInt(stock || "0"),
          minOrder: parseInt(minOrder || "1"),
          sku: sku || null,
          tags: tags || [],
          sellerId: user.userId,
          categoryId,
        })
        .select("*, category:Category(*)")
        .single();

      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(201, product);
    }

    // PUT — update product (owner or admin)
    if (event.httpMethod === "PUT") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Product id is required" });

      const { data: existing } = await supabase.from("Product").select("sellerId").eq("id", id).maybeSingle();
      if (!existing) return jsonResponse(404, { error: "Product not found" });
      if (existing.sellerId !== user.userId && user.role !== "ADMIN") {
        return jsonResponse(403, { error: "You can only edit your own products" });
      }

      const body = JSON.parse(event.body || "{}");
      const { name, description, price, images, stock, categoryId, minOrder, sku, tags, compareAt, published } = body;

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (price !== undefined) data.price = parseFloat(price);
      if (compareAt !== undefined) data.compareAt = compareAt ? parseFloat(compareAt) : null;
      if (images !== undefined) data.images = images;
      if (stock !== undefined) data.stock = parseInt(stock);
      if (minOrder !== undefined) data.minOrder = parseInt(minOrder);
      if (sku !== undefined) data.sku = sku;
      if (tags !== undefined) data.tags = tags;
      if (categoryId !== undefined) data.categoryId = categoryId;
      if (published !== undefined) data.published = published;

      const { data: product, error } = await supabase
        .from("Product")
        .update(data)
        .eq("id", id)
        .select("*, category:Category(*)")
        .single();

      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(200, product);
    }

    // DELETE — delete product (owner or admin)
    if (event.httpMethod === "DELETE") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Product id is required" });

      const { data: existing } = await supabase.from("Product").select("sellerId").eq("id", id).maybeSingle();
      if (!existing) return jsonResponse(404, { error: "Product not found" });
      if (existing.sellerId !== user.userId && user.role !== "ADMIN") {
        return jsonResponse(403, { error: "You can only delete your own products" });
      }

      await supabase.from("Product").delete().eq("id", id);
      return jsonResponse(200, { message: "Product deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Products error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
