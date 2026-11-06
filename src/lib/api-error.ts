// Reads the { error } message our API routes send, with a fallback for
// responses that aren't our JSON (e.g. a crashed server).
export async function apiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
