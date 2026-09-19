"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Receipt = {
  trackingCode: string;
  customerName: string;
  docSeries?: string;
  trustee?: string;
  make?: string;
  model?: string;
  year?: number;
  vinHint?: string;
  paidOutAt: string;
  message: string;
};

export function InsuranceCheck({ token }: { token: string }) {
  const [data, setData] = useState<Receipt | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .insuranceReceipt(token)
      .then(setData)
      .catch((err: Error) => setError(err.message || "Çek tapılmadı."));
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center">
        <h1 className="font-display text-3xl">Çek tapılmadı</h1>
        <p className="mt-3 text-sm text-muted">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="px-5 pt-32 text-sm text-muted">Çek yüklənir…</p>;
  }

  const paid = new Date(data.paidOutAt).toLocaleString("az-AZ");
  const car = [data.year, data.make, data.model].filter(Boolean).join(" ");

  return (
    <article className="mx-auto max-w-lg px-5 pb-24 pt-28">
      <div className="rounded-[28px] border border-emerald-400/30 bg-gradient-to-b from-emerald-500/10 to-transparent p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-300">Auto Nex · elektron çek</p>
        <h1 className="mt-4 font-sans text-3xl font-semibold leading-tight text-fg">Pul sizə köçürülmüşdür</h1>
        <p className="mt-3 font-sans text-sm leading-7 text-muted">
          Sığorta haqqı hesabınıza köçürülüb. Bu səhifə ödəniş təsdiqidir.
        </p>

        <dl className="mt-8 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/20">
          <Row label="Müştəri" value={data.customerName} />
          <Row label="Şəxsiyyət vəsiqəsi seriyası" value={data.docSeries || "—"} />
          {data.trustee ? <Row label="Etibar edilən" value={data.trustee} /> : null}
          <Row label="Avtomobil" value={car || "—"} />
          <Row label="VIN" value={data.vinHint || "—"} />
          <Row label="İzləmə kodu" value={data.trackingCode} />
          <Row label="Köçürmə vaxtı" value={paid} />
        </dl>

        <p className="mt-6 text-center font-sans text-lg font-medium text-emerald-200">{data.message}</p>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link
          href={`/track/${data.trackingCode}`}
          className="rounded-xl bg-fg px-5 py-3 text-sm text-bg"
        >
          İzləmə
        </Link>
        <Link
          href={`/insurance/${data.trackingCode}`}
          className="rounded-xl border border-line px-5 py-3 text-sm"
        >
          Sığorta statusu
        </Link>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="font-sans text-xs text-muted">{label}</dt>
      <dd className="font-sans text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}
