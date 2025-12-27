"use client";

import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string | null };

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setMsg(null);
      try {
        const res = await fetch("/api/me", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          setMsg(json?.error?.message || json?.message || "Failed to load profile");
          return;
        }
        setMe(json.data.user);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function logout() {
    setMsg(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Logout failed");
      window.location.href = "/login";
    } catch (e: any) {
      setMsg(e?.message || "Logout failed");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-lg font-semibold">Profile</div>
        <div className="text-white/70 text-sm mt-1">Account details and session.</div>
      </div>

      {msg && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0f1930] p-4">
        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : (
          <div className="grid gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/60">Name</div>
              <div className="mt-1 font-semibold">{me?.name || "—"}</div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/60">Email</div>
              <div className="mt-1 font-semibold break-all">{me?.email || "—"}</div>
            </div>

            <button
              onClick={logout}
              className="mt-2 w-full rounded-2xl px-4 py-3 font-semibold bg-red-500/20 border border-red-500/30 hover:bg-red-500/25"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
