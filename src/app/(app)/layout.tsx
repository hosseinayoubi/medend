import AuthGate from "@/components/auth/AuthGate";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  // ...
  return (
    <AuthGate requireAuth>
      <div className="min-h-screen bg-[#0b1220] text-white">
        {/* ... همون header/drawer/bottom nav */}
        <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>
      </div>
    </AuthGate>
  );
}
