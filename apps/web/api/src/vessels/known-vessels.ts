export type KnownVessel = { mmsi: string; name: string };

/** AIS/Wikidata first-hit can attach the wrong ship. Prefer these when IMO matches. */
export const KNOWN_VESSELS: Record<string, KnownVessel> = {
  "9393307": { mmsi: "255803480", name: "MSC RIDA VIII" },
};

export function knownVesselByImo(imo: string): KnownVessel | null {
  const digits = String(imo).replace(/\D/g, "");
  return KNOWN_VESSELS[digits] ?? null;
}

export function knownVesselByMmsi(mmsi: string): { imo: string; name: string } | null {
  const digits = String(mmsi).replace(/\D/g, "");
  for (const [imo, vessel] of Object.entries(KNOWN_VESSELS)) {
    if (vessel.mmsi === digits) return { imo, name: vessel.name };
  }
  return null;
}

export function nineDigitMmsi(raw: unknown): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

export function namesCompatible(a?: string | null, b?: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return true;
  const na = a.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const nb = b.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!na || !nb) return true;
  return na === nb || na.includes(nb) || nb.includes(na);
}
