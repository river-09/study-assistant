"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiError } from "@/lib/api-error";

// maxBytes comes from the server page, so this browser file never imports
// server code (documents.ts imports the database).
export function UploadForm({ courseId, maxBytes }: { courseId: string; maxBytes: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    setError(null);
    // Quick checks for instant feedback. The server checks again: anyone can
    // skip this code by calling the API directly.
    if (file.size > maxBytes) {
      setError(`File is too large (max ${maxBytes / 1024 / 1024} MB)`);
      return;
    }

    const form = new FormData();
    form.append("file", file);

    setPending(true);
    // No Content-Type header: the browser sets multipart/form-data itself,
    // including the boundary string that separates the parts.
    const response = await fetch(`/api/courses/${courseId}/documents`, {
      method: "POST",
      body: form,
    });
    setPending(false);
    if (inputRef.current) inputRef.current.value = ""; // allow picking the same file again

    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-black/25 px-4 py-6 text-center hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/5">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <span>
          {pending
            ? "Uploading…"
            : `Click to upload a lecture PDF (max ${maxBytes / 1024 / 1024} MB)`}
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
