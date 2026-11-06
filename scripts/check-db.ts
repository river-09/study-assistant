// Checks that the app can reach Postgres through Drizzle.
// Run with: npm run check:db
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  const result = await db.execute<{ version: string }>(sql`select version()`);
  console.log("Connected:", result.rows[0].version);
  await db.$client.end(); // close the pool so the script can exit
}

main().catch((err) => {
  console.error("Database check failed:", err?.message ?? err);
  process.exit(1);
});
