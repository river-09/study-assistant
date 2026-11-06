"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";
import type { ChatUIMessage, Source } from "@/lib/chat-types";
import { splitCitations } from "@/lib/prompt";

type Props = {
  courseId: string;
  conversationId: string | null; // null for a brand-new chat
  initialMessages: ChatUIMessage[];
};

export function ChatView({ courseId, conversationId, initialMessages }: Props) {
  const [input, setInput] = useState("");
  const [openSource, setOpenSource] = useState<Source | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        // Send only the new question; the server loads the history itself.
        // `body` holds what submit() passes to sendMessage (the conversation id).
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return { body: { ...body, courseId, text } };
        },
      }),
    [courseId],
  );

  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    id: conversationId ?? undefined,
    messages: initialMessages,
    transport,
  });

  // A new chat learns its id from the first answer's metadata, so the id is
  // derived, not stored: the page's id if it had one, otherwise the learned one.
  const learnedId = [...messages].reverse().find((m) => m.metadata?.conversationId)?.metadata
    ?.conversationId;
  const chatId = conversationId ?? learnedId;

  // Put a newly learned id in the URL (without reloading), so refreshing or
  // sharing the page keeps the chat.
  useEffect(() => {
    if (!conversationId && learnedId) {
      window.history.replaceState(null, "", `/courses/${courseId}/chat/${learnedId}`);
    }
  }, [conversationId, learnedId, courseId]);

  const busy = status === "submitted" || status === "streaming";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    // The id is read here, in the event handler, and sent along with this message.
    sendMessage({ text }, { body: { conversationId: chatId } });
    setInput("");
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        {messages.length === 0 && (
          <p className="opacity-60">
            Ask anything about this course&apos;s notes. Answers cite the page they came from.
          </p>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onOpenSource={setOpenSource} />
        ))}

        {status === "submitted" && <p className="text-sm opacity-60">Searching your notes…</p>}
        {error && <p className="text-sm text-red-600">{readError(error)}</p>}

        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Where does the Calvin cycle happen?"
            maxLength={2000}
            className="flex-1 rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/25"
          />
          <button
            type="submit"
            disabled={busy || input.trim() === ""}
            className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
          >
            {busy ? "Answering…" : "Ask"}
          </button>
        </form>
      </section>

      <SourcePanel source={openSource} onClose={() => setOpenSource(null)} />
    </div>
  );
}

function MessageBubble({
  message,
  onOpenSource,
}: {
  message: ChatUIMessage;
  onOpenSource: (s: Source) => void;
}) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

  if (message.role === "user") {
    return (
      <div className="self-end rounded-lg bg-black/5 px-4 py-2 dark:bg-white/10">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  const sources = message.metadata?.sources ?? [];
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  return (
    <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      <p className="whitespace-pre-wrap leading-7">
        {splitCitations(text).map((piece, i) => {
          if (typeof piece === "string") return <span key={i}>{piece}</span>;
          const source = byNumber.get(piece);
          // A marker with no matching source (e.g. the model invented [9]) stays plain text.
          if (!source) return <span key={i}>[{piece}]</span>;
          return (
            <button
              key={i}
              onClick={() => onOpenSource(source)}
              title={`${source.filename}, page ${source.pageNumber}`}
              className="mx-0.5 rounded bg-blue-500/15 px-1.5 text-xs font-medium text-blue-700 hover:bg-blue-500/25 dark:text-blue-300"
            >
              {piece}
            </button>
          );
        })}
      </p>
    </div>
  );
}

function SourcePanel({ source, onClose }: { source: Source | null; onClose: () => void }) {
  if (!source) {
    return (
      <aside className="hidden w-80 shrink-0 text-sm opacity-50 lg:block">
        Click a citation number to see the passage it came from.
      </aside>
    );
  }
  return (
    <aside className="w-full shrink-0 rounded-lg border border-black/10 p-4 lg:w-80 dark:border-white/15">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            [{source.n}] {source.filename}
          </p>
          <p className="text-sm opacity-70">Page {source.pageNumber}</p>
        </div>
        <button onClick={onClose} className="text-sm opacity-60 hover:opacity-100" aria-label="Close source">
          ✕
        </button>
      </div>
      <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{source.content}</p>
      <a
        href={`/api/documents/${source.documentId}/file#page=${source.pageNumber}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-sm underline underline-offset-4"
      >
        Open the PDF at page {source.pageNumber} ↗
      </a>
    </aside>
  );
}

// Our API answers errors as JSON { error }; show that message if we can.
function readError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return error.message || "Something went wrong. Please try again.";
}
