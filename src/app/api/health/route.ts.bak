import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json(
      {
        ok: true,
        db: "ok",
        ms: Date.now() - t0,
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        version: process.env.APP_VERSION ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { ok: false, db: "fail" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
