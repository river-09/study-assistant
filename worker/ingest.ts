// What the worker does for one "ingest-document" job.
// The worker is trusted code, so unlike the API it looks documents up by id
// alone: the id came from our own upload route, not from a browser.
import { eq } from "drizzle-orm";
import type { JobWithMetadata } from "pg-boss";
import { db } from "../src/db";
import { chunks, documents } from "../src/db/schema";
import { chunkPages, cleanPageText, looksScanned } from "../src/lib/chunking";
import { isPdf } from "../src/lib/documents";
import { embedDocuments } from "../src/lib/gemini";
import { PermanentIngestError } from "../src/lib/ingest-errors";
import { extractPages } from "../src/lib/pdf";
import { ingestJobData } from "../src/lib/queue";
import { readFile } from "../src/lib/storage";

type DocumentStatus = (typeof documents.status.enumValues)[number];

async function setStatus(documentId: string, status: DocumentStatus, error: string | null = null) {
  await db.update(documents).set({ status, error }).where(eq(documents.id, documentId));
}

// Turns an error into a short message that is safe to show the user.
function userMessage(err: unknown): string {
  if (err instanceof Error && "code" in err && err.code === "ENOENT") {
    return "The uploaded file is missing. Please upload it again.";
  }
  const detail = err instanceof Error ? err.message : String(err);
  return `Processing failed: ${detail}`.slice(0, 500);
}

export async function handleIngestJob(job: JobWithMetadata<unknown>): Promise<void> {
  const parsed = ingestJobData.safeParse(job.data);
  if (!parsed.success) {
    // Retrying can't fix bad job data, so log it and let the job complete.
    console.error(`[ingest] job ${job.id} has invalid data`, job.data);
    return;
  }
  const { documentId } = parsed.data;

  const [doc] = await db
    .select({
      id: documents.id,
      storageKey: documents.storageKey,
      userId: documents.userId,
      courseId: documents.courseId,
    })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc) {
    // The user deleted the document before we got to it. Nothing to do.
    console.log(`[ingest] document ${documentId} no longer exists, skipping`);
    return;
  }

  const attempt = job.retryCount + 1;
  const attempts = job.retryLimit + 1;
  console.log(`[ingest] document ${documentId}: attempt ${attempt} of ${attempts}`);
  await setStatus(documentId, "processing");

  try {
    const bytes = await readFile(doc.storageKey);
    if (!isPdf(bytes)) throw new PermanentIngestError("The stored file is not a PDF.");

    const rawPages = await extractPages(bytes);
    await db.update(documents).set({ pageCount: rawPages.length }).where(eq(documents.id, documentId));

    const pages = rawPages.map((p) => ({ pageNumber: p.pageNumber, text: cleanPageText(p.text) }));
    if (looksScanned(pages)) {
      throw new PermanentIngestError(
        "This PDF looks scanned: it has almost no selectable text. Upload a PDF with real text (OCR isn't supported).",
      );
    }

    const pieces = chunkPages(pages);
    console.log(`[ingest] document ${documentId}: ${pieces.length} chunks from ${pages.length} pages`);

    // The slow part (network calls to Gemini) happens before the transaction,
    // so we never hold a transaction open while waiting on another service.
    const vectors = await embedDocuments(pieces.map((p) => p.content));

    // Delete-then-insert in one transaction, so a retry or re-run always ends
    // with exactly one set of chunks, and a crash halfway keeps the old set.
    // "ready" is set in the same transaction: a document is never ready
    // without its chunks.
    await db.transaction(async (tx) => {
      await tx.delete(chunks).where(eq(chunks.documentId, documentId));
      if (pieces.length > 0) {
        await tx.insert(chunks).values(
          pieces.map((p, i) => ({
            documentId,
            userId: doc.userId, // copied from the document, so retrieval
            courseId: doc.courseId, // can filter chunks without a join
            pageNumber: p.pageNumber,
            chunkIndex: p.chunkIndex,
            content: p.content,
            embedding: vectors[i],
          })),
        );
      }
      await tx.update(documents).set({ status: "ready", error: null }).where(eq(documents.id, documentId));
    });
    console.log(`[ingest] document ${documentId}: ready (${pieces.length} chunks stored)`);
  } catch (err) {
    if (err instanceof PermanentIngestError) {
      // Retrying can't help, so fail now and return normally: pg-boss marks the
      // job completed (it was handled), and no retries are spent.
      console.warn(`[ingest] document ${documentId}: ${err.message}`);
      await setStatus(documentId, "failed", err.message);
      return;
    }
    const isLastAttempt = job.retryCount >= job.retryLimit;
    console.error(
      `[ingest] document ${documentId}: attempt ${attempt} failed${isLastAttempt ? ", giving up" : ", will retry"}`,
      err,
    );
    // Only the final failure is shown to the user. Before that the document
    // stays "processing" while pg-boss waits to retry.
    if (isLastAttempt) await setStatus(documentId, "failed", userMessage(err));
    throw err; // tells pg-boss this attempt failed, so it retries or gives up
  }
}
