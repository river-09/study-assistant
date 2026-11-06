// Data access for courses. Every function takes the signed-in user's id and
// includes it in the WHERE clause, so one user can never read or change
// another user's course, even with a guessed course id.
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { courses, documents } from "@/db/schema";
import { deleteFile } from "./storage";

// What the client sends when creating or renaming a course.
export const courseInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
});

// The fields we send to the browser. user_id stays on the server.
const publicColumns = {
  id: courses.id,
  name: courses.name,
  createdAt: courses.createdAt,
};

export type Course = { id: string; name: string; createdAt: Date };

export function listCourses(userId: string): Promise<Course[]> {
  return db
    .select(publicColumns)
    .from(courses)
    .where(eq(courses.userId, userId))
    .orderBy(asc(courses.createdAt));
}

export async function getCourse(userId: string, courseId: string): Promise<Course | null> {
  const [course] = await db
    .select(publicColumns)
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
  return course ?? null;
}

export async function createCourse(userId: string, name: string): Promise<Course> {
  const [course] = await db
    .insert(courses)
    .values({ userId, name })
    .returning(publicColumns);
  return course;
}

// Returns null when the course doesn't exist or belongs to someone else.
export async function renameCourse(
  userId: string,
  courseId: string,
  name: string,
): Promise<Course | null> {
  const [course] = await db
    .update(courses)
    .set({ name })
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .returning(publicColumns);
  return course ?? null;
}

// Deleting a course also deletes its documents, chunks, conversations and
// quizzes (ON DELETE CASCADE). The cascade can't reach files on disk, so we
// collect the documents' storage keys first and delete those files after.
// Returns false when there was nothing to delete.
export async function deleteCourse(userId: string, courseId: string): Promise<boolean> {
  const files = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(and(eq(documents.courseId, courseId), eq(documents.userId, userId)));

  const deleted = await db
    .delete(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .returning({ id: courses.id });
  if (deleted.length === 0) return false;

  await Promise.all(files.map((f) => deleteFile(f.storageKey)));
  return true;
}
