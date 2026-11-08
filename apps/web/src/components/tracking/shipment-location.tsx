"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, ExternalLink, MapPin, Navigation, PackageSearch } from "lucide-react";
import type { Locale } from "@/lib/constants";
import type { TrackingShipment } from "@/lib/types";
import { safeCarrierUrl } from "./shipment-notices";
import { ShipmentMap } from "./shipment-map";

const COPY = {
  az: {
    title: "Xəritə və canlı izləmə",
    intro: "Avtomobilinizin yerini və daşıyıcının son məlumatını burada yoxlayın.",
    mapTitle: "Son bildirilən məntəqə",
    mapPending: "Məntəqə hələ təsdiqlənməyib",
    mapPendingHint: "İlk daşınma məlumatı əlavə olunduqda xəritədə görünəcək.",
    mapSource: "Sifariş üzrə qeyd olunan mövqe",
    mapHint: "Xəritədəki nişan son qeyd edilmiş koordinatı və ya limanın təxmini yerini göstərir. Canlı GPS deyil.",
    carrierTitle: "Daşıyıcıdan yenilənən məlumat",
    carrierHint: "Gəmi və konteynerin mövqeyini, eləcə də yenilənən tarixləri daşıyıcının səhifəsində yoxlayın.",
    open: "Canlı izləməni aç",
    external: "Daşıyıcının xarici saytında, yeni pəncərədə açılır. Məlumatın dəqiqliyi və yenilənmə tezliyi daşıyıcıdan asılıdır.",
    source: "Məlumat mənbəyi",
    container: "Konteyner kodu",
    copy: "Kodu kopyala",
    copied: "Kod kopyalandı",
    copyFailed: "Avtomatik kopyalanmadı. Yuxarıdakı kodu seçib kopyalayın.",
    howTo: "Sayt konteyner kodu istəsə, bu kodu axtarış sahəsinə daxil edin.",
    missingTitle: "İzləmə linki hələ əlavə edilməyib",
    missingHint: "Daşıyıcı təsdiqləndikdə menecer linki buraya əlavə edəcək. Bu vaxtadək aşağıdakı daşınma mərhələlərini izləyə bilərsiniz.",
    stage: "Hazırkı mərhələ",
    legendPin: "Xəritə nişanı: son bildirilən yer",
    legendLink: "Xarici link: daşıyıcının məlumatı",
    explain: "Xəritə və link nə göstərir?",
  },
  en: {
    title: "Map and live tracking",
    intro: "Check your vehicle’s reported location and the carrier’s latest information here.",
    mapTitle: "Last reported location",
    mapPending: "Location not yet confirmed",
    mapPendingHint: "The map will appear when the first transport location is added.",
    mapSource: "Location recorded for this order",
    mapHint: "The pin shows the last recorded coordinates or the approximate port location. It is not live GPS.",
    carrierTitle: "Updates from the carrier",
    carrierHint: "Check the vessel or container location and updated dates on the carrier’s page.",
    open: "Open live tracking",
    external: "Opens the carrier’s external website in a new tab. Accuracy and update frequency depend on the carrier.",
    source: "Information source",
    container: "Container code",
    copy: "Copy code",
    copied: "Code copied",
    copyFailed: "Could not copy automatically. Select and copy the code above.",
    howTo: "If the website requests a container code, paste this code into its search field.",
    missingTitle: "Tracking link not yet added",
    missingHint: "Your manager will add the link when the carrier is confirmed. Until then, follow the shipment stages below.",
    stage: "Current stage",
    legendPin: "Map pin: last reported location",
    legendLink: "External link: carrier information",
    explain: "What do the map and link show?",
  },
  ru: {
    title: "Карта и отслеживание",
    intro: "Здесь можно проверить указанное местоположение автомобиля и обновления перевозчика.",
    mapTitle: "Последнее указанное местоположение",
    mapPending: "Местоположение ещё не подтверждено",
    mapPendingHint: "Карта появится после добавления первого местоположения по перевозке.",
    mapSource: "Местоположение, указанное в заказе",
    mapHint: "Метка показывает последние записанные координаты или приблизительное место порта. Это не GPS в реальном времени.",
    carrierTitle: "Обновления перевозчика",
    carrierHint: "Местоположение судна или контейнера и обновлённые даты доступны на странице перевозчика.",
    open: "Открыть отслеживание",
    external: "Откроется внешний сайт перевозчика в новой вкладке. Точность и частота обновлений зависят от перевозчика.",
    source: "Источник информации",
    container: "Код контейнера",
    copy: "Скопировать код",
    copied: "Код скопирован",
    copyFailed: "Не удалось скопировать автоматически. Выделите и скопируйте код выше.",
    howTo: "Если сайт запрашивает код контейнера, вставьте этот код в поле поиска.",
    missingTitle: "Ссылка ещё не добавлена",
    missingHint: "Менеджер добавит ссылку после подтверждения перевозчика. Пока можно следить за этапами перевозки ниже.",
    stage: "Текущий этап",
    legendPin: "Метка на карте: последнее указанное место",
    legendLink: "Внешняя ссылка: информация перевозчика",
    explain: "Что показывают карта и ссылка?",
  },
  tr: {
    title: "Harita ve canlı takip",
    intro: "Aracınızın bildirilen konumunu ve taşıyıcının güncel bilgilerini burada kontrol edin.",
    mapTitle: "Son bildirilen konum",
    mapPending: "Konum henüz doğrulanmadı",
    mapPendingHint: "İlk taşıma konumu eklendiğinde haritada gösterilecek.",
    mapSource: "Sipariş için kaydedilen konum",
    mapHint: "İşaret, son kaydedilen koordinatları veya limanın yaklaşık konumunu gösterir. Canlı GPS değildir.",
    carrierTitle: "Taşıyıcıdan güncel bilgiler",
    carrierHint: "Gemi veya konteynerin konumunu ve güncellenen tarihleri taşıyıcının sayfasından kontrol edin.",
    open: "Canlı takibi aç",
    external: "Taşıyıcının harici sitesi yeni sekmede açılır. Doğruluk ve güncelleme sıklığı taşıyıcıya bağlıdır.",
    source: "Bilgi kaynağı",
    container: "Konteyner kodu",
    copy: "Kodu kopyala",
    copied: "Kod kopyalandı",
    copyFailed: "Otomatik kopyalanamadı. Yukarıdaki kodu seçip kopyalayın.",
    howTo: "Site konteyner kodu isterse bu kodu arama alanına girin.",
    missingTitle: "Takip bağlantısı henüz eklenmedi",
    missingHint: "Taşıyıcı kesinleştiğinde yöneticiniz bağlantıyı ekleyecek. Bu arada aşağıdaki taşıma aşamalarını takip edebilirsiniz.",
    stage: "Mevcut aşama",
    legendPin: "Harita işareti: son bildirilen konum",
    legendLink: "Harici bağlantı: taşıyıcı bilgileri",
    explain: "Harita ve bağlantı ne gösterir?",
  },
} satisfies Record<Locale, Record<string, string>>;

function validCoordinates(lat?: number | null, lng?: number | null) {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function ShipmentLocation({ shipment, locale = "az", stageCaption }: { shipment: TrackingShipment; locale?: Locale; stageCaption?: string }) {
  const text = COPY[locale];
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const url = safeCarrierUrl(shipment.carrierTrackingUrl);
  const host = url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
  const manualPin = validCoordinates(shipment.mapLat, shipment.mapLng);
  const lat = manualPin ? shipment.mapLat : shipment.lat;
  const lng = manualPin ? shipment.mapLng : shipment.lng;
  const hasPin = validCoordinates(lat, lng);
  const place = [shipment.currentPort, shipment.currentCountry].filter(Boolean).join(", ");
  const container = shipment.containerNumber?.trim();

  async function copyContainer() {
    if (!container) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(container);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <section id="shipment-location" aria-labelledby="shipment-location-title" className="scroll-mt-28 overflow-hidden rounded-3xl border border-line bg-card">
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal/10 text-royal" aria-hidden="true"><MapPin size={22} /></span>
        <div>
          <h2 id="shipment-location-title" className="text-lg font-semibold sm:text-xl">{text.title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{text.intro}</p>
        </div>
      </div>
      <div className="relative isolate border-y border-line">
        {hasPin ? <>
          <ShipmentMap lat={lat} lng={lng} label={place || text.mapTitle} className="h-[260px] sm:h-[300px]" />
          <div className="pointer-events-none absolute top-3 right-3 z-[450] max-w-[calc(100%-76px)] rounded-xl border border-line bg-card/95 px-3 py-2 shadow-sm">
            <p className="text-[10px] text-muted">{text.mapTitle}</p>
            <p className="mt-0.5 break-words text-xs font-semibold">{place || text.mapSource}</p>
          </div>
        </> : <div role="status" className="flex h-[260px] flex-col items-center justify-center bg-bg/70 px-6 py-6 text-center sm:h-[300px]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-royal/25 bg-royal/5 text-royal"><MapPin size={25} aria-hidden="true" /></span>
          <p className="mt-3 text-sm font-semibold">{text.mapPending}</p>
          <p className="mt-2 max-w-xs text-xs leading-5 text-muted">{text.mapPendingHint}</p>
        </div>}
      </div>

      <div className="p-4 sm:px-5">
        {url ? <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="text-[10px] text-muted">{text.source}</p><p className="mt-0.5 break-all text-xs font-medium">{shipment.carrierName ? `${shipment.carrierName} · ${host}` : host}</p></div>
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${text.open} · ${host} · ${text.external}`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-royal px-4 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal">
            {text.open}<ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
          </a>
        </div> : <div role="status" className="flex items-start gap-2.5 rounded-xl bg-bg p-3"><PackageSearch size={19} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /><div><p className="text-sm font-semibold">{text.missingTitle}</p><p className="mt-1 text-xs leading-5 text-muted">{text.missingHint}</p></div></div>}

        {container && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="min-w-0"><p className="text-[10px] text-muted">{text.container}</p><code className="mt-0.5 block select-text break-all text-sm font-semibold tracking-wide">{container}</code></div>
          <button type="button" onClick={copyContainer} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-medium transition hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">
            {copyStatus === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copyStatus === "copied" ? text.copied : text.copy}
          </button>
          <p role="status" aria-live="polite" className={`w-full text-xs leading-5 ${copyStatus === "failed" ? "text-amber-700" : "sr-only"}`}>{copyStatus === "failed" ? text.copyFailed : copyStatus === "copied" ? text.copied : ""}</p>
        </div>}

        <p className="mt-3 text-[11px] leading-5 text-muted">{text.legendPin}. {text.legendLink}.</p>
        <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer py-1 font-medium text-royal">{text.explain}</summary><div className="space-y-2 pt-2 leading-5"><p>{text.mapHint}</p>{url && <p className="flex items-start gap-1.5"><ExternalLink size={13} className="mt-1 shrink-0" aria-hidden="true" />{text.external}</p>}{url && container && <p>{text.howTo}</p>}{stageCaption && <p className="flex items-start gap-2"><Navigation size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{text.stage}: {stageCaption}</span></p>}</div></details>
      </div>
    </section>
  );
}
