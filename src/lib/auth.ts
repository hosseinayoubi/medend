import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

const COOKIE_NAME = "medend_session";
const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? "14");

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string) {
  const token = newToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });

  cookies().set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { expiresAt };
}

export async function destroySession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  cookies().delete(COOKIE_NAME);

  if (!token) return;
  const tokenHash = sha256(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getAuthedUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) throw new AppError("UNAUTHORIZED", "Not logged in", 401);

  const tokenHash = sha256(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) throw new AppError("UNAUTHORIZED", "Invalid session", 401);

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
    throw new AppError("UNAUTHORIZED", "Session expired", 401);
  }

  return session.user;
}
