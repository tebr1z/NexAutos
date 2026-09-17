"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CarFront, LogOut, PackageCheck, Ship, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { TRACKING_STEPS } from "@/lib/constants";
import type { TrackingShipment } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useI18n } from "@/providers/i18n-provider";

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [orders, setOrders] = useState<TrackingShipment[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  function statusLabel(status: TrackingShipment["currentStatus"]) {
    if (status === "CANCELLED") return t.track.cancelled;
    const step = TRACKING_STEPS.find((row) => row.key === status);
    return step ? step[locale] : status;
  }

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login?next=/account");
    if (user.role !== "CUSTOMER") return router.replace("/admin");
    api.myOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : t.account.loadError))
      .finally(() => setFetching(false));
  }, [loading, router, user, t.account.loadError]);

  const active = useMemo(
    () => orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.currentStatus)),
    [orders],
  );

  if (loading || !user || user.role !== "CUSTOMER") {
    return <div className="flex min-h-[70vh] items-center justify-center text-sm text-muted">{t.account.opening}</div>;
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-24 pt-32 md:px-8 md:pt-36">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-royal">{t.account.kicker}</p>
          <h1 className="font-display mt-3 text-4xl md:text-5xl">{t.account.welcome}, {user.name}</h1>
          <p className="mt-3 text-sm text-muted">{t.account.subtitle}</p>
        </div>
        <button type="button" onClick={() => { logout(); router.push("/"); }} className="inline-flex w-fit items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm text-muted transition hover:text-fg">
          <LogOut size={16} /> {t.account.logout}
        </button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Summary icon={CarFront} label={t.account.allOrders} value={orders.length} />
        <Summary icon={Ship} label={t.account.activeShip} value={active.length} />
        <Summary icon={PackageCheck} label={t.account.done} value={orders.length - active.length} />
      </div>

      <div className="mt-12 flex items-center justify-between gap-4">
        <div><h2 className="font-display text-2xl">{t.account.myCars}</h2><p className="mt-1 text-sm text-muted">{t.account.myCarsD}</p></div>
        <Link href="/contact" className="hidden rounded-full bg-fg px-5 py-2.5 text-sm text-bg sm:inline-flex">{t.account.newOrder}</Link>
      </div>

      {fetching ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">{[0, 1].map((n) => <div key={n} className="h-48 animate-pulse rounded-3xl bg-card" />)}</div>
      ) : error ? (
        <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</div>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-card/50 px-6 py-16 text-center">
          <UserRound className="mx-auto text-muted" size={30} />
          <h3 className="mt-4 text-lg">{t.account.empty}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{t.account.emptyD}</p>
          <Link href="/contact" className="mt-6 inline-flex rounded-full bg-royal px-6 py-3 text-sm font-semibold text-white">{t.account.contactUs}</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <article key={order.id ?? order.trackingCode} className="group rounded-3xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-glass">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.22em] text-muted">{order.year ?? ""} {order.make ?? t.account.car}</p><h3 className="mt-2 text-xl">{order.make} {order.model}</h3><p className="mt-1 font-mono text-xs text-muted">{order.vin}</p></div>
                <span className="shrink-0 rounded-full bg-royal/10 px-3 py-1.5 text-xs text-royal">{statusLabel(order.currentStatus)}</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-bg p-4"><p className="text-xs text-muted">{t.account.trackCode}</p><p className="mt-1 truncate font-mono">{order.trackingCode}</p></div>
                <div className="rounded-2xl bg-bg p-4"><p className="text-xs text-muted">{t.track.eta}</p><p className="mt-1">{order.eta ? formatDate(order.eta) : t.track.pending}</p></div>
              </div>
              <Link href={`/track/${order.trackingCode}`} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-royal">{t.account.trackMore} <ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof CarFront; label: string; value: number }) {
  return <div className="rounded-3xl border border-line bg-card p-5"><Icon size={20} className="text-royal" /><p className="font-display mt-5 text-3xl">{value}</p><p className="mt-1 text-sm text-muted">{label}</p></div>;
}
