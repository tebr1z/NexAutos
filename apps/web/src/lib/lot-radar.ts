export type RadarPlan = { enabled: boolean; watchLimit: number; monthlyAlertLimit: number; month: string; used: number; remaining: number; active: number; phone?: string | null };
export type RadarSearch = { name: string; make: string; model: string; yearFrom: number; yearTo: number; engineMin?: number; engineMax?: number; damages: string[]; document: string; emailEnabled: boolean; whatsappEnabled: boolean };
export type RadarWatch = { id: string; name: string; filters: RadarSearch; enabled: boolean; searchUrl: string; checkedAt?: string; lastError?: string; initializedAt?: string };
export type RadarMatch = { id: string; readAt?: string; createdAt: string; watch: { name: string }; emailSentAt?: string; whatsappSentAt?: string; emailError?: string; whatsappError?: string; data: { title: string; url: string; engineCc?: number; primaryDamage?: string; secondaryDamage?: string; document?: string; auctionAt?: string; auctionTimeText?: string } };
export type RadarState = { plan: RadarPlan; watches: RadarWatch[]; delivery: { email: string; phone?: string; emailReady: boolean; whatsappReady: boolean; serverMonitoring: boolean } };
export const RADAR_DAMAGES = { front: 'Ön', rear: 'Arxa', right: 'Sağ', left: 'Sol', side: 'Yan (tərəf bilinmir)', minor: 'Kiçik əzik / cızıq', water: 'Su / sel', fire: 'Yanğın', rollover: 'Aşma', hail: 'Dolu', none: 'Normal aşınma' };
export function auctionTimeLabel(lot: RadarMatch['data']) {
  if (lot.auctionAt && Number.isFinite(Date.parse(lot.auctionAt))) return `${new Intl.DateTimeFormat('az-AZ', { timeZone: 'Asia/Baku', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(lot.auctionAt))} · Bakı vaxtı`;
  return lot.auctionTimeText ? `${lot.auctionTimeText} · mənbə vaxtı, saat qurşağı təsdiqlənməyib` : 'Hərracın günü və saatı hələ açıqlanmayıb';
}
