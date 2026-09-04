"use client";

import { SITE } from "@/lib/constants";
import { useI18n } from "@/providers/i18n-provider";

export function SitePhones({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [primary, ...rest] = SITE.phones;

  if (compact) {
    return (
      <div className="space-y-2">
        {SITE.phones.map((p) => (
          <p key={p.tel} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a href={`tel:${p.tel}`} className="tabular-nums text-fg hover:text-royal">
              {p.display}
            </a>
            <a
              href={`https://wa.me/${p.wa}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-muted hover:text-fg"
            >
              {t.shipping.whatsapp}
            </a>
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted">{t.shipping.primary}</p>
        <a href={`tel:${primary.tel}`} className="font-display mt-2 block text-3xl tracking-tight md:text-4xl">
          {primary.display}
        </a>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/${primary.wa}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] hover:border-fg"
          >
            {t.shipping.whatsapp}
          </a>
          <a
            href={`tel:${primary.tel}`}
            className="rounded-full border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] hover:border-fg"
          >
            {t.shipping.call}
          </a>
        </div>
      </div>
      <div className="space-y-3">
        {rest.map((p) => (
          <p key={p.tel} className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
            <a href={`tel:${p.tel}`} className="tabular-nums">
              {p.display}
            </a>
            <a
              href={`https://wa.me/${p.wa}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-muted hover:text-fg"
            >
              {t.shipping.whatsapp}
            </a>
          </p>
        ))}
      </div>
    </div>
  );
}
