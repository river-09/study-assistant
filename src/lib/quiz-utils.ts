// Pure helpers for quizzes, unit tested in quiz-utils.test.ts.
import type { QuizQuestion } from "./quiz-schema";

// Picks `count` items spread evenly across the list (the middle of each equal
// slice), so a quiz covers the whole lecture, not just its first pages.
//   pickSpread([0..9], 3) -> [1, 5, 8]
export function pickSpread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, i) => items[Math.floor(((i + 0.5) * items.length) / count)]);
}

// Models tend to put the right answer first. Shuffling the options (and
// moving answerIndex with the correct one) removes that pattern.
// `random` is a parameter so tests can make the shuffle predictable.
export function shuffleOptions(q: QuizQuestion, random: () => number = Math.random): QuizQuestion {
  const order = q.options.map((_, i) => i);
  // Fisher-Yates: walk backwards, swapping each position with a random earlier one.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answerIndex: order.indexOf(q.answerIndex),
  };
}

export function scoreQuiz(questions: QuizQuestion[], answers: (number | null)[]): number {
  return questions.filter((q, i) => answers[i] === q.answerIndex).length;
}
