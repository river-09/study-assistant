// Finds the chunks of a user's notes that are closest in meaning to a question.
import { and, cosineDistance, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { chunks, documents } from "@/db/schema";
import { embedQuery } from "./gemini";

export const TOP_K = 6;

// Cosine distance runs from 0 (same meaning) to 2 (opposite). Chunks further
// than this from the question are treated as not relevant. First calibration
// on real gemini-embedding-001 vectors (7 questions, 3-page lecture): the right
// page scored 0.28-0.31, other pages of the same lecture 0.39-0.46, off-topic
// questions 0.51+. A larger set of test questions would tune this properly.
export const MAX_DISTANCE = Number(process.env.RETRIEVAL_MAX_DISTANCE || 0.45);

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number;
  content: string;
  distance: number;
};

type SearchOptions = { limit?: number; maxDistance?: number };

// Embeds the question (one Gemini call), then searches.
export async function searchNotes(
  userId: string,
  courseId: string,
  question: string,
  options?: SearchOptions,
): Promise<RetrievedChunk[]> {
  const vector = await embedQuery(question);
  return findNearestChunks(userId, courseId, vector, options);
}

// The search itself, given an already-embedded question.
export async function findNearestChunks(
  userId: string,
  courseId: string,
  vector: number[],
  { limit = TOP_K, maxDistance = MAX_DISTANCE }: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const distance = cosineDistance(chunks.embedding, vector); // pgvector's <=> operator

  const nearest = await db.transaction(async (tx) => {
    // The HNSW index finds nearest neighbours first and filters by user and
    // course after. Without iterative scans, a filter that rejects most
    // candidates can leave fewer than `limit` rows. relaxed_order keeps
    // scanning until enough rows pass. SET LOCAL lasts only for this transaction.
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`);
    return tx
      .select({
        chunkId: chunks.id,
        documentId: chunks.documentId,
        pageNumber: chunks.pageNumber,
        content: chunks.content,
        distance,
      })
      .from(chunks)
      .where(and(eq(chunks.userId, userId), eq(chunks.courseId, courseId)))
      .orderBy(distance)
      .limit(limit);
  });

  // relaxed_order may return rows slightly out of order, so sort again here.
  const relevant = nearest
    .map((row) => ({ ...row, distance: Number(row.distance) }))
    .filter((row) => row.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
  if (relevant.length === 0) return [];

  // Filenames for at most `limit` documents, fetched separately so the main
  // query stays a simple filtered vector search on one table.
  const docIds = [...new Set(relevant.map((r) => r.documentId))];
  const docs = await db
    .select({ id: documents.id, filename: documents.filename })
    .from(documents)
    .where(inArray(documents.id, docIds));
  const filenameById = new Map(docs.map((d) => [d.id, d.filename]));

  return relevant.map((row) => ({ ...row, filename: filenameById.get(row.documentId) ?? "Unknown document" }));
}
