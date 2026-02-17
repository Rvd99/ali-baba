import type { Handler, HandlerEvent } from "@netlify/functions";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const prisma = getPrisma();
  const params = event.queryStringParameters || {};

  try {
    // GET — list categories or single category
    if (event.httpMethod === "GET") {
      if (params.id) {
        const category = await prisma.category.findUnique({
          where: { id: params.id },
          include: {
            children: true,
            parent: true,
            _count: { select: { products: true } },
          },
        });
        if (!category) return jsonResponse(404, { error: "Category not found" });
        return jsonResponse(200, category);
      }

      if (params.slug) {
        const category = await prisma.category.findUnique({
          where: { slug: params.slug },
          include: {
            children: true,
            parent: true,
            _count: { select: { products: true } },
          },
        });
        if (!category) return jsonResponse(404, { error: "Category not found" });
        return jsonResponse(200, category);
      }

      // List all — optionally filter top-level only
      const where: Record<string, unknown> = {};
      if (params.topLevel === "true") {
        where.parentId = null;
      }

      const categories = await prisma.category.findMany({
        where,
        include: {
          children: { include: { _count: { select: { products: true } } } },
          _count: { select: { products: true } },
        },
        orderBy: { name: "asc" },
      });

      return jsonResponse(200, categories);
    }

    // POST — create category (admin only)
    if (event.httpMethod === "POST") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user || user.role !== "ADMIN") {
        return jsonResponse(403, { error: "Admin access required" });
      }

      const { name, parentId, image } = JSON.parse(event.body || "{}");
      if (!name) return jsonResponse(400, { error: "Category name is required" });

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const category = await prisma.category.create({
        data: { name, slug, parentId: parentId || null, image: image || null },
      });

      return jsonResponse(201, category);
    }

    // PUT — update category (admin only)
    if (event.httpMethod === "PUT") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user || user.role !== "ADMIN") {
        return jsonResponse(403, { error: "Admin access required" });
      }

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Category id is required" });

      const { name, parentId, image } = JSON.parse(event.body || "{}");
      const data: Record<string, unknown> = {};
      if (name !== undefined) {
        data.name = name;
        data.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      if (parentId !== undefined) data.parentId = parentId || null;
      if (image !== undefined) data.image = image || null;

      const category = await prisma.category.update({ where: { id }, data });
      return jsonResponse(200, category);
    }

    // DELETE — delete category (admin only)
    if (event.httpMethod === "DELETE") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user || user.role !== "ADMIN") {
        return jsonResponse(403, { error: "Admin access required" });
      }

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Category id is required" });

      const childCount = await prisma.category.count({ where: { parentId: id } });
      if (childCount > 0) {
        return jsonResponse(400, { error: "Cannot delete category with subcategories. Remove children first." });
      }

      const productCount = await prisma.product.count({ where: { categoryId: id } });
      if (productCount > 0) {
        return jsonResponse(400, { error: "Cannot delete category with products. Reassign products first." });
      }

      await prisma.category.delete({ where: { id } });
      return jsonResponse(200, { message: "Category deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Categories error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
