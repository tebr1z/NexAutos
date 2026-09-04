"use client";

import { useRef } from "react";
import { ShieldCheck, Search, Lock, Landmark, Truck, Radio } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useI18n } from "@/providers/i18n-provider";

const CARDS = [
  { icon: ShieldCheck, title: "official", desc: "officialD" },
  { icon: Search, title: "inspect", desc: "inspectD" },
  { icon: Lock, title: "payments", desc: "paymentsD" },
  { icon: Landmark, title: "customs", desc: "customsD" },
  { icon: Truck, title: "door", desc: "doorD" },
  { icon: Radio, title: "live", desc: "liveD" },
] as const;

export function Why() {
  const root = useRef<HTMLElement>(null);
  const { t } = useI18n();

  useGSAP(
    () => {
      gsap.from(".why-card", {
        y: 36,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root.current, start: "top 75%" },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="mx-auto max-w-7xl px-5 py-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted">{t.pages.whyKicker}</p>
      <h2 className="font-display mt-3 text-4xl md:text-5xl">{t.why.title}</h2>
      <p className="mt-4 max-w-2xl text-muted">{t.why.subtitle}</p>
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <article
            key={card.title}
            className="why-card glass group rounded-3xl p-7 transition duration-500 hover:-translate-y-1 hover:shadow-glow"
          >
            <card.icon className="text-royal" size={22} />
            <h3 className="mt-5 text-lg font-medium">{t.why[card.title]}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{t.why[card.desc]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
