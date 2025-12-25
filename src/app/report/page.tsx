'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/clientAuth";

export default function ReportPage() {
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { requireAuth(); }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    setReport("");
    try {
      const res = await fetch("/api/doctor-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message || "Failed");
      setReport(json.ok.reportMarkdown ?? json.ok.report ?? "");
    } catch (e: any) {
      setError("Could not generate report. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(report);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 700 }}>MedEnd</Link>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <Link href="/chat" style={{ textDecoration: "none", color: "#0f172a" }}>Chat</Link>
        <Link href="/intake" style={{ textDecoration: "none", color: "#0f172a" }}>Intake</Link>
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Doctor report (clinical)</h1>
        <p style={{ marginTop: 0, color: "#64748b" }}>
          Generates a structured clinical note based on your intake + recent chat. Not a medical diagnosis.
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "#475569" }}>Language</label>
          <input value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", width: 220 }} />
          <button onClick={generate} disabled={loading} style={btnPrimary}>{loading ? "Generating…" : "Generate"}</button>
          <button onClick={copy} disabled={!report} style={btn}>Copy</button>
        </div>

        {error && <div style={alertError}>{error}</div>}

        <pre style={{ whiteSpace: "pre-wrap", marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#ffffff", minHeight: 220 }}>
          {report || "Report will appear here…"}
        </pre>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", cursor: "pointer" };
const btnPrimary: React.CSSProperties = { ...btn, background: "#0f172a", borderColor: "#0f172a", color: "#ffffff" };
const alertError: React.CSSProperties = { marginTop: 12, padding: 10, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" };
