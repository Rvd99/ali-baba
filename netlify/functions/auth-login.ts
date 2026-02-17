import type { Handler, HandlerEvent } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { getPrisma } from "./lib/prisma";
import { signToken, jsonResponse, corsPreflightResponse } from "./lib/auth";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return corsPreflightResponse();
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { email, password } = JSON.parse(event.body || "{}");

    if (!email || !password) {
      return jsonResponse(400, { error: "Email and password are required" });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return jsonResponse(401, { error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id, role: user.role });

    return jsonResponse(200, {
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
    console.error("Login error:", err);
    return jsonResponse(500, { error: "Internal server error" });
  }
};

export { handler };
