import { Suspense } from "react";
import { listCourses } from "@/lib/courses";
import { requireUser } from "@/lib/session";
import { CourseRow } from "./course-row";
import { NewCourseForm } from "./new-course-form";

export default function CoursesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">My courses</h1>
      <Suspense fallback={<p className="opacity-60">Loading courses…</p>}>
        <CourseList />
      </Suspense>
    </main>
  );
}

// Reads the session and the database, so it streams in behind <Suspense>.
async function CourseList() {
  const user = await requireUser();
  const courses = await listCourses(user.id);

  return (
    <div className="flex flex-col gap-6">
      <NewCourseForm />
      {courses.length === 0 ? (
        <p className="opacity-60">No courses yet. Create one to start uploading notes.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 rounded-md border border-black/10 dark:divide-white/15 dark:border-white/15">
          {courses.map((course) => (
            <CourseRow key={course.id} course={course} />
          ))}
        </ul>
      )}
    </div>
  );
}
