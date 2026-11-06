import type { NextRequest } from "next/server";
import { notFound, parseJson, unauthorized, uuidParam } from "@/lib/api";
import { courseInput, deleteCourse, getCourse, renameCourse } from "@/lib/courses";
import { getCurrentUser } from "@/lib/session";

type Context = RouteContext<"/api/courses/[id]">;

// A malformed id can't match any row, so treat it as not found instead of
// letting Postgres throw "invalid input syntax for type uuid".
async function courseId(ctx: Context): Promise<string | null> {
  const { id } = await ctx.params;
  return uuidParam.safeParse(id).success ? id : null;
}

// GET /api/courses/:id
export async function GET(_request: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const id = await courseId(ctx);
  if (!id) return notFound();

  const course = await getCourse(user.id, id);
  return course ? Response.json(course) : notFound();
}

// PATCH /api/courses/:id  { name }: rename.
export async function PATCH(request: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const id = await courseId(ctx);
  if (!id) return notFound();

  const parsed = await parseJson(request, courseInput);
  if ("response" in parsed) return parsed.response;

  const course = await renameCourse(user.id, id, parsed.data.name);
  return course ? Response.json(course) : notFound();
}

// DELETE /api/courses/:id
export async function DELETE(_request: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const id = await courseId(ctx);
  if (!id) return notFound();

  const deleted = await deleteCourse(user.id, id);
  return deleted ? new Response(null, { status: 204 }) : notFound();
}
