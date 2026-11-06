// Data access for uploaded documents. Like courses.ts, every function takes
// the signed-in user's id and filters by it.
import { and, desc, eq, sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getQueue, INGEST_QUEUE, type IngestJobData } from "./queue";
import { deleteFile, saveFile } from "./storage";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Every PDF file starts with these 4 bytes: "%PDF".
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];

export function isPdf(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

// Keep only the last part of the name (some browsers send a full path) and
// cap its length. It is only ever displayed, never used as a path.
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "";
  return (base || "document.pdf").slice(0, 200);
}

const publicColumns = {
  id: documents.id,
  filename: documents.filename,
  status: documents.status,
  pageCount: documents.pageCount,
  error: documents.error,
  createdAt: documents.createdAt,
};

export type DocumentStatus = (typeof documents.status.enumValues)[number];

export type DocumentInfo = {
  id: string;
  filename: string;
  status: DocumentStatus;
  pageCount: number | null;
  error: string | null;
  createdAt: Date;
};

export function listDocuments(userId: string, courseId: string): Promise<DocumentInfo[]> {
  return db
    .select(publicColumns)
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.courseId, courseId)))
    .orderBy(desc(documents.createdAt));
}

// One document with its storage location, only if it belongs to userId.
export async function getOwnedDocument(userId: string, documentId: string) {
  const [doc] = await db
    .select({
      id: documents.id,
      courseId: documents.courseId,
      filename: documents.filename,
      storageKey: documents.storageKey,
      status: documents.status,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  return doc ?? null;
}

// Saves the file first, then inserts the row and queues the ingest job in one
// transaction: either both exist or neither does, so a document can't get
// stuck at "uploaded" with no job to process it. If the transaction fails, the
// file is removed again.
// The caller must already have checked that the course belongs to userId.
export async function createDocument(input: {
  userId: string;
  courseId: string;
  filename: string;
  bytes: Uint8Array;
}): Promise<DocumentInfo> {
  const id = crypto.randomUUID();
  const storageKey = `${input.userId}/${id}.pdf`;
  const queue = await getQueue();

  await saveFile(storageKey, input.bytes);
  try {
    return await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documents)
        .values({
          id,
          userId: input.userId,
          courseId: input.courseId,
          filename: input.filename,
          storageKey,
        })
        .returning(publicColumns);
      const job: IngestJobData = { documentId: id };
      // { db: fromDrizzle(tx, sql) } makes pg-boss insert the job through our
      // transaction instead of its own connection.
      await queue.send(INGEST_QUEUE, job, { db: fromDrizzle(tx, sql) });
      return doc;
    });
  } catch (err) {
    await deleteFile(storageKey);
    throw err;
  }
}

// Deletes the row first (its chunks and quizzes go with it via CASCADE), then
// the file. If removing the file fails, the user still sees the document gone;
// a stray file on disk is harmless.
export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning({ storageKey: documents.storageKey });
  if (!deleted) return false;
  await deleteFile(deleted.storageKey);
  return true;
}
