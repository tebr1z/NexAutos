"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useI18n } from "@/providers/i18n-provider";
import { ShippingNotice } from "@/components/layout/shipping-notice";

const STEPS = [
  { n: "01", title: "s1", desc: "s1d" },
  { n: "02", title: "s2", desc: "s2d" },
  { n: "03", title: "s3", desc: "s3d" },
  { n: "04", title: "s4", desc: "s4d" },
  { n: "05", title: "s5", desc: "s5d" },
] as const;

export function Process() {
  const root = useRef<HTMLElement>(null);
  const { t } = useI18n();

  useGSAP(
    () => {
      gsap.from(".step-item", {
        x: -24,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: root.current, start: "top 72%" },
      });
      gsap.from(".step-line", {
        scaleY: 0,
        transformOrigin: "top",
        duration: 1.4,
        ease: "power2.out",
        scrollTrigger: { trigger: root.current, start: "top 70%" },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="mx-auto max-w-7xl px-5 py-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted">{t.pages.processKicker}</p>
      <h2 className="font-display mt-3 text-4xl md:text-5xl">{t.process.title}</h2>
      <p className="mt-4 text-muted">{t.process.subtitle}</p>
      <div className="relative mt-16">
        <div className="step-line absolute top-0 left-[19px] hidden h-full w-px bg-gradient-to-b from-royal via-silver to-transparent md:block" />
        <ol className="space-y-10">
          {STEPS.map((s) => (
            <li key={s.n} className="step-item grid gap-4 md:grid-cols-[88px_1fr] md:items-start">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-xs tracking-widest">
                {s.n}
              </span>
              <div>
                <h3 className="text-xl">{t.process[s.title]}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{t.process[s.desc]}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <ShippingNotice className="mt-14 max-w-2xl" />
    </section>
  );
}
