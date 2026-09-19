"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { INSURANCE_STATUSES, insurancePublicPath, insuranceStatusLabel } from "@/lib/insurance";
import { listLocalOrders } from "@/lib/local-orders";
import { normalizePhone } from "@/lib/sms";
import type { TrackingShipment } from "@/lib/types";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

const EMPTY = {
  firstName: "",
  lastName: "",
  docSeries: "",
  trustee: "",
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
      docSeries: order.insurance?.docSeries ?? "",
      trustee: order.insurance?.trustee ?? "",
      status: order.insurance?.status || "DRAFT",
    });
    setNotice("");
    setError("");
  }

  async function save(notify: boolean) {
    if (!selected?.id) {
      setError("Bu maşın serverdə yoxdur. Əvvəl Maşınlar səhifəsində yadda saxlayın.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api.updateInsurance(selected.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        docSeries: form.docSeries.trim(),
        trustee: form.trustee.trim(),
        status: form.status,
        notify,
      });
      setOrders((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));
      const label = insuranceStatusLabel(saved.insurance?.status || form.status);
      if (!notify) setNotice(`Sığorta saxlanıldı — ${label}.`);
      else if (!normalizePhone(selected.customerPhone)) setNotice("Saxlanıldı. Nömrə yoxdur — SMS getmədi.");
      else if (saved.notify?.sent) setNotice(`Saxlanıldı. Müştəriyə link getdi (${label}).`);
      else setNotice(saved.notify?.error || `Saxlanıldı — ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yazılmadı.");
    } finally {
      setBusy(false);
    }
  }

  async function sendContract() {
    if (!selected?.id) {
      setError("Bu maşın serverdə yoxdur. Əvvəl Maşınlar səhifəsində yadda saxlayın.");
      return;
    }
    const phone = normalizePhone(selected.customerPhone);
    if (!phone) {
      setError("Müştəri telefonu yoxdur — müqavilə göndərilmir.");
      return;
    }
    const customerName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim() || selected.customerName;
    if (!customerName?.trim()) {
      setError("Ad və soyad yazın.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api.updateInsurance(selected.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        docSeries: form.docSeries.trim(),
        trustee: form.trustee.trim(),
        status: "PROCESSING",
        notify: false,
      });
      setOrders((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));
      setForm((prev) => ({ ...prev, status: "PROCESSING" }));
      const created = await api.createContract({
        kind: "INSURANCE",
        customerName: customerName.trim(),
        customerPhone: phone,
        customerIdNumber: form.docSeries.trim() || undefined,
        extraTerms: form.trustee.trim() || undefined,
        orderId: selected.id,
        trackingCode: selected.trackingCode,
        vin: selected.vin,
        make: selected.make,
        model: selected.model,
        year: selected.year,
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

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl">Sığorta</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Bütün maşınların sığortası buradadır. Vəsiqəni doldurub sığorta müqaviləsini SMS ilə göndərin;
        müştəri OTP və əl imzası atır, imzadan sonra pulun hesaba köçəcəyi barədə qısa SMS gedir.
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-emerald-400">{notice}</p> : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Kod, müştəri, VIN, marka…"
        className={`${inp} mt-6`}
      />

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
                      <p className="mt-0.5 text-zinc-200">{[row.year, row.make, row.model].filter(Boolean).join(" ") || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{row.customerName}</td>
                    <td className="px-4 py-3 text-zinc-400">{insuranceStatusLabel(row.insurance?.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? <p className="px-4 py-8 text-sm text-zinc-500">Maşın tapılmadı.</p> : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {!selected ? (
            <p className="text-sm text-zinc-500">Soldan maşın seçin.</p>
          ) : (
            <>
              <p className="font-mono text-xs text-sky-300">{selected.trackingCode}</p>
              <p className="mt-1 text-lg text-white">
                {[selected.year, selected.make, selected.model].filter(Boolean).join(" ") || selected.customerName}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{selected.customerPhone || "nömrə yoxdur"}</p>
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
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
                >
                  {INSURANCE_STATUSES.map((row) => (
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
                <Link
                  href={insurancePublicPath(selected.trackingCode)}
                  target="_blank"
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-sky-300"
                >
                  Müştəri səhifəsi ↗
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
