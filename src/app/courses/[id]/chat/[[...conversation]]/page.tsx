import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { uuidParam } from "@/lib/api";
import { getConversation, loadChatMessages } from "@/lib/conversations";
import { getCourse } from "@/lib/courses";
import { requireUser } from "@/lib/session";

// [[...conversation]] is an optional catch-all route:
//   /courses/<id>/chat          -> a new chat
//   /courses/<id>/chat/<convId> -> an existing chat
export default function ChatPage(props: PageProps<"/courses/[id]/chat/[[...conversation]]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Suspense fallback={<p className="opacity-60">Loading chat…</p>}>
        <ChatLoader params={props.params} />
      </Suspense>
    </main>
  );
}

async function ChatLoader({ params }: { params: Promise<{ id: string; conversation?: string[] }> }) {
  const user = await requireUser();
  const { id: courseId, conversation } = await params;
  if (!uuidParam.safeParse(courseId).success) notFound();
  const course = await getCourse(user.id, courseId);
  if (!course) notFound();

  let conversationId: string | null = null;
  let title = "New chat";
  if (conversation) {
    const [convId, ...rest] = conversation;
    if (rest.length > 0 || !uuidParam.safeParse(convId).success) notFound();
    const found = await getConversation(user.id, courseId, convId);
    if (!found) notFound();
    conversationId = found.id;
    title = found.title;
  }
  const initialMessages = conversationId ? await loadChatMessages(conversationId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href={`/courses/${courseId}`} className="text-sm opacity-70 hover:underline">
            ← {course.name}
          </Link>
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        {conversationId && (
          <Link href={`/courses/${courseId}/chat`} className="text-sm underline underline-offset-4">
            New chat
          </Link>
        )}
      </div>
      {/* key: switching chats remounts the view, resetting its state */}
      <ChatView
        key={conversationId ?? "new"}
        courseId={courseId}
        conversationId={conversationId}
        initialMessages={initialMessages}
      />
    </div>
  );
}
