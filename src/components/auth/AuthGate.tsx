"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGate(props: {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}) {
  const { children, requireAuth = true, redirectTo = "/login" } = props;

  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "authed" | "guest">("loading");
  const [mounted, setMounted] = useState(false);

  // ⛑️ مهم‌ترین خط: جلوی prerender را می‌گیرد
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let alive = true;

    async function check() {
      try {
        const res = await fetch("/api/me", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        const authed = !!(res.ok && json?.ok);

        if (!alive) return;
        setStatus(authed ? "authed" : "guest");

        if (requireAuth && !authed) {
          router.replace(`${redirectTo}?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!requireAuth && authed) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        if (!alive) return;
        setStatus("guest");
        if (requireAuth) {
          router.replace(`${redirectTo}?next=${encodeURIComponent(pathname)}`);
        }
      }
    }

    check();
    return () => {
      alive = false;
    };
  }, [mounted, requireAuth, redirectTo, router, pathname]);

  // 🚧 prerender-safe
  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center px-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 w-full max-w-sm">
          <div className="text-lg font-semibold">Loading…</div>
          <div className="text-white/70 text-sm mt-1">Checking session</div>
        </div>
      </div>
    );
  }

  if (requireAuth && status === "guest") return null;

  return <>{children}</>;
}
