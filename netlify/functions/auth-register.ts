import type { Handler, HandlerEvent } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";
import { signToken, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { email, password, name, role, phone, company } = JSON.parse(event.body || "{}");

    if (!email || !password || !name) {
      return jsonResponse(400, { error: "Email, password, and name are required" });
    }

    if (password.length < 6) {
      return jsonResponse(400, { error: "Password must be at least 6 characters" });
    }

    const { data: existing } = await supabase
      .from("User")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return jsonResponse(409, { error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const validRoles = ["BUYER", "SELLER"];
    const userRole = validRoles.includes(role) ? role : "BUYER";

    const now = new Date().toISOString();
    const { data: user, error } = await supabase
      .from("User")
      .insert({
        id: randomUUID(),
        email,
        password: hashedPassword,
        name,
        role: userRole,
        phone: phone || null,
        company: company || null,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error || !user) {
      console.error("Insert error:", error);
      return jsonResponse(500, { error: "Failed to create account" });
    }

    const token = signToken({ userId: user.id, role: user.role });

    return jsonResponse(201, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        company: user.company,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
