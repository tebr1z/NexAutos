"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";

export function Assistant() {
  const { t, locale } = useI18n();
  const chips = t.faq.items.slice(0, 3);
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<{ role: "bot" | "you"; text: string }[]>([
    { role: "bot", text: t.pages.assistantHello },
  ]);

  useEffect(() => {
    setLog([{ role: "bot", text: t.pages.assistantHello }]);
  }, [locale, t.pages.assistantHello]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-20 z-40 flex h-12 w-12 items-center justify-center rounded-full glass text-fg"
        aria-label={t.pages.assistantName}
      >
        <Sparkles size={18} />
      </button>
      {open && (
        <div className="glass fixed right-5 bottom-36 z-40 w-[min(92vw,340px)] overflow-hidden rounded-2xl shadow-glass">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-medium">{t.pages.assistantName}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close}>
              <X size={16} />
            </button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto p-4 text-sm">
            {log.map((m, i) => (
              <p key={i} className={m.role === "bot" ? "text-muted" : "text-fg"}>
                {m.text}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line p-3">
            {chips.map((r) => (
              <button
                key={r.q}
                type="button"
                className="rounded-full border border-line px-3 py-1 text-[11px] hover:bg-fg/5"
                onClick={() => setLog((l) => [...l, { role: "you", text: r.q }, { role: "bot", text: r.a }])}
              >
                {r.q}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
