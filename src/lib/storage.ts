// File storage. Everything that saves, reads or deletes an uploaded file goes
// through these three functions, so changing where files live (e.g. to S3 or
// R2) means rewriting only this file.
//
// Files are stored in Postgres (the `files` table). With a 5 MB upload cap
// that's simple and cheap, and it works on hosts whose disk is wiped on restart.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";

// Storage keys are always "<userId>/<documentId>.pdf", built from ids by our own
// code. Rejecting anything else guards against a bug passing user input through.
const KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/;

function checkKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
}

// Fails if the key already exists (primary key), so a bug can never overwrite a file.
export async function saveFile(key: string, bytes: Uint8Array): Promise<void> {
  checkKey(key);
  await db.insert(files).values({ key, data: Buffer.from(bytes) });
}

// Throws an error with code "ENOENT" when the file is missing, like Node's fs,
// so callers (the worker's error messages) can tell "missing" from other failures.
export async function readFile(key: string): Promise<Buffer> {
  checkKey(key);
  const [row] = await db.select({ data: files.data }).from(files).where(eq(files.key, key));
  if (!row) throw Object.assign(new Error(`File not found: ${key}`), { code: "ENOENT" });
  return row.data;
}

// Deleting a file that is already gone is not an error.
export async function deleteFile(key: string): Promise<void> {
  checkKey(key);
  await db.delete(files).where(eq(files.key, key));
}
