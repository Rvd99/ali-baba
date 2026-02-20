import type { Handler, HandlerEvent } from "@netlify/functions";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const params = event.queryStringParameters || {};

  try {
    // GET — list categories or single category
    if (event.httpMethod === "GET") {
      if (params.id) {
        const { data: category } = await supabase
          .from("Category")
          .select("*, children:Category!parentId(*), parent:Category!parentId(*)")
          .eq("id", params.id)
          .maybeSingle();
        if (!category) return jsonResponse(404, { error: "Category not found" });
        return jsonResponse(200, category);
      }

      if (params.slug) {
        const { data: category } = await supabase
          .from("Category")
          .select("*, children:Category!parentId(*), parent:Category!parentId(*)")
          .eq("slug", params.slug)
          .maybeSingle();
        if (!category) return jsonResponse(404, { error: "Category not found" });
        return jsonResponse(200, category);
      }

      let query = supabase.from("Category").select("*, children:Category!parentId(*)").order("name", { ascending: true });
      if (params.topLevel === "true") query = query.is("parentId", null);

      const { data: categories } = await query;
      return jsonResponse(200, categories || []);
    }

    // POST — create category (admin only)
    if (event.httpMethod === "POST") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user || user.role !== "ADMIN") return jsonResponse(403, { error: "Admin access required" });

      const { name, parentId, image } = JSON.parse(event.body || "{}");
      if (!name) return jsonResponse(400, { error: "Category name is required" });

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data: category, error } = await supabase
        .from("Category")
        .insert({ id: randomUUID(), name, slug, parentId: parentId || null, image: image || null })
        .select()
        .single();

      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(201, category);
    }

    // PUT — update category (admin only)
    if (event.httpMethod === "PUT") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user || user.role !== "ADMIN") return jsonResponse(403, { error: "Admin access required" });

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Category id is required" });

      const { name, parentId, image } = JSON.parse(event.body || "{}");
      const data: Record<string, unknown> = {};
      if (name !== undefined) { data.name = name; data.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
      if (parentId !== undefined) data.parentId = parentId || null;
      if (image !== undefined) data.image = image || null;

      const { data: category, error } = await supabase.from("Category").update(data).eq("id", id).select().single();
      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(200, category);
    }

    // DELETE — delete category (admin only)
    if (event.httpMethod === "DELETE") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user || user.role !== "ADMIN") return jsonResponse(403, { error: "Admin access required" });

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Category id is required" });

      const { count: childCount } = await supabase.from("Category").select("*", { count: "exact", head: true }).eq("parentId", id);
      if (childCount && childCount > 0) return jsonResponse(400, { error: "Cannot delete category with subcategories." });

      const { count: productCount } = await supabase.from("Product").select("*", { count: "exact", head: true }).eq("categoryId", id);
      if (productCount && productCount > 0) return jsonResponse(400, { error: "Cannot delete category with products." });

      await supabase.from("Category").delete().eq("id", id);
      return jsonResponse(200, { message: "Category deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Categories error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
