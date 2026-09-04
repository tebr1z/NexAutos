"use client";

import { useEffect, useState } from "react";
import { api, type Inquiry } from "@/lib/api";

export default function InquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .inquiries()
      .then(setRows)
      .catch(() => setError("Müraciətlər yüklənmədi."));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl">Müştəri müraciətləri</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Saytdakı Əlaqə formasından gələn mesajlar burada görünür.
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <div className="mt-8 space-y-3">
        {rows.length === 0 && !error && (
          <p className="text-sm text-zinc-500">Hələ müraciət yoxdur.</p>
        )}
        {rows.map((row) => (
          <article
            key={row.id}
            className={`rounded-2xl border p-5 ${row.isRead ? "border-white/10" : "border-sky-500/40 bg-sky-500/5"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{row.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {[row.email, row.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <p className="text-xs text-zinc-500">{new Date(row.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">{row.body}</p>
            {!row.isRead && (
              <button
                type="button"
                className="mt-3 text-xs text-sky-400 hover:underline"
                onClick={async () => {
                  await api.markInquiryRead(row.id).catch(() => null);
                  setRows((list) => list.map((item) => (item.id === row.id ? { ...item, isRead: true } : item)));
                }}
              >
                Oxundu
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
