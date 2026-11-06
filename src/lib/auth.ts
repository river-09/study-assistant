// Better Auth server config: where users and sessions are stored, and which
// login providers are enabled. BETTER_AUTH_SECRET and BETTER_AUTH_URL are read
// from the environment by Better Auth itself.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  advanced: {
    database: { generateId: "uuid" }, // same id type as our own tables
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
});
