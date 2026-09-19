export const INSURANCE_STATUSES = [
  { key: "DRAFT", az: "Hazırlanır" },
  { key: "PENDING", az: "Sənədlər gözlənilir" },
  { key: "SIGN_WAIT", az: "Sığorta müqaviləsi imza gözləyir" },
  { key: "SIGNED", az: "Sığorta imzalanıb" },
  { key: "PROCESSING", az: "Sığorta müqaviləsi imza gözləyir" },
  { key: "PAID", az: "Sığorta imzalanıb" },
  { key: "TRANSFERRED", az: "Pul köçürülüb" },
  { key: "ACTIVE", az: "Sığorta aktivdir" },
] as const;

export const INSURANCE_STATUS_OPTIONS = INSURANCE_STATUSES.filter(
  (row, i, list) => list.findIndex((item) => item.az === row.az) === i,
);

export function insuranceSignRequired(status?: string | null) {
  return status === "SIGN_WAIT" || status === "PROCESSING";
}

export type InsuranceStatusKey = (typeof INSURANCE_STATUSES)[number]["key"];

export function normalizeInsuranceStatus(status?: string | null) {
  if (status === "PROCESSING") return "SIGN_WAIT";
  if (status === "PAID") return "SIGNED";
  return status || "DRAFT";
}

export function insuranceStatusLabel(status?: string | null) {
  const row = INSURANCE_STATUSES.find((item) => item.key === status);
  return row?.az ?? "Hazırlanır";
}

export function insurancePublicPath(code: string) {
  return `/insurance/${encodeURIComponent(code.toUpperCase().replace(/\s+/g, ""))}`;
}
