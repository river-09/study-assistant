// Small helpers shared by API route handlers, so every route answers errors
// in the same JSON shape: { error: string, issues?: ... }.
import { z } from "zod";

export const uuidParam = z.uuid();

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// Also used when the row exists but belongs to another user, so the response
// doesn't reveal that the id is real.
export function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export function badRequest(error: string, issues?: unknown) {
  return Response.json({ error, issues }, { status: 400 });
}

// Any other status, e.g. 413 (too large) or 415 (wrong file type).
export function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

// Parses the JSON body and validates it. Returns the data, or a 400 response.
export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: badRequest("Body must be valid JSON") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid input";
    return { response: badRequest(message, z.flattenError(result.error).fieldErrors) };
  }
  return { data: result.data };
}
