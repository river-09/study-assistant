// POST /api/chat: answer a question from the user's notes, streamed.
// Body: { courseId, conversationId?, text }. The browser sends only the new
// question; earlier turns are loaded from the database, so a client can't
// rewrite the history the model sees.
import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { z } from "zod";
import { errorResponse, notFound, parseJson, unauthorized } from "@/lib/api";
import type { ChatUIMessage, Source } from "@/lib/chat-types";
import {
  createConversation,
  getConversation,
  recentTurns,
  saveMessage,
} from "@/lib/conversations";
import { getCourse } from "@/lib/courses";
import { chatModel } from "@/lib/llm";
import { buildUserPrompt, citedNumbers, NOT_IN_NOTES, SYSTEM_PROMPT } from "@/lib/prompt";
import { searchNotes } from "@/lib/retrieval";
import { getCurrentUser } from "@/lib/session";

const chatInput = z.object({
  courseId: z.uuid(),
  conversationId: z.uuid().optional(),
  text: z.string().trim().min(1, "Ask a question").max(2000, "Question is too long"),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = await parseJson(request, chatInput);
  if ("response" in parsed) return parsed.response;
  const { courseId, text } = parsed.data;

  if (!(await getCourse(user.id, courseId))) return notFound();
  let conversationId = parsed.data.conversationId;
  if (conversationId && !(await getConversation(user.id, courseId, conversationId))) {
    return notFound();
  }

  const model = chatModel(); // throws early if GEMINI_CHAT_MODEL is missing

  // Retrieval happens before anything is saved or streamed, so if Gemini is
  // down the user gets a clear error and the chat isn't left half-written.
  let hits;
  try {
    hits = await searchNotes(user.id, courseId, text);
  } catch (err) {
    console.error("[chat] retrieval failed", err);
    return errorResponse(503, "The AI service is busy right now. Please try again in a minute.");
  }
  const sources: Source[] = hits.map((h, i) => ({
    n: i + 1,
    chunkId: h.chunkId,
    documentId: h.documentId,
    filename: h.filename,
    pageNumber: h.pageNumber,
    content: h.content,
  }));

  // Earlier turns (read before saving the new question) give the model context
  // for follow-ups. Sources are only attached to the current question.
  const history = conversationId ? await recentTurns(conversationId) : [];
  conversationId ??= await createConversation(user.id, courseId, text);
  await saveMessage({ conversationId, role: "user", content: text });
  const chatId = conversationId; // a const copy for the callbacks below

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      // Metadata goes first, so the UI knows the conversation id and can show
      // source chips as soon as [n] markers start arriving.
      writer.write({ type: "start", messageMetadata: { conversationId: chatId, sources } });

      if (sources.length === 0) {
        // Nothing relevant in the notes: answer without calling the model.
        writer.write({ type: "text-start", id: "answer" });
        writer.write({ type: "text-delta", id: "answer", delta: NOT_IN_NOTES });
        writer.write({ type: "text-end", id: "answer" });
        writer.write({ type: "finish" });
        await saveMessage({ conversationId: chatId, role: "assistant", content: NOT_IN_NOTES });
        return;
      }

      const result = streamText({
        model,
        instructions: SYSTEM_PROMPT,
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: buildUserPrompt(text, sources) },
        ],
        // The SDK retries 429s and server errors with backoff on its own.
        maxRetries: 3,
        onEnd: async ({ text: answer }) => {
          const citations = citedNumbers(answer, sources.length).map((n) => {
            const s = sources[n - 1];
            return { n, chunkId: s.chunkId, documentId: s.documentId, pageNumber: s.pageNumber };
          });
          await saveMessage({ conversationId: chatId, role: "assistant", content: answer, citations });
        },
      });
      // Keep generating (and saving) even if the user closes the tab mid-answer.
      result.consumeStream();
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
    onError: (err) => {
      console.error("[chat] streaming failed", err);
      return "Something went wrong while answering. Please try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
