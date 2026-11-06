export type RadarPlan = { enabled: boolean; watchLimit: number; monthlyAlertLimit: number; month: string; used: number; remaining: number; active: number; phone?: string | null };
export type RadarSearch = { name: string; make: string; model: string; yearFrom: number; yearTo: number; engineMin?: number; engineMax?: number; damages: string[]; document: string; emailEnabled: boolean; whatsappEnabled: boolean };
export type RadarDealSearch = RadarSearch & { maxBuyNowUsd?: number; marketValueUsd?: number; minDiscountPercent?: number };
export type RadarWatch = { id: string; name: string; filters: Omit<RadarDealSearch, 'name' | 'emailEnabled' | 'whatsappEnabled'> & { mode?: 'buy_now' }; enabled: boolean; emailEnabled: boolean; whatsappEnabled: boolean; searchUrl: string; checkedAt?: string; nextCheckAt?: string; lastError?: string; initializedAt?: string; lastSource?: 'direct' | 'feed' | 'browser'; browserAttemptedAt?: string };
export type RadarMatch = { id: string; readAt?: string; createdAt: string; watch: { id?: string; name: string; filters?: { mode?: 'buy_now' } }; emailSentAt?: string; whatsappSentAt?: string; emailError?: string; whatsappError?: string; data: { title: string; url: string; engineCc?: number; primaryDamage?: string; secondaryDamage?: string; document?: string; auctionAt?: string; auctionTimeText?: string; buyNowUsd?: number | null } };
export type RadarState = { plan: RadarPlan; watches: RadarWatch[]; delivery: { email: string; phone?: string; emailReady: boolean; whatsappReady: boolean; serverMonitoring: boolean; pollIntervalMinutes?: number; sourceMode?: 'feed' | 'direct' } };
export const RADAR_DAMAGES = { front: 'Ön', rear: 'Arxa', right: 'Sağ', left: 'Sol', side: 'Yan (tərəf bilinmir)', minor: 'Kiçik əzik / cızıq', water: 'Su / sel', fire: 'Yanğın', rollover: 'Aşma', hail: 'Dolu', none: 'Normal aşınma' };
export function auctionTimeLabel(lot: RadarMatch['data']) {
  if (lot.auctionAt && Number.isFinite(Date.parse(lot.auctionAt))) return `${new Intl.DateTimeFormat('az-AZ', { timeZone: 'Asia/Baku', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(lot.auctionAt))} · Bakı vaxtı`;
  return lot.auctionTimeText ? `${lot.auctionTimeText} · mənbə vaxtı, saat qurşağı təsdiqlənməyib` : 'Hərracın günü və saatı hələ açıqlanmayıb';
}
export function radarCheckTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Hələ planlaşdırılmayıb';
  return `${new Intl.DateTimeFormat('az-AZ', { timeZone: 'Asia/Baku', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))} · Bakı`;
}
export function radarUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
