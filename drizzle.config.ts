import "./env-config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Check .env.local.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle", // generated migration .sql files go here (committed to git)
  dbCredentials: { url },
  casing: "snake_case", // pageNumber in TypeScript -> page_number in Postgres
  strict: true, // ask for confirmation before running destructive changes
});
