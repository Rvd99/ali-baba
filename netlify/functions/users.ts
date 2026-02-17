import type { Handler, HandlerEvent } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { getPrisma } from "./lib/prisma";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const authUser = getUserFromHeader(event.headers.authorization);
  if (!authUser) return jsonResponse(401, { error: "Authentication required" });

  const prisma = getPrisma();
  const params = event.queryStringParameters || {};

  try {
    // GET — get own profile or user by id (public info)
    if (event.httpMethod === "GET") {
      const userId = params.id || authUser.userId;
      const isSelf = userId === authUser.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: isSelf,
          name: true,
          role: true,
          phone: isSelf,
          avatar: true,
          bio: true,
          company: true,
          createdAt: true,
          addresses: isSelf,
          _count: { select: { products: true, reviews: true } },
        },
      });

      if (!user) return jsonResponse(404, { error: "User not found" });
      return jsonResponse(200, user);
    }

    // PUT — update own profile
    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { name, phone, avatar, bio, company, currentPassword, newPassword } = body;

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (phone !== undefined) data.phone = phone || null;
      if (avatar !== undefined) data.avatar = avatar || null;
      if (bio !== undefined) data.bio = bio || null;
      if (company !== undefined) data.company = company || null;

      // Password change
      if (newPassword) {
        if (!currentPassword) {
          return jsonResponse(400, { error: "Current password is required to set a new password" });
        }
        const existing = await prisma.user.findUnique({ where: { id: authUser.userId } });
        if (!existing || !(await bcrypt.compare(currentPassword, existing.password))) {
          return jsonResponse(401, { error: "Current password is incorrect" });
        }
        data.password = await bcrypt.hash(newPassword, 12);
      }

      const user = await prisma.user.update({
        where: { id: authUser.userId },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          avatar: true,
          bio: true,
          company: true,
        },
      });

      return jsonResponse(200, user);
    }

    // POST — add address
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      if (body.action === "add-address") {
        const { label, street, city, state, postalCode, country, isDefault } = body;
        if (!street || !city || !state || !postalCode || !country) {
          return jsonResponse(400, { error: "street, city, state, postalCode, and country are required" });
        }

        // If this is the default, unset other defaults
        if (isDefault) {
          await prisma.address.updateMany({
            where: { userId: authUser.userId },
            data: { isDefault: false },
          });
        }

        const address = await prisma.address.create({
          data: {
            userId: authUser.userId,
            label: label || "Home",
            street,
            city,
            state,
            postalCode,
            country,
            isDefault: isDefault || false,
          },
        });

        return jsonResponse(201, address);
      }

      if (body.action === "delete-address") {
        const { addressId } = body;
        if (!addressId) return jsonResponse(400, { error: "addressId is required" });

        const address = await prisma.address.findUnique({ where: { id: addressId } });
        if (!address || address.userId !== authUser.userId) {
          return jsonResponse(404, { error: "Address not found" });
        }

        await prisma.address.delete({ where: { id: addressId } });
        return jsonResponse(200, { message: "Address deleted" });
      }

      return jsonResponse(400, { error: "Unknown action. Use 'add-address' or 'delete-address'." });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Users error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
