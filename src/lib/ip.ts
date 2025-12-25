// src/lib/ip.ts
export function getClientIp(req: Request): string {
  // Vercel / proxies usually set x-forwarded-for as "client, proxy1, proxy2"
  const xff = req.headers.get("x-forwarded-for");
  const ipFromXff = xff?.split(",")[0]?.trim();

  const xRealIp = req.headers.get("x-real-ip")?.trim();

  return ipFromXff || xRealIp || "unknown";
}
