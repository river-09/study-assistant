// Loads .env.local (and the other .env* files) using the same rules as Next.js.
// Next.js does this automatically for the app; tools that run outside Next.js
// (like drizzle-kit) import this file first.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
