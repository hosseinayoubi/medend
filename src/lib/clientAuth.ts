export async function requireAuth(): Promise<{ id: string; email: string; name: string | null }> {
  const res = await fetch("/api/me", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }
  return data?.data?.user;
}
