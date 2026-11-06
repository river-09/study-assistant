// Mounts every Better Auth endpoint under /api/auth/*, for example
// /api/auth/sign-in/social and the Google callback /api/auth/callback/google.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
