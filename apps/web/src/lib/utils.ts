import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, locale = "en-US") {
  return new Intl.NumberFormat(locale).format(value);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Always `04.09.2026`, with time when it is not midnight: `04.09.2026 14:30`. */
export function formatDate(value: string | Date, _locale?: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours === 0 && minutes === 0) return date;
  return `${date} ${pad(hours)}:${pad(minutes)}`;
}

export function formatMoney(value: number, currency: string, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
