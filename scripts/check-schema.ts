// Smoke test for the schema: insert a row in every level, run a vector search,
// then delete the user and check ON DELETE CASCADE removed everything.
// Run with: npm run check:schema
import { cosineDistance, eq, count } from "drizzle-orm";
import { db } from "../src/db";
import { chunks, courses, documents, user, EMBEDDING_DIMENSIONS } from "../src/db/schema";

// A fake embedding: all zeros except one position, so we know which is closest.
function fakeEmbedding(hot: number): number[] {
  const v = new Array(EMBEDDING_DIMENSIONS).fill(0);
  v[hot] = 1;
  return v;
}

async function main() {
  const [u] = await db
    .insert(user)
    .values({ name: "Smoke Test", email: `smoke-${Date.now()}@example.com` })
    .returning();
  const [course] = await db
    .insert(courses)
    .values({ userId: u.id, name: "Biology 101" })
    .returning();
  const [doc] = await db
    .insert(documents)
    .values({
      userId: u.id,
      courseId: course.id,
      filename: "lecture1.pdf",
      storageKey: `smoke/${u.id}.pdf`,
    })
    .returning();
  await db.insert(chunks).values([
    { documentId: doc.id, userId: u.id, courseId: course.id, pageNumber: 1, chunkIndex: 0, content: "about cells", embedding: fakeEmbedding(0) },
    { documentId: doc.id, userId: u.id, courseId: course.id, pageNumber: 2, chunkIndex: 1, content: "about plants", embedding: fakeEmbedding(1) },
  ]);
  console.log(`Inserted user, course, document (status: ${doc.status}), 2 chunks`);

  // Nearest chunk to a "question" that points the same way as chunk 0.
  const distance = cosineDistance(chunks.embedding, fakeEmbedding(0));
  const [nearest] = await db
    .select({ content: chunks.content, pageNumber: chunks.pageNumber, distance })
    .from(chunks)
    .where(eq(chunks.userId, u.id))
    .orderBy(distance)
    .limit(1);
  console.log(`Nearest chunk: "${nearest.content}" (page ${nearest.pageNumber}, distance ${nearest.distance})`);

  await db.delete(user).where(eq(user.id, u.id));
  const [left] = await db.select({ n: count() }).from(chunks).where(eq(chunks.userId, u.id));
  console.log(`After deleting the user, chunks left: ${left.n} ${left.n === 0 ? "OK" : "FAIL"}`);

  await db.$client.end();
  if (left.n !== 0) process.exit(1);
}

main().catch((err) => {
  console.error("Schema check failed:", err?.message ?? err);
  process.exit(1);
});
