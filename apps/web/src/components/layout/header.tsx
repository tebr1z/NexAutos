"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "@/providers/theme-provider";
import { Logo } from "@/components/brand/logo";
import { CurrencySwitcher, LocaleSwitcher } from "@/components/layout/locale-switcher";
import { useI18n } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

function NavTrackForm({
  compact,
  onDarkHero,
  label,
  placeholder,
  onDone,
}: {
  compact?: boolean;
  onDarkHero: boolean;
  label: string;
  placeholder: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(e: FormEvent) {
    e.preventDefault();
    const next = code.trim().toUpperCase();
    router.push(next ? `/track/${next}` : "/track");
    onDone?.();
  }

  return (
    <form
      onSubmit={go}
      className={cn(
        "flex items-center overflow-hidden rounded-full border",
        compact ? "max-w-[11.5rem] sm:max-w-none" : "",
        onDarkHero ? "border-white/35 bg-white/10" : "border-line bg-card",
      )}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "min-w-0 bg-transparent font-mono outline-none",
          compact ? "w-[6.2rem] px-3 py-2 text-[12px] sm:w-32" : "w-32 px-4 py-2 text-sm xl:w-40",
          onDarkHero ? "text-white placeholder:text-white/45" : "text-fg placeholder:text-muted",
        )}
        aria-label={label}
      />
      <button
        type="submit"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 font-semibold tracking-wide transition hover:opacity-90",
          compact ? "px-3 py-2 text-[12px] sm:px-3.5 sm:text-[13px]" : "px-4 py-2 text-sm",
          onDarkHero ? "bg-white text-black" : "bg-fg text-bg",
        )}
      >
        <Search size={compact ? 14 : 16} strokeWidth={2.4} />
        <span className={compact ? "sr-only" : ""}>{label}</span>
      </button>
    </form>
  );
}

export function Header() {
  const { t } = useI18n();
  const { setTheme, resolvedTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/cars", label: t.nav.cars },
    { href: "/how-it-works", label: t.nav.how },
    { href: "/about", label: t.nav.about },
    { href: "/contact", label: t.nav.contact },
  ];

  const isDark = resolvedTheme === "dark";
  const onDarkHero = isDark && !scrolled;
  const tone = onDarkHero ? "hero" : "bar";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,padding] duration-300",
        onDarkHero ? "border-b border-transparent bg-transparent py-5 text-white" : "nav-scrolled py-3 text-fg",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 md:px-8">
        <Link href="/" className={onDarkHero ? "text-white" : "text-fg"}>
          <Logo />
        </Link>

        <nav
          className={cn(
            "hidden items-center gap-7 text-[13px] tracking-wide lg:flex",
            onDarkHero ? "text-white/75" : "text-muted",
          )}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn("transition-colors", onDarkHero ? "hover:text-white" : "hover:text-fg")}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LocaleSwitcher compact tone={tone} />
          <CurrencySwitcher tone={tone} />
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "rounded-full p-2 transition",
              onDarkHero ? "text-white hover:bg-white/15" : "text-fg hover:bg-fg/10",
            )}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NavTrackForm
            onDarkHero={onDarkHero}
            label={t.nav.find}
            placeholder={t.track.placeholder}
          />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <NavTrackForm
            compact
            onDarkHero={onDarkHero}
            label={t.nav.find}
            placeholder={t.track.placeholder}
          />
          <button
            type="button"
            className={cn(onDarkHero ? "text-white" : "text-fg")}
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-4 mt-3 rounded-2xl border border-line bg-card p-5 text-fg shadow-glass lg:hidden">
          <NavTrackForm
            onDarkHero={false}
            label={t.nav.find}
            placeholder={t.track.placeholder}
            onDone={() => setOpen(false)}
          />
          <div className="mt-5 flex flex-col gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <LocaleSwitcher tone="bar" />
              <CurrencySwitcher tone="bar" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
