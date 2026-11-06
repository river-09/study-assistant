"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiError } from "@/lib/api-error";
import type { DocumentInfo, DocumentStatus } from "@/lib/documents";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  uploaded: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  processing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ready: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export function DocumentRow({ doc }: { doc: DocumentInfo }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    router.refresh();
  }

  // One model call, a few seconds. The button stays disabled meanwhile so a
  // double click can't make (and pay for) two quizzes.
  async function makeQuiz() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/documents/${doc.id}/quizzes`, { method: "POST" });
    if (!response.ok) {
      setPending(false);
      setError(await apiError(response));
      return;
    }
    const { id } = (await response.json()) as { id: string };
    router.push(`/quizzes/${id}`);
  }

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <a
          href={`/api/documents/${doc.id}/file`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 truncate font-medium hover:underline"
          title={doc.filename}
        >
          {doc.filename}
        </a>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[doc.status]}`}>
          {doc.status}
        </span>
        {doc.status === "ready" && !confirming && (
          <button onClick={makeQuiz} disabled={pending} className="text-sm disabled:opacity-50">
            {pending ? "Writing quiz…" : "Make quiz"}
          </button>
        )}
        {confirming ? (
          <>
            <button
              onClick={remove}
              disabled={pending}
              className="text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Yes, delete
            </button>
            <button onClick={() => setConfirming(false)} className="text-sm opacity-70">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-sm text-red-600">
            Delete
          </button>
        )}
      </div>
      {doc.status === "failed" && doc.error && (
        <p className="text-sm text-red-600">{doc.error}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}
