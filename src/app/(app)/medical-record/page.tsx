import Link from "next/link";

export default function MedicalRecordPage() {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-lg font-semibold">Medical record</div>
        <div className="text-white/70 text-sm mt-1">
          Next step: aggregate data from questionnaire/journal/reports.
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f1930] p-4">
        <div className="text-white/70 text-sm">
          بعداً اینجا: خلاصه‌ی intake، journal و doctor-reports رو نمایش می‌دیم.
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            href="/dashboard"
            className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
