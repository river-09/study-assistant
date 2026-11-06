import { parseJson, unauthorized } from "@/lib/api";
import { courseInput, createCourse, listCourses } from "@/lib/courses";
import { getCurrentUser } from "@/lib/session";

// GET /api/courses: the signed-in user's courses.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  return Response.json(await listCourses(user.id));
}

// POST /api/courses  { name }: create a course.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = await parseJson(request, courseInput);
  if ("response" in parsed) return parsed.response;

  const course = await createCourse(user.id, parsed.data.name);
  return Response.json(course, { status: 201 });
}
