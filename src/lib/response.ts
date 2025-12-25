// src/lib/response.ts
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  extra?: unknown,
  init?: ResponseInit
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(extra ? { extra } : {}) } },
    { status, ...(init ?? {}) }
  );
}
