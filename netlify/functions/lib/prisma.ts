import { PrismaClient } from "../../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    // Ensure Supabase pooler params are present for serverless environments
    const url = new URL(connectionString);
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    const adapter = new PrismaPg({ connectionString: url.toString() });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
