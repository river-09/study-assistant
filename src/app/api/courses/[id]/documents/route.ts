import type { NextRequest } from "next/server";
import { badRequest, errorResponse, notFound, unauthorized, uuidParam } from "@/lib/api";
import { getCourse } from "@/lib/courses";
import {
  cleanFilename,
  createDocument,
  isPdf,
  listDocuments,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

type Context = RouteContext<"/api/courses/[id]/documents">;

// Room for the multipart wrapper around the file (boundaries, field names).
const FORM_OVERHEAD_BYTES = 64 * 1024;
const TOO_LARGE = `File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`;

// Returns the course id if it's a valid uuid and the course belongs to the user.
async function ownedCourseId(userId: string, ctx: Context): Promise<string | null> {
  const { id } = await ctx.params;
  if (!uuidParam.safeParse(id).success) return null;
  return (await getCourse(userId, id)) ? id : null;
}

// GET /api/courses/:id/documents: the course's documents with their status.
export async function GET(_request: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const courseId = await ownedCourseId(user.id, ctx);
  if (!courseId) return notFound();

  return Response.json(await listDocuments(user.id, courseId));
}

// POST /api/courses/:id/documents  (multipart/form-data with a "file" field)
export async function POST(request: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const courseId = await ownedCourseId(user.id, ctx);
  if (!courseId) return notFound();

  // Cheap early check: reject honestly-declared big uploads before reading them.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) return errorResponse(413, TOO_LARGE);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected a multipart form with a file field");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("No file uploaded");
  if (file.size === 0) return badRequest("File is empty");
  // The real check: the actual size, whatever the header claimed.
  if (file.size > MAX_UPLOAD_BYTES) return errorResponse(413, TOO_LARGE);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Don't trust the name or the browser's type: look at the bytes.
  if (!isPdf(bytes)) return errorResponse(415, "Only PDF files are supported");

  const doc = await createDocument({
    userId: user.id,
    courseId,
    filename: cleanFilename(file.name),
    bytes,
  });
  return Response.json(doc, { status: 201 });
}
