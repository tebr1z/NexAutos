"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, CalendarClock, CarFront, Check, CircleHelp, Download, ExternalLink, FileText, MapPin, MessageCircle, Navigation, RefreshCw, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { SITE, type Locale } from "@/lib/constants";
import type { TrackingShipment } from "@/lib/types";
import { findPortCoords } from "@/lib/carriers";
import { useI18n } from "@/providers/i18n-provider";
import { getLocalOrder, overlayLocal } from "@/lib/local-orders";
import { isFullVinQuery, normalizeTrackingQuery } from "@/lib/tracking-query";
import { PhotoCatalog } from "@/components/tracking/photo-catalog";
import { journeyPosition, normalizeTransits } from "@/lib/journey";
import { getTrackingOverview } from "@/lib/tracking-overview";
import { ShippingNotice } from "@/components/layout/shipping-notice";
import { ShipmentLocation } from "./shipment-location";
import { ShipmentNotices, safeCarrierUrl } from "./shipment-notices";
import { ShipmentReview } from "./shipment-review";

const COPY = {
  az: {
    ambiguous: "Bu nömrəyə bir neçə avtomobil uyğundur. Dəqiq avtomobili açmaq üçün izləmə kodunu daxil edin və ya menecerinizə müraciət edin.",
    rateLimit: "Çox sayda axtarış edildi. Bir qədər gözləyib yenidən yoxlayın.",
    unavailable: "Hazırda serverdən məlumat alınmır. Bir qədər sonra yenidən yoxlayın.",
    lookupHint: "VIN və lot axtarışında daşınma məlumatları göstərilir. Şəxsi məlumatlar, ödəniş və sənədlər üçün izləmə kodunuzu daxil edin.",
    openByCode: "İzləmə kodu ilə aç",
    intro: "Maşınınız haradadır, sonra nə olacaq və siz nə etməlisiniz — hamısı burada.",
    overview: "İcmal", map: "Xəritə və canlı izləmə", openLive: "Canlı izləməni aç", payments: "Ödəniş və sənədlər", journey: "Daşınma mərhələləri",
    current: "Avtomobilinizin hazırkı mərhələsi", location: "Son bildirilən yer", locationPending: "Məntəqə hələ təsdiqlənməyib",
    next: "Sonrakı mərhələ", nextHint: "Mərhələ baş verdikdə menecer tərəfindən təsdiqlənəcək.", action: "Siz nə etməlisiniz?",
    manager: "Menecerə yazın", managerMessage: "Salam, sifarişimin daşınması barədə kömək istəyirəm.",
    refresh: "Məlumatı yenilə", refreshing: "Yenilənir…", updated: "Son status qeydi", timezone: "Bakı vaxtı (UTC+4)", datePending: "Status tarixi hələ qeyd edilməyib",
    cache: "Serverdən məlumat alınmadı. Bu cihazda saxlanmış əvvəlki məlumat göstərilir; aktual statusu menecerinizlə dəqiqləşdirin.",
    refreshFailed: "Yeniləmə alınmadı. Son yüklənmiş məlumat saxlanılıb; bir qədər sonra yenidən yoxlayın.",
    phaseTitle: "Alışdan təhvilə — yolunuz", phaseHint: "Bu, daşınma mərhələləridir; məsafə və ya qalan vaxt faizi deyil.",
    before: "Öncəki mərhələ", now: "İndi", after: "Növbəti mərhələ", allStages: "Bütün mərhələləri göstər", stageHint: "Tarix yalnız qeydə alınmış yeniliklərdə göstərilir.",
    photosPending: "İlk fotolar əlavə edildikdə burada terminal, yükləmə və təhvil mərhələlərinə görə görünəcək.",
    details: "Avtomobil və daşınma məlumatları", opening: "Konteynerin açılma tarixi", carrier: "Daşıyıcı", vessel: "Gəmi", voyage: "Reys", container: "Konteyner kodu",
    faq: "İzləməni necə oxumalı?", mapQuestion: "Xəritə ilə canlı izləmə linkinin fərqi nədir?",
    mapAnswer: "Xəritə sifarişdə qeyd edilmiş son mövqeni göstərir, canlı GPS deyil. “Canlı izləməni aç” daşıyıcının xarici saytına aparır. Oradakı yer və tarixlərin yenilənməsi daşıyıcıdan asılıdır.",
    containerQuestion: "Konteyner nömrəsi və izləmə linki niyə yoxdur?", containerAnswer: "Avtomobil ilk alındıqda bu məlumatlar olmaya bilər. Konteyner və daşıyıcı təsdiqləndikdə menecer əlavə edəcək; bu müddətdə mərhələlərdən izləyə bilərsiniz.",
    etaQuestion: "Çatma tarixi dəqiqdirmi?", cancelled: "Sifariş ləğv edilib", documentsHint: "Sifarişinizə əlavə edilmiş sənədlər və faktura.",
  },
  en: {
    ambiguous: "More than one vehicle matches this number. Enter your tracking code or contact your manager to open the correct vehicle.",
    rateLimit: "Too many searches. Please wait a little and try again.",
    unavailable: "The server is currently unavailable. Please try again shortly.",
    lookupHint: "VIN and lot searches show shipment information. Use your tracking code for personal information, payments and documents.",
    openByCode: "Open with tracking code",
    intro: "Where your car is, what happens next and what you need to do — all in one place.",
    overview: "Overview", map: "Map and live tracking", openLive: "Open live tracking", payments: "Payments and documents", journey: "Shipping stages",
    current: "Your vehicle’s current stage", location: "Last reported location", locationPending: "Location not yet confirmed",
    next: "Next stage", nextHint: "Your manager will confirm this stage when it occurs.", action: "What do you need to do?",
    manager: "Message your manager", managerMessage: "Hello, I would like help with my vehicle shipment.",
    refresh: "Refresh information", refreshing: "Refreshing…", updated: "Last recorded status", timezone: "Baku time (UTC+4)", datePending: "No status date recorded yet",
    cache: "The server could not be reached. Previously saved information from this device is shown; confirm the current status with your manager.",
    refreshFailed: "The refresh failed. The last loaded information is still shown; please try again later.",
    phaseTitle: "Your journey from purchase to handover", phaseHint: "These are shipping stages, not a percentage of distance or remaining time.",
    before: "Previous stage", now: "Now", after: "Next stage", allStages: "Show all stages", stageHint: "Dates appear only for recorded updates.",
    photosPending: "Photos will appear here by terminal, loading and handover stage when they are added.",
    details: "Vehicle and shipment details", opening: "Container opening date", carrier: "Carrier", vessel: "Vessel", voyage: "Voyage", container: "Container code",
    faq: "How to read your tracking", mapQuestion: "How is the map different from the live tracking link?",
    mapAnswer: "The map shows the last location recorded for your order, not live GPS. “Open live tracking” opens the carrier’s external website. Location and date updates there depend on the carrier.",
    containerQuestion: "Why is there no container number or tracking link?", containerAnswer: "These details may not exist when the vehicle is first purchased. Your manager will add them once the container and carrier are confirmed. Until then, follow the shipping stages.",
    etaQuestion: "Is the arrival date guaranteed?", cancelled: "Order cancelled", documentsHint: "Documents and invoice attached to your order.",
  },
  ru: {
    ambiguous: "Найдено несколько автомобилей с этим номером. Введите код отслеживания или обратитесь к менеджеру.",
    rateLimit: "Слишком много запросов. Подождите немного и повторите поиск.",
    unavailable: "Сервер временно недоступен. Попробуйте немного позже.",
    lookupHint: "По VIN и номеру лота показываются данные перевозки. Для личных данных, оплаты и документов используйте код отслеживания.",
    openByCode: "Открыть по коду отслеживания",
    intro: "Где ваш автомобиль, что будет дальше и что нужно сделать вам — всё здесь.",
    overview: "Обзор", map: "Карта и отслеживание", openLive: "Открыть отслеживание", payments: "Оплата и документы", journey: "Этапы перевозки",
    current: "Текущий этап вашего автомобиля", location: "Последнее указанное место", locationPending: "Местоположение ещё не подтверждено",
    next: "Следующий этап", nextHint: "Менеджер подтвердит этот этап после его выполнения.", action: "Что нужно сделать вам?",
    manager: "Написать менеджеру", managerMessage: "Здравствуйте, нужна помощь с перевозкой моего автомобиля.",
    refresh: "Обновить информацию", refreshing: "Обновление…", updated: "Последняя запись статуса", timezone: "Время Баку (UTC+4)", datePending: "Дата статуса ещё не указана",
    cache: "Не удалось получить данные с сервера. Показана ранее сохранённая информация с этого устройства; уточните актуальный статус у менеджера.",
    refreshFailed: "Не удалось обновить данные. Показана последняя загруженная информация; попробуйте позже.",
    phaseTitle: "Ваш путь от покупки до передачи", phaseHint: "Это этапы перевозки, а не процент расстояния или оставшегося времени.",
    before: "Предыдущий этап", now: "Сейчас", after: "Следующий этап", allStages: "Показать все этапы", stageHint: "Даты указаны только для записанных обновлений.",
    photosPending: "После добавления фотографии появятся здесь по этапам терминала, погрузки и передачи.",
    details: "Данные автомобиля и перевозки", opening: "Дата вскрытия контейнера", carrier: "Перевозчик", vessel: "Судно", voyage: "Рейс", container: "Код контейнера",
    faq: "Как читать отслеживание?", mapQuestion: "Чем карта отличается от ссылки отслеживания?",
    mapAnswer: "Карта показывает последнее записанное место по заказу, а не GPS в реальном времени. Ссылка отслеживания открывает внешний сайт перевозчика. Обновления местоположения и дат зависят от перевозчика.",
    containerQuestion: "Почему нет номера контейнера или ссылки?", containerAnswer: "При покупке автомобиля этих данных может ещё не быть. Менеджер добавит их после подтверждения контейнера и перевозчика. Пока следите за этапами перевозки.",
    etaQuestion: "Гарантирована ли дата прибытия?", cancelled: "Заказ отменён", documentsHint: "Документы и счёт, прикреплённые к вашему заказу.",
  },
  tr: {
    ambiguous: "Bu numara birden fazla araçla eşleşiyor. Doğru aracı açmak için takip kodunu girin veya yöneticinize başvurun.",
    rateLimit: "Çok fazla arama yapıldı. Biraz bekleyip yeniden deneyin.",
    unavailable: "Sunucudan şu anda bilgi alınamıyor. Biraz sonra yeniden deneyin.",
    lookupHint: "VIN ve lot araması taşıma bilgilerini gösterir. Kişisel bilgiler, ödeme ve belgeler için takip kodunu kullanın.",
    openByCode: "Takip koduyla aç",
    intro: "Aracınız nerede, sırada ne var ve siz ne yapmalısınız — hepsi burada.",
    overview: "Özet", map: "Harita ve canlı takip", openLive: "Canlı takibi aç", payments: "Ödeme ve evraklar", journey: "Taşıma aşamaları",
    current: "Aracınızın mevcut aşaması", location: "Son bildirilen konum", locationPending: "Konum henüz doğrulanmadı",
    next: "Sonraki aşama", nextHint: "Bu aşama gerçekleştiğinde yöneticiniz tarafından doğrulanacak.", action: "Siz ne yapmalısınız?",
    manager: "Yöneticinize yazın", managerMessage: "Merhaba, aracımın taşınması hakkında yardım istiyorum.",
    refresh: "Bilgileri yenile", refreshing: "Yenileniyor…", updated: "Son kaydedilen durum", timezone: "Bakü saati (UTC+4)", datePending: "Durum tarihi henüz kaydedilmedi",
    cache: "Sunucudan bilgi alınamadı. Bu cihazda önceden kaydedilen bilgiler gösteriliyor; güncel durumu yöneticinizle netleştirin.",
    refreshFailed: "Yenileme başarısız. Son yüklenen bilgiler korunuyor; daha sonra tekrar deneyin.",
    phaseTitle: "Satın almadan teslime yolculuğunuz", phaseHint: "Bunlar taşıma aşamalarıdır; mesafe veya kalan süre yüzdesi değildir.",
    before: "Önceki aşama", now: "Şimdi", after: "Sonraki aşama", allStages: "Tüm aşamaları göster", stageHint: "Tarihler yalnızca kaydedilen güncellemelerde gösterilir.",
    photosPending: "İlk fotoğraflar eklendiğinde terminal, yükleme ve teslim aşamalarına göre burada görünecek.",
    details: "Araç ve gönderi bilgileri", opening: "Konteyner açılma tarihi", carrier: "Taşıyıcı", vessel: "Gemi", voyage: "Sefer", container: "Konteyner kodu",
    faq: "Takibi nasıl okumalı?", mapQuestion: "Harita ile canlı takip bağlantısı arasındaki fark nedir?",
    mapAnswer: "Harita sipariş için kaydedilen son konumu gösterir; canlı GPS değildir. “Canlı takibi aç” taşıyıcının harici sitesini açar. Oradaki konum ve tarih güncellemeleri taşıyıcıya bağlıdır.",
    containerQuestion: "Konteyner numarası veya takip bağlantısı neden yok?", containerAnswer: "Araç ilk alındığında bu bilgiler henüz olmayabilir. Konteyner ve taşıyıcı doğrulandığında yöneticiniz ekleyecek. Bu sürede taşıma aşamalarını takip edebilirsiniz.",
    etaQuestion: "Varış tarihi kesin mi?", cancelled: "Sipariş iptal edildi", documentsHint: "Siparişinize eklenen evraklar ve fatura.",
  },
} satisfies Record<Locale, Record<string, string>>;

function withManualPin(shipment: TrackingShipment): TrackingShipment {
  if (shipment.mapLat != null && shipment.mapLng != null) return { ...shipment, lat: shipment.mapLat, lng: shipment.mapLng };
  if (shipment.lat != null && shipment.lng != null) return shipment;
  const hit = findPortCoords(shipment.currentPort);
  return hit ? { ...shipment, lat: hit.lat, lng: hit.lng, currentCountry: shipment.currentCountry || hit.country } : shipment;
}

function lookupView(shipment: TrackingShipment, query: string): TrackingShipment {
  if (shipment.lookupType !== "vin" && shipment.lookupType !== "lot") return shipment;
  // The API already returns a shipment-only allowlist. Keep sensitive UI blocks
  // disabled even if stale or unexpected fields reach this public lookup view.
  return {
    ...shipment, trackingCode: normalizeTrackingQuery(query), id: undefined,
    customerName: "", customerPhone: undefined, adminNotes: undefined,
    freightPaymentStatus: undefined, documentMethod: undefined, documentStatus: undefined,
    purchasePaymentPercent: undefined, commissionUsd: undefined,
    documents: [], invoice: undefined, contract: undefined,
    hasInsurance: false, insurance: undefined, review: undefined, reviewToken: undefined,
  };
}

function recordedDate(value: string | undefined, locale: Locale, includeTime = true) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const language = { az: "az-AZ", en: "en-GB", ru: "ru-RU", tr: "tr-TR" }[locale];
  return new Intl.DateTimeFormat(language, { timeZone: "Asia/Baku", dateStyle: "short", ...(includeTime ? { timeStyle: "short" as const } : {}) }).format(new Date(value));
}

function documentUrl(value: string) {
  try {
    const parsed = new URL(value, SITE.url);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : undefined;
  } catch { return undefined; }
}

export function TrackingDetail({ code }: { code: string }) {
  const { t, locale } = useI18n();
  const text = COPY[locale];
  const [loadedData, setData] = useState<{ code: string; shipment: TrackingShipment } | null>(null);
  const [error, setError] = useState<"not_found" | "ambiguous" | "rate_limit" | "unavailable" | null>(null);
  const [warning, setWarning] = useState<"cache" | "refresh" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const loadedCode = useRef<string | null>(null);
  const data = loadedData?.code === code ? lookupView(loadedData.shipment, code) : null;

  useEffect(() => {
    let active = true;
    if (loadedCode.current !== code) setData(null);
    setError(null);
    setWarning(null);
    setRefreshing(true);
    api.track(code).then((shipment) => {
      if (!active) return;
      const next = withManualPin(shipment.lookupType ? shipment : overlayLocal(shipment, code));
      loadedCode.current = code;
      setData({ code, shipment: next });
    }).catch((failure: unknown) => {
      if (!active) return;
      const status = failure && typeof failure === "object" && "status" in failure && typeof failure.status === "number" ? failure.status : undefined;
      // A server rejection must not be replaced by a stale cached car.
      if (status !== undefined && status >= 400 && status < 500) {
        loadedCode.current = null;
        setData(null);
        setError(status === 409 ? "ambiguous" : status === 429 ? "rate_limit" : "not_found");
        return;
      }
      if (loadedCode.current === code) {
        setWarning("refresh");
        return;
      }
      let cached: TrackingShipment | null | undefined;
      try { if (!isFullVinQuery(code)) cached = getLocalOrder(code); } catch { /* Browser storage may be unavailable. */ }
      if (cached && !cached.lookupType && normalizeTrackingQuery(cached.trackingCode) === normalizeTrackingQuery(code)) {
        loadedCode.current = code;
        setData({ code, shipment: withManualPin(cached) });
        setWarning("cache");
      } else setError("unavailable");
    }).finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [code, refreshKey]);

  if (error && !data) return (
    <div className="mx-auto max-w-2xl px-5 pt-32 pb-24 text-center"><div className="rounded-3xl border border-line bg-card px-6 py-14">
      <MapPin className="mx-auto text-muted" size={30} aria-hidden="true" /><h1 className="font-display mt-5 text-3xl">{error === "not_found" ? t.track.notFoundTitle : t.track.title}</h1><p role="alert" className="mt-3 text-muted">{error === "ambiguous" ? text.ambiguous : error === "rate_limit" ? text.rateLimit : error === "unavailable" ? text.unavailable : t.track.notFound}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/track" className="rounded-full bg-fg px-6 py-3 text-sm text-bg">{t.track.searchAgain}</Link><button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="rounded-full border border-line px-6 py-3 text-sm">{text.refresh}</button></div>
    </div></div>
  );
  if (!data) return <div role="status" className="mx-auto max-w-7xl px-5 pt-32 pb-24 text-muted">{t.common.loading}…</div>;

  const overview = getTrackingOverview(data, locale);
  const limitedLookup = data.lookupType === "vin" || data.lookupType === "lot";
  const stops = normalizeTransits(data.transitPorts);
  const { items, cursor } = journeyPosition(data.currentStatus, stops, data.currentTransitIndex, locale, data.destinationPort);
  const cancelled = data.currentStatus === "CANCELLED";
  const delivered = data.currentStatus === "DELIVERED";
  const knownStage = overview.phaseIndex >= 0;
  const currentLabel = cancelled ? text.cancelled : knownStage ? items[cursor]?.label ?? overview.phaseLabel : overview.phaseLabel;
  const nextStep = !cancelled && !delivered && knownStage ? items[cursor + 1] : undefined;
  const location = [data.currentPort, data.currentCountry].filter(Boolean).join(", ");
  const route = [data.originPort, ...stops.map((stop) => stop.place), data.destinationPort].filter(Boolean);
  const managerUrl = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(`${text.managerMessage} ${data.trackingCode} · VIN ${data.vin}`)}`;
  const carrierUrl = safeCarrierUrl(data.carrierTrackingUrl);
  const documents = (limitedLookup ? [] : data.documents ?? []).map((doc) => ({ ...doc, safeUrl: documentUrl(doc.url) })).filter((doc) => doc.safeUrl);
  const opening = data.containerOpeningDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 md:px-8 md:pt-32">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 w-full sm:w-auto sm:flex-1"><p className="font-mono text-xs text-royal">{limitedLookup ? `${data.lookupType === "vin" ? "VIN" : "Lot №"}: ` : ""}{data.trackingCode}</p><h1 className="font-display mt-2 text-3xl leading-tight sm:text-4xl">{[data.year, data.make, data.model].filter(Boolean).join(" ") || t.track.yourCar}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{text.intro}</p></div>
        <div className="flex flex-wrap items-center gap-2">{carrierUrl && <a href={carrierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-royal px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">{text.openLive}<ExternalLink size={15} aria-hidden="true" /></a>}<button type="button" disabled={refreshing} onClick={() => setRefreshKey((value) => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium transition hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:opacity-60"><RefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />{refreshing ? text.refreshing : text.refresh}</button></div>
      </header>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-muted"><CalendarClock size={13} aria-hidden="true" />{overview.lastUpdatedAt ? <><span>{text.updated}: <time dateTime={overview.lastUpdatedAt}>{recordedDate(overview.lastUpdatedAt, locale)}</time></span><span>· {text.timezone}</span></> : text.datePending}</p>
      {warning && <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6"><TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />{warning === "cache" ? text.cache : text.refreshFailed}</p>}
      {limitedLookup && <p className="mt-4 rounded-2xl border border-line bg-card p-4 text-sm leading-6 text-muted">{text.lookupHint} <Link href="/track" className="font-medium text-royal underline">{text.openByCode}</Link></p>}

      <nav aria-label={t.track.title} className="mt-5 flex gap-2 overflow-x-auto pb-2 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:text-sm">
        {[{ href: "#shipment-status", label: text.overview }, { href: "#shipment-location", label: text.map }, ...(!cancelled && !limitedLookup ? [{ href: "#shipment-payments", label: text.payments }] : []), { href: "#shipment-photos", label: t.track.photos }, { href: "#shipment-journey", label: text.journey }].map((item, index) => <a key={item.href} href={item.href} className={`shrink-0 rounded-full px-4 py-2.5 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal ${index === 0 ? "bg-royal text-white" : "border border-line bg-card hover:bg-bg"}`}>{item.label}</a>)}
      </nav>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
        <section id="shipment-status" aria-labelledby="shipment-status-title" className="scroll-mt-28 rounded-3xl border border-royal/25 bg-card p-5 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-medium text-muted"><CarFront size={18} className="text-royal" aria-hidden="true" />{text.current}</div>
          <h2 id="shipment-status-title" className={`mt-3 text-2xl leading-tight font-semibold sm:text-3xl ${cancelled ? "text-muted" : "text-royal"}`}>{currentLabel}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">{overview.explanation}</p>
          <dl className="mt-5 grid gap-4 border-y border-line py-4 sm:grid-cols-2">
            <div><dt className="flex items-center gap-1.5 text-xs text-muted"><MapPin size={14} aria-hidden="true" />{text.location}</dt><dd className="mt-1.5 text-sm font-medium leading-6">{location || text.locationPending}</dd></div>
            <div><dt className="flex items-center gap-1.5 text-xs text-muted"><CalendarClock size={14} aria-hidden="true" />{t.track.eta}</dt><dd className="mt-1.5 text-sm font-medium leading-6">{cancelled ? "—" : delivered ? currentLabel : recordedDate(data.eta, locale, false) || t.track.pending}</dd>{!cancelled && !delivered && <p className="mt-1 text-[11px] leading-5 text-muted">{t.track.etaHint}</p>}</div>
            {opening && !cancelled && !delivered && <div className="rounded-xl bg-royal/5 px-3 py-2 sm:col-span-2"><dt className="text-xs text-muted">{text.opening}</dt><dd className="mt-1 text-sm font-semibold text-royal">{opening[3]}.{opening[2]}.{opening[1]}</dd></div>}
          </dl>
          {nextStep && <div className="mt-4 flex items-start gap-3"><ArrowRight size={18} className="mt-0.5 shrink-0 text-royal" aria-hidden="true" /><div><p className="text-xs text-muted">{text.next}</p><p className="mt-1 text-sm font-medium leading-6">{nextStep.label}</p><p className="mt-1 text-[11px] leading-5 text-muted">{text.nextHint}</p></div></div>}
          <div className={`mt-5 rounded-2xl border p-4 ${!limitedLookup && overview.actionNeeded && !delivered ? "border-amber-500/25 bg-amber-500/5" : "border-royal/15 bg-royal/5"}`}>
            <h3 className="text-sm font-semibold">{text.action}</h3><p className="mt-2 text-sm leading-6 text-muted">{limitedLookup ? text.lookupHint : overview.nextAction}</p>
            <a href={managerUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-royal ring-1 ring-line transition hover:bg-bg"><MessageCircle size={16} aria-hidden="true" />{text.manager}<ArrowRight size={13} aria-hidden="true" /></a>
          </div>
        </section>
        <ShipmentLocation key={`${data.trackingCode}:${data.containerNumber || ""}`} shipment={data} locale={locale} stageCaption={currentLabel} />
      </div>

      <section className="mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6" aria-labelledby="shipment-phases-title">
        <h2 id="shipment-phases-title" className="text-base font-semibold">{text.phaseTitle}</h2><p className="mt-1 text-xs leading-5 text-muted">{text.phaseHint}</p>
        <ol className="mt-4 grid grid-cols-4 gap-2 lg:grid-cols-8">{overview.phases.map((phase) => <li key={phase.key} aria-current={phase.state === "current" ? "step" : undefined} className={`min-w-0 rounded-xl px-2 py-3 text-center ${phase.state === "current" ? "bg-royal text-white ring-4 ring-royal/10" : phase.state === "complete" ? "bg-royal/8 text-royal" : "bg-bg text-muted"}`}><span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs ${phase.state === "current" ? "bg-white/15" : "bg-fg/5"}`}>{phase.state === "complete" ? <Check size={14} aria-hidden="true" /> : phase.index + 1}</span><span className="mt-2 block text-[10px] leading-4 font-medium sm:text-xs">{phase.label}</span></li>)}</ol>
      </section>

      {!cancelled && !limitedLookup && <div id="shipment-payments" className="scroll-mt-28"><ShipmentNotices shipment={data} /></div>}
      <section id="shipment-photos" className="scroll-mt-28">
        {data.photos?.length ? <PhotoCatalog photos={data.photos} /> : <div className="mt-6 rounded-3xl border border-dashed border-line bg-card p-5 sm:p-6"><h2 className="font-semibold">{t.track.photos}</h2><p className="mt-2 text-sm leading-6 text-muted">{text.photosPending}</p></div>}
      </section>

      <section id="shipment-journey" className="mt-6 scroll-mt-28 rounded-3xl border border-line bg-card p-5 sm:p-6" aria-labelledby="shipment-journey-title">
        <h2 id="shipment-journey-title" className="flex items-center gap-2 text-lg font-semibold"><Navigation size={20} className="text-royal" aria-hidden="true" />{text.journey}</h2>
        {route.length > 0 && <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">{route.map((place, index) => <span key={`${place}-${index}`} className="contents"><span className="rounded-lg bg-bg px-2.5 py-1.5">{place}</span>{index < route.length - 1 && <ArrowRight size={12} aria-hidden="true" />}</span>)}</p>}
        {!cancelled && knownStage ? <ol className="mt-5 grid gap-3 md:grid-cols-3">{items.slice(Math.max(0, cursor - 1), cursor + 2).map((item) => {
          const index = items.indexOf(item);
          const current = index === cursor;
          return <li key={item.id} className={`rounded-2xl border p-4 ${current ? "border-royal/20 bg-royal/5" : "border-line bg-bg"}`}><p className={`text-xs ${current ? "text-royal" : "text-muted"}`}>{index < cursor ? text.before : current ? text.now : text.after}</p><p className={`mt-2 text-sm leading-6 ${current ? "font-semibold text-royal" : "text-muted"}`}>{item.label}</p></li>;
        })}</ol> : <p className="mt-4 rounded-xl bg-bg p-4 text-sm leading-6 text-muted">{overview.explanation}</p>}
        <details className="mt-5 border-t border-line pt-3"><summary className="cursor-pointer py-2 text-sm font-medium text-royal">{text.allStages} <span className="font-normal text-muted">({items.length})</span></summary><p className="mt-2 text-xs text-muted">{text.stageHint}</p>
          <ol className="mt-5 space-y-0">{items.map((item, index) => {
            const event = item.kind === "step" ? (data.events ?? []).find((entry) => entry.status === item.key) : undefined;
            const when = item.kind === "transit" ? item.occurredAt : event?.occurredAt;
            const current = !cancelled && knownStage && index === cursor;
            const done = cancelled || !knownStage ? Boolean(when) : index <= cursor;
            return <li key={item.id} className="grid grid-cols-[24px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-royal text-white" : "bg-fg/10 text-muted"} ${current ? "ring-4 ring-royal/20" : ""}`}>{done ? <Check size={13} aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>{index < items.length - 1 && <span className={`w-px flex-1 ${done ? "bg-royal/40" : "bg-line"}`} />}</div><div className="pb-6"><p className={`text-sm leading-6 ${current ? "font-semibold text-royal" : done ? "text-fg/80" : "text-muted"}`}>{item.label}</p>{when && <p className="mt-1 text-xs text-muted">{recordedDate(when, locale)}</p>}</div></li>;
          })}</ol>
        </details>
      </section>

      {(data.invoice || documents.length > 0) && <section id="shipment-documents" className="mt-6 scroll-mt-28 rounded-3xl border border-line bg-card p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><FileText size={20} className="text-royal" aria-hidden="true" />{t.track.docsTitle}</h2><p className="mt-1 text-xs text-muted">{text.documentsHint}</p>{data.invoice && <div className="mt-4 rounded-2xl bg-bg p-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><span className="break-all text-muted">{t.track.invoice} {data.invoice.number}</span><span className="font-semibold">${data.invoice.amountUsd.toLocaleString()}</span></div><p className="mt-2 text-xs text-royal">{data.invoice.status}</p></div>}<div className="mt-3 grid gap-2 sm:grid-cols-2">{documents.map((doc) => <a key={doc.url} href={doc.safeUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm transition hover:bg-bg"><span className="min-w-0 break-words">{doc.title}</span><Download size={17} className="shrink-0 text-muted" aria-hidden="true" /></a>)}</div></section>}
      {!limitedLookup && <ShipmentReview key={data.trackingCode} shipment={data} />}

      <details className="mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6"><summary className="cursor-pointer text-sm font-semibold">{text.details}</summary><div className="mt-5 grid items-start gap-6 sm:grid-cols-[1fr_auto]"><dl className="grid gap-4 text-sm sm:grid-cols-2">{[["VIN", data.vin], ["Lot №", data.lotNumber], [t.track.origin, data.originPort], [t.track.destination, data.destinationPort], [text.container, data.containerNumber], [text.carrier, data.carrierName], [text.vessel, data.vesselName], [text.voyage, data.voyageNumber], [text.opening, opening ? `${opening[3]}.${opening[2]}.${opening[1]}` : undefined]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl><div className="flex items-center gap-3 rounded-2xl bg-bg p-3"><QRCodeSVG value={`${SITE.url}/track/${encodeURIComponent(data.trackingCode)}`} size={72} bgColor="transparent" fgColor="currentColor" /><div className="text-xs leading-5 text-muted">{t.track.openPhone}<br />{t.track.scanQr}</div></div></div>{(data.hasInsurance || data.insurance?.status) && <Link href={`/insurance/${data.trackingCode}`} className="mt-5 inline-flex min-h-10 items-center text-sm font-medium text-royal">{t.track.insurance}<ArrowRight size={15} className="ml-2" aria-hidden="true" /></Link>}{data.contract?.status && data.contract.status !== "NONE" && <p className="mt-3 text-xs text-muted">{data.contract.signed ? t.track.contractSigned : t.track.contractUnsigned}</p>}</details>

      <section className="mt-6 rounded-3xl border border-line bg-card p-5 sm:p-6" aria-labelledby="shipment-faq-title"><h2 id="shipment-faq-title" className="flex items-center gap-2 text-base font-semibold"><CircleHelp size={19} className="text-royal" aria-hidden="true" />{text.faq}</h2><div className="mt-3 divide-y divide-line">{[{ question: text.mapQuestion, answer: text.mapAnswer }, { question: text.containerQuestion, answer: text.containerAnswer }].map((row) => <details key={row.question} className="py-3"><summary className="cursor-pointer text-sm font-medium">{row.question}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{row.answer}</p></details>)}<details className="py-3"><summary className="cursor-pointer text-sm font-medium">{text.etaQuestion}</summary><ShippingNotice className="mt-4" /></details></div></section>
    </div>
  );
}
