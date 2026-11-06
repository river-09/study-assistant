// Data access for chats. Conversations are scoped by user like courses.
// Messages are reached through their conversation, so checking the
// conversation's owner is enough.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chunks, conversations, documents, messages, type Citation } from "@/db/schema";
import type { ChatUIMessage, Source } from "./chat-types";

export type ConversationSummary = { id: string; title: string; updatedAt: Date };

export function listConversations(userId: string, courseId: string): Promise<ConversationSummary[]> {
  return db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.courseId, courseId)))
    .orderBy(desc(conversations.updatedAt));
}

// Returns the conversation only if it belongs to this user AND this course.
export async function getConversation(userId: string, courseId: string, conversationId: string) {
  const [row] = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
        eq(conversations.courseId, courseId),
      ),
    );
  return row ?? null;
}

export async function createConversation(userId: string, courseId: string, firstQuestion: string) {
  const title = firstQuestion.length > 80 ? `${firstQuestion.slice(0, 77)}...` : firstQuestion;
  const [row] = await db
    .insert(conversations)
    .values({ userId, courseId, title })
    .returning({ id: conversations.id });
  return row.id;
}

export async function saveMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(messages).values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      citations: input.citations ?? [],
    });
    // Bump updatedAt so the conversation list shows the latest chat first.
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, input.conversationId));
  });
}

// The last few turns as plain text, for the model's context. The caller must
// already have checked that the conversation belongs to the user.
export async function recentTurns(conversationId: string, limit = 6) {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}

// All messages in the shape the chat UI uses. Saved citations only hold ids,
// so the chunk text and filename are looked up again here. A source whose
// document was deleted since is simply left out.
export async function loadChatMessages(conversationId: string): Promise<ChatUIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const chunkIds = [...new Set(rows.flatMap((m) => m.citations.map((c) => c.chunkId)))];
  const found =
    chunkIds.length === 0
      ? []
      : await db
          .select({ id: chunks.id, content: chunks.content, filename: documents.filename })
          .from(chunks)
          .innerJoin(documents, eq(documents.id, chunks.documentId))
          .where(inArray(chunks.id, chunkIds));
  const byId = new Map(found.map((c) => [c.id, c]));

  return rows.map((m) => {
    const sources: Source[] = m.citations.flatMap((c) => {
      const chunk = byId.get(c.chunkId);
      return chunk
        ? [{ ...c, filename: chunk.filename, content: chunk.content }]
        : [];
    });
    return {
      id: m.id,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
      metadata: { conversationId, sources },
    };
  });
}
