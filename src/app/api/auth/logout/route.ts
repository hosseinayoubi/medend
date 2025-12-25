import { ok, fail } from "@/lib/response";
import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return ok({ done: true });
  } catch {
    return fail("SERVER_ERROR", "Something went wrong", 500);
  }
}
