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

export function hasInsuranceCase(row?: {
  insurance?: { status?: string | null; firstName?: string | null; lastName?: string | null; receiptToken?: string | null } | null;
  hasInsurance?: boolean;
} | null) {
  if (row?.hasInsurance) return true;
  const ins = row?.insurance;
  if (!ins) return false;
  return Boolean(ins.status || ins.firstName || ins.lastName || ins.receiptToken);
}

export function insuranceStatusLabel(status?: string | null) {
  if (!status) return "—";
  const row = INSURANCE_STATUSES.find((item) => item.key === status);
  return row?.az ?? "—";
}

export function insurancePublicPath(code: string) {
  return `/insurance/${encodeURIComponent(code.toUpperCase().replace(/\s+/g, ""))}`;
}
