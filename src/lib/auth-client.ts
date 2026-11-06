// Browser-side helper for Better Auth. Client Components use it to start the
// Google login and to sign out. It talks to the /api/auth/* routes.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
