import Link from "next/link";

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: "8px 0 4px", fontSize: 30 }}>Dashboard</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>Text-only, fast, and simple.</p>

      <div style={{ display: "grid", gap: 12, maxWidth: 520, marginTop: 16 }}>
        <Link href="/intake" style={cardStyle}>📝 Intake questionnaire</Link>
        <Link href="/chat" style={cardStyle}>💬 Chat</Link>
        <Link href="/report" style={cardStyle}>🩺 Doctor report (clinical)</Link>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
};
