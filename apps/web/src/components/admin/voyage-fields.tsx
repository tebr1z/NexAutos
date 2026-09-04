import type { TransitStop } from "@/lib/types";

export type VoyageValues = {
  vesselName: string;
  vesselImo: string;
  originPort: string;
  destinationPort: string;
  currentPort: string;
  currentCountry: string;
  transitPorts: TransitStop[];
};

export const EMPTY_VOYAGE: VoyageValues = {
  vesselName: "",
  vesselImo: "",
  originPort: "",
  destinationPort: "",
  currentPort: "",
  currentCountry: "",
  transitPorts: [],
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
  function set<K extends keyof VoyageValues>(key: K, next: VoyageValues[K]) {
    onChange({ ...value, [key]: next });
  }

  function patchStop(index: number, patch: Partial<TransitStop>) {
    const next = [...value.transitPorts];
    next[index] = { ...next[index], ...patch };
    set("transitPorts", next);
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
        <input
          placeholder="Son liman — Bakı"
          value={value.destinationPort}
          onChange={(e) => set("destinationPort", e.target.value)}
          className={field}
        />
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
          placeholder="IMO — 7 rəqəm"
          value={value.vesselImo}
          onChange={(e) => set("vesselImo", e.target.value.replace(/\D/g, "").slice(0, 7))}
          className={`${field} font-mono`}
          inputMode="numeric"
        />
      </div>

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
