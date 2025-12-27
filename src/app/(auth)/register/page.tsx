"use client";

export const dynamic = "force-dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthGate from "@/components/auth/AuthGate";

export default function RegisterPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setMsg(json?.error?.message || json?.message || "Register failed");
        setLoading(false);
        return;
      }

      const next = sp.get("next");
      router.push(next || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || "Register failed");
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
          <div className="text-xl font-semibold">Create account</div>
          <div className="text-white/70 text-sm mt-1">Start your journey</div>

          <div className="mt-5 grid gap-3">
            <input
              className="w-full rounded-2xl bg-[#0f1930] border border-white/10 px-4 py-3 outline-none"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
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
              autoComplete="new-password"
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
              {loading ? "Creating…" : "Create account"}
            </button>

            <a href="/login" className="text-sm text-white/70 hover:text-white text-center">
              Back to login
            </a>
          </div>
        </form>
      </div>
    </AuthGate>
  );
}
