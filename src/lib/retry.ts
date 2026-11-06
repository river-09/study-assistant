// Retry with exponential backoff, used for Gemini calls (see gemini.ts).

export type RetryOptions = {
  retries: number; // extra attempts after the first (retries: 3 = up to 4 calls)
  baseDelayMs: number; // wait before the 1st retry; doubles each time (base, 2x, 4x, ...)
  maxDelayMs: number; // never wait longer than this
  shouldRetry: (err: unknown) => boolean; // false = give up immediately (e.g. a 400 Bad Request)
  // If the error says how long to wait (Gemini's 429s do), return that in ms
  // and use it instead of the doubling delay. Return undefined for "no hint".
  delayFor?: (err: unknown) => number | undefined;
  // How to wait. Real code uses the default; tests pass a fake that returns
  // immediately and records the delays it was asked for.
  sleep?: (ms: number) => Promise<void>;
};

export const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn` and returns its result. If it throws:
 *  - shouldRetry(err) is false            -> rethrow that error right away
 *  - no retries left                      -> rethrow that (last) error
 *  - otherwise wait, then call fn again.
 * The wait before retry number n (1, 2, 3...) is baseDelayMs * 2^(n-1),
 * or delayFor(err) if that returns a number, capped at maxDelayMs in both cases.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? realSleep;

  // No end condition: every path out of the loop is a return or a throw.
  // `attempt` counts retries already used (0 on the first call).
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!options.shouldRetry(err)) throw err; // retrying won't help
      if (attempt >= options.retries) throw err; // out of retries

      // retry n waits base * 2^(n-1); attempt is n-1, so base * 2^attempt
      const backoff = options.baseDelayMs * 2 ** attempt;
      const wait = options.delayFor?.(err) ?? backoff; // the server's hint wins
      await sleep(Math.min(wait, options.maxDelayMs));
    }
  }
}
