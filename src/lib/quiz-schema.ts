// The shape of a quiz, as zod schemas. No server imports, so the quiz UI and
// the database schema can use these types too.
import { z } from "zod";

export const MAX_QUESTIONS = 8;

// What we ask the model to return. The AI SDK sends this schema to Gemini and
// validates the reply against it, so a malformed quiz never reaches the database.
export const generatedQuestion = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3).describe("index of the correct option, 0-3"),
  explanation: z.string().min(1).describe("one or two sentences on why the answer is right"),
  sourceNumber: z.number().int().min(1).describe("the [n] of the source this question is based on"),
});

export const generatedQuiz = z.object({
  questions: z.array(generatedQuestion).min(1).max(MAX_QUESTIONS),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestion>;

// What we store: the source number is swapped for the page it points to,
// since source numbers only mean something inside one prompt.
export type QuizQuestion = Omit<GeneratedQuestion, "sourceNumber"> & { pageNumber: number };
