import type { CalculatorReport } from "./api";

export type ReportStatusFilter = "ALL" | "OPEN" | "RESOLVED";

export function safeReportUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function reportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tarix məlum deyil" : date.toLocaleString("az-AZ", {
    timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function filterReports(rows: CalculatorReport[], status: ReportStatusFilter, query: string) {
  const search = query.trim().toLocaleLowerCase("az-AZ");
  return rows.filter((row) => (status === "ALL" || row.status === status) && (!search || [
    row.message, row.user.name, row.user.email, row.version, row.pageUrl,
  ].some((value) => value?.toLocaleLowerCase("az-AZ").includes(search))));
}
