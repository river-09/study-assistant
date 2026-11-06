import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignInButton } from "@/components/sign-in-button";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-center opacity-70">
        Use your Google account. Your notes are only visible to you.
      </p>
      <SignInButton />
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </main>
  );
}

// Already signed in? Skip the login page.
async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/courses");
  return null;
}
