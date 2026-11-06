// The job queue, shared by the web app (which adds jobs) and the worker (which
// runs them). pg-boss keeps its jobs in tables in our own Postgres database,
// in a separate schema called "pgboss", so there is no extra service to run.
import { PgBoss } from "pg-boss";
import { z } from "zod";

export const INGEST_QUEUE = "ingest-document";

// The only data an ingest job carries. The worker loads everything else
// (file location, owner, course) from the documents table.
export const ingestJobData = z.object({ documentId: z.uuid() });
export type IngestJobData = z.infer<typeof ingestJobData>;

// 3 retries after the first attempt, waiting roughly 10s, 20s, 40s between
// them (exponential backoff), never more than 5 minutes. A job that runs longer
// than 15 minutes counts as failed (the worker probably crashed) and is retried.
// Note: createQueue only applies these when the queue is first created.
const INGEST_QUEUE_OPTIONS = {
  retryLimit: 3,
  retryDelay: 10,
  retryBackoff: true,
  retryDelayMax: 300,
  expireInSeconds: 15 * 60,
};

type Role = "app" | "worker";

// One pg-boss instance per process. Like the db pool, it's kept on globalThis
// so Next.js hot reloads in development don't start a new one each time.
const globalForQueue = globalThis as unknown as { boss?: Promise<PgBoss> };

export function getQueue(role: Role = "app"): Promise<PgBoss> {
  globalForQueue.boss ??= startQueue(role);
  return globalForQueue.boss;
}

async function startQueue(role: Role): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Check .env.local.");

  const boss = new PgBoss({
    connectionString,
    // The app only adds jobs, so it needs few connections and none of the
    // background housekeeping. The worker does the housekeeping (expiring
    // stuck jobs, deleting old ones) for everyone.
    max: role === "app" ? 3 : 10,
    supervise: role === "worker",
    schedule: false, // we don't use cron-style scheduled jobs
  });
  // Without a listener, a lost database connection would crash the process.
  boss.on("error", (err) => console.error("[queue]", err));

  await boss.start(); // creates or upgrades the pgboss schema if needed
  await boss.createQueue(INGEST_QUEUE, INGEST_QUEUE_OPTIONS); // no-op if it exists
  return boss;
}
