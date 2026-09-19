"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { INSURANCE_STATUS_OPTIONS, insurancePublicPath, insuranceStatusLabel, normalizeInsuranceStatus } from "@/lib/insurance";
import { listLocalOrders } from "@/lib/local-orders";
import { normalizePhone } from "@/lib/sms";
import type { TrackingShipment } from "@/lib/types";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

const EMPTY = {
  firstName: "",
  lastName: "",
  phone: "",
  docSeries: "",
  trustee: "",
  amountAzn: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  status: "DRAFT",
};

export default function AdminInsurancePage() {
  const [orders, setOrders] = useState<TrackingShipment[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .orders()
      .then((rows) => setOrders(rows.length ? rows : listLocalOrders()))
      .catch(() => setOrders(listLocalOrders()));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((row) => {
      const hay = [row.trackingCode, row.customerName, row.vin, row.make, row.model, row.insurance?.status]
        .join(" ")
        .toLowerCase();
      return !q || hay.includes(q);
    });
  }, [orders, query]);

  const selected = orders.find((row) => (row.id || row.trackingCode) === selectedId) ?? null;

  function pick(order: TrackingShipment) {
    setSelectedId(order.id || order.trackingCode);
    setForm({
      firstName: order.insurance?.firstName ?? "",
      lastName: order.insurance?.lastName ?? "",
      phone: order.customerPhone ?? "",
      docSeries: order.insurance?.docSeries ?? "",
      trustee: order.insurance?.trustee ?? "",
      amountAzn: order.insurance?.amountAzn ?? "",
      vin: order.vin?.startsWith("SIG") ? "" : order.vin ?? "",
      make: order.make ?? "",
      model: order.model ?? "",
      year: order.year ? String(order.year) : "",
      status: normalizeInsuranceStatus(order.insurance?.status),
    });
    setNotice("");
    setError("");
  }

  function startNew() {
    setSelectedId("__new__");
    setForm(EMPTY);
    setNotice("");
    setError("");
  }

  async function ensureRecord() {
    if (selected?.id) return selected;
    const phone = normalizePhone(form.phone);
    if (!phone) throw new Error("Telefon yazın — maşın olmadan da sığorta açılır.");
    const firstName = form.firstName.trim();
    if (!firstName) throw new Error("Ad yazın.");
    const created = await api.createInsurance({
      firstName,
      lastName: form.lastName.trim() || undefined,
      phone,
      docSeries: form.docSeries.trim() || undefined,
      trustee: form.trustee.trim() || undefined,
      amountAzn: form.amountAzn.trim() || undefined,
      vin: form.vin.trim() || undefined,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      year: form.year.trim() ? Number(form.year) : undefined,
    });
    setOrders((list) => [created, ...list.filter((row) => row.id !== created.id)]);
    pick(created);
    return created;
  }

  async function save(notify: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const target = await ensureRecord();
      if (!target.id) throw new Error("Sığorta yazılmadı.");
      const saved = await api.updateInsurance(target.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        docSeries: form.docSeries.trim(),
        trustee: form.trustee.trim(),
        amountAzn: form.amountAzn.trim(),
        vin: form.vin.trim() || undefined,
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        year: form.year.trim() ? Number(form.year) : undefined,
        status: form.status,
        notify,
      });
      setOrders((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));
      const label = insuranceStatusLabel(saved.insurance?.status || form.status);
      if (!notify) setNotice(`Sığorta saxlanıldı — ${label}.`);
      else if (!normalizePhone(form.phone || target.customerPhone)) setNotice("Saxlanıldı. Nömrə yoxdur — SMS getmədi.");
      else if (saved.notify?.sent) setNotice(`Saxlanıldı. Müştəriyə link getdi (${label}).`);
      else setNotice(saved.notify?.error || `Saxlanıldı — ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yazılmadı.");
    } finally {
      setBusy(false);
    }
  }

  async function sendContract() {
    const customerName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim() || selected?.customerName || "";
    const docSeries = form.docSeries.trim() || selected?.insurance?.docSeries?.trim() || "";
    if (!customerName.trim()) {
      setError("Ad və soyad yazın.");
      return;
    }
    if (!docSeries) {
      setError("Şəxsiyyət vəsiqəsi seriyasını yazın — müqaviləyə düşəcək.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const target = await ensureRecord();
      const phone = normalizePhone(form.phone || target.customerPhone);
      if (!phone) throw new Error("Müştəri telefonu yoxdur — müqavilə göndərilmir.");
      const saved = await api.updateInsurance(target.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        docSeries,
        trustee: form.trustee.trim(),
        amountAzn: form.amountAzn.trim(),
        vin: form.vin.trim() || undefined,
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        year: form.year.trim() ? Number(form.year) : undefined,
        status: "SIGN_WAIT",
        notify: false,
      });
      setOrders((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));
      setForm((prev) => ({ ...prev, status: "SIGN_WAIT", docSeries }));
      const created = await api.createContract({
        kind: "INSURANCE",
        customerName: customerName.trim(),
        customerPhone: phone,
        customerIdNumber: docSeries,
        extraTerms: form.trustee.trim() || undefined,
        amountAzn: form.amountAzn.trim() || undefined,
        orderId: target.id,
        trackingCode: target.trackingCode,
        vin: form.vin.trim() || (target.vin?.startsWith("SIG") ? undefined : target.vin),
        make: form.make.trim() || target.make,
        model: form.model.trim() || target.model,
        year: form.year.trim() ? Number(form.year) : target.year,
      });
      const sent = created.notify?.whatsapp?.sent || created.notify?.email?.sent;
      setNotice(
        sent
          ? `Sığorta müqaviləsi göndərildi. İmza: ${created.publicUrl}`
          : created.notify?.whatsapp?.error || `Müqavilə yaradıldı. Link: ${created.publicUrl}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Müqavilə göndərilmədi.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPayoutCheck() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const target = await ensureRecord();
      const saved = await api.updateInsurance(target.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        docSeries: form.docSeries.trim(),
        trustee: form.trustee.trim(),
        amountAzn: form.amountAzn.trim(),
        notify: false,
      });
      setOrders((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));
      const result = await api.confirmInsurancePayout(target.id);
      setOrders((list) => list.map((row) => (row.id === result.id ? { ...row, ...result } : row)));
      setForm((prev) => ({ ...prev, status: result.insurance?.status || "TRANSFERRED" }));
      const sent = result.notify?.sent;
      setNotice(
        sent
          ? `Çek göndərildi: pul sizə köçürülmüşdür. ${result.receiptUrl}`
          : result.notify?.error || `Çek hazırdır: ${result.receiptUrl}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Çek göndərilmədi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl">Sığorta</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Maşın seçmədən də sığorta aça bilərsiniz. İmza gözləyəndə müştəri mütləq imzalamalıdır.
        Ayrılan məbləğ əvvəldən boş qala bilər — sonra yazırsınız.
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-emerald-400">{notice}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kod, müştəri, VIN, marka…"
          className={`${inp} flex-1`}
        />
        <button
          type="button"
          onClick={startNew}
          className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black"
        >
          Yeni sığorta
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Maşın</th>
                <th className="px-4 py-3">Müştəri</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const id = row.id || row.trackingCode;
                return (
                  <tr
                    key={id}
                    onClick={() => pick(row)}
                    className={`cursor-pointer border-t border-white/5 ${
                      selectedId === id ? "bg-sky-500/10" : "hover:bg-white/5"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-sky-300">{row.trackingCode}</p>
                      <p className="mt-0.5 text-zinc-200">
                        {[row.year, row.make, row.model].filter(Boolean).join(" ") ||
                          (row.vin?.startsWith("SIG") ? "Maşınsız sığorta" : "—")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{row.customerName}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      <p>{insuranceStatusLabel(row.insurance?.status)}</p>
                      {row.insurance?.amountAzn ? (
                        <p className="mt-0.5 text-[11px] text-zinc-500">{row.insurance.amountAzn} AZN</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? <p className="px-4 py-8 text-sm text-zinc-500">Maşın tapılmadı.</p> : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {!selectedId ? (
            <p className="text-sm text-zinc-500">Soldan maşın seçin və ya «Yeni sığorta» ilə maşınsız açın.</p>
          ) : (
            <>
              <p className="font-mono text-xs text-sky-300">{selected?.trackingCode || "Yeni sığorta"}</p>
              <p className="mt-1 text-lg text-white">
                {[selected?.year, selected?.make, selected?.model].filter(Boolean).join(" ") ||
                  (selected?.vin?.startsWith("SIG") || selectedId === "__new__"
                    ? "Maşınsız sığorta"
                    : selected?.customerName || "Yeni müştəri")}
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  placeholder="Ad"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className={inp}
                />
                <input
                  placeholder="Soyad"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className={inp}
                />
                <input
                  placeholder="Telefon"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inp}
                />
                <input
                  placeholder="Vəsiqə seriyası"
                  value={form.docSeries}
                  onChange={(e) => setForm({ ...form, docSeries: e.target.value.toUpperCase() })}
                  className={`${inp} font-mono`}
                />
                <input
                  placeholder="Etibar edilən şəxs (istəyə bağlı)"
                  value={form.trustee}
                  onChange={(e) => setForm({ ...form, trustee: e.target.value })}
                  className={inp}
                />
                <input
                  placeholder="Ayrılan məbləğ AZN (ilk başda boş ola bilər)"
                  value={form.amountAzn}
                  onChange={(e) => setForm({ ...form, amountAzn: e.target.value })}
                  className={inp}
                />
                <p className="text-xs text-zinc-500">Maşın sistemdə yoxdursa VIN, marka, model yazın.</p>
                <input
                  placeholder="VIN (alınmamış / sistemdə olmayan maşın)"
                  value={form.vin}
                  onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })}
                  className={`${inp} font-mono`}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    placeholder="Marka"
                    value={form.make}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
                    className={inp}
                  />
                  <input
                    placeholder="Model"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className={inp}
                  />
                  <input
                    placeholder="İl"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    className={inp}
                  />
                </div>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
                >
                  {INSURANCE_STATUS_OPTIONS.map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.az}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendContract()}
                  className="rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
                >
                  Sığorta müqaviləsi göndər
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendPayoutCheck()}
                  className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
                >
                  Pul köçürüldü — çek göndər
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(true)}
                  className="rounded-xl border border-sky-400/40 px-4 py-2.5 text-sm text-sky-200 disabled:opacity-50"
                >
                  Status linki göndər
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(false)}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-200 disabled:opacity-50"
                >
                  Yalnız saxla
                </button>
                {selected?.trackingCode ? (
                  <Link
                    href={insurancePublicPath(selected.trackingCode)}
                    target="_blank"
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-sky-300"
                  >
                    Müştəri səhifəsi ↗
                  </Link>
                ) : null}
                {selected?.insurance?.receiptUrl ? (
                  <Link
                    href={selected.insurance?.receiptUrl || "#"}
                    target="_blank"
                    className="rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm text-emerald-200"
                  >
                    Çek ↗
                  </Link>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
