import type { Handler, HandlerEvent } from "@netlify/functions";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const prisma = getPrisma();
  const params = event.queryStringParameters || {};

  try {
    // GET — list products or get single product
    if (event.httpMethod === "GET") {
      // Single product by id or slug
      if (params.id) {
        const product = await prisma.product.findUnique({
          where: { id: params.id },
          include: { category: true, seller: { select: { id: true, name: true, company: true, avatar: true } }, reviews: { include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: "desc" } } },
        });
        if (!product) return jsonResponse(404, { error: "Product not found" });
        return jsonResponse(200, product);
      }

      if (params.slug) {
        const product = await prisma.product.findUnique({
          where: { slug: params.slug },
          include: { category: true, seller: { select: { id: true, name: true, company: true, avatar: true } }, reviews: { include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: "desc" } } },
        });
        if (!product) return jsonResponse(404, { error: "Product not found" });
        return jsonResponse(200, product);
      }

      // List with filters
      const page = Math.max(1, parseInt(params.page || "1"));
      const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20")));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { published: true };

      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { description: { contains: params.search, mode: "insensitive" } },
          { tags: { has: params.search.toLowerCase() } },
        ];
      }
      if (params.category) {
        where.category = { slug: params.category };
      }
      if (params.categoryId) {
        where.categoryId = params.categoryId;
      }
      if (params.sellerId) {
        where.sellerId = params.sellerId;
      }
      if (params.minPrice || params.maxPrice) {
        where.price = {};
        if (params.minPrice) (where.price as Record<string, number>).gte = parseFloat(params.minPrice);
        if (params.maxPrice) (where.price as Record<string, number>).lte = parseFloat(params.maxPrice);
      }

      const orderMap: Record<string, Record<string, string>> = {
        price_asc: { price: "asc" },
        price_desc: { price: "desc" },
        newest: { createdAt: "desc" },
        name: { name: "asc" },
      };
      const orderBy = orderMap[params.sort || ""] || { createdAt: "desc" };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: { category: true, seller: { select: { id: true, name: true, company: true } } },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      return jsonResponse(200, { products, total, page, limit, totalPages: Math.ceil(total / limit) });
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

      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description,
          price: parseFloat(price),
          compareAt: compareAt ? parseFloat(compareAt) : null,
          images: images || [],
          stock: parseInt(stock || "0"),
          minOrder: parseInt(minOrder || "1"),
          sku: sku || null,
          tags: tags || [],
          sellerId: user.userId,
          categoryId,
        },
        include: { category: true },
      });

      return jsonResponse(201, product);
    }

    // PUT — update product (owner or admin)
    if (event.httpMethod === "PUT") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Product id is required" });

      const existing = await prisma.product.findUnique({ where: { id } });
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

      const product = await prisma.product.update({
        where: { id },
        data,
        include: { category: true },
      });

      return jsonResponse(200, product);
    }

    // DELETE — delete product (owner or admin)
    if (event.httpMethod === "DELETE") {
      const user = getUserFromHeader(event.headers.authorization);
      if (!user) return jsonResponse(401, { error: "Authentication required" });

      const id = params.id;
      if (!id) return jsonResponse(400, { error: "Product id is required" });

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) return jsonResponse(404, { error: "Product not found" });
      if (existing.sellerId !== user.userId && user.role !== "ADMIN") {
        return jsonResponse(403, { error: "You can only delete your own products" });
      }

      await prisma.product.delete({ where: { id } });
      return jsonResponse(200, { message: "Product deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Products error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
