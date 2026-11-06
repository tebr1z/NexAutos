"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { LotRadarPanel } from '@/components/lot-radar/lot-radar-panel';
export default function LotRadarPage() {
  const { user, loading } = useAuth(); const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/lot-radar'); }, [user, loading, router]);
  if (loading || !user) return <p className="px-6 py-36 text-sm text-muted">Yüklənir…</p>;
  return <main className="mx-auto max-w-7xl px-5 pb-24 pt-24 md:px-8"><LotRadarPanel /></main>;
}
