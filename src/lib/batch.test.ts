import { describe, expect, it } from "vitest";
import { batch } from "./batch";

describe("batch", () => {
  it("splits into groups of the given size, last group smaller", () => {
    expect(batch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns an empty array for an empty input", () => {
    expect(batch([], 3)).toEqual([]);
  });

  it("returns one group when everything fits", () => {
    expect(batch(["a", "b"], 100)).toEqual([["a", "b"]]);
  });

  it("makes exactly-full groups when the length divides evenly", () => {
    expect(batch([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("puts each item in its own group for size 1", () => {
    expect(batch([1, 2], 1)).toEqual([[1], [2]]);
  });

  it("keeps the original order", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    expect(batch(items, 100).flat()).toEqual(items);
  });

  it("throws for a size of 0, a negative size, or a fraction like 1.5", () => {
    expect(() => batch([1, 2], 0)).toThrow();
    expect(() => batch([1, 2], -1)).toThrow();
    expect(() => batch([1, 2], 1.5)).toThrow();
  });
});
