"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/providers/i18n-provider";
import { ShippingNotice } from "@/components/layout/shipping-notice";

export function TrackForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="mx-auto max-w-2xl px-5 pt-32 pb-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted">{t.pages.trackKicker}</p>
      <h1 className="font-display mt-3 text-4xl md:text-6xl">{t.track.title}</h1>
      <p className="mt-4 text-muted">{t.track.subtitle}</p>
      <form
        className="glass mt-10 flex gap-3 rounded-2xl p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t.track.placeholder}
          className="flex-1 bg-transparent px-4 py-3 font-mono outline-none"
        />
        <button type="submit" className="rounded-xl bg-fg px-6 py-3 text-sm text-bg">
          {t.track.search}
        </button>
      </form>
      <ShippingNotice className="mt-12" />
    </div>
  );
}
