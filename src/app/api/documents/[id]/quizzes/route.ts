import type { NextRequest } from "next/server";
import { errorResponse, notFound, unauthorized, uuidParam } from "@/lib/api";
import { createQuiz, QuizError } from "@/lib/quizzes";
import { getCurrentUser } from "@/lib/session";

// POST /api/documents/:id/quizzes: generate and save a quiz for one document.
// Takes a few seconds (one model call), so the UI shows a pending state.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]/quizzes">) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  if (!uuidParam.safeParse(id).success) return notFound();

  try {
    const quizId = await createQuiz(user.id, id);
    return Response.json({ id: quizId }, { status: 201 });
  } catch (err) {
    if (err instanceof QuizError) {
      return err.status === 404 ? notFound() : errorResponse(err.status, err.message);
    }
    throw err;
  }
}
