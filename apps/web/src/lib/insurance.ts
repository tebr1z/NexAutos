export const INSURANCE_STATUSES = [
  { key: "DRAFT", az: "Hazırlanır" },
  { key: "PENDING", az: "Sənədlər gözlənilir" },
  { key: "PROCESSING", az: "Sığorta rəsmiləşdirilir" },
  { key: "PAID", az: "Sığorta ödənilib" },
  { key: "TRANSFERRED", az: "Pul köçürülüb" },
  { key: "ACTIVE", az: "Sığorta aktivdir" },
] as const;

export type InsuranceStatusKey = (typeof INSURANCE_STATUSES)[number]["key"];

export function insuranceStatusLabel(status?: string | null) {
  const row = INSURANCE_STATUSES.find((item) => item.key === status);
  return row?.az ?? "Hazırlanır";
}

export function insurancePublicPath(code: string) {
  return `/insurance/${encodeURIComponent(code.toUpperCase().replace(/\s+/g, ""))}`;
}
