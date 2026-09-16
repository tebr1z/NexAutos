"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/providers/i18n-provider";
import { ShippingNotice } from "@/components/layout/shipping-notice";
import { ArrowRight, Box, MapPin, Search, ShieldCheck } from "lucide-react";

export function TrackForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-royal/10 text-royal"><MapPin size={22} /></span>
        <p className="mt-6 text-[11px] uppercase tracking-[0.4em] text-muted">{t.pages.trackKicker}</p>
        <h1 className="font-display mt-3 text-4xl md:text-6xl">{t.track.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted">{t.track.subtitle}</p>
      </div>
      <form
        className="glass mx-auto mt-10 flex max-w-2xl flex-col gap-3 rounded-3xl p-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t.track.placeholder}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono uppercase outline-none"
        />
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fg px-6 py-3 text-sm font-medium text-bg">
          <Search size={16} /> {t.track.search}
        </button>
      </form>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Feature icon={ShieldCheck} title="Təhlükəsiz izləmə" text="Yalnız unikal kodunuzla məlumatlara baxın." />
        <Feature icon={Box} title="Bütün mərhələlər" text="Alışdan təhvilə qədər hər yenilənməni görün." />
        <Feature icon={ArrowRight} title="Canlı marşrut" text="Liman, gəmi, konteyner və təxmini tarixi izləyin." />
      </div>
      <ShippingNotice className="mx-auto mt-10 max-w-2xl" />
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return <div className="rounded-3xl border border-line bg-card p-5"><Icon size={18} className="text-royal" /><h2 className="mt-4 text-sm font-medium">{title}</h2><p className="mt-2 text-xs leading-5 text-muted">{text}</p></div>;
}
