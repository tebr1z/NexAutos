export const TRACKING_STEPS = [
  { key: "PURCHASED", en: "Purchased", az: "Alınıb", ru: "Куплено", tr: "Satın alındı" },
  { key: "AUCTION_PAID", en: "Auction Paid", az: "Hərrac ödənilib", ru: "Аукцион оплачен", tr: "Açık artırma ödendi" },
  { key: "PICKED_UP", en: "Picked Up", az: "Götürülüb", ru: "Забрано", tr: "Teslim alındı" },
  { key: "EXPORT_DOCUMENTS", en: "Export Documents", az: "İxrac sənədləri", ru: "Экспортные документы", tr: "İhracat evrakları" },
  { key: "ARRIVED_PORT", en: "Arrived Port", az: "Limana çatıb", ru: "Прибыло в порт", tr: "Limana vardı" },
  { key: "LOADED_CONTAINER", en: "Loaded Container", az: "Konteynerə yüklənib", ru: "Загружено в контейнер", tr: "Konteynere yüklendi" },
  { key: "SHIP_DEPARTED", en: "Ship Departed", az: "Gəmi yola düşüb", ru: "Судно отправилось", tr: "Gemi yola çıktı" },
  { key: "IN_TRANSIT", en: "In Transit", az: "Yoldadır", ru: "В пути", tr: "Yolda" },
  { key: "DESTINATION_PORT", en: "Destination Port", az: "Təyinat limanı", ru: "Порт назначения", tr: "Varış limanı" },
  { key: "TIR_LOADED", en: "Loaded on truck", az: "TIR yüklənib", ru: "Погружено на фуру", tr: "TIR yüklendi" },
  { key: "TIR_DEPARTED", en: "Truck departed", az: "TIR yola çıxıb", ru: "Фура выехала", tr: "TIR yola çıktı" },
  { key: "TIR_GEORGIA_BORDER", en: "At Georgia border", az: "TIR Gürcüstan sərhədindədir", ru: "Фура на границе Грузии", tr: "TIR Gürcistan sınırında" },
  { key: "TIR_BAKU_CUSTOMS", en: "At Baku customs", az: "TIR Bakı gömrüyündədir", ru: "Фура на таможне Баку", tr: "TIR Bakü gümrüğünde" },
  { key: "CUSTOMS_CLEARANCE", en: "Customs Clearance", az: "Gömrük rəsmiləşdirməsi", ru: "Таможенное оформление", tr: "Gümrükleme" },
  { key: "READY_FOR_DELIVERY", en: "Ready For Delivery", az: "Çatdırılmağa hazır", ru: "Готово к доставке", tr: "Teslime hazır" },
  { key: "DELIVERED", en: "Delivered", az: "Çatdırılıb", ru: "Доставлено", tr: "Teslim edildi" },
] as const;

export type ShipmentStatus = (typeof TRACKING_STEPS)[number]["key"] | "CANCELLED";

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
  if (status === "DESTINATION_PORT" || status === "TIR_LOADED" || status === "TIR_DEPARTED") {
    return dest ? { currentPort: dest, currentCountry: "Georgia" } : {};
  }
  if (status === "TIR_GEORGIA_BORDER") {
    return { currentPort: "Gürcüstan sərhədi", currentCountry: "Georgia" };
  }
  if (status === "TIR_BAKU_CUSTOMS") {
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
