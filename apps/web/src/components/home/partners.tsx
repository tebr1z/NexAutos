"use client";

import { useI18n } from "@/providers/i18n-provider";

const PARTNERS = [
  { name: "Copart", src: "/partners/copart.svg" },
  { name: "IAA", src: "/partners/iaai.svg" },
] as const;

const LOOP = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];

export function Partners() {
  const { t } = useI18n();
  return (
    <section className="overflow-hidden border-y border-line py-16">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-[11px] uppercase tracking-[0.4em] text-muted">{t.partners.title}</p>
        <p className="mt-3 text-muted">{t.partners.subtitle}</p>
      </div>
      <div className="group mt-10 flex w-max animate-[marquee_32s_linear_infinite] gap-6 px-6 hover:[animation-play-state:paused] motion-reduce:animate-none">
        {LOOP.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            className="flex h-[96px] w-[260px] shrink-0 items-center justify-center rounded-2xl bg-white px-8 ring-1 ring-black/10"
          >
            <img
              src={p.src}
              alt={i < PARTNERS.length ? p.name : ""}
              className="h-12 w-auto max-w-[200px] object-contain"
            />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-25%); }
        }
      `}</style>
    </section>
  );
}
