"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/lib/courses";
import { apiError } from "@/lib/api-error";

type Mode = "view" | "rename" | "confirm-delete";

export function CourseRow({ course }: { course: Course }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [name, setName] = useState(course.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(method: "PATCH" | "DELETE") {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/courses/${course.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ name }) : undefined,
    });
    setPending(false);
    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    setMode("view");
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        {mode === "rename" ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            className="flex-1 rounded-md border border-black/20 bg-transparent px-2 py-1 dark:border-white/25"
          />
        ) : (
          <Link href={`/courses/${course.id}`} className="flex-1 font-medium hover:underline">
            {course.name}
          </Link>
        )}

        {mode === "view" && (
          <>
            <button onClick={() => setMode("rename")} className="text-sm opacity-70 hover:opacity-100">
              Rename
            </button>
            <button onClick={() => setMode("confirm-delete")} className="text-sm text-red-600">
              Delete
            </button>
          </>
        )}

        {mode === "rename" && (
          <>
            <button
              onClick={() => send("PATCH")}
              disabled={pending || name.trim() === ""}
              className="text-sm font-medium disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setName(course.name);
                setMode("view");
              }}
              className="text-sm opacity-70"
            >
              Cancel
            </button>
          </>
        )}

        {mode === "confirm-delete" && (
          <>
            <span className="text-sm">Delete this course and all its notes?</span>
            <button
              onClick={() => send("DELETE")}
              disabled={pending}
              className="text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Yes, delete
            </button>
            <button onClick={() => setMode("view")} className="text-sm opacity-70">
              Cancel
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
