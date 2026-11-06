import type { NextRequest } from "next/server";
import { notFound, unauthorized, uuidParam } from "@/lib/api";
import { deleteDocument } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

// DELETE /api/documents/:id: removes the row (and its chunks) and the file.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  if (!uuidParam.safeParse(id).success) return notFound();

  const deleted = await deleteDocument(user.id, id);
  return deleted ? new Response(null, { status: 204 }) : notFound();
}
