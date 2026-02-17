import type { Handler, HandlerEvent } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { getPrisma } from "./lib/prisma";
import { signToken, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { email, password, name, role, phone, company } = JSON.parse(event.body || "{}");

    if (!email || !password || !name) {
      return jsonResponse(400, { error: "Email, password, and name are required" });
    }

    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonResponse(409, { error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const validRoles = ["BUYER", "SELLER"];
    const userRole = validRoles.includes(role) ? role : "BUYER";

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
        phone: phone || null,
        company: company || null,
      },
    });

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
