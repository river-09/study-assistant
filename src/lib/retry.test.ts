// setup() passes a fake sleep that records each requested delay instead of
// waiting, so retry tests run instantly and can assert the exact backoff.
import { describe, expect, it, vi } from "vitest";
import { withRetry, type RetryOptions } from "./retry";

function setup(overrides: Partial<RetryOptions> = {}) {
  const delays: number[] = [];
  const options: RetryOptions = {
    retries: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    shouldRetry: () => true,
    sleep: async (ms) => {
      delays.push(ms);
    },
    ...overrides,
  };
  return { delays, options };
}

describe("withRetry", () => {
  it("returns the result without waiting when the first call succeeds", async () => {
    const { delays, options } = setup();
    const fn = vi.fn().mockResolvedValueOnce("ok");

    await expect(withRetry(fn, options)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("retries after a failure and returns the later success", async () => {
    const { delays, options } = setup();
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");

    await expect(withRetry(fn, options)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([100]);
  });

  it("doubles the wait each time: 100, 200, 400", async () => {
    const { delays, options } = setup();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockResolvedValueOnce("ok");

    await withRetry(fn, options);
    expect(delays).toEqual([100, 200, 400]);
  });

  it("never waits longer than maxDelayMs", async () => {
    const { delays, options } = setup({ retries: 5, maxDelayMs: 300 });
    const fn = vi.fn().mockRejectedValue(new Error("always"));

    await expect(withRetry(fn, options)).rejects.toThrow();
    expect(delays).toEqual([100, 200, 300, 300, 300]);
  });

  it("gives up after `retries` retries and throws the last error", async () => {
    const { options } = setup({ retries: 2 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));

    await expect(withRetry(fn, options)).rejects.toThrow("fail 3");
    expect(fn).toHaveBeenCalledTimes(3); // first try + 2 retries
  });

  it("does not retry when shouldRetry returns false", async () => {
    const { delays, options } = setup({ shouldRetry: () => false });
    const fn = vi.fn().mockRejectedValue(new Error("bad request"));

    await expect(withRetry(fn, options)).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("uses delayFor's hint instead of the doubling delay when it returns a number", async () => {
    const { delays, options } = setup({ delayFor: () => 750 });
    const fn = vi.fn().mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce("ok");

    await withRetry(fn, options);
    expect(delays).toEqual([750]);
  });

  it("falls back to the doubling delay when delayFor has no hint", async () => {
    const { delays, options } = setup({ delayFor: () => undefined });
    const fn = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce("ok");

    await withRetry(fn, options);
    expect(delays).toEqual([100]);
  });
});
