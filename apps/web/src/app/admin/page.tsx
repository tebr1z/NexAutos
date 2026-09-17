"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, type ContractRecord, type OceanLookup } from "@/lib/api";
import { enrichKnownContainer, lookupCarrier, oceanFields, findPortCoords } from "@/lib/carriers";
import { generateTrackingCode, previewTrackingCode } from "@/lib/tracking-code";
import {
  listLocalOrders,
  saveLocalOrder,
  updateLocalOrder,
  replaceLocalOrder,
  mergeRemotePreserveLocal,
} from "@/lib/local-orders";
import type { TrackingShipment } from "@/lib/types";
import { TRACKING_STEPS, locationForStatus, isLiveVesselMapStatus, type ShipmentStatus } from "@/lib/constants";
import { normalizePhone } from "@/lib/sms";
import { buildJourney, journeyPosition, selectedJourneyValue, transitLabel, normalizeTransits } from "@/lib/journey";
import { EMPTY_VOYAGE, VoyageFields, type VoyageValues } from "@/components/admin/voyage-fields";
import { PhotoFields } from "@/components/admin/photo-fields";
import { emptyPhotos, flattenPhotos, photosFromList, type PhotosByCategory } from "@/lib/photo-categories";
import { daysLeftInArchive, isDelivered, normalizeTrackingCode } from "@/lib/archive";

type NotifyInfo = { sent?: boolean; channel?: string; error?: string };
type Screen = "list" | "create" | "edit";

const inp =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

const EMPTY_FORM = {
  customerName: "",
  phone: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  containerNumber: "",
};

function parseCoord(raw?: string) {
  if (!raw?.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function stageNotice(label: string, phone: string | undefined, notify?: NotifyInfo) {
  if (notify?.error === "skipped") return `${label} yeniləndi. Bu mərhələ üçün WhatsApp/SMS getmir.`;
  if (!normalizePhone(phone)) return `${label} yeniləndi. WhatsApp nömrəsi yoxdur — SMS getmədi.`;
  if (notify?.sent) return `${label} yeniləndi. Müştəriyə SMS göndərildi.`;
  if (notify?.error === "not_configured") {
    return `${label} yeniləndi. SMS xidməti qurulmayıb — Twilio və ya WhatsApp açarını .env-ə yazın.`;
  }
  return `${label} yeniləndi. SMS göndərilmədi.`;
}

async function notifyLocal(order: TrackingShipment, status: string): Promise<NotifyInfo> {
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: order.customerPhone,
        trackingCode: order.trackingCode,
        status,
        make: order.make,
        model: order.model,
      }),
    });
    return (await res.json()) as NotifyInfo;
  } catch {
    return { sent: false, error: "notify_failed" };
  }
}

function stageLabel(order: TrackingShipment) {
  const { items, cursor } = journeyPosition(
    order.currentStatus,
    order.transitPorts,
    order.currentTransitIndex,
    "az",
    order.destinationPort,
  );
  return items[cursor]?.label ?? order.currentStatus;
}

function parseJourney(value: string, transitCount: number): { status: ShipmentStatus; transitIndex: number } {
  if (value.startsWith("transit:")) {
    const transitIndex = Number(value.slice("transit:".length));
    return { status: "IN_TRANSIT", transitIndex: Number.isFinite(transitIndex) ? transitIndex : -1 };
  }
  const status = value.replace(/^step:/, "") as ShipmentStatus;
  if (status === "IN_TRANSIT") return { status, transitIndex: -1 };
  const inTransit = TRACKING_STEPS.findIndex((s) => s.key === "IN_TRANSIT");
  const stepIndex = TRACKING_STEPS.findIndex((s) => s.key === status);
  return {
    status,
    transitIndex: stepIndex > inTransit ? transitCount : -1,
  };
}

export default function AdminHomePage() {
  const [orders, setOrders] = useState<TrackingShipment[]>(() => listLocalOrders());
  const [screen, setScreen] = useState<Screen>("list");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotosByCategory>(emptyPhotos);
  const [created, setCreated] = useState("");
  const [voyage, setVoyage] = useState<VoyageValues>(EMPTY_VOYAGE);
  const [editCode, setEditCode] = useState("");
  const [journey, setJourney] = useState("step:PURCHASED");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [liveOcean, setLiveOcean] = useState<OceanLookup | null>(null);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [contractId, setContractId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const editingOrder = editingCode ? orders.find((row) => row.trackingCode === editingCode) : null;
  const preview = previewTrackingCode(form.customerName, form.make, form.model);
  const prefixOcean = useMemo(() => {
    if (form.containerNumber.replace(/\s/g, "").length < 4) return null;
    return enrichKnownContainer(lookupCarrier(form.containerNumber));
  }, [form.containerNumber]);

  useEffect(() => {
    api
      .orders()
      .then((remote) => {
        setOrders((local) => {
          const byCode = new Map(local.map((row) => [row.trackingCode, row]));
          for (const row of remote) {
            byCode.set(row.trackingCode, mergeRemotePreserveLocal(byCode.get(row.trackingCode), row));
          }
          return [...byCode.values()];
        });
      })
      .catch(() => {
        /* local list already shown */
      });

    api
      .contracts()
      .then((list) => {
        setContracts(list);
        const id = new URLSearchParams(window.location.search).get("contract");
        if (!id) return;
        const row = list.find((item) => item.id === id && item.status === "SIGNED");
        if (!row) return;
        setContractId(row.id);
        setForm({ ...EMPTY_FORM, customerName: row.customerName, phone: row.customerPhone });
        setScreen("create");
        setEditingCode(null);
        setCreated("");
        setVoyage(EMPTY_VOYAGE);
        setPhotos(emptyPhotos());
        setNotice("");
      })
      .catch(() => {
        /* create form still works locally after a signed contract is listed */
      });
  }, []);

  useEffect(() => {
    if (screen !== "create") return;
    const n = form.containerNumber.replace(/[^A-Za-z0-9]/g, "");
    if (n.length < 10) {
      setLiveOcean(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .lookupOcean(n)
        .then(setLiveOcean)
        .catch(() => setLiveOcean(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.containerNumber, screen]);

  const activeOrders = orders.filter((o) => !isDelivered(o.currentStatus));
  const archivedOrders = orders.filter((o) => isDelivered(o.currentStatus) && daysLeftInArchive(o.deliveredAt) > 0);
  const filteredActiveOrders = activeOrders.filter((order) => {
    const haystack = [order.trackingCode, order.customerName, order.vin, order.make, order.model, order.containerNumber]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("az");
    return haystack.includes(query.trim().toLocaleLowerCase("az")) && (statusFilter === "ALL" || order.currentStatus === statusFilter);
  });

  const signedContracts = contracts.filter((row) => row.status === "SIGNED");
  const waitingContracts = signedContracts.filter((row) => !row.trackingCode);
  const assignedContracts = signedContracts.filter((row) => row.trackingCode);

  function pickContract(id: string) {
    setContractId(id);
    const row = contracts.find((item) => item.id === id);
    if (!row) return;
    setForm((current) => ({ ...current, customerName: row.customerName, phone: row.customerPhone }));
  }

  function goList() {
    setScreen("list");
    setEditingCode(null);
    setCreated("");
    setContractId("");
    setForm(EMPTY_FORM);
    setVoyage(EMPTY_VOYAGE);
    setPhotos(emptyPhotos());
    setLiveOcean(null);
  }

  function goCreate() {
    setScreen("create");
    setEditingCode(null);
    setCreated("");
    setContractId("");
    setForm(EMPTY_FORM);
    setVoyage(EMPTY_VOYAGE);
    setPhotos(emptyPhotos());
    setNotice("");
  }

  function goEdit(order: TrackingShipment) {
    setScreen("edit");
    setEditingCode(order.trackingCode);
    setCreated("");
    setEditCode(order.trackingCode);
    setJourney(selectedJourneyValue(order.currentStatus, order.currentTransitIndex));
    setForm({
      customerName: order.customerName ?? "",
      phone: order.customerPhone ?? "",
      vin: order.vin ?? "",
      make: order.make ?? "",
      model: order.model ?? "",
      year: order.year ? String(order.year) : "",
      containerNumber: order.containerNumber ?? "",
    });
    setVoyage({
      vesselName: order.vesselName ?? "",
      vesselImo: order.vesselImo ?? "",
      originPort: order.originPort ?? "",
      destinationPort: order.destinationPort ?? "",
      currentPort: order.currentPort ?? "",
      currentCountry: order.currentCountry ?? "",
      transitPorts: normalizeTransits(order.transitPorts),
      eta: order.eta ?? "",
      mapLat: order.mapLat != null ? String(order.mapLat) : "",
      mapLng: order.mapLng != null ? String(order.mapLng) : "",
    });
    setPhotos(photosFromList(order.photos ?? []));
    setNotice("");
  }

  function persist(next: TrackingShipment, oldCode = next.trackingCode) {
    replaceLocalOrder(oldCode, next);
    setOrders((list) => [
      next,
      ...list.filter((row) => row.trackingCode !== oldCode && row.trackingCode !== next.trackingCode),
    ]);
  }

  async function applyStage(order: TrackingShipment, status: ShipmentStatus, currentTransitIndex = -1) {
    if (status === order.currentStatus && currentTransitIndex === (order.currentTransitIndex ?? -1)) {
      return order;
    }
    const transits = normalizeTransits(order.transitPorts).map((stop, i) =>
      status === "IN_TRANSIT" && i === (currentTransitIndex >= 0 ? currentTransitIndex : -1) && !stop.occurredAt
        ? { ...stop, occurredAt: new Date().toISOString() }
        : stop,
    );
    const inTransit = TRACKING_STEPS.findIndex((s) => s.key === "IN_TRANSIT");
    const stepIndex = TRACKING_STEPS.findIndex((s) => s.key === status);
    const transitIdx =
      status === "IN_TRANSIT"
        ? currentTransitIndex
        : stepIndex > inTransit
          ? transits.length
          : -1;
    const label =
      status === "IN_TRANSIT" && transitIdx >= 0 && transits[transitIdx]
        ? transitLabel(transits[transitIdx].place, "az")
        : (TRACKING_STEPS.find((s) => s.key === status)?.az ?? status);
    const location = locationForStatus(status, order.destinationPort);
    const landPin = isLiveVesselMapStatus(status)
      ? {}
      : (() => {
          const hit = findPortCoords(location.currentPort || order.currentPort);
          return {
            lat: order.mapLat ?? hit?.lat,
            lng: order.mapLng ?? hit?.lng,
          };
        })();
    const event = {
      status,
      title: label,
      description: `Hazırkı mərhələ: ${label}`,
      occurredAt: new Date().toISOString(),
    };
    const patch: Partial<TrackingShipment> = {
      currentStatus: status,
      currentTransitIndex: transitIdx,
      transitPorts: transits,
      ...location,
      ...landPin,
      deliveredAt: status === "DELIVERED" ? new Date().toISOString() : order.deliveredAt,
      events: [...(order.events ?? []), event],
    };
    const localNext = { ...order, ...patch };
    persist(localNext, order.trackingCode);

    let notify: NotifyInfo | undefined;
    try {
      if (order.id) {
        const remote = await api.updateOrderStatus(order.id, status, event.description, transitIdx);
        notify = remote.notify;
        const next = mergeRemotePreserveLocal(localNext, { ...remote, ...patch, customerPhone: remote.customerPhone ?? order.customerPhone });
        persist(next, order.trackingCode);
        setNotice(stageNotice(label, next.customerPhone, notify));
        return next;
      }
    } catch {
      /* local copy */
    }
    notify = await notifyLocal(localNext, status);
    const saved = updateLocalOrder(order.trackingCode, patch) ?? localNext;
    persist(saved, order.trackingCode);
    setNotice(stageNotice(label, order.customerPhone, notify));
    return saved;
  }

  async function markDelivered(order: TrackingShipment) {
    if (!window.confirm("Maşın arxivə düşəcək və 30 gün sonra silinəcək. Davam edilsin?")) return;
    await applyStage(order, "DELIVERED");
  }

  async function saveEdit(order: TrackingShipment) {
    setSaving(true);
    const trackingCode = normalizeTrackingCode(editCode) || order.trackingCode;
    if (trackingCode.length < 4) {
      setSaving(false);
      window.alert("İzləmə kodu ən azı 4 simvol olmalıdır.");
      return;
    }
    if (orders.some((row) => row.trackingCode === trackingCode && row.trackingCode !== order.trackingCode)) {
      setSaving(false);
      window.alert("Bu izləmə kodu artıq istifadə olunur.");
      return;
    }
    const transitPorts = normalizeTransits(voyage.transitPorts);
    const { status, transitIndex } = parseJourney(journey, transitPorts.length);
    if (
      (status === "DESTINATION_PORT" || status === "TIR_LOADED" || status === "TIR_DEPARTED") &&
      !voyage.destinationPort.trim()
    ) {
      setSaving(false);
      window.alert("Təyinat limanı seçin: Batum və ya Poti.");
      return;
    }
    const location = locationForStatus(status, voyage.destinationPort);
    const next: TrackingShipment = {
      ...order,
      trackingCode,
      customerName: form.customerName.trim() || order.customerName,
      customerPhone: form.phone.trim() || undefined,
      vin: form.vin.toUpperCase() || order.vin,
      make: form.make || undefined,
      model: form.model || undefined,
      year: form.year ? Number(form.year) : undefined,
      containerNumber: form.containerNumber || undefined,
      vesselName: voyage.vesselName || undefined,
      vesselImo: voyage.vesselImo.length === 7 ? voyage.vesselImo : undefined,
      originPort: voyage.originPort || undefined,
      destinationPort: voyage.destinationPort || undefined,
      currentPort: location.currentPort || voyage.currentPort || undefined,
      currentCountry: location.currentCountry || voyage.currentCountry || undefined,
      eta: voyage.eta || undefined,
      mapLat: parseCoord(voyage.mapLat),
      mapLng: parseCoord(voyage.mapLng),
      lat: parseCoord(voyage.mapLat) ?? order.lat,
      lng: parseCoord(voyage.mapLng) ?? order.lng,
      transitPorts,
      currentTransitIndex: transitIndex,
      photos: flattenPhotos(photos),
    };

    persist(next, order.trackingCode);
    let saved = next;

    try {
      if (order.id) {
        const remote = await api.updateVoyage(order.id, {
          trackingCode,
          containerNumber: next.containerNumber,
          vesselName: next.vesselName,
          vesselImo: next.vesselImo,
          originPort: next.originPort,
          destinationPort: next.destinationPort,
          currentPort: next.currentPort,
          currentCountry: next.currentCountry,
          transitPorts,
          currentTransitIndex: transitIndex,
          eta: next.eta,
          mapLat: next.mapLat ?? null,
          mapLng: next.mapLng ?? null,
        });
        saved = mergeRemotePreserveLocal(next, remote);
        persist(saved, trackingCode);
      }
    } catch {
      /* local copy remains — track page still reads it */
    }

    if (status !== saved.currentStatus || transitIndex !== (saved.currentTransitIndex ?? -1)) {
      await applyStage(saved, status, transitIndex);
    }

    setSaving(false);
    setNotice("Yadda saxlanıldı. İzləmə səhifəsində görünür.");
    setEditingCode(trackingCode);
  }

  async function createCar(e: FormEvent) {
    e.preventDefault();
    const contract = signedContracts.find((row) => row.id === contractId);
    if (!contract) {
      window.alert("Əvvəl imzalanmış müştəri müqaviləsini seçin. Maşın müqavilədən sonra alınır.");
      return;
    }
    if (!form.customerName.trim() || !form.vin.trim()) return;
    if (
      contract.trackingCode &&
      !window.confirm("Bu müqaviləyə artıq maşın təyin olunub. Yenidən təyin edilsin?")
    ) {
      return;
    }
    const existing = orders.map((o) => o.trackingCode);
    const trackingCode = generateTrackingCode(form.customerName, form.make, form.model, existing);
    const loaded = form.containerNumber ? enrichKnownContainer(lookupCarrier(form.containerNumber)) : null;
    const live = liveOcean;
    const transitPorts = normalizeTransits(voyage.transitPorts);
    const shipment: TrackingShipment = {
      trackingCode,
      vin: form.vin.toUpperCase(),
      make: form.make,
      model: form.model,
      year: form.year ? Number(form.year) : undefined,
      auctionHouse: "OTHER",
      currentStatus: loaded?.containerStatus || live?.containerStatus ? "LOADED_CONTAINER" : "PURCHASED",
      customerName: form.customerName.trim(),
      customerPhone: form.phone.trim() || undefined,
      events: [],
      documents: [],
      photos: flattenPhotos(photos),
      ...(loaded ? oceanFields(loaded) : {}),
      containerNumber:
        live?.formatted || (loaded ? oceanFields(loaded).containerNumber : form.containerNumber || undefined),
      voyageNumber: live?.voyageNumber || loaded?.voyageNumber,
      carrierName: live?.carrierName || loaded?.carrier?.name,
      carrierCode: live?.carrierCode || loaded?.carrier?.code,
      originPort: voyage.originPort || live?.originPort || loaded?.originPort,
      destinationPort: voyage.destinationPort || live?.destinationPort || loaded?.destinationPort,
      currentPort: voyage.currentPort || live?.currentPort || loaded?.currentPort,
      currentCountry: voyage.currentCountry || live?.currentCountry || loaded?.currentCountry,
      transitPorts,
      currentTransitIndex: -1,
      vesselName: voyage.vesselName || live?.vesselName || loaded?.vesselName,
      vesselImo: voyage.vesselImo.length === 7 ? voyage.vesselImo : undefined,
      containerStatus: live?.containerStatus || loaded?.containerStatus,
      lat: live?.lat ?? loaded?.lat,
      lng: live?.lng ?? loaded?.lng,
      eta: voyage.eta || live?.eta || loaded?.eta,
      mapLat: parseCoord(voyage.mapLat),
      mapLng: parseCoord(voyage.mapLng),
      lat: parseCoord(voyage.mapLat) ?? live?.lat ?? loaded?.lat,
      lng: parseCoord(voyage.mapLng) ?? live?.lng ?? loaded?.lng,
    };

    saveLocalOrder(shipment);
    setOrders((list) => [shipment, ...list]);
    setCreated(trackingCode);

    let saved = shipment;
    try {
      const remote = await api.createOrder({
        customerName: shipment.customerName,
        phone: form.phone.trim() || undefined,
        email: `${trackingCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@autonex.local`,
        vin: shipment.vin,
        auctionHouse: "OTHER",
        containerNumber: form.containerNumber,
        make: form.make,
        model: form.model,
        trackingCode,
        vesselName: voyage.vesselName || undefined,
        vesselImo: voyage.vesselImo.length === 7 ? voyage.vesselImo : undefined,
        originPort: voyage.originPort || undefined,
        destinationPort: voyage.destinationPort || undefined,
        currentPort: voyage.currentPort || undefined,
        currentCountry: voyage.currentCountry || undefined,
        transitPorts,
        eta: voyage.eta || undefined,
        mapLat: parseCoord(voyage.mapLat),
        mapLng: parseCoord(voyage.mapLng),
      });
      saved = mergeRemotePreserveLocal(shipment, { ...remote, ...shipment, trackingCode: remote.trackingCode || trackingCode });
      persist(saved, trackingCode);
      setCreated(saved.trackingCode);
    } catch {
      /* already saved locally */
    }

    try {
      await api.assignContract(contract.id, {
        trackingCode: saved.trackingCode,
        vin: saved.vin,
        make: saved.make,
        model: saved.model,
        year: saved.year,
        orderId: saved.id,
      });
      setContracts((list) =>
        list.map((row) =>
          row.id === contract.id
            ? {
                ...row,
                trackingCode: saved.trackingCode,
                vin: saved.vin,
                make: saved.make,
                model: saved.model,
                year: saved.year,
              }
            : row,
        ),
      );
    } catch {
      /* car exists; assignment can be retried from the contract */
    }
  }

  if (screen === "create") {
    return (
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={goList} className="text-sm text-zinc-400 hover:text-white">
          ← Siyahı
        </button>
        <h1 className="font-display mt-4 text-3xl">Yeni maşın</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Yalnız imzalanmış müştəriyə. Müqavilə birinci addımdır — maşın sonra alınır və təyin olunur.
        </p>

        {created ? (
          <div className="mt-8 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-6">
            <p className="text-xs uppercase tracking-widest text-sky-300">Müştəriyə verin</p>
            <p className="mt-2 font-display text-3xl tracking-wide">{created}</p>
            <p className="mt-2 text-sm text-sky-200/80">Müqaviləyə təyin olundu.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/track/${created}`} className="text-sm text-sky-300 underline">
                İzləmə səhifəsini aç
              </Link>
              <Link href="/admin/contracts" className="text-sm text-sky-300 underline">
                Müqavilələr
              </Link>
              <button type="button" onClick={goList} className="text-sm text-zinc-400 hover:text-white">
                Siyahıya qayıt
              </button>
              <button type="button" onClick={goCreate} className="text-sm text-zinc-400 hover:text-white">
                Daha bir maşın
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={createCar}>
            {signedContracts.length === 0 ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                İmzalanmış müştəri yoxdur. Əvvəl{" "}
                <Link href="/admin/contracts" className="underline">
                  müqavilə yaradın
                </Link>
                , müştəri imzalasın, sonra maşın alın.
              </p>
            ) : (
              <label className="block text-xs text-zinc-400">
                İmzalanmış müştəri *
                <select
                  required
                  value={contractId}
                  onChange={(e) => pickContract(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
                >
                  <option value="">Müqavilə seçin</option>
                  {waitingContracts.length > 0 && (
                    <optgroup label="Maşın gözləyir">
                      {waitingContracts.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.customerName} · {row.number} · {row.customerPhone}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {assignedContracts.length > 0 && (
                    <optgroup label="Artıq maşın təyin olunub">
                      {assignedContracts.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.customerName} · {row.number} · {row.trackingCode}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            )}
            <CarBasics form={form} onChange={setForm} lockCustomer={Boolean(contractId)} />
            <VoyageFields value={voyage} onChange={setVoyage} />
            {(liveOcean?.carrierName || prefixOcean?.carrier) && (
              <p className="text-sm text-sky-300">
                Daşıyıcı: {liveOcean?.carrierCode ?? prefixOcean?.carrier?.code} ·{" "}
                {liveOcean?.carrierName ?? prefixOcean?.carrier?.name}
              </p>
            )}
            <PhotoFields value={photos} onChange={setPhotos} />
            <p className="font-mono text-sm text-zinc-400">
              Kod: <span className="text-white">{preview}</span>
            </p>
            <button
              disabled={signedContracts.length === 0}
              className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              Yüklə və kod yarat
            </button>
          </form>
        )}
      </div>
    );
  }

  if (screen === "edit") {
    if (!editingOrder) {
      return (
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-zinc-400">Maşın tapılmadı.</p>
          <button type="button" onClick={goList} className="mt-4 text-sm text-sky-300">
            ← Siyahı
          </button>
        </div>
      );
    }

    const previewStage = parseJourney(journey, voyage.transitPorts.length);
    const previewJourney = journeyPosition(
      previewStage.status,
      voyage.transitPorts,
      previewStage.transitIndex,
      "az",
      voyage.destinationPort,
    );
    const previewLabel = previewJourney.items[previewJourney.cursor]?.label ?? previewStage.status;

    return (
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={goList} className="text-sm text-zinc-400 hover:text-white">
          ← Siyahı
        </button>
        <h1 className="font-display mt-4 text-3xl">
          {editingOrder.year} {editingOrder.make} {editingOrder.model}
        </h1>
        <p className="mt-1 font-mono text-sm text-sky-300">{editingOrder.trackingCode}</p>
        <p className="mt-2 text-sm text-zinc-400">Yalnız bu maşın. Digər maşınlar burada görünmür.</p>

        {notice && (
          <p className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">{notice}</p>
        )}

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">İzləmə önizləməsi</p><p className="mt-2 text-lg text-white">{previewLabel}</p></div><Link href={`/track/${editingOrder.trackingCode}`} target="_blank" className="rounded-full border border-white/15 px-4 py-2 text-xs text-sky-300">Müştəri görünüşünü aç ↗</Link></div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-sky-400 transition-all" style={{ width: `${previewJourney.progress}%` }} /></div>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Hazırkı yer</p><p className="mt-1 text-zinc-200">{[voyage.currentPort, voyage.currentCountry].filter(Boolean).join(", ") || "—"}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Gəmi / IMO</p><p className="mt-1 text-zinc-200">{[voyage.vesselName, voyage.vesselImo].filter(Boolean).join(" · ") || "—"}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Konteyner</p><p className="mt-1 font-mono text-zinc-200">{form.containerNumber || "—"}</p></div></div>
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit(editingOrder);
          }}
        >
          <label className="block text-xs text-zinc-400">
            İzləmə kodu
            <input
              value={editCode}
              onChange={(e) => setEditCode(e.target.value.toUpperCase())}
              className={`${inp} mt-1 font-mono`}
            />
          </label>

          <CarBasics form={form} onChange={setForm} />

          <label className="block text-xs text-zinc-400">
            Hazırkı mərhələ
            <select
              value={journey}
              onChange={(e) => setJourney(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
            >
              {buildJourney(voyage.transitPorts, "az", voyage.destinationPort).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-xs text-zinc-500">Sürətli mərhələ seçimi</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {TRACKING_STEPS.map((step) => <button key={step.key} type="button" onClick={() => setJourney(`step:${step.key}`)} className={`shrink-0 rounded-full border px-3 py-2 text-xs ${previewStage.status === step.key ? "border-sky-400 bg-sky-400/10 text-sky-300" : "border-white/10 text-zinc-500 hover:text-white"}`}>{step.az}</button>)}
            </div>
          </div>

          <VoyageFields value={voyage} onChange={setVoyage} />
          <PhotoFields value={photos} onChange={setPhotos} />

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {saving ? "Yazılır…" : "Yadda saxla"}
            </button>
            <Link href={`/track/${editingOrder.trackingCode}`} className="rounded-xl border border-white/15 px-5 py-3 text-sm text-zinc-300">
              İzlə
            </Link>
            <Link href="/admin/contracts" className="rounded-xl border border-white/15 px-5 py-3 text-sm text-zinc-300">
              Müqavilələr
            </Link>
            <button type="button" onClick={goList} className="px-5 py-3 text-sm text-zinc-400">
              Ləğv et
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Maşınlar</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Əvvəl müştəri müqaviləsi, sonra alış. Siyahıdan bir maşını açın.
          </p>
        </div>
        <button type="button" onClick={goCreate} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black">
          Yeni maşın
        </button>
      </div>

      {notice && (
        <p className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">{notice}</p>
      )}

      <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-[1fr_220px]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kod, müştəri, VIN, marka və ya konteyner axtar…" className={inp} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white">
          <option value="ALL">Bütün mərhələlər</option>
          {TRACKING_STEPS.map((step) => <option key={step.key} value={step.key}>{step.az}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500"><span>{activeOrders.length} aktiv sifariş</span><span>·</span><span>{archivedOrders.length} arxiv</span>{query || statusFilter !== "ALL" ? <><span>·</span><span className="text-sky-300">{filteredActiveOrders.length} nəticə</span></> : null}</div>

      <OrdersTable orders={filteredActiveOrders} archived={false} onEdit={goEdit} onDeliver={markDelivered} />

      <h2 id="arxiv" className="mt-16 scroll-mt-24 text-lg">
        Arxiv
      </h2>
      <p className="mt-1 text-xs text-zinc-500">Təhvil verilənlər. 30 gün sonra silinir.</p>
      {archivedOrders.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">Arxiv boşdur.</p>
      ) : (
        <OrdersTable orders={archivedOrders} archived onEdit={goEdit} onDeliver={markDelivered} />
      )}
    </div>
  );
}

function CarBasics({
  form,
  onChange,
  lockCustomer = false,
}: {
  form: typeof EMPTY_FORM;
  onChange: (next: typeof EMPTY_FORM) => void;
  lockCustomer?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <input
        required
        readOnly={lockCustomer}
        placeholder="Müştəri adı *"
        value={form.customerName}
        onChange={(e) => onChange({ ...form, customerName: e.target.value })}
        className={`${inp} ${lockCustomer ? "opacity-70" : ""}`}
      />
      <input
        required={lockCustomer}
        readOnly={lockCustomer}
        placeholder="WhatsApp / telefon"
        value={form.phone}
        onChange={(e) => onChange({ ...form, phone: e.target.value })}
        className={`${inp} ${lockCustomer ? "opacity-70" : ""}`}
      />
      <input
        required
        placeholder="VIN *"
        value={form.vin}
        onChange={(e) => onChange({ ...form, vin: e.target.value.toUpperCase() })}
        className={`${inp} font-mono md:col-span-2`}
      />
      <input
        placeholder="Marka — Tesla, BMW…"
        value={form.make}
        onChange={(e) => onChange({ ...form, make: e.target.value })}
        className={inp}
      />
      <input
        placeholder="Model — Model 3, X5…"
        value={form.model}
        onChange={(e) => onChange({ ...form, model: e.target.value })}
        className={inp}
      />
      <input
        placeholder="İl"
        value={form.year}
        onChange={(e) => onChange({ ...form, year: e.target.value })}
        className={inp}
      />
      <input
        placeholder="Konteyner — MSCU 4829137"
        value={form.containerNumber}
        onChange={(e) => onChange({ ...form, containerNumber: e.target.value.toUpperCase() })}
        className={`${inp} font-mono`}
      />
    </div>
  );
}

function OrdersTable({
  orders,
  archived,
  onEdit,
  onDeliver,
}: {
  orders: TrackingShipment[];
  archived: boolean;
  onEdit: (order: TrackingShipment) => void;
  onDeliver: (order: TrackingShipment) => void;
}) {
  if (orders.length === 0) {
    return <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-zinc-500">Bu seçimə uyğun maşın tapılmadı.</div>;
  }
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-3">Kod</th>
            <th>Müştəri</th>
            <th>Maşın</th>
            <th>Mərhələ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.trackingCode} className="border-t border-white/10">
              <td className="py-3 font-mono text-sky-400">{order.trackingCode}</td>
              <td>
                {order.customerName}
                {archived && (
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    {daysLeftInArchive(order.deliveredAt)} gün sonra silinəcək
                  </span>
                )}
              </td>
              <td>
                {order.year} {order.make} {order.model}
              </td>
              <td className="text-zinc-300">{stageLabel(order)}</td>
              <td className="text-right">
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => onEdit(order)} className="text-xs text-sky-400 hover:underline">
                    Yenilə
                  </button>
                  <Link href={`/track/${order.trackingCode}`} className="text-xs text-zinc-400 hover:text-white hover:underline">
                    İzlə
                  </Link>
                  {!archived && (
                    <button
                      type="button"
                      onClick={() => onDeliver(order)}
                      className="text-xs text-zinc-400 hover:text-white hover:underline"
                    >
                      Təhvil
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
