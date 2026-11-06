"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/quiz-schema";
import { scoreQuiz } from "@/lib/quiz-utils";

export function QuizView({ questions, documentId }: { questions: QuizQuestion[]; documentId: string }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const allAnswered = answers.every((a) => a !== null);

  function choose(questionIndex: number, optionIndex: number) {
    if (submitted) return;
    setAnswers((prev) => prev.map((a, i) => (i === questionIndex ? optionIndex : a)));
  }

  function retry() {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {submitted && (
        <p className="rounded-md bg-black/5 px-4 py-3 text-lg font-medium dark:bg-white/10">
          You scored {scoreQuiz(questions, answers)} / {questions.length}
        </p>
      )}

      <ol className="flex flex-col gap-6">
        {questions.map((q, qi) => (
          <li key={qi} className="flex flex-col gap-2">
            <p className="font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="flex flex-col gap-1.5">
              {q.options.map((option, oi) => {
                const chosen = answers[qi] === oi;
                const correct = oi === q.answerIndex;
                // Before submitting, only show the choice. After, show right and wrong.
                const style = !submitted
                  ? chosen
                    ? "border-foreground"
                    : "border-black/15 dark:border-white/20"
                  : correct
                    ? "border-green-600 bg-green-500/10"
                    : chosen
                      ? "border-red-600 bg-red-500/10"
                      : "border-black/15 opacity-60 dark:border-white/20";
                return (
                  <button
                    key={oi}
                    onClick={() => choose(qi, oi)}
                    disabled={submitted}
                    className={`rounded-md border px-3 py-2 text-left ${style}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className="text-sm opacity-80">
                {q.explanation}{" "}
                <a
                  href={`/api/documents/${documentId}/file#page=${q.pageNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Page {q.pageNumber} ↗
                </a>
              </p>
            )}
          </li>
        ))}
      </ol>

      {submitted ? (
        <button onClick={retry} className="self-start rounded-md border px-4 py-2">
          Try again
        </button>
      ) : (
        <button
          onClick={() => setSubmitted(true)}
          disabled={!allAnswered}
          className="self-start rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {allAnswered ? "Check answers" : `Answer all ${questions.length} questions`}
        </button>
      )}
    </div>
  );
}
