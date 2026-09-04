"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/contracts", label: "Müqavilələr" },
  { href: "/admin", label: "Maşınlar" },
  { href: "/admin#arxiv", label: "Arxiv" },
  { href: "/admin/inquiries", label: "Müraciətlər" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role === "CUSTOMER")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role === "CUSTOMER") {
    return <div className="flex min-h-screen items-center justify-center text-muted">Admin…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#070708] text-zinc-100">
      <aside className="hidden w-56 shrink-0 border-r border-white/10 p-6 lg:block">
        <Link href="/" className="text-white">
          <Logo />
        </Link>
        <nav className="mt-10 space-y-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/5 hover:text-white",
                (l.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === l.href || (l.href !== "/admin#arxiv" && pathname.startsWith(l.href))) &&
                  "bg-white/10 text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={logout} className="mt-10 text-xs text-zinc-500">
          Çıxış
        </button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-sm">
          <p className="text-zinc-500">Əvvəl müştəri müqaviləsi, sonra maşın</p>
          <p>{user.name}</p>
        </header>
        <div className="p-6 lg:p-10">{children}</div>
      </div>
    </div>
  );
}
