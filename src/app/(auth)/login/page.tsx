"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthGate from "@/components/auth/AuthGate";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function getNextPath() {
    // فقط کلاینت
    if (typeof window === "undefined") return "/dashboard";
    const sp = new URLSearchParams(window.location.search);
    return sp.get("next") || "/dashboard";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setMsg(json?.error?.message || json?.message || "Login failed");
        setLoading(false);
        return;
      }

      router.push(getNextPath());
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <AuthGate requireAuth={false}>
      <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center px-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <div className="text-xl font-semibold">Sign in</div>
          <div className="text-white/70 text-sm mt-1">Welcome back</div>

          <div className="mt-5 grid gap-3">
            <input
              className="w-full rounded-2xl bg-[#0f1930] border border-white/10 px-4 py-3 outline-none"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              className="w-full rounded-2xl bg-[#0f1930] border border-white/10 px-4 py-3 outline-none"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {msg && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={[
                "w-full rounded-2xl px-4 py-3 font-semibold",
                loading ? "bg-white/10 text-white/60" : "bg-white text-black hover:bg-white/90",
              ].join(" ")}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <a href="/register" className="text-sm text-white/70 hover:text-white text-center">
              Create an account
            </a>
          </div>
        </form>
      </div>
    </AuthGate>
  );
}
