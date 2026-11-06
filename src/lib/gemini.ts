// Gemini embeddings. Everything that turns text into vectors goes through here.
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import { batch } from "./batch";
import { realSleep, withRetry, type RetryOptions } from "./retry";

// The Gemini API rejects more than 100 texts in one embedding request
// (confirmed against the API: "at most 100 requests can be in one batch").
export const EMBED_BATCH_SIZE = 100;

// Chunks we store vs. questions we search with. Gemini embeds the two
// differently so that a question lands near the passages that answer it.
type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Check .env.local.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function embedModel(): string {
  const model = process.env.GEMINI_EMBED_MODEL;
  if (!model) throw new Error("GEMINI_EMBED_MODEL is not set. Check .env.local.");
  return model;
}

// 429 (rate limited) and 5xx (Gemini having a bad moment) are worth retrying.
// Anything else from the API, like 400 Bad Request or 403 bad key, will fail
// the same way again. Errors that aren't ApiErrors are usually network blips.
export function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  return err instanceof TypeError; // fetch() throws TypeError when the network fails
}

// Gemini's 429 responses include how long to wait, e.g. "retryDelay":"37s".
export function retryAfterMs(err: unknown): number | undefined {
  if (!(err instanceof ApiError) || err.status !== 429) return undefined;
  const match = err.message.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}

// Short, in-process retries for brief rate-limit bursts. If these run out, the
// error reaches the worker and pg-boss retries the whole job later.
const RETRY: RetryOptions = {
  retries: 4,
  baseDelayMs: 2000,
  maxDelayMs: 60_000,
  shouldRetry: isRetryable,
  delayFor: retryAfterMs,
  sleep: realSleep,
};

// Exactly one vector per text, each with exactly EMBEDDING_DIMENSIONS numbers.
// Checked before anything is stored: a wrong count would pair vectors with the
// wrong chunks, and a wrong length would fail the insert.
function vectorsSchema(count: number) {
  return z.array(z.array(z.number()).length(EMBEDDING_DIMENSIONS)).length(count);
}

async function embedBatch(texts: string[], taskType: TaskType): Promise<number[][]> {
  const response = await withRetry(
    () =>
      getClient().models.embedContent({
        model: embedModel(),
        contents: texts,
        config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    RETRY,
  );
  const vectors = response.embeddings?.map((e) => e.values);
  return vectorsSchema(texts.length).parse(vectors);
}

// Embeds chunks for storage. Batches run one after another, not all at once,
// to stay gentle on the free tier's per-minute limits.
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const group of batch(texts, EMBED_BATCH_SIZE)) {
    vectors.push(...(await embedBatch(group, "RETRIEVAL_DOCUMENT")));
  }
  return vectors;
}

// Embeds a user's question for searching (see retrieval.ts).
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text], "RETRIEVAL_QUERY");
  return vector;
}
