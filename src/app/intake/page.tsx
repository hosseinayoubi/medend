'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { intakeQuestions, IntakeQuestion } from "@/features/intake/questions";
import { requireAuth } from "@/lib/clientAuth";

export default function IntakePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;
      try {
        const res = await fetch("/api/intake", { method: "GET" });
        const json = await res.json();
        if (json?.ok && json.data) setData(json.data);
      } catch (e: any) {
        setError("Could not load intake.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const steps = useMemo(() => {
    const a: IntakeQuestion[][] = [];
    a.push(intakeQuestions.slice(0, 5));
    a.push(intakeQuestions.slice(5, 12));
    a.push(intakeQuestions.slice(12));
    return a;
  }, []);

  const [step, setStep] = useState(0);

  function update(id: string, value: any) {
    setSavedMsg(null);
    setData(prev => ({ ...prev, [id]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.message || "Save failed");
      setSavedMsg("Saved.");
    } catch (e: any) {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Shell><p style={{ color: "#64748b" }}>Loading…</p></Shell>;

  const current = steps[step] ?? [];

  return (
    <Shell>
      <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Intake questionnaire</h1>
      <p style={{ marginTop: 0, color: "#64748b" }}>Fast, text-only. You can update this anytime.</p>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {steps.map((_, i) => (
          <div key={i} style={{ height: 8, flex: 1, borderRadius: 999, background: i <= step ? "#0f172a" : "#e2e8f0" }} />
        ))}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {current.map(q => (
          <Question key={q.id} q={q} value={data[q.id]} onChange={(v) => update(q.id, v)} />
        ))}
      </div>

      {error && <div style={alertError}>{error}</div>}
      {savedMsg && <div style={alertOk}>{savedMsg}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} style={btn}>
          Back
        </button>
        <button disabled={step >= steps.length - 1} onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} style={btn}>
          Next
        </button>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <Link href="/chat" style={btn}>Go to chat</Link>
      </div>
    </Shell>
  );
}

function Question({ q, value, onChange }: { q: IntakeQuestion; value: any; onChange: (v: any) => void }) {
  const common: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", outline: "none" };

  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#0f172a" }}>
        {q.label}{q.required ? " *" : ""}
      </span>

      {q.type === "text" && (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder} style={common} />
      )}

      {q.type === "number" && (
        <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} style={common} />
      )}

      {q.type === "textarea" && (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder} rows={4} style={{ ...common, resize: "vertical" }} />
      )}

      {q.type === "select" && (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={common}>
          <option value="">Select…</option>
          {q.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {q.type === "scale" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="range"
            min={q.min}
            max={q.max}
            step={q.step ?? 1}
            value={typeof value === "number" ? value : 0}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 26, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? value : 0}</span>
        </div>
      )}

      {q.type === "multi" && (
        <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          {q.options.map(o => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const checked = arr.includes(o.value);
            return (
              <label key={o.value} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o.value] : arr.filter(x => x !== o.value);
                    onChange(next);
                  }}
                />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 700 }}>MedEnd</Link>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <Link href="/chat" style={{ textDecoration: "none", color: "#0f172a" }}>Chat</Link>
        <Link href="/intake" style={{ textDecoration: "none", color: "#0f172a" }}>Intake</Link>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
        {children}
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = { ...btn, background: "#0f172a", borderColor: "#0f172a", color: "#ffffff" };

const alertError: React.CSSProperties = { marginTop: 12, padding: 10, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" };
const alertOk: React.CSSProperties = { marginTop: 12, padding: 10, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" };
