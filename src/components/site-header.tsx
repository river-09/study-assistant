import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

// The brand link is static. Only the user menu reads the session, so only it
// waits behind <Suspense>; the rest of the header renders immediately.
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/15">
      <Link href="/" className="font-semibold">
        Study Assistant
      </Link>
      <Suspense fallback={null}>
        <UserMenu />
      </Suspense>
    </header>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="text-sm underline underline-offset-4">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <Link href="/courses" className="text-sm">
        My courses
      </Link>
      <span className="text-sm opacity-70">{user.name}</span>
      <SignOutButton />
    </div>
  );
}
