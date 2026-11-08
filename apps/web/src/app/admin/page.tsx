"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, type ContractRecord } from "@/lib/api";
import { findPortCoords } from "@/lib/carriers";
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
import { fitDataUrl } from "@/lib/fit-image";
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
  lotNumber: "",
  containerNumber: "",
  carrierTrackingUrl: "",
  originCountry: "" as "" | "USA" | "KOREA" | "CHINA" | "OTHER",
  freightPaymentStatus: "UNPAID" as "UNPAID" | "PARTIAL" | "PAID",
  documentMethod: "UNSET" as "UNSET" | "POWER_OF_ATTORNEY" | "SIGNIFY",
  documentStatus: "PENDING" as "PENDING" | "COMPLETED",
  purchasePaymentPercent: "",
  commissionUsd: "",
  containerOpeningDate: "",
};

function formDetails(form: typeof EMPTY_FORM) {
  return {
    originCountry: form.originCountry || undefined,
    freightPaymentStatus: form.freightPaymentStatus,
    documentMethod: form.originCountry === "USA" ? "SIGNIFY" as const : form.documentMethod,
    documentStatus: form.originCountry === "USA" && form.documentMethod !== "SIGNIFY" ? "PENDING" as const : form.documentStatus,
    purchasePaymentPercent: form.purchasePaymentPercent === "" ? undefined : Number(form.purchasePaymentPercent),
    commissionUsd: form.commissionUsd === "" ? undefined : Number(form.commissionUsd),
    containerOpeningDate: form.containerOpeningDate || undefined,
    carrierTrackingUrl: form.carrierTrackingUrl.trim() || undefined,
  };
}

function formError(form: typeof EMPTY_FORM) {
  if (!form.vin.trim()) return "VIN yazın.";
  if (form.year && (!Number.isInteger(Number(form.year)) || Number(form.year) < 1950 || Number(form.year) > 2100)) return "İl 1950–2100 aralığında olmalıdır.";
  if (form.purchasePaymentPercent && (!Number.isInteger(Number(form.purchasePaymentPercent)) || Number(form.purchasePaymentPercent) < 0 || Number(form.purchasePaymentPercent) > 100)) return "Alış ödənişi 0–100% aralığında olmalıdır.";
  if (form.commissionUsd && (!Number.isFinite(Number(form.commissionUsd)) || Number(form.commissionUsd) < 0 || Number(form.commissionUsd) > 1_000_000)) return "Komissiya 0–1 000 000 USD aralığında olmalıdır.";
  if (form.carrierTrackingUrl.trim()) {
    try {
      const url = new URL(form.carrierTrackingUrl.trim());
      if (url.protocol !== "https:" || url.username || url.password) return "Daşıyıcının giriş məlumatı olmayan HTTPS izləmə linkini yazın.";
    } catch {
      return "Daşıyıcının düzgün HTTPS izləmə linkini yazın.";
    }
  }
  return "";
}

function parseCoord(raw?: string) {
  if (!raw?.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function createOrderBody(shipment: TrackingShipment) {
  const trackingCode = shipment.trackingCode;
  return {
    customerName: shipment.customerName,
    phone: shipment.customerPhone,
    email: `${trackingCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@autonex.local`,
    vin: shipment.vin,
    auctionHouse: "OTHER",
    containerNumber: shipment.containerNumber,
    make: shipment.make,
    model: shipment.model,
    year: shipment.year,
    lotNumber: shipment.lotNumber,
    trackingCode,
    vesselName: shipment.vesselName,
    carrierTrackingUrl: shipment.carrierTrackingUrl,
    originCountry: shipment.originCountry,
    freightPaymentStatus: shipment.freightPaymentStatus,
    documentMethod: shipment.documentMethod,
    documentStatus: shipment.documentStatus,
    purchasePaymentPercent: shipment.purchasePaymentPercent,
    commissionUsd: shipment.commissionUsd,
    containerOpeningDate: shipment.containerOpeningDate,
    originPort: shipment.originPort,
    destinationPort: shipment.destinationPort,
    currentPort: shipment.currentPort,
    currentCountry: shipment.currentCountry,
    transitPorts: shipment.transitPorts,
    currentTransitIndex: shipment.currentTransitIndex,
    eta: shipment.eta,
    mapLat: shipment.mapLat,
    mapLng: shipment.mapLng,
  };
}

async function pushOrderPhotos(orderId: string, photos: TrackingShipment["photos"]) {
  const keepIds: string[] = [];
  const keepUrls: string[] = [];
  let last: TrackingShipment | null = null;
  const failed: string[] = [];

  if (!photos.length) {
    return api.pruneOrderPhotos(orderId, [], []);
  }

  for (const photo of photos) {
    if (photo.id && !photo.url.startsWith("data:")) {
      keepIds.push(photo.id);
      keepUrls.push(photo.url);
      continue;
    }
    const mediaId = photo.url.match(/\/media\/photos\/([^/?#]+)/)?.[1];
    if (mediaId) {
      keepIds.push(mediaId);
      continue;
    }
    if (/^https?:\/\//i.test(photo.url) || photo.url.startsWith("/api/")) {
      keepUrls.push(photo.url);
      continue;
    }
    if (!photo.url.startsWith("data:image/")) {
      failed.push(photo.category || "şəkil");
      continue;
    }
    try {
      const url = await fitDataUrl(photo.url);
      const uploaded = await api.addOrderPhoto(orderId, {
        url,
        category: photo.category,
        caption: photo.caption,
      });
      last = uploaded;
      const added = uploaded.photos?.find((row) => row.id === uploaded.uploadedPhotoId);
      const id = uploaded.uploadedPhotoId;
      if (id) keepIds.push(id);
      if (added?.url) keepUrls.push(added.url);
    } catch (err) {
      failed.push(err instanceof Error ? err.message : photo.category || "şəkil");
    }
  }

  if (failed.length) {
    throw new Error(`${failed.length} şəkil yüklənmədi. Uğurlu şəkillər serverdə saxlanıldı. ${failed[0]}`);
  }
  if (keepIds.length === 0 && keepUrls.length === 0) {
    throw new Error(failed[0] || "Şəkillər Cloudflare R2-yə yazılmadı. Yenidən Yadda saxla basın.");
  }
  last = await api.pruneOrderPhotos(orderId, keepIds, keepUrls);
  return last;
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
  const [smsText, setSmsText] = useState("");
  const [photoSmsReady, setPhotoSmsReady] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [contractId, setContractId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const editingOrder = editingCode ? orders.find((row) => row.trackingCode === editingCode) : null;
  const preview = previewTrackingCode(form.customerName, form.make, form.model);

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
    setSmsText("");
    setPhotoSmsReady(false);
  }

  function goCreate() {
    setScreen("create");
    setEditingCode(null);
    setCreated("");
    setContractId("");
    setForm(EMPTY_FORM);
    setVoyage(EMPTY_VOYAGE);
    setPhotos(emptyPhotos());
    setSmsText("");
    setPhotoSmsReady(false);
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
      lotNumber: order.lotNumber ?? "",
      containerNumber: order.containerNumber ?? "",
      carrierTrackingUrl: order.carrierTrackingUrl ?? "",
      originCountry: order.originCountry ?? "",
      freightPaymentStatus: order.freightPaymentStatus ?? "UNPAID",
      documentMethod: order.originCountry === "USA" ? "SIGNIFY" : order.documentMethod ?? "UNSET",
      documentStatus: order.originCountry === "USA" && order.documentMethod !== "SIGNIFY" ? "PENDING" : order.documentStatus ?? "PENDING",
      purchasePaymentPercent: order.purchasePaymentPercent != null ? String(order.purchasePaymentPercent) : "",
      commissionUsd: order.commissionUsd != null ? String(order.commissionUsd) : "",
      containerOpeningDate: order.containerOpeningDate ?? "",
    });
    setVoyage({
      vesselName: order.vesselName ?? "",
      vesselImo: order.vesselImo ?? "",
      vesselMmsi: "",
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
    setSmsText("");
    setPhotoSmsReady(Boolean(order.photos?.length));
    const linked = contracts.find((row) => row.trackingCode === order.trackingCode && row.status === "SIGNED");
    setContractId(linked?.id ?? "");
  }

  async function linkSignedContract(order: TrackingShipment, id: string) {
    const contract = signedContracts.find((row) => row.id === id);
    if (!contract) {
      window.alert("İmzalanmış müqavilə seçin.");
      return;
    }
    if (
      contract.trackingCode &&
      contract.trackingCode !== order.trackingCode &&
      !window.confirm("Bu müqaviləyə artıq başqa maşın təyin olunub. Yenidən təyin edilsin?")
    ) {
      return;
    }
    try {
      const next = await api.assignContract(contract.id, {
        trackingCode: order.trackingCode,
        vin: order.vin,
        make: order.make,
        model: order.model,
        year: order.year,
        orderId: order.id,
      });
      setContracts((list) => list.map((row) => (row.id === next.id ? { ...row, ...next } : row)));
      setForm((current) => ({
        ...current,
        customerName: next.customerName || current.customerName,
        phone: next.customerPhone || current.phone,
      }));
      setNotice("Müqavilə bu maşına təyin olundu.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Müqavilə təyin olunmadı.");
    }
  }

  function persist(next: TrackingShipment, oldCode = next.trackingCode) {
    replaceLocalOrder(oldCode, next);
    setOrders((list) => [
      next,
      ...list.filter((row) => row.trackingCode !== oldCode && row.trackingCode !== next.trackingCode),
    ]);
  }

  async function sendCustomerSms(order: TrackingShipment, kind: "photos" | "custom") {
    if (!order.id) {
      setNotice("Əvvəl maşını Yadda saxla, sonra SMS göndər.");
      return;
    }
    if (kind === "custom" && !smsText.trim()) {
      setNotice("SMS mətnini yazın.");
      return;
    }
    setSaving(true);
    try {
      const saved = await api.sendCustomerSms(order.id, {
        kind,
        text: kind === "custom" ? smsText.trim() : undefined,
        phone: form.phone.trim() || order.customerPhone,
      });
      if (saved.notify?.sent) {
        setNotice(
          kind === "photos"
            ? "Yeni şəkillər haqqında SMS/WhatsApp getdi (marka, model və track linki daxil)."
            : "Müştəriyə SMS/WhatsApp getdi (marka, model və track linki avtomatik əlavə olundu).",
        );
        if (kind === "photos") setPhotoSmsReady(false);
        if (kind === "custom") setSmsText("");
      } else if (saved.notify?.error === "no_phone") {
        setNotice("WhatsApp nömrəsi yoxdur — SMS getmədi.");
      } else {
        setNotice(saved.notify?.error ? `SMS getmədi: ${saved.notify.error}` : "SMS getmədi.");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "SMS göndərilmədi.");
    } finally {
      setSaving(false);
    }
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
    const phone = form.phone.trim() || order.customerPhone;
    const localNext = { ...order, ...patch, customerPhone: phone };
    let notify: NotifyInfo | undefined;
    if (order.id) {
      const remote = await api.updateOrderStatus(order.id, status, event.description, transitIdx, phone);
      notify = remote.notify;
      const next = mergeRemotePreserveLocal(localNext, remote);
      persist(next, order.trackingCode);
      setNotice(stageNotice(label, next.customerPhone, notify));
      return next;
    }
    const saved = updateLocalOrder(order.trackingCode, { ...patch, customerPhone: phone }) ?? localNext;
    persist(saved, order.trackingCode);
    setNotice("Mərhələ yalnız bu brauzerdə saxlanıldı. Müştəri görmür; əvvəl maşını serverə yadda saxlayın. Bildiriş göndərilmədi.");
    return saved;
  }

  async function markDelivered(order: TrackingShipment) {
    if (!window.confirm("Maşın arxivə düşəcək və 30 gün sonra silinəcək. Davam edilsin?")) return;
    try {
      await applyStage(order, "DELIVERED");
    } catch (err) {
      setNotice(err instanceof Error ? `Təhvil statusu serverə yazılmadı: ${err.message}` : "Təhvil statusu serverə yazılmadı. Yenidən cəhd edin.");
    }
  }

  async function saveEdit(order: TrackingShipment) {
    setSaving(true);
    const invalid = formError(form);
    if (invalid) {
      setSaving(false);
      setNotice(invalid);
      return;
    }
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
      ...formDetails(form),
      trackingCode,
      customerName: form.customerName.trim() || order.customerName,
      customerPhone: form.phone.trim() || undefined,
      vin: form.vin.trim().toUpperCase() || order.vin,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      year: form.year ? Number(form.year) : undefined,
      lotNumber: form.lotNumber.trim() || undefined,
      containerNumber: form.containerNumber.trim() || undefined,
      vesselName: voyage.vesselName || undefined,
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
    const hadNewPhotos = flattenPhotos(photos).some((row) => row.url.startsWith("data:image/"));
    let saved = next;
    let serverOk = Boolean(order.id);
    let metadataSaved = false;

    try {
      if (order.id) {
        const remote = await api.updateVoyage(order.id, {
          trackingCode,
          phone: form.phone.trim(),
          customerName: form.customerName.trim(),
          vin: next.vin,
          make: next.make ?? "",
          model: next.model ?? "",
          year: next.year ?? null,
          lotNumber: next.lotNumber ?? "",
          originCountry: next.originCountry ?? null,
          freightPaymentStatus: next.freightPaymentStatus,
          documentMethod: next.documentMethod,
          documentStatus: next.documentStatus,
          purchasePaymentPercent: next.purchasePaymentPercent ?? null,
          commissionUsd: next.commissionUsd ?? null,
          containerOpeningDate: next.containerOpeningDate ?? null,
          carrierTrackingUrl: next.carrierTrackingUrl ?? "",
          containerNumber: next.containerNumber ?? "",
          vesselName: next.vesselName ?? "",
          originPort: next.originPort ?? "",
          destinationPort: next.destinationPort ?? "",
          currentPort: next.currentPort ?? "",
          currentCountry: next.currentCountry ?? "",
          transitPorts,
          currentTransitIndex: transitIndex,
          eta: next.eta ?? "",
          mapLat: next.mapLat ?? null,
          mapLng: next.mapLng ?? null,
        });
        saved = mergeRemotePreserveLocal(next, remote);
        persist(saved, trackingCode);
        metadataSaved = true;
        serverOk = true;
      } else {
        const remote = await api.createOrder(createOrderBody(next));
        saved = mergeRemotePreserveLocal(next, remote);
        persist(saved, trackingCode);
        metadataSaved = true;
        serverOk = true;
      }
      if (saved.id) {
        const withPhotos = await pushOrderPhotos(saved.id, flattenPhotos(photos));
        saved = mergeRemotePreserveLocal(saved, withPhotos);
        persist(saved, trackingCode);
        setPhotos(photosFromList(saved.photos ?? []));
      }
    } catch (err) {
      serverOk = false;
      setNotice(
        metadataSaved
          ? `Maşın məlumatları serverdə saxlanıldı, amma şəkillər tamamlanmadı. Mərhələ dəyişdirilmədi.${err instanceof Error ? ` ${err.message}` : ""}`
          : `Dəyişikliklər yalnız bu brauzerdə qaldı; serverə yazılmadı və bildiriş göndərilmədi.${err instanceof Error ? ` ${err.message}` : ""}`,
      );
    }

    if (serverOk && (status !== saved.currentStatus || transitIndex !== (saved.currentTransitIndex ?? -1))) {
      try {
        await applyStage(saved, status, transitIndex);
      } catch (err) {
        setSaving(false);
        setEditingCode(trackingCode);
        setNotice(err instanceof Error ? `Maşın məlumatları saxlanıldı, amma mərhələ serverə yazılmadı: ${err.message}` : "Maşın məlumatları saxlanıldı, amma mərhələ serverə yazılmadı. Yenidən cəhd edin.");
        return;
      }
    }

    setSaving(false);
    if (serverOk) {
      const localCount = flattenPhotos(photos).length;
      const remoteCount = saved.photos?.filter((p) => !p.url.startsWith("data:")).length ?? 0;
      if (hadNewPhotos && remoteCount > 0) setPhotoSmsReady(true);
      setNotice(
        localCount && remoteCount < localCount
          ? `Maşın yazıldı, amma ${localCount - remoteCount} şəkil müştəri səhifəsinə düşmədi. Yenidən Yadda saxla basın.`
          : hadNewPhotos
            ? "Yadda saxlanıldı. Aşağıda «Yeni şəkillər SMS» ilə müştəriyə xəbər verin."
            : localCount
              ? "Yadda saxlanıldı. Şəkillər müştəri izləmə səhifəsində görünməlidir."
              : "Yadda saxlanıldı. Müştəri izləmə linkindən görə bilər.",
      );
    }
    setEditingCode(trackingCode);
  }

  async function createCar(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const contract = contractId ? signedContracts.find((row) => row.id === contractId) : undefined;
    if (contractId && !contract) {
      window.alert("Seçilmiş müqavilə tapılmadı.");
      return;
    }
    const invalid = formError(form);
    if (invalid) {
      setNotice(invalid);
      return;
    }
    if (
      contract?.trackingCode &&
      !window.confirm("Bu müqaviləyə artıq maşın təyin olunub. Yenidən təyin edilsin?")
    ) {
      return;
    }
    const existing = orders.map((o) => o.trackingCode);
    const trackingCode = generateTrackingCode(form.customerName, form.make, form.model, existing);
    setSaving(true);
    setNotice("");
    const shipment: TrackingShipment = {
      ...formDetails(form),
      trackingCode,
      vin: form.vin.trim().toUpperCase(),
      make: form.make,
      model: form.model,
      year: form.year ? Number(form.year) : undefined,
      lotNumber: form.lotNumber.trim() || undefined,
      auctionHouse: "OTHER",
      currentStatus: "PURCHASED",
      customerName: form.customerName.trim() || "Müştəri təyin edilməyib",
      customerPhone: form.phone.trim() || undefined,
      events: [],
      documents: [],
      photos: flattenPhotos(photos),
      transitPorts: [],
      currentTransitIndex: -1,
    };

    saveLocalOrder(shipment);
    setOrders((list) => [shipment, ...list]);
    setCreated(trackingCode);

    let saved = shipment;
    try {
      const remote = await api.createOrder({
        ...createOrderBody(shipment),
        phone: form.phone.trim() || shipment.customerPhone,
      });
      saved = mergeRemotePreserveLocal(shipment, remote);
      persist(saved, trackingCode);
      if (saved.id) {
        saved = mergeRemotePreserveLocal(saved, await pushOrderPhotos(saved.id, flattenPhotos(photos)));
        persist(saved, trackingCode);
      }
      setCreated(saved.trackingCode);
    } catch (err) {
      setNotice(
        saved.id
          ? `Maşın serverə yazıldı, amma şəkillər tam yüklənmədi. Redaktədən yenidən yadda saxlayın.${err instanceof Error ? ` ${err.message}` : ""}`
          : `Bu, yalnız brauzerdəki qaralamadır; müştəri izləyə bilmir. Qaralamanı açıb yenidən yadda saxlayın.${err instanceof Error ? ` ${err.message}` : ""}`,
      );
    }

    if (contract) {
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
        /* car exists; assignment can be retried from the contract or edit screen */
      }
    }
    setSaving(false);
  }

  if (screen === "create") {
    const createdOrder = orders.find((order) => order.trackingCode === created);
    const synced = Boolean(createdOrder?.id);
    return (
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={goList} className="text-sm text-zinc-400 hover:text-white">
          ← Siyahı
        </button>
        <h1 className="font-display mt-4 text-3xl">Yeni maşın</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Əvvəl VIN, marka, model, il və lot məlumatlarını yazın. Konteyner, daşıyıcı linki və ödəniş qeydlərini sonra əlavə edə bilərsiniz.
        </p>
        {notice && <p role="status" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{notice}</p>}

        {created ? (
          <div className="mt-8 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-6">
            <p className="text-xs uppercase tracking-widest text-sky-300">{saving ? "Saxlanılır…" : synced ? "Müştəriyə verin" : "Yalnız yerli qaralama"}</p>
            <p className="mt-2 font-display text-3xl tracking-wide">{created}</p>
            <p className="mt-2 text-sm text-sky-200/80">
              {synced ? "Maşın serverdə saxlanılıb. Müqavilə sonra təyin oluna bilər." : "Serverə yazılana qədər bu kod müştəri üçün aktiv deyil."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {synced && <Link href={`/track/${created}`} className="text-sm text-sky-300 underline">
                İzləmə səhifəsini aç
              </Link>}
              {createdOrder && <button type="button" disabled={saving} onClick={() => goEdit(createdOrder)} className="text-sm text-sky-300 underline disabled:opacity-50">{synced ? "Əlavə məlumatları yaz" : "Qaralamanı aç və serverə yaz"}</button>}
              <Link href="/admin/contracts" className="text-sm text-sky-300 underline">
                Müqavilələr
              </Link>
              <button type="button" disabled={saving} onClick={goList} className="text-sm text-zinc-400 hover:text-white disabled:opacity-50">
                Siyahıya qayıt
              </button>
              <button type="button" disabled={saving} onClick={goCreate} className="text-sm text-zinc-400 hover:text-white disabled:opacity-50">
                Daha bir maşın
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={createCar}>
            <label className="block text-xs text-zinc-400">
              Müqavilə — istəyə bağlı
              <select
                value={contractId}
                onChange={(e) => pickContract(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
              >
                <option value="">Sonra təyin et</option>
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
            {signedContracts.length === 0 && (
              <p className="text-xs text-zinc-500">
                İmzalanmış müqavilə yoxdur. Maşını indi saxlayın, müqaviləni sonra{" "}
                <Link href="/admin/contracts" className="underline">
                  Müqavilələr
                </Link>{" "}
                və ya bu maşının redaktəsindən təyin edin.
              </p>
            )}
            <CarBasics form={form} onChange={setForm} lockCustomer={Boolean(contractId)} />
            <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-zinc-300">İlkin şəkillər — istəyə bağlı</summary><div className="mt-4"><PhotoFields value={photos} onChange={setPhotos} /></div></details>
            <p className="font-mono text-sm text-zinc-400">
              Kod: <span className="text-white">{preview}</span>
            </p>
            <button disabled={saving} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-50">
              {saving ? "Saxlanılır…" : "Maşını əlavə et və kod yarat"}
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
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Hazırkı yer</p><p className="mt-1 text-zinc-200">{[voyage.currentPort, voyage.currentCountry].filter(Boolean).join(", ") || "—"}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Gəmi</p><p className="mt-1 text-zinc-200">{voyage.vesselName || "Hələ əlavə edilməyib"}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-zinc-500">Konteyner</p><p className="mt-1 font-mono text-zinc-200">{form.containerNumber || "Hələ əlavə edilməyib"}</p></div></div>
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

          <label className="block text-xs text-zinc-400">
            Müqavilə — sonradan təyin
            <select
              value={contractId}
              onChange={(e) => pickContract(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
            >
              <option value="">Müqavilə seçin</option>
              {waitingContracts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.customerName} · {row.number} · {row.customerPhone}
                </option>
              ))}
              {assignedContracts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.customerName} · {row.number} · {row.trackingCode}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void linkSignedContract(editingOrder, contractId)}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-200"
          >
            Müqaviləyə təyin et
          </button>

          <CarBasics form={form} onChange={setForm} />
          <ShipmentTerms form={form} onChange={setForm} />

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

          <section className="rounded-2xl border border-white/10 p-5"><h2 className="text-base font-medium">Marşrut və xəritə</h2><p className="mb-5 mt-1 text-xs text-zinc-500">Məlumatlar məlum olduqca əlavə edin. Xəritə son təsdiqlənmiş yeri göstərir; daşıyıcının linki ayrıca açılır.</p><VoyageFields value={voyage} onChange={setVoyage} /></section>
          <PhotoFields value={photos} onChange={setPhotos} />

          {photoSmsReady ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-200">Yeni şəkillər yükləndi. Müştəriyə track linki + marka/model ilə SMS getsin?</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void sendCustomerSms(editingOrder, "photos")}
                className="mt-3 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
              >
                Yeni şəkillər haqqında SMS göndər
              </button>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Müştəriyə SMS</p>
            <p className="mt-2 text-sm text-zinc-400">
              Mətnə avtomatik marka, model və track linki əlavə olunur. Nömrə: {form.phone || editingOrder.customerPhone || "yoxdur"}
            </p>
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={3}
              placeholder="Məs: Maşın limana çatıb, şəkillərə baxın."
              className={`${inp} mt-3`}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void sendCustomerSms(editingOrder, "custom")}
              className="mt-3 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              Sistemdən SMS göndər
            </button>
          </div>

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
            <Link href="/admin/insurance" className="rounded-xl border border-white/15 px-5 py-3 text-sm text-zinc-300">
              Sığorta
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
            Alınmış maşını əlavə edin, müqaviləni sonra müştəriyə təyin edin. Siyahıdan bir maşını açın.
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
    <section className="rounded-2xl border border-white/10 p-5">
      <h2 className="text-base font-medium">Avtomobil məlumatları</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-xs text-zinc-400 md:col-span-2">VIN *<input required maxLength={32} placeholder="Avtomobilin VIN kodu" value={form.vin} onChange={(e) => onChange({ ...form, vin: e.target.value.toUpperCase() })} className={`${inp} mt-1 font-mono`} /></label>
        <label className="text-xs text-zinc-400">Marka<input placeholder="Məsələn, BMW" value={form.make} onChange={(e) => onChange({ ...form, make: e.target.value })} className={`${inp} mt-1`} /></label>
        <label className="text-xs text-zinc-400">Model<input placeholder="Məsələn, X5" value={form.model} onChange={(e) => onChange({ ...form, model: e.target.value })} className={`${inp} mt-1`} /></label>
        <label className="text-xs text-zinc-400">İl<input type="number" min={1950} max={2100} step={1} placeholder="2024" value={form.year} onChange={(e) => onChange({ ...form, year: e.target.value })} className={`${inp} mt-1`} /></label>
        <label className="text-xs text-zinc-400">Lot nömrəsi<input placeholder="Auksion lot nömrəsi" value={form.lotNumber} onChange={(e) => onChange({ ...form, lotNumber: e.target.value })} className={`${inp} mt-1 font-mono`} /></label>
      </div>
      <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
        <label className="text-xs text-zinc-400">Müştəri adı — istəyə bağlı<input readOnly={lockCustomer} placeholder="Sonradan təyin edilə bilər" value={form.customerName} onChange={(e) => onChange({ ...form, customerName: e.target.value })} className={`${inp} mt-1 ${lockCustomer ? "opacity-70" : ""}`} /></label>
        <label className="text-xs text-zinc-400">WhatsApp / telefon — istəyə bağlı<input type="tel" readOnly={lockCustomer} placeholder="+994…" value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value })} className={`${inp} mt-1 ${lockCustomer ? "opacity-70" : ""}`} /></label>
      </div>
    </section>
  );
}

function ShipmentTerms({ form, onChange }: { form: typeof EMPTY_FORM; onChange: (next: typeof EMPTY_FORM) => void }) {
  const selectClass = "mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white";
  const documentLabel = form.documentMethod === "SIGNIFY" ? "Signify imzası" : form.documentMethod === "POWER_OF_ATTORNEY" ? "Etibarnamə" : "Sənəd";
  return (
    <section className="space-y-6 rounded-2xl border border-white/10 p-5">
      <div><h2 className="text-base font-medium">Konteyner və daşıyıcı</h2><p className="mt-1 text-xs text-zinc-500">İlk alış zamanı lazım deyil. Kod və izləmə linki məlum olduqda buradan əlavə edin.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-zinc-400">Konteyner nömrəsi<input placeholder="MSCU4829137" value={form.containerNumber} onChange={(e) => onChange({ ...form, containerNumber: e.target.value.toUpperCase() })} className={`${inp} mt-1 font-mono`} /></label>
          <label className="text-xs text-zinc-400">Konteynerin açılma tarixi<input type="date" value={form.containerOpeningDate} onChange={(e) => onChange({ ...form, containerOpeningDate: e.target.value })} className={`${inp} mt-1`} /></label>
          <label className="text-xs text-zinc-400 md:col-span-2">Daşıyıcının izləmə linki<input type="url" placeholder="https://…" value={form.carrierTrackingUrl} onChange={(e) => onChange({ ...form, carrierTrackingUrl: e.target.value })} className={`${inp} mt-1`} /><span className="mt-1 block text-[11px] text-zinc-500">Müştəri bu linkə vuraraq daşıyıcının saytında izləyə bilər. Yalnız HTTPS, şifrəsiz link.</span></label>
        </div>
      </div>
      <div className="border-t border-white/10 pt-5"><h2 className="text-base font-medium">Ödəniş və sənədlər</h2><p className="mt-1 text-xs text-zinc-500">Bu məlumatlar müştərinin izləmə səhifəsində görünür. Boş komissiya əvvəlki sifarişə yeni ödəniş tətbiq etmir.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-zinc-400">Alış ölkəsi<select value={form.originCountry} onChange={(e) => { const originCountry = e.target.value as typeof form.originCountry; onChange({ ...form, originCountry, documentMethod: originCountry === "USA" ? "SIGNIFY" : form.documentMethod === "SIGNIFY" ? "UNSET" : form.documentMethod, documentStatus: "PENDING" }); }} className={selectClass}><option value="">Hələ təyin edilməyib</option><option value="USA">ABŞ</option><option value="KOREA">Koreya</option><option value="CHINA">Çin</option><option value="OTHER">Digər</option></select></label>
          <label className="text-xs text-zinc-400">Yol pulunun vəziyyəti<select value={form.freightPaymentStatus} onChange={(e) => onChange({ ...form, freightPaymentStatus: e.target.value as typeof form.freightPaymentStatus })} className={selectClass}><option value="UNPAID">Yol pulu ödənməyib</option><option value="PARTIAL">Qismən ödənilib</option><option value="PAID">Tam ödənilib</option></select></label>
          <label className="text-xs text-zinc-400">Tələb olunan sənəd<select disabled={form.originCountry === "USA"} value={form.documentMethod} onChange={(e) => onChange({ ...form, documentMethod: e.target.value as typeof form.documentMethod, documentStatus: "PENDING" })} className={`${selectClass} disabled:opacity-70`}><option value="UNSET">Hələ təyin edilməyib</option><option value="POWER_OF_ATTORNEY" disabled={form.originCountry === "USA"}>Etibarnamə</option><option value="SIGNIFY">Signify — ABŞ, etibarnamə tələb olunmur</option></select>{form.originCountry === "USA" && <span className="mt-1 block text-[11px] text-sky-200">ABŞ-dan alışda yalnız Signify imzası tələb olunur; etibarnamə seçilmir.</span>}</label>
          <label className="text-xs text-zinc-400">{documentLabel} vəziyyəti<select disabled={form.documentMethod === "UNSET"} value={form.documentStatus} onChange={(e) => onChange({ ...form, documentStatus: e.target.value as typeof form.documentStatus })} className={`${selectClass} disabled:opacity-40`}><option value="PENDING">{form.documentMethod === "SIGNIFY" ? "İmza gözlənilir" : "Təqdim edilməyib"}</option><option value="COMPLETED">{form.documentMethod === "SIGNIFY" ? "İmzalanıb" : "Təqdim edilib"}</option></select></label>
          <label className="text-xs text-zinc-400">Alış üzrə ödənilən hissə (%)<input type="number" min={0} max={100} step={1} placeholder="Təyin edilməyib" value={form.purchasePaymentPercent} onChange={(e) => onChange({ ...form, purchasePaymentPercent: e.target.value })} className={`${inp} mt-1`} /><button type="button" onClick={() => onChange({ ...form, purchasePaymentPercent: "30" })} className="mt-2 text-xs text-sky-300">30% ilə alınıb</button></label>
          <label className="text-xs text-zinc-400">Ümumi komissiya (USD)<input type="number" min={0} max={1_000_000} step="0.01" placeholder="Tətbiq edilməyib" value={form.commissionUsd} onChange={(e) => onChange({ ...form, commissionUsd: e.target.value })} className={`${inp} mt-1`} /><button type="button" onClick={() => onChange({ ...form, commissionUsd: "105" })} className="mt-2 text-xs text-sky-300">105 USD təyin et</button></label>
        </div>
        {form.documentMethod === "SIGNIFY" && <p className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-xs text-sky-200">Müştəriyə “ABŞ-dan alış üçün etibarnamə lazım deyil. Zəhmət olmasa Signify ilə imzalayın; kömək üçün menecerə müraciət edin” bildirişi göstəriləcək.</p>}
      </div>
    </section>
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
