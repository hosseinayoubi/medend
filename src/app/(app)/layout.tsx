"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AuthGate from "@/components/auth/AuthGate";

function NavLink(props: { href: string; label: string; icon?: string }) {
  const pathname = usePathname();
  const active = pathname === props.href;

  return (
    <Link
      href={props.href}
      className={[
        "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs",
        active ? "bg-white/10 text-white" : "text-white/70 hover:text-white",
      ].join(" ")}
    >
      <span className="text-base">{props.icon ?? "•"}</span>
      <span>{props.label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AuthGate requireAuth>
      <div className="min-h-screen bg-[#0b1220] text-white">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#0b1220]/80 backdrop-blur border-b border-white/10">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setDrawerOpen(true)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="font-semibold tracking-tight">Medend</div>

            <Link
              href="/profile"
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15"
              aria-label="Profile"
            >
              👤
            </Link>
          </div>
        </header>

        {/* Drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[280px] bg-[#0f1930] border-r border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Menu</div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10"
                >
                  🏠 Dashboard
                </Link>

                <Link
                  href="/questionnaire"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10"
                >
                  📝 Questionnaire
                </Link>

                <Link
                  href="/medical-record"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10"
                >
                  📁 Medical record
                </Link>

                <Link
                  href="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10"
                >
                  👤 Profile
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>

        {/* Bottom nav */}
       {/* Bottom nav */}
<nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b1220]/80 backdrop-blur">
  <div className="mx-auto max-w-3xl px-2 py-2 flex items-center justify-between">
    <NavLink href="/dashboard" label="Home" icon="🏠" />
    {/* A) Chat همیشه medical */}
    <NavLink href="/chat/medical" label="Chat" icon="💬" />

    {/* ✅ NEW: Dental right after Chat */}
    <NavLink href="/chat/dental" label="Dental" icon="🦷" />

    <NavLink href="/chat/therapy" label="Therapy" icon="🧠" />
    <NavLink href="/chat/recipe" label="Recipe" icon="🍲" />
  </div>
</nav>
      </div>
    </AuthGate>
  );
}
