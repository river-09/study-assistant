// The one place that answers "who is making this request?". Pages and API
// routes call these instead of reading cookies themselves, so the check can't
// be forgotten or done differently in two places.
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

// Only the fields the app needs, not the whole session object.
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

// cache() lets several components in one page render share a single lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
});

// For pages: send signed-out visitors to the login page.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
