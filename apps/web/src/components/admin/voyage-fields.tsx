"use client";

import { useState } from "react";
import type { TransitStop } from "@/lib/types";
import { DESTINATION_PORTS } from "@/lib/constants";
import { findPortCoords } from "@/lib/carriers";
import { api } from "@/lib/api";

export type VoyageValues = {
  vesselName: string;
  vesselImo: string;
  originPort: string;
  destinationPort: string;
  currentPort: string;
  currentCountry: string;
  transitPorts: TransitStop[];
  eta: string;
  mapLat: string;
  mapLng: string;
};

export const EMPTY_VOYAGE: VoyageValues = {
  vesselName: "",
  vesselImo: "",
  originPort: "",
  destinationPort: "",
  currentPort: "",
  currentCountry: "",
  transitPorts: [],
  eta: "",
  mapLat: "",
  mapLng: "",
};

const field =
  "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-500";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitAt(iso?: string) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function joinAt(date: string, time: string) {
  if (!date) return undefined;
  const d = new Date(`${date}T${time || "12:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function newStop(): TransitStop {
  return { place: "", occurredAt: new Date().toISOString() };
}

export function VoyageFields({
  value,
  onChange,
}: {
  value: VoyageValues;
  onChange: (next: VoyageValues) => void;
}) {
  const [mapBusy, setMapBusy] = useState("");
  const [mapNotice, setMapNotice] = useState("");

  function set<K extends keyof VoyageValues>(key: K, next: VoyageValues[K]) {
    onChange({ ...value, [key]: next });
  }

  function patchStop(index: number, patch: Partial<TransitStop>) {
    const next = [...value.transitPorts];
    next[index] = { ...next[index], ...patch };
    set("transitPorts", next);
  }

  function applyPin(lat: number, lng: number, notice: string) {
    onChange({
      ...value,
      mapLat: lat.toFixed(5),
      mapLng: lng.toFixed(5),
    });
    setMapNotice(notice);
  }

  async function pinFromImo() {
    const imo = value.vesselImo.replace(/\D/g, "");
    if (imo.length !== 7) {
      setMapNotice("Əvvəl 7 rəqəmli IMO yazın.");
      return;
    }
    setMapBusy("imo");
    setMapNotice("");
    try {
      const pos = await api.vesselByImo(imo);
      const nextName = pos?.name?.trim() || value.vesselName;
      const live = pos?.hasCoordinates && pos.latitude != null && pos.longitude != null;
      onChange({
        ...value,
        vesselImo: imo,
        vesselName: nextName,
        ...(live ? { mapLat: pos.latitude!.toFixed(5), mapLng: pos.longitude!.toFixed(5) } : {}),
      });
      if (!live) {
        setMapNotice(
          pos?.name
            ? `Gəmi tapıldı (${pos.name}). Canlı AIS hələ gəlməyib — 1-2 dəq sonra yenə basın və ya koordinatı əl ilə yazın.`
            : "Bu IMO üçün canlı AIS tapılmadı. Koordinatı əl ilə yazın.",
        );
        return;
      }
      setMapNotice(`Gəmi AIS: ${pos.name || "IMO " + imo}`);
    } catch {
      setMapNotice("AIS-ə çıxılmadı. Koordinatı əl ilə yazın və ya limandan götürün.");
    } finally {
      setMapBusy("");
    }
  }

  function pinFromPort() {
    const hit = findPortCoords(value.currentPort) ?? findPortCoords(value.destinationPort) ?? findPortCoords(value.originPort);
    if (!hit) {
      setMapNotice("Liman adı tanınmadı. Enlem/boylamı əl ilə yazın.");
      return;
    }
    applyPin(hit.lat, hit.lng, `${hit.name} limanı`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          placeholder="Başlanğıc — Savannah"
          value={value.originPort}
          onChange={(e) => set("originPort", e.target.value)}
          className={field}
        />
        <select
          value={DESTINATION_PORTS.some((p) => p.value === value.destinationPort) ? value.destinationPort : value.destinationPort ? "__other__" : ""}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "__other__") return;
            const hit = DESTINATION_PORTS.find((p) => p.value === next);
            onChange({
              ...value,
              destinationPort: next,
              currentCountry: hit?.country || value.currentCountry,
              currentPort:
                !value.currentPort ||
                DESTINATION_PORTS.some((p) => p.value === value.currentPort) ||
                value.currentPort === value.destinationPort
                  ? next
                  : value.currentPort,
            });
          }}
          className="w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"
        >
          <option value="">Təyinat limanı — Batum və ya Poti</option>
          {DESTINATION_PORTS.map((port) => (
            <option key={port.value} value={port.value}>
              {port.az} limanı
            </option>
          ))}
          {value.destinationPort && !DESTINATION_PORTS.some((p) => p.value === value.destinationPort) ? (
            <option value="__other__">{value.destinationPort}</option>
          ) : null}
        </select>
        <input
          placeholder="Hazırkı yer"
          value={value.currentPort}
          onChange={(e) => set("currentPort", e.target.value)}
          className={field}
        />
        <input
          placeholder="Ölkə"
          value={value.currentCountry}
          onChange={(e) => set("currentCountry", e.target.value)}
          className={field}
        />
        <input
          placeholder="Gəmi adı"
          value={value.vesselName}
          onChange={(e) => set("vesselName", e.target.value.toUpperCase())}
          className={field}
        />
        <input
          name="vesselImo"
          placeholder="IMO — 7 rəqəm, dəyişmək olar"
          value={value.vesselImo}
          onChange={(e) => set("vesselImo", e.target.value.replace(/\D/g, "").slice(0, 7))}
          className={`${field} font-mono`}
          inputMode="numeric"
          maxLength={7}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input
          placeholder="Xəritə enlem — 41.64900"
          value={value.mapLat}
          onChange={(e) => set("mapLat", e.target.value.replace(/[^\d.-]/g, ""))}
          className={`${field} font-mono`}
          inputMode="decimal"
        />
        <input
          placeholder="Xəritə boylam — 41.63900"
          value={value.mapLng}
          onChange={(e) => set("mapLng", e.target.value.replace(/[^\d.-]/g, ""))}
          className={`${field} font-mono`}
          inputMode="decimal"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void pinFromImo()}
          disabled={mapBusy === "imo"}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-sky-300 disabled:opacity-50"
        >
          {mapBusy === "imo" ? "IMO axtarılır…" : "IMO-dan tap"}
        </button>
        <button
          type="button"
          onClick={pinFromPort}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-sky-300"
        >
          Limandan götür
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        Dənizdə (konteyner/gəmi yoldadır) xəritə IMO ilə canlı gəmini göstərir. TIR və gömrükdə əl pin və ya liman
        koordinatı işləyir. AIS tapılmasa da əl rəqəmləri qalır.
      </p>
      {mapNotice ? <p className="text-[11px] text-sky-300">{mapNotice}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-[11px] text-zinc-500">
          Təxmini çatma vaxtı — tarix
          <input
            type="date"
            value={splitAt(value.eta || undefined).date}
            onChange={(e) => set("eta", joinAt(e.target.value, splitAt(value.eta || undefined).time) ?? "")}
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          Saat
          <input
            type="time"
            value={splitAt(value.eta || undefined).time}
            onChange={(e) => set("eta", joinAt(splitAt(value.eta || undefined).date, e.target.value) ?? "")}
            className={`${field} mt-1`}
          />
        </label>
      </div>
      <p className="text-[11px] text-zinc-500">
        Təyinat limanından sonra izləmədə TIR mərhələləri görünür: yüklənib → yola çıxıb → Gürcüstan sərhədi → Bakı gömrüyü.
      </p>

      <div>
        <p className="text-sm">Tranzitlər</p>
        <p className="mt-1 text-xs text-zinc-500">
          İstənilən qədər əlavə edin. Hamısı izləmədə Yoldadır-dan sonra, öz tarixi ilə görünür.
        </p>
        <div className="mt-3 space-y-3">
          {value.transitPorts.map((stop, i) => {
            const at = splitAt(stop.occurredAt);
            return (
              <div key={i} className="rounded-xl border border-white/10 p-3">
                <div className="flex gap-2">
                  <input
                    placeholder={`Tranzit ${i + 1} — Belarus`}
                    value={stop.place}
                    onChange={(e) => patchStop(i, { place: e.target.value })}
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={() => set("transitPorts", value.transitPorts.filter((_, idx) => idx !== i))}
                    className="shrink-0 px-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Sil
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-zinc-500">
                    Tarix
                    <input
                      type="date"
                      value={at.date}
                      onChange={(e) => patchStop(i, { occurredAt: joinAt(e.target.value, at.time) })}
                      className={`${field} mt-1`}
                    />
                  </label>
                  <label className="text-[11px] text-zinc-500">
                    Saat
                    <input
                      type="time"
                      value={at.time}
                      onChange={(e) => patchStop(i, { occurredAt: joinAt(at.date, e.target.value) })}
                      className={`${field} mt-1`}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => set("transitPorts", [...value.transitPorts, newStop()])}
          className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs text-sky-300"
        >
          + Tranzit əlavə et
        </button>
      </div>
    </div>
  );
}
