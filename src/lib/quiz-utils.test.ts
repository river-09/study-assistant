import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "./quiz-schema";
import { pickSpread, scoreQuiz, shuffleOptions } from "./quiz-utils";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("pickSpread", () => {
  it("returns everything when there are fewer items than requested", () => {
    expect(pickSpread([1, 2, 3], 8)).toEqual([1, 2, 3]);
  });

  it("picks the middle of each equal slice", () => {
    expect(pickSpread(range(10), 3)).toEqual([1, 5, 8]);
    expect(pickSpread(range(80), 8)).toEqual([5, 15, 25, 35, 45, 55, 65, 75]);
  });

  it("covers both ends of a long document, in order, without repeats", () => {
    const picked = pickSpread(range(300), 8);
    expect(picked[0]).toBeLessThan(30);
    expect(picked[7]).toBeGreaterThan(270);
    expect(picked).toEqual([...picked].sort((a, b) => a - b));
    expect(new Set(picked).size).toBe(8);
  });
});

describe("shuffleOptions", () => {
  const q: QuizQuestion = {
    question: "Where is the Calvin cycle?",
    options: ["stroma", "matrix", "nucleus", "cytoplasm"],
    answerIndex: 0,
    explanation: "It happens in the stroma.",
    pageNumber: 2,
  };

  it("keeps answerIndex pointing at the same correct option", () => {
    for (let seed = 0; seed < 20; seed++) {
      let x = seed / 20;
      const random = () => (x = (x * 9301 + 0.49297) % 1); // small predictable sequence
      const shuffled = shuffleOptions(q, random);
      expect(shuffled.options[shuffled.answerIndex]).toBe("stroma");
      expect([...shuffled.options].sort()).toEqual([...q.options].sort());
    }
  });

  it("does not change the original question", () => {
    shuffleOptions(q, () => 0);
    expect(q.options).toEqual(["stroma", "matrix", "nucleus", "cytoplasm"]);
  });
});

describe("scoreQuiz", () => {
  const qs = [0, 2, 1].map((answerIndex) => ({ answerIndex }) as QuizQuestion);

  it("counts matching answers and treats unanswered as wrong", () => {
    expect(scoreQuiz(qs, [0, 2, 1])).toBe(3);
    expect(scoreQuiz(qs, [0, 1, null])).toBe(1);
  });
});
