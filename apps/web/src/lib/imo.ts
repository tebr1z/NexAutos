export function isValidImo(raw?: string | null) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 7 || /^0+$/.test(digits)) return null;
  const d = digits.split("").map(Number);
  const sum = d[0] * 7 + d[1] * 6 + d[2] * 5 + d[3] * 4 + d[4] * 3 + d[5] * 2;
  if (sum % 10 !== d[6]) return null;
  return digits;
}
