"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { insuranceStatusLabel } from "@/lib/insurance";
import { useI18n } from "@/providers/i18n-provider";

type InsuranceView = {
  trackingCode: string;
  make?: string;
  model?: string;
  year?: number;
  vinHint?: string;
  firstName?: string;
  lastName?: string;
  docSeries?: string;
  trustee?: string;
  status: string;
};

export function InsuranceStatus({ code }: { code: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<InsuranceView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .insurance(code)
      .then((row) => {
        if (live) setData(row);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [code]);

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-5 pb-24 pt-32 text-center">
        <h1 className="font-display text-3xl">{t.track.insuranceNotFound}</h1>
        <p className="mt-3 text-muted">{t.track.notFound}</p>
        <Link href="/track" className="mt-8 inline-block rounded-2xl bg-fg px-5 py-3 text-sm text-bg">
          {t.track.searchAgain}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-5 pb-24 pt-32 text-center text-muted">{t.track.pending}</div>
    );
  }

  const person = [data.firstName, data.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-royal/10 text-royal">
          <ShieldCheck size={22} />
        </span>
        <p className="mt-6 text-[11px] uppercase tracking-[0.4em] text-muted">{t.track.insuranceKicker}</p>
        <h1 className="font-display mt-3 text-4xl">{t.track.insuranceTitle}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">{t.track.insuranceSub}</p>
      </div>

      <div className="mt-10 rounded-3xl border border-line bg-card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{t.track.status}</p>
        <p className="mt-2 text-2xl text-royal">{insuranceStatusLabel(data.status)}</p>
        <p className="mt-2 font-mono text-sm text-muted">{data.trackingCode}</p>
        <dl className="mt-6 space-y-3 text-sm">
          <Row label={t.track.yourCar} value={[data.year, data.make, data.model].filter(Boolean).join(" ") || "—"} />
          <Row label="VIN" value={data.vinHint || "—"} />
          <Row label={t.track.insuranceName} value={person || t.track.insuranceLater} />
          <Row label={t.track.insuranceDoc} value={data.docSeries || t.track.insuranceLater} />
          {data.trustee ? <Row label={t.track.insuranceTrustee} value={data.trustee} /> : null}
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/track/${data.trackingCode}`}
          className="rounded-2xl bg-fg px-5 py-3 text-sm font-medium text-bg"
        >
          {t.track.title}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line pt-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
