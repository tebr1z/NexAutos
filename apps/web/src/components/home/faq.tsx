"use client";

import Link from "next/link";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/providers/i18n-provider";

export function FAQ({ standalone = false }: { standalone?: boolean }) {
  const { t } = useI18n();
  return (
    <section className={standalone ? "mx-auto max-w-3xl px-5 pt-32 pb-28 md:px-8" : "mx-auto max-w-3xl px-5 py-24 md:px-8"}>
      {standalone && <p className="text-[11px] uppercase tracking-[0.32em] text-muted">{t.faq.kicker}</p>}
      <h2 className={`font-display ${standalone ? "mt-3 text-4xl text-fg md:text-5xl" : "text-4xl"}`}>{t.faq.title}</h2>
      {standalone && <p className="mt-6 text-sm leading-7 text-muted">{t.faq.intro}</p>}

      <Accordion.Root type="single" collapsible className="mt-10 divide-y divide-line">
        {t.faq.items.map((item, i) => (
          <Accordion.Item key={item.q} value={`item-${i}`} className="py-5">
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full items-start justify-between gap-4 text-left text-[17px] leading-snug text-fg data-[state=open]:text-royal">
                {item.q}
                <ChevronDown
                  size={18}
                  className="mt-0.5 shrink-0 text-muted transition group-data-[state=open]:rotate-180"
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-none">
              <p className="pt-3 text-sm leading-7 text-muted">{item.a}</p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>

      {standalone && (
        <p className="mt-14 text-sm leading-7 text-muted">
          {t.faq.more}{" "}
          <Link href="/terms" className="text-fg underline-offset-4 hover:underline">
            {t.footer.terms}
          </Link>
          {" · "}
          <Link href="/privacy" className="text-fg underline-offset-4 hover:underline">
            {t.footer.privacy}
          </Link>
          {" · "}
          <Link href="/track" className="text-fg underline-offset-4 hover:underline">
            {t.nav.track}
          </Link>
          {" · "}
          <Link href="/contact" className="text-fg underline-offset-4 hover:underline">
            {t.nav.contact}
          </Link>
        </p>
      )}
    </section>
  );
}
