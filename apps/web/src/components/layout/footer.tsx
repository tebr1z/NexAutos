"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SITE } from "@/lib/constants";
import { SitePhones } from "@/components/layout/site-phones";
import { useI18n } from "@/providers/i18n-provider";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted">{t.footer.brand}</p>
        </div>
        <div className="space-y-3 text-sm text-muted">
          <p className="text-fg">{t.footer.studio}</p>
          <p>{SITE.address}</p>
          <a href={`mailto:${SITE.email}`} className="block">
            {SITE.email}
          </a>
          <SitePhones compact />
        </div>
        <div className="space-y-3 text-sm text-muted">
          <p className="text-fg">{t.footer.platform}</p>
          <Link href="/cars" className="block">
            {t.nav.cars}
          </Link>
          <Link href="/track" className="block">
            {t.nav.track}
          </Link>
          <Link href="/faq" className="block">
            {t.nav.faq}
          </Link>
          <Link href="/privacy" className="block">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="block">
            {t.footer.terms}
          </Link>
        </div>
      </div>
      <div className="metallic-line h-px w-full" />
      <div className="mx-auto flex max-w-7xl justify-between px-5 py-6 text-xs text-muted md:px-8">
        <span>© {new Date().getFullYear()} Auto Nex. {t.footer.rights}</span>
        <span>{t.footer.cities}</span>
      </div>
    </footer>
  );
}
