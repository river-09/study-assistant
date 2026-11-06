import type { NextRequest } from "next/server";
import { notFound, unauthorized, uuidParam } from "@/lib/api";
import { getOwnedDocument } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";
import { readFile } from "@/lib/storage";

// GET /api/documents/:id/file: the PDF itself, shown in the browser's viewer.
// Citation links add #page=N, which browser PDF viewers jump to.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]/file">) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  if (!uuidParam.safeParse(id).success) return notFound();

  const doc = await getOwnedDocument(user.id, id);
  if (!doc) return notFound();

  let bytes: Buffer;
  try {
    bytes = await readFile(doc.storageKey);
  } catch {
    return notFound();
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // inline = show in the browser; the filename is escaped for the header
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
