import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { uuidParam } from "@/lib/api";
import { getQuiz } from "@/lib/quizzes";
import { requireUser } from "@/lib/session";
import { QuizView } from "./quiz-view";

export default function QuizPage(props: PageProps<"/quizzes/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Suspense fallback={<p className="opacity-60">Loading quiz…</p>}>
        <QuizLoader params={props.params} />
      </Suspense>
    </main>
  );
}

async function QuizLoader({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quiz = uuidParam.safeParse(id).success ? await getQuiz(user.id, id) : null;
  if (!quiz) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/courses/${quiz.courseId}`} className="text-sm opacity-70 hover:underline">
          ← Back to course
        </Link>
        <h1 className="text-2xl font-semibold">Quiz: {quiz.filename}</h1>
        <p className="text-sm opacity-60">{quiz.questions.length} questions</p>
      </div>
      <QuizView questions={quiz.questions} documentId={quiz.documentId} />
    </div>
  );
}
