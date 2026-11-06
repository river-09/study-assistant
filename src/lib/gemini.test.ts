// The Gemini SDK is mocked, so these tests make no API calls and run offline.
import { ApiError } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { embedDocuments, embedQuery, isRetryable, retryAfterMs } from "./gemini";

// vi.mock runs before the imports above, so the fake has to be created with
// vi.hoisted (which also runs first). embedContent is the fake API method.
const { embedContent } = vi.hoisted(() => ({ embedContent: vi.fn() }));

vi.mock("@google/genai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@google/genai")>();
  // Keep everything real (like ApiError) except the client, whose
  // models.embedContent becomes our fake.
  return { ...real, GoogleGenAI: class { models = { embedContent } } };
});

// A fake vector whose numbers are all `n`, so we can tell vectors apart.
const vector = (n: number, length = 768) => new Array(length).fill(n);

// Makes the fake answer like Gemini: one vector per text, numbered by the
// text itself ("t7" -> all 7s), so we can check the order survives batching.
function answerLikeGemini() {
  embedContent.mockImplementation(async ({ contents }: { contents: string[] }) => ({
    embeddings: contents.map((t) => ({ values: vector(Number(t.slice(1))) })),
  }));
}

beforeEach(() => {
  embedContent.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_EMBED_MODEL = "test-embed-model";
});

describe("embedDocuments", () => {
  it("sends at most 100 texts per request and keeps the order", async () => {
    answerLikeGemini();
    const texts = Array.from({ length: 250 }, (_, i) => `t${i}`);

    const vectors = await embedDocuments(texts);

    expect(embedContent).toHaveBeenCalledTimes(3);
    expect(embedContent.mock.calls.map(([req]) => req.contents.length)).toEqual([100, 100, 50]);
    expect(vectors).toHaveLength(250);
    expect(vectors.map((v) => v[0])).toEqual(texts.map((_, i) => i));
  });

  it("asks for document embeddings at 768 dimensions with the configured model", async () => {
    answerLikeGemini();
    await embedDocuments(["t1"]);

    const [request] = embedContent.mock.calls[0];
    expect(request.model).toBe("test-embed-model");
    expect(request.config).toEqual({ taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 });
  });

  it("rejects vectors with the wrong number of dimensions", async () => {
    embedContent.mockResolvedValue({ embeddings: [{ values: vector(1, 767) }] });
    await expect(embedDocuments(["t1"])).rejects.toThrow();
  });

  it("rejects a response with fewer vectors than texts", async () => {
    embedContent.mockResolvedValue({ embeddings: [{ values: vector(1) }] });
    await expect(embedDocuments(["t1", "t2"])).rejects.toThrow();
  });

  it("makes no request for an empty list", async () => {
    await expect(embedDocuments([])).resolves.toEqual([]);
    expect(embedContent).not.toHaveBeenCalled();
  });
});

describe("embedQuery", () => {
  it("asks for a query embedding and returns one vector", async () => {
    answerLikeGemini();
    const v = await embedQuery("t5");

    expect(v).toEqual(vector(5));
    expect(embedContent.mock.calls[0][0].config.taskType).toBe("RETRIEVAL_QUERY");
  });
});

describe("isRetryable", () => {
  it("retries rate limits, server errors and network failures only", () => {
    expect(isRetryable(new ApiError({ message: "slow down", status: 429 }))).toBe(true);
    expect(isRetryable(new ApiError({ message: "unavailable", status: 503 }))).toBe(true);
    expect(isRetryable(new ApiError({ message: "bad request", status: 400 }))).toBe(false);
    expect(isRetryable(new ApiError({ message: "bad key", status: 403 }))).toBe(false);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(new Error("something else"))).toBe(false);
  });
});

describe("retryAfterMs", () => {
  it("reads Gemini's retryDelay hint from a 429", () => {
    const err = new ApiError({ message: '{"error":{"details":[{"retryDelay":"37s"}]}}', status: 429 });
    expect(retryAfterMs(err)).toBe(37_000);
  });

  it("returns undefined when there is no hint or it isn't a 429", () => {
    expect(retryAfterMs(new ApiError({ message: "no hint here", status: 429 }))).toBeUndefined();
    expect(retryAfterMs(new ApiError({ message: '"retryDelay":"5s"', status: 500 }))).toBeUndefined();
  });
});
