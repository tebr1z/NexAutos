export const TRACKING_STEPS = [
  { key: "PURCHASED", en: "Vehicle purchased", az: "Maşın alınıb", ru: "Автомобиль куплен", tr: "Araç satın alındı" },
  { key: "PAYMENT_RECEIVED", en: "Payment received by company", az: "Pul şirkətin hesabına mədaxil olub", ru: "Оплата поступила компании", tr: "Ödeme şirket hesabına ulaştı" },
  { key: "AUCTION_PAID", en: "Auction Paid", az: "Hərrac ödənilib", ru: "Аукцион оплачен", tr: "Açık artırma ödendi" },
  { key: "AUCTION_RELEASED", en: "Released by auction", az: "Hərracdan çıxarılıb", ru: "Выдан аукционом", tr: "Açık artırmadan çıkarıldı" },
  { key: "EXPORT_DOCUMENTS", en: "Documents being prepared", az: "Sənədləri hazırlanır", ru: "Документы готовятся", tr: "Evrakları hazırlanıyor" },
  { key: "EXPORT_READY", en: "Export document ready", az: "İxrac sənədi hazırdır", ru: "Экспортный документ готов", tr: "İhracat evrakı hazır" },
  { key: "PICKED_UP", en: "Collected from purchase location", az: "Alındığı yerdən götürülüb", ru: "Забран с места покупки", tr: "Satın alındığı yerden alındı" },
  { key: "TO_ORIGIN_PORT", en: "On the way to port", az: "Limana doğru yoldadır", ru: "Следует в порт", tr: "Limana doğru yolda" },
  { key: "ARRIVED_PORT", en: "Arrived Port", az: "Limana çatıb", ru: "Прибыло в порт", tr: "Limana vardı" },
  { key: "CONTAINER_LOADING", en: "Container loading in progress", az: "Konteynerə yüklənmə mərhələsindədir", ru: "Идёт загрузка в контейнер", tr: "Konteynere yükleniyor" },
  { key: "LOADED_CONTAINER", en: "Container loaded, awaiting departure", az: "Konteynerə yüklənib, yola çıxmağı gözləyir", ru: "В контейнере, ожидает отправления", tr: "Konteynere yüklendi, kalkış bekleniyor" },
  { key: "VESSEL_WAITING", en: "Awaiting vessel arrival", az: "Gəminin limana yaxınlaşmasını gözləyir", ru: "Ожидает прибытия судна", tr: "Geminin limana gelişi bekleniyor" },
  { key: "VESSEL_LOADED", en: "Loaded onto vessel", az: "Gəmiyə yüklənib", ru: "Погружен на судно", tr: "Gemiye yüklendi" },
  { key: "SHIP_DEPARTED", en: "Vessel underway", az: "Gəmi hərəkətdədir", ru: "Судно в пути", tr: "Gemi hareket halinde" },
  { key: "IN_TRANSIT", en: "Transit route", az: "Tranzit marşrutundadır", ru: "Транзитный маршрут", tr: "Transit güzergâhında" },
  { key: "ISTANBUL_TO_POTI", en: "Departed Istanbul towards Poti", az: "İstanbuldan Poti istiqamətinə yola düşüb", ru: "Отправлен из Стамбула в Поти", tr: "İstanbul’dan Poti yönüne çıktı" },
  { key: "DESTINATION_APPROACHING", en: "Vessel approaching Poti / Batumi", az: "Gəmi Poti / Batum limanına yaxınlaşır", ru: "Судно приближается к Поти / Батуми", tr: "Gemi Poti / Batum limanına yaklaşıyor" },
  { key: "DESTINATION_PORT", en: "Destination Port", az: "Təyinat limanı", ru: "Порт назначения", tr: "Varış limanı" },
  { key: "CONTAINER_DISCHARGED", en: "Container discharged", az: "Konteyner boşaldılıb", ru: "Контейнер выгружен", tr: "Konteyner tahliye edildi" },
  { key: "CONTAINER_OPENING_PENDING", en: "Awaiting container opening", az: "Konteynerin açılmasını gözləyir", ru: "Ожидает вскрытия контейнера", tr: "Konteynerin açılması bekleniyor" },
  { key: "CONTAINER_OPENED", en: "Container opened", az: "Konteyner açılıb", ru: "Контейнер открыт", tr: "Konteyner açıldı" },
  { key: "TIR_LOADING_PENDING", en: "Awaiting truck loading", az: "TIR-a yüklənməyi gözləyir", ru: "Ожидает погрузки на фуру", tr: "TIR’a yükleme bekleniyor" },
  { key: "TIR_LOADED", en: "Loaded on truck", az: "TIR yüklənib", ru: "Погружено на фуру", tr: "TIR yüklendi" },
  { key: "CUSTOMS_DOCUMENTS", en: "Baku customs documents being prepared", az: "Bakı gömrüyü üçün sənədlər hazırlanır", ru: "Готовятся документы для таможни Баку", tr: "Bakü gümrük evrakları hazırlanıyor" },
  { key: "CUSTOMS_DOCUMENTS_READY", en: "Customs documents ready", az: "Gömrük sənədləri hazırdır", ru: "Таможенные документы готовы", tr: "Gümrük evrakları hazır" },
  { key: "TIR_DEPARTED", en: "Truck departed", az: "TIR yola çıxıb", ru: "Фура выехала", tr: "TIR yola çıktı" },
  { key: "TIR_GEORGIA_BORDER", en: "At Georgia border", az: "TIR Gürcüstan sərhədindədir", ru: "Фура на границе Грузии", tr: "TIR Gürcistan sınırında" },
  { key: "TIR_BAKU_CUSTOMS", en: "At Baku customs", az: "TIR Bakı gömrüyündədir", ru: "Фура на таможне Баку", tr: "TIR Bakü gümrüğünde" },
  { key: "CUSTOMS_CLEARANCE", en: "Customs Clearance", az: "Gömrük rəsmiləşdirməsi", ru: "Таможенное оформление", tr: "Gümrükleme" },
  { key: "READY_FOR_DELIVERY", en: "Unloaded at Baku customs — please collect", az: "Maşın Bakı gömrüyündə boşaldılıb — zəhmət olmasa təhvil götürün", ru: "Выгружен на таможне Баку — заберите автомобиль", tr: "Bakü gümrüğünde indirildi — lütfen teslim alın" },
  { key: "DELIVERED", en: "Handed over", az: "Təhvil verilib", ru: "Передано клиенту", tr: "Teslim edildi" },
] as const;

export type ShipmentStatus = (typeof TRACKING_STEPS)[number]["key"] | "CANCELLED";

/** WhatsApp/SMS yalnız bu mərhələlərdə — qalanları izləmə səhifəsində görünür, mesaj getmir. */
export const SMS_NOTIFY_STATUSES = [
  "PURCHASED",
  "EXPORT_DOCUMENTS",
  "EXPORT_READY",
  "LOADED_CONTAINER",
  "SHIP_DEPARTED",
  "DESTINATION_PORT",
  "TIR_BAKU_CUSTOMS",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export function shouldNotifyStatus(status: string) {
  return (SMS_NOTIFY_STATUSES as readonly string[]).includes(status);
}

/** Road/customs stages use the last reported land location. */
export function isRoadMapStatus(status: string) {
  return (
    status.startsWith("TIR_") ||
    status.startsWith("CUSTOMS_") ||
    status === "CUSTOMS_CLEARANCE" ||
    status === "READY_FOR_DELIVERY" ||
    status === "DELIVERED" ||
    status === "CANCELLED"
  );
}

export function isLiveVesselMapStatus(status: string) {
  return !isRoadMapStatus(status);
}

export const DESTINATION_PORTS = [
  { value: "Batumi", az: "Batum", en: "Batumi", ru: "Батуми", tr: "Batum", country: "Georgia" },
  { value: "Poti", az: "Poti", en: "Poti", ru: "Поти", tr: "Poti", country: "Georgia" },
] as const;

export type DestinationPortValue = (typeof DESTINATION_PORTS)[number]["value"];

export function destinationPortName(port: string | null | undefined, locale: "az" | "en" | "ru" | "tr" = "az") {
  const raw = port?.trim();
  if (!raw) return "";
  const hit = DESTINATION_PORTS.find((row) => row.value.toLowerCase() === raw.toLowerCase() || row.az.toLowerCase() === raw.toLowerCase());
  return hit ? hit[locale] : raw;
}

export function locationForStatus(
  status: ShipmentStatus,
  destinationPort?: string | null,
): { currentPort?: string; currentCountry?: string } {
  const dest = destinationPort?.trim();
  if (["DESTINATION_PORT", "CONTAINER_DISCHARGED", "CONTAINER_OPENING_PENDING", "CONTAINER_OPENED", "TIR_LOADING_PENDING", "TIR_LOADED", "CUSTOMS_DOCUMENTS", "CUSTOMS_DOCUMENTS_READY"].includes(status)) {
    return dest ? { currentPort: dest, currentCountry: "Georgia" } : {};
  }
  if (status === "TIR_GEORGIA_BORDER") {
    return { currentPort: "Gürcüstan sərhədi", currentCountry: "Georgia" };
  }
  if (["TIR_BAKU_CUSTOMS", "CUSTOMS_CLEARANCE", "READY_FOR_DELIVERY"].includes(status)) {
    return { currentPort: "Bakı gömrüyü", currentCountry: "Azerbaijan" };
  }
  return {};
}

export const AUCTIONS = ["COPART", "IAAI", "MANHEIM"] as const;

export const LOCALES = [
  { code: "az", label: "AZ", name: "Azərbaycan" },
  { code: "en", label: "EN", name: "English" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "tr", label: "TR", name: "Türkçe" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const CURRENCIES = [
  { code: "AZN", symbol: "₼" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "TRY", symbol: "₺" },
] as const;

export type Currency = (typeof CURRENCIES)[number]["code"];

export const HERO_VIDEO =
  "https://videos.pexels.com/video-files/2053100/2053100-uhd_2560_1440_30fps.mp4";

export const HERO_POSTER =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2400&q=80";

const PHONES = [
  { display: "070 966 81 11", tel: "+994709668111", wa: "994709668111" },
  { display: "070 964 64 66", tel: "+994709646466", wa: "994709646466" },
  { display: "099 730 03 13", tel: "+994997300313", wa: "994997300313" },
] as const;

export const SITE = {
  name: "Auto Nex",
  tagline: "Premium Car Import From USA, Korea & China",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://nex.autos",
  email: "auto@nex.autos",
  address: "Bakı şəhəri, Bakıxanov qəsəbəsi",
  phones: PHONES,
  phone: PHONES[0].display,
  whatsapp: PHONES[0].wa,
};

export const IMAGES = {
  cars: [
    "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1600&q=80",
  ],
};
