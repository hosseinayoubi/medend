"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ChatMode = "medical" | "therapy" | "recipe" | "dental";

export default function ChatClient() {
  const sp = useSearchParams();
  const urlMode = (sp.get("mode") ?? "medical") as ChatMode;

  const [mode, setMode] = useState<ChatMode>("medical");

  useEffect(() => {
    setMode(urlMode);
  }, [urlMode]);

  // ⬇️ اینجا همون UI چت فعلی‌ت رو بذار
  // فقط به جای state قبلی، از mode/setMode همین استفاده کن
  return (
    <div>
      {/* your existing chat ui */}
      <div className="text-white/60 text-sm mb-2">Mode: {mode}</div>
      {/* ... */}
    </div>
  );
}
