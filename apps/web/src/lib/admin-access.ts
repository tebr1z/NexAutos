import type { AuthUser } from "./types";

export type InternalRole = Exclude<AuthUser["role"], "CUSTOMER">;
export type AssignableRole = Exclude<InternalRole, "SUPER_ADMIN">;

export const ROLE_DETAILS: Record<InternalRole, { label: string; short: string; description: string }> = {
  SUPER_ADMIN: {
    label: "Baş administrator",
    short: "Tam sistem nəzarəti",
    description: "Bütün bölmələr, sistem ayarları və administrator hesabları daxil tam səlahiyyət.",
  },
  ADMIN: {
    label: "Tam giriş",
    short: "Bütün iş bölmələri",
    description: "Bütün əməliyyat bölmələri, ayarlar və aşağı səviyyəli istifadəçilərin idarəsi.",
  },
  MANAGER: {
    label: "Menecer",
    short: "Əməliyyat və tariflər",
    description: "Maşınlar, kataloq, müqavilə, sığorta, bazar analizi və yol tarifləri.",
  },
  STAFF: {
    label: "Əməkdaş",
    short: "Gündəlik əməliyyatlar",
    description: "Maşınlar, müqavilələr, sığorta, arxiv və müştəri müraciətləri.",
  },
  FREIGHT_USER: {
    label: "Kalkulyator müştərisi",
    short: "Məhdud giriş",
    description: "Fərdi limit və endirimlə kalkulyator, BidCars extension və final qiymətlər üzrə bazar analizi.",
  },
};

const MANAGER_PATHS = [
  "/admin",
  "/admin/catalog",
  "/admin/freight",
  "/admin/market",
  "/admin/contracts",
  "/admin/insurance",
  "/admin/inquiries",
];
const STAFF_PATHS = ["/admin", "/admin/contracts", "/admin/insurance", "/admin/inquiries"];

function pathMatches(pathname: string, allowed: string) {
  return allowed === "/admin" ? pathname === allowed : pathname === allowed || pathname.startsWith(`${allowed}/`);
}

export function canAccessAdminPath(role: AuthUser["role"] | undefined, pathname: string) {
  if (!role || role === "CUSTOMER") return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  if (role === "FREIGHT_USER") return ["/admin/freight", "/admin/market"].some((path) => pathMatches(pathname, path));
  const paths = role === "MANAGER" ? MANAGER_PATHS : STAFF_PATHS;
  return paths.some((allowed) => pathMatches(pathname, allowed));
}

export function adminHomeForRole(role: AuthUser["role"] | undefined) {
  return role === "FREIGHT_USER" ? "/admin/freight" : "/admin";
}

export function assignableRolesFor(role: AuthUser["role"] | undefined): AssignableRole[] {
  return role === "SUPER_ADMIN" ? ["ADMIN", "MANAGER", "STAFF", "FREIGHT_USER"] : ["MANAGER", "STAFF", "FREIGHT_USER"];
}
