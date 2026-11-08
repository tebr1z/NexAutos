import type { Locale, ShipmentStatus } from "./constants";
import type { TrackingShipment } from "./types";

type Copy = Record<Locale, string>;
type PhaseKey = "purchase" | "documents" | "container" | "sea" | "port" | "truck" | "customs" | "delivered";

export const TRACKING_PHASES: ReadonlyArray<{ key: PhaseKey; label: Copy }> = [
  { key: "purchase", label: { az: "Alış", en: "Purchase", ru: "Покупка", tr: "Satın alma" } },
  { key: "documents", label: { az: "Sənədlər", en: "Documents", ru: "Документы", tr: "Evraklar" } },
  { key: "container", label: { az: "Yükləmə", en: "Loading", ru: "Погрузка", tr: "Yükleme" } },
  { key: "sea", label: { az: "Dəniz yolu", en: "Sea transport", ru: "Морской путь", tr: "Deniz yolu" } },
  { key: "port", label: { az: "Poti / Batum", en: "Poti / Batumi", ru: "Поти / Батуми", tr: "Poti / Batum" } },
  { key: "truck", label: { az: "TIR yolu", en: "Truck transport", ru: "Перевозка фурой", tr: "TIR yolu" } },
  { key: "customs", label: { az: "Bakı gömrüyü", en: "Baku customs", ru: "Таможня Баку", tr: "Bakü gümrüğü" } },
  { key: "delivered", label: { az: "Təhvil", en: "Handover", ru: "Передача", tr: "Teslim" } },
];

const STATUS_PHASE: Record<Exclude<ShipmentStatus, "CANCELLED">, PhaseKey> = {
  PURCHASED: "purchase",
  PAYMENT_RECEIVED: "purchase",
  AUCTION_PAID: "purchase",
  AUCTION_RELEASED: "purchase",
  EXPORT_DOCUMENTS: "documents",
  EXPORT_READY: "documents",
  PICKED_UP: "container",
  TO_ORIGIN_PORT: "container",
  ARRIVED_PORT: "container",
  CONTAINER_LOADING: "container",
  LOADED_CONTAINER: "container",
  VESSEL_WAITING: "container",
  VESSEL_LOADED: "sea",
  SHIP_DEPARTED: "sea",
  IN_TRANSIT: "sea",
  ISTANBUL_TO_POTI: "sea",
  DESTINATION_APPROACHING: "sea",
  DESTINATION_PORT: "port",
  CONTAINER_DISCHARGED: "port",
  CONTAINER_OPENING_PENDING: "port",
  CONTAINER_OPENED: "port",
  TIR_LOADING_PENDING: "port",
  TIR_LOADED: "truck",
  CUSTOMS_DOCUMENTS: "truck",
  CUSTOMS_DOCUMENTS_READY: "truck",
  TIR_DEPARTED: "truck",
  TIR_GEORGIA_BORDER: "truck",
  TIR_BAKU_CUSTOMS: "customs",
  CUSTOMS_CLEARANCE: "customs",
  READY_FOR_DELIVERY: "customs",
  DELIVERED: "delivered",
};

const EXPLANATIONS: Record<ShipmentStatus, Copy> = {
  PURCHASED: {
    az: "Avtomobiliniz alınıb. Ödəniş və daşınma hazırlığı üzrə yeniliklər burada görünəcək.",
    en: "Your vehicle has been purchased. Payment and shipping preparations will be updated here.",
    ru: "Ваш автомобиль куплен. Здесь появятся обновления об оплате и подготовке перевозки.",
    tr: "Aracınız satın alındı. Ödeme ve taşıma hazırlıklarının güncellemeleri burada görünecek.",
  },
  PAYMENT_RECEIVED: {
    az: "Ödəniş şirkətin hesabına daxil olub. Bu, avtomobilin artıq yola çıxması demək deyil.",
    en: "The company has received the payment. This does not mean the vehicle has departed yet.",
    ru: "Оплата поступила компании. Это ещё не означает, что автомобиль отправлен.",
    tr: "Ödeme şirket hesabına ulaştı. Bu, aracın henüz yola çıktığı anlamına gelmez.",
  },
  AUCTION_PAID: {
    az: "Hərrac üzrə ödəniş tamamlanıb. Avtomobilin götürülməsi üçün hazırlıq aparılır.",
    en: "The auction payment is complete. Vehicle collection is being arranged.",
    ru: "Аукцион оплачен. Организуется вывоз автомобиля.",
    tr: "Açık artırma ödemesi tamamlandı. Aracın alınması planlanıyor.",
  },
  AUCTION_RELEASED: {
    az: "Avtomobil hərracdan buraxılıb. Faktiki götürülmə ayrıca mərhələ kimi göstəriləcək.",
    en: "The auction has released the vehicle. Physical collection will be recorded separately.",
    ru: "Аукцион разрешил выдачу автомобиля. Фактический вывоз будет отмечен отдельно.",
    tr: "Araç açık artırma tarafından serbest bırakıldı. Fiziksel teslim alma ayrıca bildirilecek.",
  },
  EXPORT_DOCUMENTS: {
    az: "İxrac üçün lazım olan sənədlər hazırlanır. Sənəd hazır olduqda status yenilənəcək.",
    en: "The export documents are being prepared. This status will change when they are ready.",
    ru: "Готовятся документы для экспорта. Статус обновится после их подготовки.",
    tr: "İhracat için gerekli evraklar hazırlanıyor. Hazır olduğunda durum güncellenecek.",
  },
  EXPORT_READY: {
    az: "İxrac sənədi hazırdır. Növbəti daşınma addımları plan üzrə qeyd ediləcək.",
    en: "The export document is ready. The next shipping steps will be recorded as they occur.",
    ru: "Экспортный документ готов. Следующие этапы перевозки будут отмечаться по мере выполнения.",
    tr: "İhracat evrakı hazır. Sonraki taşıma adımları gerçekleştikçe kaydedilecek.",
  },
  PICKED_UP: {
    az: "Avtomobil alındığı yerdən götürülüb. Limana daşınma üzrə yeniliklər izləmədə görünəcək.",
    en: "The vehicle has been collected from the purchase location. Port transport updates will follow.",
    ru: "Автомобиль забран с места покупки. Здесь появятся обновления о доставке в порт.",
    tr: "Araç satın alındığı yerden alındı. Limana taşıma güncellemeleri burada görünecek.",
  },
  TO_ORIGIN_PORT: {
    az: "Avtomobil yola salınacağı limana doğru daşınır. Hələ dəniz səfərinə başlamayıb.",
    en: "The vehicle is being transported to the departure port. Its sea journey has not started yet.",
    ru: "Автомобиль следует в порт отправления. Морская перевозка ещё не началась.",
    tr: "Araç çıkış limanına taşınıyor. Deniz yolculuğu henüz başlamadı.",
  },
  ARRIVED_PORT: {
    az: "Avtomobil çıxış limanına çatıb. Konteynerə yüklənmə və gəmi hazırlığı gözlənilir.",
    en: "The vehicle has reached the departure port. Container loading and vessel arrangements are next.",
    ru: "Автомобиль прибыл в порт отправления. Ожидаются загрузка в контейнер и подготовка судна.",
    tr: "Araç çıkış limanına ulaştı. Konteyner yükleme ve gemi hazırlıkları bekleniyor.",
  },
  CONTAINER_LOADING: {
    az: "Avtomobilin konteynerə yüklənməsi aparılır. Yüklənmə tamamlandıqda ayrıca bildiriləcək.",
    en: "Container loading is in progress. Completion will be recorded separately.",
    ru: "Идёт загрузка автомобиля в контейнер. Завершение будет отмечено отдельно.",
    tr: "Araç konteynere yükleniyor. Yükleme tamamlandığında ayrıca bildirilecek.",
  },
  LOADED_CONTAINER: {
    az: "Avtomobil konteynerə yüklənib və göndərişi gözləyir. Gəmi hələ yola çıxmayıb.",
    en: "The vehicle is in the container, awaiting dispatch. The vessel has not departed yet.",
    ru: "Автомобиль загружен в контейнер и ожидает отправления. Судно ещё не вышло.",
    tr: "Araç konteynere yüklendi ve gönderimi bekliyor. Gemi henüz hareket etmedi.",
  },
  VESSEL_WAITING: {
    az: "Konteynerin daşınacağı gəminin limana gəlməsi gözlənilir.",
    en: "The container is waiting for the carrying vessel to arrive at port.",
    ru: "Ожидается прибытие судна, которое перевезёт контейнер.",
    tr: "Konteyneri taşıyacak geminin limana gelişi bekleniyor.",
  },
  VESSEL_LOADED: {
    az: "Konteyner gəmiyə yüklənib. Gəminin hərəkətə başlaması ayrıca qeyd ediləcək.",
    en: "The container has been loaded onto the vessel. Departure will be recorded separately.",
    ru: "Контейнер погружен на судно. Отправление будет отмечено отдельно.",
    tr: "Konteyner gemiye yüklendi. Geminin hareketi ayrıca kaydedilecek.",
  },
  SHIP_DEPARTED: {
    az: "Gəmi yola çıxıb və dəniz səfəri başlayıb. Liman və tranzit yenilikləri burada izlənilir.",
    en: "The vessel has departed and the sea journey has started. Port and transit updates appear here.",
    ru: "Судно отправилось, морская перевозка началась. Здесь появятся портовые и транзитные обновления.",
    tr: "Gemi yola çıktı ve deniz yolculuğu başladı. Liman ve transit güncellemeleri burada izlenir.",
  },
  IN_TRANSIT: {
    az: "Avtomobil dəniz marşrutu üzrə tranzitdədir. Qeyd olunan dayanacaqlar aşağıda göstərilir.",
    en: "The vehicle is in transit on its sea route. Recorded transit stops are shown below.",
    ru: "Автомобиль следует морским транзитным маршрутом. Отмеченные остановки показаны ниже.",
    tr: "Araç deniz güzergâhında transit halinde. Kaydedilen duraklar aşağıda gösterilir.",
  },
  ISTANBUL_TO_POTI: {
    az: "Göndəriş İstanbuldan Poti istiqamətinə yola düşüb. Təyinat limanına çatması hələ təsdiqlənməyib.",
    en: "The shipment has left Istanbul towards Poti. Arrival at the destination port is not yet confirmed.",
    ru: "Груз отправлен из Стамбула в Поти. Прибытие в порт назначения ещё не подтверждено.",
    tr: "Gönderi İstanbul’dan Poti yönüne çıktı. Varış limanına ulaşması henüz doğrulanmadı.",
  },
  DESTINATION_APPROACHING: {
    az: "Gəmi Poti / Batum limanına yaxınlaşır. Bu status konteynerin artıq boşaldılması demək deyil.",
    en: "The vessel is approaching Poti / Batumi. This does not mean the container has been unloaded yet.",
    ru: "Судно приближается к Поти / Батуми. Это ещё не означает, что контейнер выгружен.",
    tr: "Gemi Poti / Batum limanına yaklaşıyor. Bu, konteynerin henüz tahliye edildiği anlamına gelmez.",
  },
  DESTINATION_PORT: {
    az: "Göndəriş təyinat limanına çatıb. Konteynerin boşaldılması və açılması ayrıca izlənilir.",
    en: "The shipment has reached the destination port. Container discharge and opening are tracked separately.",
    ru: "Груз прибыл в порт назначения. Выгрузка и вскрытие контейнера отслеживаются отдельно.",
    tr: "Gönderi varış limanına ulaştı. Konteyner tahliyesi ve açılması ayrı izlenir.",
  },
  CONTAINER_DISCHARGED: {
    az: "Konteyner gəmidən limana boşaldılıb. Avtomobilin konteynerdən çıxarılması hələ növbəti mərhələdir.",
    en: "The container has been discharged from the vessel. Removing the vehicle from it is a separate step.",
    ru: "Контейнер выгружен с судна в порт. Извлечение автомобиля — отдельный этап.",
    tr: "Konteyner gemiden limana indirildi. Aracın konteynerden çıkarılması ayrı bir aşamadır.",
  },
  CONTAINER_OPENING_PENDING: {
    az: "Konteynerin açılması gözlənilir. Açılış tarixi təyin edilərsə, göndəriş məlumatlarında göstəriləcək.",
    en: "Container opening is awaited. If scheduled, the opening date appears in the shipment details.",
    ru: "Ожидается вскрытие контейнера. Назначенная дата появится в информации о перевозке.",
    tr: "Konteynerin açılması bekleniyor. Tarih belirlenirse gönderi bilgilerinde gösterilecek.",
  },
  CONTAINER_OPENED: {
    az: "Konteyner açılıb. Avtomobilin TIR-la daşınması üçün növbəti hazırlıq aparılır.",
    en: "The container has been opened. The next preparations are for truck transport.",
    ru: "Контейнер открыт. Идёт подготовка к перевозке автомобиля фурой.",
    tr: "Konteyner açıldı. Aracın TIR ile taşınması için sonraki hazırlıklar yapılıyor.",
  },
  TIR_LOADING_PENDING: {
    az: "Avtomobil TIR-a yüklənmək üçün gözləyir. TIR-ın yola çıxması ayrıca bildiriləcək.",
    en: "The vehicle is waiting to be loaded onto a truck. Truck departure will be recorded separately.",
    ru: "Автомобиль ожидает погрузки на фуру. Отправление фуры будет отмечено отдельно.",
    tr: "Araç TIR’a yüklenmeyi bekliyor. TIR’ın hareketi ayrıca bildirilecek.",
  },
  TIR_LOADED: {
    az: "Avtomobil TIR-a yüklənib. Bakı istiqamətinə hərəkət və sənədləşmə yenilikləri burada görünəcək.",
    en: "The vehicle is loaded onto a truck. Updates on paperwork and departure towards Baku will appear here.",
    ru: "Автомобиль погружен на фуру. Здесь появятся обновления о документах и выезде в Баку.",
    tr: "Araç TIR’a yüklendi. Evrak ve Bakü yönüne hareket güncellemeleri burada görünecek.",
  },
  CUSTOMS_DOCUMENTS: {
    az: "Bakı gömrüyünə giriş üçün sənədlər hazırlanır. Bu status avtomobilin artıq Bakıda olması demək deyil.",
    en: "Documents for Baku customs are being prepared. This does not mean the vehicle is already in Baku.",
    ru: "Готовятся документы для таможни Баку. Это не означает, что автомобиль уже в Баку.",
    tr: "Bakü gümrüğü için evraklar hazırlanıyor. Bu, aracın henüz Bakü’de olduğu anlamına gelmez.",
  },
  CUSTOMS_DOCUMENTS_READY: {
    az: "Bakı gömrüyü üçün sənədlər hazırdır. TIR-ın hərəkəti ayrıca mərhələdə təsdiqlənir.",
    en: "The Baku customs documents are ready. Truck departure is confirmed in a separate stage.",
    ru: "Документы для таможни Баку готовы. Отправление фуры подтверждается отдельным этапом.",
    tr: "Bakü gümrük evrakları hazır. TIR’ın hareketi ayrı bir aşamada doğrulanır.",
  },
  TIR_DEPARTED: {
    az: "Avtomobili daşıyan TIR yoldadır. Sərhəd və Bakı gömrüyü yenilikləri gəldikcə qeyd olunur.",
    en: "The truck carrying your vehicle is on the road. Border and Baku customs updates will be recorded as received.",
    ru: "Фура с вашим автомобилем в пути. Обновления о границе и таможне Баку будут отмечаться по поступлении.",
    tr: "Aracınızı taşıyan TIR yolda. Sınır ve Bakü gümrük güncellemeleri geldikçe kaydedilir.",
  },
  TIR_GEORGIA_BORDER: {
    az: "TIR Gürcüstan sərhədindədir. Sərhəd keçidi tamamlandıqca marşrut yenilənəcək.",
    en: "The truck is at the Georgia border. The route will be updated as border crossing progresses.",
    ru: "Фура на границе Грузии. Маршрут обновится по мере прохождения границы.",
    tr: "TIR Gürcistan sınırında. Sınır geçişi ilerledikçe güzergâh güncellenecek.",
  },
  TIR_BAKU_CUSTOMS: {
    az: "TIR Bakı gömrüyünə daxil olub. Avtomobilin boşaldılması və təhvilə hazır olması ayrıca təsdiqlənəcək.",
    en: "The truck has entered Baku customs. Unloading and readiness for collection will be confirmed separately.",
    ru: "Фура въехала на таможню Баку. Разгрузка и готовность к выдаче будут подтверждены отдельно.",
    tr: "TIR Bakü gümrüğüne girdi. İndirme ve teslim almaya hazır olma ayrıca doğrulanacak.",
  },
  CUSTOMS_CLEARANCE: {
    az: "Avtomobil üzrə gömrük rəsmiləşdirilməsi aparılır. Təhvil üçün hazır olduqda bildiriləcək.",
    en: "Customs clearance is in progress. Readiness for collection will be announced.",
    ru: "Идёт таможенное оформление автомобиля. О готовности к выдаче сообщат отдельно.",
    tr: "Aracın gümrük işlemleri sürüyor. Teslim almaya hazır olduğunda bildirilecek.",
  },
  READY_FOR_DELIVERY: {
    az: "Avtomobiliniz Bakı gömrüyündə boşaldılıb və təhvil götürməyiniz gözlənilir.",
    en: "Your vehicle has been unloaded at Baku customs and is awaiting collection.",
    ru: "Ваш автомобиль выгружен на таможне Баку и ожидает получения.",
    tr: "Aracınız Bakü gümrüğünde indirildi ve teslim almanızı bekliyor.",
  },
  DELIVERED: {
    az: "Avtomobiliniz təhvil verilib. Daşınma tamamlanıb; foto və mərhələlər burada saxlanılır.",
    en: "Your vehicle has been handed over. Shipping is complete; photos and stage history remain available here.",
    ru: "Ваш автомобиль передан вам. Перевозка завершена; фотографии и история этапов остаются здесь.",
    tr: "Aracınız teslim edildi. Taşıma tamamlandı; fotoğraflar ve aşama geçmişi burada saklanır.",
  },
  CANCELLED: {
    az: "Bu göndəriş ləğv edilib. Davamı və mümkün ödəniş məsələləri üçün menecerinizlə əlaqə saxlayın.",
    en: "This shipment has been cancelled. Contact your manager about next steps and any payment questions.",
    ru: "Эта перевозка отменена. Свяжитесь с менеджером по дальнейшим действиям и вопросам оплаты.",
    tr: "Bu gönderi iptal edildi. Sonraki adımlar ve ödeme soruları için yöneticinizle iletişime geçin.",
  },
};

const ACTIONS = {
  cancelled: { az: "Məlumatı dəqiqləşdirmək üçün menecerinizlə əlaqə saxlayın.", en: "Contact your manager to clarify the details.", ru: "Свяжитесь с менеджером для уточнения деталей.", tr: "Ayrıntıları netleştirmek için yöneticinizle görüşün." },
  collect: { az: "Təhvil vaxtını və lazım olan sənədləri menecerinizlə razılaşdırın.", en: "Arrange collection time and required documents with your manager.", ru: "Согласуйте с менеджером время получения и необходимые документы.", tr: "Teslim alma saatini ve gerekli evrakları yöneticinizle kararlaştırın." },
  review: { az: "Xidmətimizi aşağıdakı qiymətləndirmə bölməsində dəyərləndirə bilərsiniz.", en: "You can rate our service in the review section below.", ru: "Вы можете оценить наш сервис в разделе отзывов ниже.", tr: "Aşağıdaki değerlendirme bölümünde hizmetimizi puanlayabilirsiniz." },
  reviewed: { az: "Qiymətləndirməniz üçün təşəkkür edirik. Əlavə sualınız varsa, bizimlə əlaqə saxlayın.", en: "Thank you for your review. Contact us if you have any further questions.", ru: "Спасибо за оценку. Свяжитесь с нами, если у вас остались вопросы.", tr: "Değerlendirmeniz için teşekkürler. Başka sorunuz varsa bize ulaşın." },
  signify: { az: "Signify imzası gözlənilir. İmzanı tamamlamaq üçün menecerinizə müraciət edin; kömək edəcək.", en: "Your Signify signature is pending. Contact your manager for help completing it.", ru: "Ожидается ваша подпись Signify. Менеджер поможет её оформить.", tr: "Signify imzanız bekleniyor. Tamamlamak için yöneticinizden yardım isteyin." },
  powerOfAttorney: { az: "Etibarnamə hələ təqdim edilməyib. Tələbləri menecerinizlə dəqiqləşdirin.", en: "The power of attorney has not been provided. Confirm the requirements with your manager.", ru: "Доверенность ещё не предоставлена. Уточните требования у менеджера.", tr: "Vekâletname henüz sunulmadı. Gereklilikleri yöneticinizle netleştirin." },
  freightUnpaid: { az: "Yol pulu ödənilməyib. Məbləğ və ödəniş vaxtını menecerinizlə dəqiqləşdirin.", en: "Freight is unpaid. Confirm the amount and payment timing with your manager.", ru: "Перевозка не оплачена. Уточните сумму и срок оплаты у менеджера.", tr: "Yol ücreti ödenmedi. Tutarı ve ödeme zamanını yöneticinizle netleştirin." },
  freightPartial: { az: "Yol pulu qismən ödənilib. Qalıq məbləği və ödəniş vaxtını menecerinizlə dəqiqləşdirin.", en: "Freight is partly paid. Confirm the remaining amount and payment timing with your manager.", ru: "Перевозка оплачена частично. Уточните остаток и срок оплаты у менеджера.", tr: "Yol ücreti kısmen ödendi. Kalan tutarı ve ödeme zamanını yöneticinizle netleştirin." },
  unset: { az: "Sənədləşmə üsulunu meneceriniz dəqiqləşdirəcək. Hazırda əlavə sənəd tələbi təsdiqlənməyib.", en: "Your manager will confirm the paperwork method. No additional document request is confirmed yet.", ru: "Менеджер уточнит способ оформления. Запрос дополнительных документов пока не подтверждён.", tr: "Evrak yöntemini yöneticiniz netleştirecek. Henüz ek belge talebi doğrulanmadı." },
  none: { az: "Hazırda sizdən əlavə addım tələb olunmur. Yeniliklər bu səhifədə göstəriləcək.", en: "No further action is currently required from you. Updates will appear on this page.", ru: "Сейчас дополнительных действий от вас не требуется. Обновления появятся на этой странице.", tr: "Şu anda ek işlem yapmanız gerekmiyor. Güncellemeler bu sayfada görünecek." },
  unknown: { az: "Son məlumatı meneceriniz dəqiqləşdirəcək. Təsdiqlənmiş yenilik burada göstəriləcək.", en: "Your manager will confirm the latest information. Verified updates will appear here.", ru: "Менеджер уточнит актуальную информацию. Подтверждённое обновление появится здесь.", tr: "Son bilgiyi yöneticiniz netleştirecek. Doğrulanmış güncelleme burada gösterilecek." },
} satisfies Record<string, Copy>;

export type TrackingPhase = {
  key: PhaseKey;
  index: number;
  label: string;
  state: "complete" | "current" | "upcoming";
};

export type TrackingOverview = {
  phaseIndex: number;
  phaseKey: PhaseKey | null;
  phaseLabel: string;
  explanation: string;
  nextAction: string;
  actionNeeded: boolean;
  lastUpdatedAt?: string;
  phases: TrackingPhase[];
};

function supportedLocale(locale: Locale): Locale {
  return ["az", "en", "ru", "tr"].includes(locale) ? locale : "az";
}

function phaseIndexFor(status: string | undefined) {
  const phaseKey = status && Object.prototype.hasOwnProperty.call(STATUS_PHASE, status)
    ? STATUS_PHASE[status as keyof typeof STATUS_PHASE]
    : null;
  return TRACKING_PHASES.findIndex((phase) => phase.key === phaseKey);
}

export function getTrackingPhases(shipment: Partial<TrackingShipment> | null | undefined, locale: Locale = "az"): TrackingPhase[] {
  const lang = supportedLocale(locale);
  const current = phaseIndexFor(shipment?.currentStatus);
  return TRACKING_PHASES.map((phase, index) => ({
    key: phase.key,
    index,
    label: phase.label[lang],
    state: current < 0 || index > current ? "upcoming" : index === current ? "current" : "complete",
  }));
}

/** Uses recorded, non-future events, never the time the page was fetched. */
function latestRecordedUpdate(shipment: Partial<TrackingShipment>, now: number): string | undefined {
  const dates = (shipment.events ?? []).map((event) => event.occurredAt);
  const phase = phaseIndexFor(shipment.currentStatus);
  const selectedTransit = shipment.currentTransitIndex ?? -1;
  const validTransit = Number.isInteger(selectedTransit) && selectedTransit >= 0 && selectedTransit < (shipment.transitPorts?.length ?? 0);
  const transitLimit = shipment.currentStatus === "IN_TRANSIT"
    ? validTransit ? selectedTransit : -1
    : phase > 3 ? (shipment.transitPorts?.length ?? 0) - 1 : -1;
  (shipment.transitPorts ?? []).forEach((stop, index) => {
    if (index <= transitLimit && stop.occurredAt) dates.push(stop.occurredAt);
  });
  let latest: number | undefined;
  for (const date of dates) {
    const timestamp = Date.parse(date);
    if (Number.isFinite(timestamp) && timestamp <= now && (latest === undefined || timestamp > latest)) latest = timestamp;
  }
  return latest === undefined ? undefined : new Date(latest).toISOString();
}

/** A plain-language summary of the recorded stage, not a distance or arrival prediction. */
export function getTrackingOverview(
  shipment: Partial<TrackingShipment> | null | undefined,
  locale: Locale = "az",
  now = Date.now(),
): TrackingOverview {
  const row = shipment ?? {};
  const lang = supportedLocale(locale);
  const status = row.currentStatus;
  const phaseIndex = phaseIndexFor(status);
  const phase = TRACKING_PHASES[phaseIndex];
  const knownStatus = typeof status === "string" && Object.prototype.hasOwnProperty.call(EXPLANATIONS, status);
  let explanation = knownStatus ? EXPLANATIONS[status!][lang] : ACTIONS.unknown[lang];
  const stopIndex = row.currentTransitIndex;
  const stop = status === "IN_TRANSIT" && Number.isInteger(stopIndex) && (stopIndex ?? -1) >= 0
    ? row.transitPorts?.[stopIndex!]?.place?.trim()
    : undefined;
  if (stop) {
    const transitCopy: Copy = {
      az: `Son qeyd olunan tranzit dayanacağı: ${stop}. Bu, canlı GPS mövqeyi deyil.`,
      en: `Last recorded transit stop: ${stop}. This is not a live GPS position.`,
      ru: `Последняя отмеченная транзитная остановка: ${stop}. Это не GPS-позиция в реальном времени.`,
      tr: `Son kaydedilen transit durağı: ${stop}. Bu, canlı GPS konumu değildir.`,
    };
    explanation = transitCopy[lang];
  }
  let action: keyof typeof ACTIONS = "none";
  let actionNeeded = false;
  // USA shipments use Signify, including legacy records with a conflicting POA method.
  const documentMethod = row.originCountry === "USA" ? "SIGNIFY" : row.documentMethod;
  const documentComplete = row.documentStatus === "COMPLETED" && (row.originCountry !== "USA" || row.documentMethod === "SIGNIFY");
  if (!knownStatus) action = "unknown";
  else if (status === "CANCELLED") { action = "cancelled"; actionNeeded = true; }
  else if (status === "DELIVERED") { action = row.review ? "reviewed" : "review"; actionNeeded = !row.review; }
  else if (status === "READY_FOR_DELIVERY") { action = "collect"; actionNeeded = true; }
  else if (!documentComplete && documentMethod === "SIGNIFY") { action = "signify"; actionNeeded = true; }
  else if (!documentComplete && documentMethod === "POWER_OF_ATTORNEY") { action = "powerOfAttorney"; actionNeeded = true; }
  else if (row.freightPaymentStatus === "UNPAID") { action = "freightUnpaid"; actionNeeded = true; }
  else if (row.freightPaymentStatus === "PARTIAL") { action = "freightPartial"; actionNeeded = true; }
  else if (!documentMethod || documentMethod === "UNSET") action = "unset";
  const fallbackLabel: Copy = status === "CANCELLED"
    ? { az: "Ləğv edilib", en: "Cancelled", ru: "Отменено", tr: "İptal edildi" }
    : { az: "Məlumat gözlənilir", en: "Awaiting information", ru: "Ожидается информация", tr: "Bilgi bekleniyor" };
  return {
    phaseIndex,
    phaseKey: phase?.key ?? null,
    phaseLabel: phase?.label[lang] ?? fallbackLabel[lang],
    explanation,
    nextAction: ACTIONS[action][lang],
    actionNeeded,
    lastUpdatedAt: latestRecordedUpdate(row, now),
    phases: getTrackingPhases(row, lang),
  };
}
