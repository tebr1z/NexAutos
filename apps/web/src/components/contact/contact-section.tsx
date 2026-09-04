"use client";

import { SITE } from "@/lib/constants";
import { ContactForm } from "@/components/contact/contact-form";
import { SitePhones } from "@/components/layout/site-phones";
import { ShippingNotice } from "@/components/layout/shipping-notice";
import { useI18n } from "@/providers/i18n-provider";

export function ContactSection() {
  const { t } = useI18n();
  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 pt-32 pb-24 md:grid-cols-2 md:px-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted">{t.contactPage.kicker}</p>
        <h1 className="font-display mt-3 text-5xl md:text-6xl">{t.contactPage.title}</h1>
        <p className="mt-4 max-w-md text-muted leading-7">{t.contactPage.subtitle}</p>

        <dl className="mt-12 space-y-8 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">{t.contactPage.email}</dt>
            <dd className="mt-2">
              <a href={`mailto:${SITE.email}`} className="text-fg hover:text-royal">
                {SITE.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">{t.contactPage.phone}</dt>
            <dd className="mt-3">
              <SitePhones />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">{t.contactPage.address}</dt>
            <dd className="mt-2 text-fg">{SITE.address}</dd>
          </div>
        </dl>

        <ShippingNotice className="mt-14" />
      </div>
      <ContactForm />
    </div>
  );
}
