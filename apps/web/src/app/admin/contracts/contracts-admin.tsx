"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, type ContractNotify, type ContractRecord } from "@/lib/api";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

const STATUS: Record<ContractRecord["status"], string> = {
  DRAFT: "Qaralama",
  SENT: "Göndərilib",
  PHONE_VERIFIED: "Telefon təsdiqlənib",
  READ: "Oxunub",
  SIGNED: "İmzalanıb",
  VOID: "Ləğv",
};

const EMPTY = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerAddress: "",
  customerIdNumber: "",
  origin: "",
  amountUsd: "",
  amountAzn: "",
  paymentNote: "",
  extraTerms: "",
};

function notifyLine(notify?: ContractNotify | null) {
  if (!notify) return "";
  const wa = notify.whatsapp?.sent
    ? `WhatsApp getdi (${notify.whatsapp.channel})`
    : `WhatsApp yox: ${notify.whatsapp?.error ?? "—"}`;
  const mail = notify.email?.sent ? "E-poçt getdi" : `E-poçt yox: ${notify.email?.error ?? "—"}`;
  return `${wa}. ${mail}.`;
}

export function ContractsAdmin() {
  const params = useSearchParams();
  const [rows, setRows] = useState<ContractRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [screen, setScreen] = useState<"list" | "create" | "view">("list");
  const [current, setCurrent] = useState<ContractRecord | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [lastNotify, setLastNotify] = useState<ContractNotify | null>(null);

  const prefilled = useMemo(
    () => ({
      customerName: params.get("name") ?? "",
      customerPhone: params.get("phone") ?? "",
      customerEmail: params.get("email") ?? "",
    }),
    [params],
  );

  useEffect(() => {
    api
      .contracts()
      .then(setRows)
      .catch(() => setError("Müqavilələr yüklənmədi. API işləyirmi?"));
  }, []);

  useEffect(() => {
    if (prefilled.customerName || prefilled.customerPhone) {
      setForm((f) => ({ ...f, ...prefilled }));
      setScreen("create");
    }
  }, [prefilled]);

  async function refresh() {
    const list = await api.contracts();
    setRows(list);
    if (current) {
      const next = list.find((row) => row.id === current.id);
      if (next) setCurrent(next);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await api.createContract({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        customerAddress: form.customerAddress || undefined,
        customerIdNumber: form.customerIdNumber || undefined,
        origin: form.origin || undefined,
        amountUsd: form.amountUsd || undefined,
        amountAzn: form.amountAzn || undefined,
        paymentNote: form.paymentNote || undefined,
        extraTerms: form.extraTerms || undefined,
      });
      setLastNotify(created.notify ?? null);
      setNotice(`Müqavilə ${created.number} yaradıldı. ${notifyLine(created.notify)}`);
      setCurrent(created);
      setScreen("view");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yaradılmadı.");
    }
    setSaving(false);
  }

  async function resend(row: ContractRecord) {
    try {
      const next = await api.resendContract(row.id);
      setLastNotify(next.notify ?? null);
      setCurrent(next);
      setNotice(notifyLine(next.notify));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Göndərilmədi.");
    }
  }

  async function downloadPdf(row: ContractRecord) {
    try {
      const blob = await api.contractPdf(row.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF yoxdur.");
    }
  }

  if (screen === "create") {
    return (
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => setScreen("list")} className="text-sm text-zinc-400 hover:text-white">
          ← Müqavilələr
        </button>
        <h1 className="font-display mt-4 text-3xl">Müştəri müqaviləsi</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Bu addım maşın alınmazdan əvvəldir. Müştəri imzalayır, sonra Maşınlar bölməsində avtomobil alınıb bu müştəriyə təyin olunur.
          Keçid WhatsApp və e-poçtla gedir: OTP → oxumaq → əl imzası → ikinci OTP.
        </p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <form className="mt-8 space-y-4" onSubmit={create}>
          <div className="grid gap-3 md:grid-cols-2">
            <input required placeholder="Müştəri adı *" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className={inp} />
            <input required placeholder="Telefon *" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} className={inp} />
            <input type="email" placeholder="E-poçt" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} className={inp} />
            <input placeholder="FİN / sənəd №" value={form.customerIdNumber} onChange={(e) => setForm({ ...form, customerIdNumber: e.target.value })} className={inp} />
            <input placeholder="Ünvan" value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} className={`${inp} md:col-span-2`} />
            <select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className={`${inp} bg-[#111]`}>
              <option value="">İxrac ölkəsi — sonra tapşırıqla</option>
              <option value="USA">ABŞ</option>
              <option value="KR">Koreya</option>
              <option value="CN">Çin</option>
              <option value="OTHER">Digər</option>
            </select>
            <input placeholder="Büdcə / depozit USD (istəyə bağlı)" value={form.amountUsd} onChange={(e) => setForm({ ...form, amountUsd: e.target.value })} className={inp} />
            <input placeholder="Büdcə AZN" value={form.amountAzn} onChange={(e) => setForm({ ...form, amountAzn: e.target.value })} className={inp} />
            <input placeholder="Ödəniş qeydi" value={form.paymentNote} onChange={(e) => setForm({ ...form, paymentNote: e.target.value })} className={`${inp} md:col-span-2`} />
            <textarea placeholder="Əlavə şərt" value={form.extraTerms} onChange={(e) => setForm({ ...form, extraTerms: e.target.value })} className={`${inp} min-h-24 md:col-span-2`} />
          </div>
          <button disabled={saving} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-50">
            {saving ? "Göndərilir…" : "Müqavilə yarat və keçidi göndər"}
          </button>
        </form>
      </div>
    );
  }

  if (screen === "view" && current) {
    const waMe = current.notifyMeta?.waMe || lastNotify?.waMe;
    return (
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setScreen("list")} className="text-sm text-zinc-400 hover:text-white">
          ← Müqavilələr
        </button>
        <h1 className="font-display mt-4 text-3xl">{current.number}</h1>
        <p className="mt-1 text-sm text-sky-300">{STATUS[current.status]}</p>
        {notice && <p className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">{notice}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <dl className="mt-8 grid gap-3 text-sm md:grid-cols-2">
          <Item label="Müştəri" value={current.customerName} />
          <Item label="Telefon" value={current.customerPhone} />
          <Item label="E-poçt" value={current.customerEmail} />
          <Item label="FİN" value={current.customerIdNumber} />
          <Item label="Ünvan" value={current.customerAddress} />
          <Item label="Büdcə" value={[current.amountUsd && `${current.amountUsd} USD`, current.amountAzn && `${current.amountAzn} AZN`].filter(Boolean).join(" · ")} />
          <Item label="Təyin olunmuş maşın" value={[current.year, current.make, current.model].filter(Boolean).join(" ") || (current.trackingCode ? "təyin edilib" : "hələ alınmayıb")} />
          <Item label="İzləmə kodu" value={current.trackingCode} />
          <Item label="VIN" value={current.vin} />
          <Item label="Telefon OTP" value={current.phoneVerifiedAt ? new Date(current.phoneVerifiedAt).toLocaleString() : "—"} />
          <Item label="Oxunub" value={current.readAt ? new Date(current.readAt).toLocaleString() : "—"} />
          <Item label="İmza" value={current.signedAt ? new Date(current.signedAt).toLocaleString() : "—"} />
          <Item label="IP" value={current.signerIp} />
        </dl>
        {current.documentHash && (
          <p className="mt-4 break-all font-mono text-[11px] text-zinc-500">SHA-256 {current.documentHash}</p>
        )}
        {current.signaturePng && (
          <img src={current.signaturePng} alt="İmza" className="mt-4 h-20 rounded-xl bg-white" />
        )}
        {current.lastOtpPreview && current.status !== "SIGNED" && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            SMS qurulmayıb — son kod: <span className="font-mono">{current.lastOtpPreview}</span>
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <a href={current.publicUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2.5 text-sm text-black">
            İmza səhifəsi
          </a>
          <button type="button" onClick={() => void navigator.clipboard.writeText(current.publicUrl)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
            Keçidi kopyala
          </button>
          {waMe && (
            <a href={waMe} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
              WhatsApp-dan əl ilə göndər
            </a>
          )}
          <button type="button" onClick={() => void resend(current)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
            WhatsApp + e-poçt yenidən
          </button>
          {current.status === "SIGNED" && (
            <a
              href={`/admin?contract=${encodeURIComponent(current.id)}`}
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-black"
            >
              {current.trackingCode ? "Maşını yenilə" : "Maşın al və təyin et"}
            </a>
          )}
          {current.status === "SIGNED" && (
            <button type="button" onClick={() => void downloadPdf(current)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
              PDF
            </button>
          )}
          {current.status !== "SIGNED" && current.status !== "VOID" && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Müqavilə ləğv edilsin?")) return;
                const next = await api.voidContract(current.id);
                setCurrent(next);
                await refresh();
              }}
              className="rounded-xl px-4 py-2.5 text-sm text-red-400"
            >
              Ləğv et
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Müqavilələr</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Birinci addım: müştəri müqaviləsi. Maşın sonra alınır və imzalamış müştəriyə təyin olunur.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            setScreen("create");
          }}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black"
        >
          Yeni müqavilə
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {notice && <p className="mt-4 text-sm text-sky-300">{notice}</p>}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-3">№</th>
              <th>Müştəri</th>
              <th>Təyin</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-zinc-500">
                  Hələ müqavilə yoxdur.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="py-3 font-mono text-sky-400">{row.number}</td>
                <td>
                  {row.customerName}
                  <span className="mt-1 block text-[11px] text-zinc-500">{row.customerPhone}</span>
                </td>
                <td>
                  {row.trackingCode
                    ? [row.year, row.make, row.model].filter(Boolean).join(" ") || row.trackingCode
                    : "hələ yox"}
                </td>
                <td>{STATUS[row.status]}</td>
                <td className="text-right">
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      className="text-xs text-sky-400 hover:underline"
                      onClick={() => {
                        setCurrent(row);
                        setScreen("view");
                      }}
                    >
                      Aç
                    </button>
                    {row.status === "SIGNED" && !row.trackingCode && (
                      <a href={`/admin?contract=${encodeURIComponent(row.id)}`} className="text-xs text-zinc-400 hover:text-white hover:underline">
                        Maşın təyin et
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-white">{value || "—"}</dd>
    </div>
  );
}
