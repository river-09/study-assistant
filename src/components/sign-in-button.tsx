"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    // Redirects the browser to Google, then back to /courses after login.
    await authClient.signIn.social({ provider: "google", callbackURL: "/courses" });
  }

  return (
    <button
      onClick={signIn}
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-60"
    >
      {pending ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}
