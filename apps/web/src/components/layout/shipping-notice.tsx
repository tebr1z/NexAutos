"use client";

import { useI18n } from "@/providers/i18n-provider";

export function ShippingNotice({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <aside className={`border-l border-royal/35 pl-5 ${className}`}>
      <p className="text-[11px] uppercase tracking-[0.32em] text-muted">{t.shipping.kicker}</p>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{t.shipping.lead}</p>
      <p className="mt-2 max-w-xl text-sm leading-7 text-muted">{t.shipping.force}</p>
    </aside>
  );
}
