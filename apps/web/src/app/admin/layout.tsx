"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Archive, CarFront, FileSignature, Images, LogOut, MessageSquareText, Settings, Shield, Ship } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Maşınlar", icon: CarFront },
  { href: "/admin/catalog", label: "Kataloq", icon: Images },
  { href: "/admin/freight", label: "Yol pulu", icon: Ship },
  { href: "/admin/contracts", label: "Müqavilələr", icon: FileSignature },
  { href: "/admin/insurance", label: "Sığorta", icon: Shield },
  { href: "/admin#arxiv", label: "Arxiv", icon: Archive },
  { href: "/admin/inquiries", label: "Müraciətlər", icon: MessageSquareText },
  { href: "/admin/settings", label: "Ayarlar", icon: Settings },
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-400 hover:bg-white/5 hover:text-white",
                (l.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === l.href || (l.href !== "/admin#arxiv" && pathname.startsWith(l.href))) &&
                  "bg-white/10 text-white",
              )}
            >
              <l.icon size={17} /> {l.label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={logout} className="mt-10 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-white">
          <LogOut size={15} /> Çıxış
        </button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-sm lg:px-8">
          <div><p className="text-xs text-zinc-500">Auto Nex idarəetmə paneli</p><p className="mt-0.5 text-zinc-300">Maşın alına bilər, müqavilə sonra təyin olunur</p></div>
          <div className="flex items-center gap-3"><p className="hidden sm:block">{user.name}</p><button type="button" onClick={logout} className="rounded-full border border-white/10 p-2 text-zinc-400 lg:hidden" aria-label="Çıxış"><LogOut size={16} /></button></div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 lg:hidden">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs text-zinc-400", pathname === l.href && "bg-white/10 text-white")}><l.icon size={15} />{l.label}</Link>)}
        </nav>
        <div className="p-5 sm:p-6 lg:p-10">{children}</div>
      </div>
    </div>
  );
}
