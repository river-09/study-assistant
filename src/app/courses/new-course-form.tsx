"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiError } from "@/lib/api-error";

export function NewCourseForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser's full-page form submit
    setPending(true);
    setError(null);

    const response = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setPending(false);
    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    setName("");
    router.refresh(); // re-run the server component so the new course shows up
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New course name, e.g. Biology 101"
          maxLength={100}
          className="flex-1 rounded-md border border-black/20 bg-transparent px-3 py-2 dark:border-white/25"
        />
        <button
          type="submit"
          disabled={pending || name.trim() === ""}
          className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add course"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
