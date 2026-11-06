import Link from "next/link";

// Fully static: no session read, so this page prerenders and loads instantly.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Study Assistant</h1>
      <p className="text-lg opacity-80">
        Upload your lecture PDFs, ask questions, and get answers that cite the
        exact page they came from. Then test yourself with auto-generated quizzes.
      </p>
      <div>
        <Link
          href="/courses"
          className="inline-block rounded-md bg-foreground px-4 py-2 text-background"
        >
          Go to my courses
        </Link>
      </div>
    </main>
  );
}
