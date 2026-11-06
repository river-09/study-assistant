import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { uuidParam } from "@/lib/api";
import { listConversations } from "@/lib/conversations";
import { getCourse } from "@/lib/courses";
import { listDocuments, MAX_UPLOAD_BYTES } from "@/lib/documents";
import { listQuizzes } from "@/lib/quizzes";
import { requireUser } from "@/lib/session";
import { DocumentRow } from "./document-row";
import { StatusPoller } from "./status-poller";
import { UploadForm } from "./upload-form";

export default function CoursePage(props: PageProps<"/courses/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/courses" className="text-sm opacity-70 hover:underline">
        ← All courses
      </Link>
      <Suspense fallback={<p className="mt-4 opacity-60">Loading course…</p>}>
        <CourseDetails params={props.params} />
      </Suspense>
    </main>
  );
}

async function CourseDetails({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Not a uuid, not found, or someone else's course: all look the same.
  const course = uuidParam.safeParse(id).success ? await getCourse(user.id, id) : null;
  if (!course) notFound();

  const [docs, chats, quizList] = await Promise.all([
    listDocuments(user.id, course.id),
    listConversations(user.id, course.id),
    listQuizzes(user.id, course.id),
  ]);
  const inProgress = docs.some((d) => d.status === "uploaded" || d.status === "processing");
  const hasReadyDocs = docs.some((d) => d.status === "ready");

  return (
    <div className="mt-4 flex flex-col gap-6">
      <StatusPoller active={inProgress} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{course.name}</h1>
        {hasReadyDocs && (
          <Link
            href={`/courses/${course.id}/chat`}
            className="rounded-md bg-foreground px-4 py-2 text-background"
          >
            Ask a question
          </Link>
        )}
      </div>

      {chats.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Recent chats</h2>
          <ul className="flex flex-col gap-1">
            {chats.slice(0, 5).map((chat) => (
              <li key={chat.id}>
                <Link href={`/courses/${course.id}/chat/${chat.id}`} className="hover:underline">
                  {chat.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quizList.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Quizzes</h2>
          <ul className="flex flex-col gap-1">
            {quizList.slice(0, 5).map((quiz) => (
              <li key={quiz.id}>
                <Link href={`/quizzes/${quiz.id}`} className="hover:underline">
                  {quiz.filename}
                </Link>{" "}
                <span className="text-sm opacity-60">
                  {quiz.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="font-medium">Lecture notes</h2>
      <UploadForm courseId={course.id} maxBytes={MAX_UPLOAD_BYTES} />
      {docs.length === 0 ? (
        <p className="opacity-60">No documents yet. Upload your first lecture PDF above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 rounded-md border border-black/10 dark:divide-white/15 dark:border-white/15">
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </div>
  );
}
