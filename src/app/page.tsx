import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: "8px 0 4px", fontSize: 34 }}>MedEnd</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Text-only medical assistant. Start with a quick intake questionnaire, then chat, then generate a clinical doctor report.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <Link href="/login" style={btnPrimary}>Login</Link>
        <Link href="/register" style={btn}>Create account</Link>
        <Link href="/intake" style={btn}>Intake</Link>
        <Link href="/chat" style={btn}>Chat</Link>
      </div>

      <p style={{ marginTop: 22, fontSize: 13, color: "#64748b" }}>
        Note: This is not a doctor. If you have severe symptoms, seek urgent care.
      </p>
    </main>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "#0f172a",
  background: "#ffffff",
};

const btnPrimary: React.CSSProperties = { ...btn, background: "#0f172a", color: "#ffffff", borderColor: "#0f172a" };
