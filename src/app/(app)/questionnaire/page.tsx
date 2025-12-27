"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { IntakeData } from "@/lib/intake";

type StepId = "basics" | "complaint" | "conditions" | "lifestyle";

const steps: { id: StepId; title: string; desc: string }[] = [
  { id: "basics", title: "Basics", desc: "Age, sex, height/weight." },
  { id: "complaint", title: "Main complaint", desc: "What brings you here?" },
  { id: "conditions", title: "Conditions & meds", desc: "History, allergies, medications." },
  { id: "lifestyle", title: "Lifestyle", desc: "Sleep, smoking, alcohol, exercise." },
];

function asNumber(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function splitList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(arr?: string[]): string {
  return (arr ?? []).join(", ");
}

export default function QuestionnairePage() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [data, setData] = useState<IntakeData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const progress = useMemo(() => {
    return Math.round(((stepIndex + 1) / steps.length) * 100);
  }, [stepIndex]);

  // Load existing intake
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setMsg(null);
      try {
        const res = await fetch("/api/intake", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok || !json?.ok) {
          setMsg(json?.error?.message || json?.message || "Failed to load intake");
          setLoading(false);
          return;
        }

        const existing = (json?.data ?? null) as IntakeData | null;
        setData(existing ?? {});
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message || "Failed to load intake");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  async function save(nextData: IntakeData) {
    setSaving(true);
    setMsg(null);
    try {
      const payload: IntakeData = {
        ...nextData,
        meta: {
          ...(nextData.meta ?? {}),
          updatedAtClient: new Date().toISOString(),
        },
      };

      const res = await fetch("/api/intake", {
        method: "POST", // اگر خواستی می‌تونیم PUT کنیم
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setMsg(json?.error?.message || json?.message || "Failed to save");
        setSaving(false);
        return false;
      }

      setData(payload);
      setSaving(false);
      return true;
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
      setSaving(false);
      return false;
    }
  }

  async function onNext() {
    const ok = await save(data);
    if (!ok) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function onBack() {
    setMsg(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function onFinish() {
    const next: IntakeData = {
      ...data,
      meta: { ...(data.meta ?? {}), completed: true, updatedAtClient: new Date().toISOString() },
    };

    const ok = await save(next);
    if (!ok) return;

    // برگرد به داشبورد
    window.location.href = "/dashboard";
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-lg font-semibold">Questionnaire</div>
        <div className="text-white/70 text-sm mt-1">Loading…</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Questionnaire</div>
            <div className="text-white/70 text-sm mt-1">
              Step {stepIndex + 1} of {steps.length} • {step.title}
            </div>
          </div>

          <Link href="/dashboard" className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm">
            Back
          </Link>
        </div>

        <div className="mt-4">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-white/30" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-white/50 text-xs mt-2">{step.desc}</div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            {msg}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f1930] p-4">
        {step.id === "basics" && (
          <div className="grid gap-3">
            <div className="text-white/80 text-sm">Basics</div>

            <div className="grid grid-cols-2 gap-3">
              <input
                className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
                placeholder="Age"
                inputMode="numeric"
                value={data.basics?.age ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    basics: { ...(d.basics ?? {}), age: asNumber(e.target.value) },
                  }))
                }
              />

              <select
                className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
                value={data.basics?.sex ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    basics: { ...(d.basics ?? {}), sex: (e.target.value || undefined) as any },
                  }))
                }
              >
                <option value="">Sex (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
                placeholder="Height (cm)"
                inputMode="numeric"
                value={data.basics?.heightCm ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    basics: { ...(d.basics ?? {}), heightCm: asNumber(e.target.value) },
                  }))
                }
              />

              <input
                className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
                placeholder="Weight (kg)"
                inputMode="numeric"
                value={data.basics?.weightKg ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    basics: { ...(d.basics ?? {}), weightKg: asNumber(e.target.value) },
                  }))
                }
              />
            </div>
          </div>
        )}

        {step.id === "complaint" && (
          <div className="grid gap-3">
            <div className="text-white/80 text-sm">Main complaint</div>

            <input
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Title (e.g., headache, stomach pain)"
              value={data.complaint?.title ?? ""}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  complaint: { ...(d.complaint ?? {}), title: e.target.value },
                }))
              }
            />

            <input
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Duration (e.g., 3 days, 2 weeks)"
              value={data.complaint?.duration ?? ""}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  complaint: { ...(d.complaint ?? {}), duration: e.target.value },
                }))
              }
            />

            <textarea
              className="w-full min-h-[120px] rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Details (optional)"
              value={data.complaint?.details ?? ""}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  complaint: { ...(d.complaint ?? {}), details: e.target.value },
                }))
              }
            />
          </div>
        )}

        {step.id === "conditions" && (
          <div className="grid gap-3">
            <div className="text-white/80 text-sm">Conditions & meds</div>

            <input
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Conditions (comma separated)"
              value={joinList(data.conditions?.conditions)}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  conditions: {
                    ...(d.conditions ?? {}),
                    conditions: splitList(e.target.value),
                  },
                }))
              }
            />

            <input
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Allergies (comma separated)"
              value={joinList(data.conditions?.allergies)}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  conditions: {
                    ...(d.conditions ?? {}),
                    allergies: splitList(e.target.value),
                  },
                }))
              }
            />

            <input
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Medications (comma separated)"
              value={joinList(data.conditions?.meds)}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  conditions: {
                    ...(d.conditions ?? {}),
                    meds: splitList(e.target.value),
                  },
                }))
              }
            />
          </div>
        )}

        {step.id === "lifestyle" && (
          <div className="grid gap-3">
            <div className="text-white/80 text-sm">Lifestyle</div>

            <input
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              placeholder="Sleep hours (optional)"
              inputMode="numeric"
              value={data.lifestyle?.sleepHours ?? ""}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  lifestyle: { ...(d.lifestyle ?? {}), sleepHours: asNumber(e.target.value) },
                }))
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
                value={data.lifestyle?.smoking ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    lifestyle: { ...(d.lifestyle ?? {}), smoking: (e.target.value || undefined) as any },
                  }))
                }
              >
                <option value="">Smoking?</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>

              <select
                className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
                value={data.lifestyle?.alcohol ?? ""}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    lifestyle: { ...(d.lifestyle ?? {}), alcohol: (e.target.value || undefined) as any },
                  }))
                }
              >
                <option value="">Alcohol?</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <select
              className="w-full rounded-2xl bg-[#0b1220] border border-white/10 px-4 py-3 outline-none"
              value={data.lifestyle?.exercise ?? ""}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  lifestyle: { ...(d.lifestyle ?? {}), exercise: (e.target.value || undefined) as any },
                }))
              }
            >
              <option value="">Exercise?</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              When you finish, we’ll mark your intake as completed.
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={stepIndex === 0 || saving}
            className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm disabled:opacity-50"
          >
            Back
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save(data)}
              disabled={saving}
              className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>

            {stepIndex < steps.length - 1 ? (
              <button
                type="button"
                onClick={onNext}
                disabled={saving}
                className="rounded-xl bg-white text-black hover:bg-white/90 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Next"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onFinish}
                disabled={saving}
                className="rounded-xl bg-white text-black hover:bg-white/90 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Finish"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
