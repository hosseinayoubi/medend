import { ok } from "@/lib/response";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
  } catch {
    // logout should be idempotent: even if something goes wrong,
    // return success so the client can safely reset UI state.
  }

  return ok({ done: true });
}
