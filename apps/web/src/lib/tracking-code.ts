const MAP: Record<string, string> = {
  ə: "e",
  ı: "i",
  ö: "o",
  ü: "u",
  ş: "s",
  ç: "c",
  ğ: "g",
};

function latin(input: string) {
  return input
    .split("")
    .map((ch) => MAP[ch.toLowerCase()] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function slugPart(input: string, max = 10) {
  const clean = latin(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (clean || "AUTO").slice(0, max);
}

export function carInitial(make: string, model?: string) {
  const src = (make || model || "A").trim().split(/\s+/)[0];
  return slugPart(src, 1) || "A";
}

function randomDigits(length = 5) {
  const max = 10 ** length;
  return String(Math.floor(Math.random() * max)).padStart(length, "0");
}

function customerInitial(customerName: string) {
  return slugPart(customerName.trim().split(/\s+/)[0] || "M", 1) || "M";
}

function codePrefix(customerName: string, make: string, model?: string) {
  return `${customerInitial(customerName)}${carInitial(make, model)}`;
}

export function previewTrackingCode(customerName: string, make: string, model?: string) {
  return `${codePrefix(customerName, make, model)}XXXXX`;
}

export function generateTrackingCode(customerName: string, make: string, model?: string, existing: string[] = []) {
  const prefix = codePrefix(customerName, make, model);
  const taken = new Set(existing.map((c) => c.toUpperCase()));
  for (let i = 0; i < 60; i++) {
    const code = `${prefix}${randomDigits(5)}`;
    if (!taken.has(code)) return code;
  }
  return `${prefix}${randomDigits(5)}${randomDigits(2)}`;
}
