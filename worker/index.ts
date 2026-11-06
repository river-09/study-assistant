// The background worker: a separate Node process from the website.
// Run it next to `npm run dev` with: npm run worker
import { db } from "../src/db";
import { getQueue, INGEST_QUEUE } from "../src/lib/queue";
import { handleIngestJob } from "./ingest";

async function main() {
  const queue = await getQueue("worker");

  // pg-boss checks the queue every 2 seconds and hands us one job at a time.
  // includeMetadata adds retryCount/retryLimit so the handler can tell when
  // it's on its last attempt.
  await queue.work(INGEST_QUEUE, { includeMetadata: true }, async ([job]) => {
    await handleIngestJob(job);
  });
  console.log(`[worker] waiting for "${INGEST_QUEUE}" jobs`);

  // Ctrl+C (SIGINT) or a host stopping the process (SIGTERM): let the job in
  // progress finish (up to 30s) before closing, instead of dying halfway.
  let stopping = false;
  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal} received, finishing current job…`);
    await queue.stop({ graceful: true, timeout: 30_000 });
    await db.$client.end();
    process.exit(0);
  }
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] failed to start:", err);
  process.exit(1);
});
