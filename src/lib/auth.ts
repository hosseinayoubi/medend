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

function expireCookie() {
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
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

  // expire cookie explicitly (سازگارتر از delete)
  expireCookie();

  if (!token) return;

  const tokenHash = sha256(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getAuthedUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) {
    // کوکی‌ای نداریم، چیزی برای expire کردن هم نیست
    throw new AppError("UNAUTHORIZED", "Not logged in", 401);
  }

  const tokenHash = sha256(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    // اگر کوکی هست ولی سشن نیست، کوکی رو هم پاک کن
    expireCookie();
    throw new AppError("UNAUTHORIZED", "Invalid session", 401);
  }

  if (session.expiresAt.getTime() < Date.now()) {
    // سشن منقضی شده → دیتابیس پاک + کوکی expire
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => {});
    expireCookie();
    throw new AppError("UNAUTHORIZED", "Session expired", 401);
  }

  return session.user;
}
