"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/providers/i18n-provider";
import { ShippingNotice } from "@/components/layout/shipping-notice";
import { MapPin, Search } from "lucide-react";

export function TrackForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6 md:pt-36">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-royal/10 text-royal"><MapPin size={22} /></span>
        <h1 className="font-display mt-5 text-3xl md:text-5xl">{t.track.title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">{t.track.subtitle}</p>
      </div>
      <form
        className="mx-auto mt-7 flex max-w-xl flex-col gap-3 rounded-3xl border border-line bg-card p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) router.push(`/track/${encodeURIComponent(code.trim().toUpperCase())}`);
        }}
      >
        <label htmlFor="tracking-code" className="text-sm font-medium">{t.track.placeholder}</label>
        <input
          id="tracking-code"
          required
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t.track.placeholder}
          className="min-w-0 rounded-xl border border-line bg-bg px-4 py-4 font-mono text-base uppercase outline-none focus:border-royal focus:ring-2 focus:ring-royal/15"
        />
        <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-royal px-6 py-4 text-base font-medium text-white">
          <Search size={16} /> {t.track.search}
        </button>
      </form>
      <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-5 text-muted">{t.track.featSafeD}</p>
      <details className="mx-auto mt-7 max-w-xl rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm text-muted">{t.track.featStages}</summary><ShippingNotice className="mt-3" /></details>
    </div>
  );
}
