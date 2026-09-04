"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useI18n } from "@/providers/i18n-provider";

const ITEMS = [
  { key: "cars" as const, value: 300, suffix: "+" },
  { key: "customers" as const, value: 200, suffix: "+" },
  { key: "years" as const, value: 4, suffix: "+" },
];

export function Stats() {
  const root = useRef<HTMLElement>(null);
  const { t } = useI18n();

  useGSAP(
    () => {
      const counters = gsap.utils.toArray<HTMLElement>(".stat-num");
      counters.forEach((el) => {
        const target = Number(el.dataset.value);
        const obj = { n: 0 };
        gsap.to(obj, {
          n: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => {
            el.textContent = Math.floor(obj.n).toString();
          },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="border-y border-line bg-card/40">
      <div className="mx-auto grid max-w-7xl grid-cols-3 gap-4 px-5 py-14 md:px-8">
        {ITEMS.map((item) => (
          <div key={item.key} className="text-center">
            <p className="font-display text-3xl md:text-5xl">
              <span className="stat-num" data-value={item.value}>
                0
              </span>
              {item.suffix}
            </p>
            <p className="mt-2 text-xs text-muted md:text-sm">{t.stats[item.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
