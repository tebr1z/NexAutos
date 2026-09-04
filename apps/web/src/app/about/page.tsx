"use client";

import Image from "next/image";
import { useI18n } from "@/providers/i18n-provider";

export default function AboutPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-5xl px-5 pt-32 pb-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.4em] text-muted">{t.pages.aboutKicker}</p>
      <h1 className="font-display mt-3 text-5xl md:text-6xl">{t.pages.aboutTitle}</h1>
      <p className="mt-8 max-w-2xl text-lg leading-8 text-muted">{t.pages.aboutBody}</p>
      <div className="relative mt-14 aspect-[16/8] overflow-hidden rounded-3xl">
        <Image
          src="https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=1800&q=80"
          alt="Auto Nex"
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover"
        />
      </div>
    </div>
  );
}
