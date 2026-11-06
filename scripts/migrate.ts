// Applies any pending migrations in drizzle/. Used on deploy (start:prod),
// where drizzle-kit (a dev tool) may not be installed. Safe to run every time:
// already-applied migrations are skipped.
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("[migrate] database is up to date");
  await db.$client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
