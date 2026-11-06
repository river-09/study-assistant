"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 3000;

// While any document is still waiting or processing, re-render the page from
// the server every few seconds so the status badges update. The server page
// decides `active`; once every document is ready or failed it passes false
// and the timer stops.
export function StatusPoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer); // stop when active turns false or the page closes
  }, [active, router]);

  return null; // renders nothing; it only runs the timer
}
