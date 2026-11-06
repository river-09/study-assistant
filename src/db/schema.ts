import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { QuizQuestion } from "../lib/quiz-schema";
import { user } from "./auth-schema";

// Better Auth's tables (user, session, account, verification) are generated
// into auth-schema.ts by `npx auth generate`. Re-exporting them here means
// drizzle-kit and the app see every table through this one file.
export * from "./auth-schema";

// Must match outputDimensionality in the Gemini embedding call.
export const EMBEDDING_DIMENSIONS = 768;

// Column helpers, so every table gets the same id and timestamp setup.
// Column names come from the TypeScript keys via casing: "snake_case".
const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Postgres's binary column type. Drizzle has no built-in for it, so it's
// declared here; the pg driver reads and writes it as a Node Buffer.
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// Uploaded PDFs, stored in the database rather than on disk. Free hosts wipe
// their disk on every restart, and keeping files here means one fewer service.
// Only src/lib/storage.ts touches this table; `key` is the documents.storage_key.
export const files = pgTable("files", {
  key: text().primaryKey(),
  data: bytea().notNull(),
  createdAt: createdAt(),
});

export const documentStatus = pgEnum("document_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);

export const courses = pgTable(
  "courses",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    filename: text().notNull(), // original name, shown in the UI
    storageKey: text().notNull().unique(), // where the file lives in storage
    status: documentStatus().notNull().default("uploaded"),
    pageCount: integer(), // null until the worker has read the PDF
    error: text(), // set only when status is "failed"
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId, t.courseId)],
);

// user_id and course_id are copied from the document so retrieval can filter
// on them directly, without joining documents on every question.
export const chunks = pgTable(
  "chunks",
  {
    id: id(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    pageNumber: integer().notNull(), // 1-based, used for citations
    chunkIndex: integer().notNull(), // order of the chunk within the document
    content: text().notNull(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (t) => [
    index().using("hnsw", t.embedding.op("vector_cosine_ops")),
    index().on(t.userId, t.courseId),
    uniqueIndex().on(t.documentId, t.chunkIndex),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId, t.courseId)],
);

// One entry per [n] marker in an assistant answer.
export type Citation = {
  n: number;
  chunkId: string;
  documentId: string;
  pageNumber: number;
};

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole().notNull(),
    content: text().notNull(),
    citations: jsonb().$type<Citation[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.conversationId, t.createdAt)],
);

// Derived from the zod schema that validates the model's output (quiz-schema.ts),
// so the stored shape and the validated shape can never drift apart.
export type { QuizQuestion };

export const quizzes = pgTable(
  "quizzes",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    questions: jsonb().$type<QuizQuestion[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.documentId)],
);
