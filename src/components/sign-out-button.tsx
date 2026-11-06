"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut(); // deletes the session row and the cookie
    router.push("/login");
    router.refresh(); // re-render server components without the old session
  }

  return (
    <button onClick={signOut} className="text-sm underline underline-offset-4">
      Sign out
    </button>
  );
}
