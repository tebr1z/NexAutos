"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { HERO_POSTER, HERO_VIDEO } from "@/lib/constants";
import { useI18n } from "@/providers/i18n-provider";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const { t } = useI18n();

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduce ? 0 : 1.1;
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration } });
      tl.from(".hero-kicker", { y: 20, autoAlpha: 0 })
        .from(".hero-title", { y: 40, autoAlpha: 0 }, "-=0.7")
        .from(".hero-sub", { y: 24, autoAlpha: 0 }, "-=0.75")
        .from(".hero-cta", { y: 16, autoAlpha: 0, stagger: 0.08 }, "-=0.7")
        .from(".hero-scroll", { autoAlpha: 0 }, "-=0.4");

      gsap.to(".hero-video", {
        yPercent: 12,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative min-h-[620px] h-[100svh] overflow-hidden">
      <div className="hero-video absolute inset-0 h-[115%] w-full will-change-transform">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_POSTER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_POSTER}
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/90" />
      <div className="noise pointer-events-none absolute inset-0 opacity-[0.12]" />

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-12 sm:pb-20 md:px-8 md:pb-24">
        <p className="hero-kicker max-w-full text-[10px] uppercase tracking-[0.35em] text-zinc-300 sm:text-[11px] sm:tracking-[0.48em]">{t.hero.kicker}</p>
        <h1 className="hero-title font-display mt-5 max-w-4xl text-[2.5rem] leading-[1.03] text-white sm:text-6xl lg:text-7xl">
          {t.hero.title}
        </h1>
        <p className="hero-sub mt-6 max-w-xl text-lg text-zinc-300 md:text-xl">{t.hero.subtitle}</p>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:flex sm:flex-wrap sm:items-center">
          <Link
            href="/track"
            className="hero-cta inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-black transition hover:bg-zinc-200"
          >
            {t.hero.track}
          </Link>
          <Link
            href="/cars"
            className="hero-cta glass rounded-full px-7 py-3.5 text-center text-sm text-white"
          >
            {t.hero.find}
          </Link>
        </div>
        <div className="hero-scroll mt-8 hidden items-center gap-3 text-[11px] uppercase tracking-[0.4em] text-zinc-400 sm:flex lg:mt-12">
          <span className="h-10 w-px bg-zinc-500" />
          {t.hero.scroll}
        </div>
      </div>
    </section>
  );
}
