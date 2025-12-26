import { NextResponse } from "next/server";

function withNoStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return { ...(init ?? {}), headers };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, withNoStore(init));
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
    { ...withNoStore(init), status }
  );
}
