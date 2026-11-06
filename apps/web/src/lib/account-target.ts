/** Never silently switch an explicit admin target to the signed-in account. */
export function requiredAccountId(userId: string): string {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("İdarə ediləcək istifadəçi seçilməyib. Hesabı yenidən seçin.");
  }
  return userId.trim();
}

export function calculatorAccountPath(userId?: string): string {
  return userId === undefined
    ? "/calculator/me"
    : `/calculator/users/${encodeURIComponent(requiredAccountId(userId))}`;
}

export function radarAccountPath(userId: string): string {
  return `/lot-radar/admin/users/${encodeURIComponent(requiredAccountId(userId))}`;
}
