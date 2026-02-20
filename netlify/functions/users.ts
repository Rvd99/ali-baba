import type { Handler, HandlerEvent } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { getUserFromHeader, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();

  const authUser = getUserFromHeader(event.headers.authorization);
  if (!authUser) return jsonResponse(401, { error: "Authentication required" });

  const params = event.queryStringParameters || {};

  try {
    // GET — get own profile or user by id
    if (event.httpMethod === "GET") {
      const userId = params.id || authUser.userId;
      const isSelf = userId === authUser.userId;

      const selectFields = isSelf
        ? "id, email, name, role, phone, avatar, bio, company, createdAt, addresses:Address(*)"
        : "id, name, role, avatar, bio, company, createdAt";

      const { data: user } = await supabase.from("User").select(selectFields).eq("id", userId).maybeSingle();
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

      if (newPassword) {
        if (!currentPassword) return jsonResponse(400, { error: "Current password is required" });
        const { data: existing } = await supabase.from("User").select("password").eq("id", authUser.userId).single();
        if (!existing || !(await bcrypt.compare(currentPassword, existing.password))) {
          return jsonResponse(401, { error: "Current password is incorrect" });
        }
        data.password = await bcrypt.hash(newPassword, 12);
      }

      const { data: user, error } = await supabase
        .from("User")
        .update(data)
        .eq("id", authUser.userId)
        .select("id, email, name, role, phone, avatar, bio, company")
        .single();

      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(200, user);
    }

    // POST — add/delete address
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      if (body.action === "add-address") {
        const { label, street, city, state, postalCode, country, isDefault } = body;
        if (!street || !city || !state || !postalCode || !country) {
          return jsonResponse(400, { error: "street, city, state, postalCode, and country are required" });
        }
        if (isDefault) {
          await supabase.from("Address").update({ isDefault: false }).eq("userId", authUser.userId);
        }
        const { data: address, error } = await supabase
          .from("Address")
          .insert({ id: randomUUID(), userId: authUser.userId, label: label || "Home", street, city, state, postalCode, country, isDefault: isDefault || false })
          .select().single();
        if (error) return jsonResponse(500, { error: error.message });
        return jsonResponse(201, address);
      }

      if (body.action === "delete-address") {
        const { addressId } = body;
        if (!addressId) return jsonResponse(400, { error: "addressId is required" });
        const { data: address } = await supabase.from("Address").select("userId").eq("id", addressId).maybeSingle();
        if (!address || address.userId !== authUser.userId) return jsonResponse(404, { error: "Address not found" });
        await supabase.from("Address").delete().eq("id", addressId);
        return jsonResponse(200, { message: "Address deleted" });
      }

      return jsonResponse(400, { error: "Unknown action." });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Users error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
