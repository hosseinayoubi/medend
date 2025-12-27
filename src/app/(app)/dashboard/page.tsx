import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-lg font-semibold">Dashboard</div>
        <div className="text-white/70 text-sm mt-1">Quick actions</div>
      </div>

      <div className="grid gap-3">
        <Link
          href="/chat/medical"
          className="rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-white/10 p-4 hover:bg-white/5 transition"
        >
          <div className="font-semibold">💬 Medical Chat</div>
          <div className="text-white/70 text-sm mt-1">Ask questions, get guidance.</div>
        </Link>

        <Link
          href="/questionnaire"
          className="rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/10 border border-white/10 p-4 hover:bg-white/5 transition"
        >
          <div className="font-semibold">📝 Questionnaire</div>
          <div className="text-white/70 text-sm mt-1">Fill or update your intake.</div>
        </Link>

        <Link
          href="/medical-record"
          className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-white/10 p-4 hover:bg-white/5 transition"
        >
          <div className="font-semibold">📁 Medical record</div>
          <div className="text-white/70 text-sm mt-1">Your data & summaries.</div>
        </Link>

        <Link
          href="/profile"
          className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition"
        >
          <div className="font-semibold">👤 Profile</div>
          <div className="text-white/70 text-sm mt-1">Account & logout.</div>
        </Link>
      </div>
    </div>
  );
}
