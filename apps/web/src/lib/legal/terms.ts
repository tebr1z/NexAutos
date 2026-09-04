import type { Locale } from "@/lib/constants";
import type { LegalDoc } from "./types";

export type { LegalDoc, LegalSection } from "./types";
export type TermsDoc = LegalDoc;
export type TermsSection = import("./types").LegalSection;

export const TERMS: Record<Locale, LegalDoc> = {
  az: {
    kicker: "Hüquqi sənəd",
    title: "İstifadə şərtləri",
    updated: "Son yeniləmə: 4 sentyabr 2026",
    toc: "Mündəricat",
    intro:
      "Bu sənəd Auto Nex ilə müştəri arasındakı münasibəti, veb-saytın istifadəsini, hərrac alışını, dəniz daşınmasını, gömrüyü, izləməni və çatdırılmanı tənzimləyir. Saytdan, izləmə kodundan, WhatsApp və ya e-poçt vasitəsilə xidmətə müraciət etməklə bu şərtləri qəbul etmiş sayılırsınız.",
    sections: [
      {
        id: "terefler",
        title: "1. Tərəflər və əhatə",
        paragraphs: [
          "Auto Nex Bakı şəhəri, Bakıxanov qəsəbəsində fəaliyyət göstərən avtomobil idxal evdir. Əlaqə: auto@nex.autos; WhatsApp və telefon: 070 966 81 11 (əsas xətt), 070 964 64 66, 099 730 03 13.",
          "Bu şərtlər nex.autos (və əlaqəli domenlər), izləmə səhifəsi, məsləhət forması və Auto Nex əməkdaşları ilə yazılı və ya WhatsApp yazışmalarına şamil olunur.",
          "Xidmət fiziki və hüquqi şəxslərə, müştərinin tapşırığı ilə ABŞ, Koreya və Çin ixrac kanallarından avtomobil seçimi, hərrac alışı, dəniz daşınması, gömrük müşayiəti və Azərbaycana çatdırılması üzrə göstərilir.",
        ],
      },
      {
        id: "status",
        title: "2. Auto Nex-in statusu",
        paragraphs: [
          "Auto Nex idxal agenti və təşkilatçıdır. Biz hərrac platforması (Copart, IAAI, Manheim və s.), gəmi xətti, liman operatoru və ya Azərbaycan gömrük orqanı deyilik.",
          "Hərracda alış müştərinin yazılı və ya WhatsApp tapşırığı əsasında icra olunur. Gəmi, konteyner və liman əməliyyatları müvafiq daşıyıcıların və limanların qaydalarına tabedir.",
          "Üçüncü tərəflərin (hərrac, yard, xətt, ekspedisiya, gömrük brokeri) hərəkət və ya hərəkətsizliyinə görə Auto Nex yalnız öz agenti funksiyası çərçivəsində məsuliyyət daşıyır.",
        ],
      },
      {
        id: "sayt",
        title: "3. Veb-sayt və məsləhət",
        paragraphs: [
          "Saytdakı kataloq, qiymət intervalı, şəkillər və təsvirlər məlumat xarakterlidir və öhdəlik təşkil etməyə bilər. Lot hərracda dəyişə, satıla və ya geri çəkilə bilər.",
          "Məsləhət sorğusu öhdəlik yaratmır. Alış yalnız hesablaşma şərtləri, lot və büdcə razılaşdırıldıqdan, faktura üzrə ödəniş qaydası təsdiqləndikdən sonra başlanır.",
          "Saytda texniki fasilə, xəta və ya üçüncü tərəf xidmətinin dayanması mümkündür. Bu, daşınma müqaviləsini avtomatik pozmur.",
        ],
      },
      {
        id: "herrec",
        title: "4. Hərrac və müştəri tapşırığı",
        paragraphs: [
          "Alış Copart, IAAI, Manheim və lisenziyalı tərəfdaşlar, habelə seçilmiş Koreya və Çin ixrac kanalları üzrə aparıla bilər.",
          "Müştəri lotu, maksimum qiyməti və əlavə şərtləri təsdiq edir. Auto Nex bu tapşırıq hüdudunda təklif verir və hesablaşmanı təşkil edir.",
          "Hərrac qaydaları, o cümlədən «olduğu kimi» (as-is) satışı, titulu, zədə qeydləri və ödəniş müddətləri həmin platformanın şərtlərinə tabedir. Müştəri lotun auksion təsvirini qəbul etmiş sayılır.",
        ],
      },
      {
        id: "veziyyet",
        title: "5. Avtomobilin vəziyyəti",
        paragraphs: [
          "Hərrac avtomobilləri əksər hallarda zədələnmiş, sökülmüş və ya məhdud yoxlama ilə satılır. Auto Nex alışdan əvvəl hərrac fotoları, VIN və mümkün yoxlama hesabatlarını nəzərdən keçirir; bu, gizli qüsurların olmadığına zəmanət deyil.",
          "Mühərrik, sürətlər qutusu, elektronika, ramka və lak-boya üzrə gizli zədələr hərracda görünməyə bilər. Müştəri bu riski qəbul edir.",
          "Əlavə ekspertiz, skan və ya mexaniki yoxlama ayrıca razılaşdırılır və əlavə ödənişə tabedir.",
        ],
      },
      {
        id: "odenis",
        title: "6. Qiymət, faktura və ödəniş",
        paragraphs: [
          "Müştəri rəsmi faktura alır. Məbləğ adətən hərrac, daşınma, sənədləşmə, gömrük müşayiəti və çatdırılma üzrə bölünür. Dəqiq struktur hər sifarişdə yazılı şəkildə verilir.",
          "Hərrac və ixrac ödənişləri xarici valyutada, müvafiq hesablaşma qrafikinə görə tələb oluna bilər. Gecikmiş ödəniş lotun itirilməsi, cərimə və ya əlavə saxlama haqqı ilə nəticələnə bilər; bunlar hərracın və/və ya anbarın qaydalarından irəli gəlir.",
          "Gömrük rüsumu, ƏDV və digər dövlət ödənişləri Azərbaycan qanunvericiliyinə və rəsmiləşdirmə anındakı tariflərə görə hesablanır. Onlar ilkin smetadan fərqlənə bilər və müştərinin öhdəliyidir, əgər yazılı şəkildə başqa cür razılaşdırılmayıbsa.",
        ],
      },
      {
        id: "deniz",
        title: "7. Dəniz daşınması və müddət",
        paragraphs: [
          "Avtomobil konteyner və ya razılaşdırılmış digər dəniz sxemi ilə daşınır. ABŞ, Koreya və Çin xətlərinin hamısı gəmi reysinə tabedir.",
          "Çatdırılma müddəti gəminin cədvəli, yükləmə pəncərəsi və təyinat dəhlizi ilə müəyyən olunur. Səfər həm qısa, həm də uzana bilər. Bildirilən gün sayı və ETA istiqamətləndiricidir, təqvim üzrə zəmanətli təhvil günü deyil.",
          "Konteyner, gəmi adı, IMO və liman məlumatı mövcud olduqca izləmədə əks etdirilir. Xəttin və ya limanın gecikməsi Auto Nex-in təkbaşına nəzarətində deyil.",
        ],
      },
      {
        id: "forsmajor",
        title: "8. Fors-major və qrafik dəyişikliyi",
        paragraphs: [
          "Aşağıdakılar fors-major və ya Auto Nex-in ağlabatan nəzarətindən kənar hallar sayılır və müddətin uzanması və ya qısalması ilə nəticələnə bilər: liman sıxlığı və tıxac; əlverişsiz hava və dəniz şəraiti; gəmi rotasiyası, ləğv və ya əvəzlənməsi; tətil, blokada, hərbi və siyasi məhdudiyyət; epidemiya; dövlət qərarları; gömrük yoxlamasının uzanması; daşıyıcının və ya limanın əməliyyat qərarı.",
          "Belə hallarda Auto Nex mümkün qədər tez məlumat verir və izləmə mərhələsini yeniləyir. Bu, cərimə, kompensasiya və ya müqavilənin avtomatik ləğvi üçün əsas yaratmır, qanunla birbaşa tələb olunmadıqca.",
        ],
      },
      {
        id: "izleme",
        title: "9. İzləmə kodu",
        paragraphs: [
          "Hər göndərişə unikal izləmə kodu verilir (məsələn, müştəri və avtomobil baş hərfi + rəqəmlər). Hesab açmaq tələb olunmur.",
          "Koddakı mərhələlər, tarixlər, tranzitlər, foto və qeydlər məlumat məqsədlidir. Onlar gəmi AIS siqnalı və ya liman statusu ilə eyni anda sinxron olmaya bilər.",
          "Kodu üçüncü şəxslə paylaşmaq müştərinin məsuliyyətidir. Kodun itirilməsi barədə Auto Nex-ə yazılı məlumat verilməlidir.",
        ],
      },
      {
        id: "gomruk",
        title: "10. Gömrük rəsmiləşdirməsi",
        paragraphs: [
          "Azərbaycan gömrüyündə rəsmiləşdirmə qüvvədə olan qanun, tarif və prosedurla aparılır. Sənəd toplusu (invoys, konosament, title və s.) daşıyıcı və ixrac ölkəsinin tələbindən asılıdır.",
          "Əlavə yoxlama, laboratoriya, qiymətləndirmə və ya saxlama gömrük orqanının qərarıdır. Bu, çatdırılmanı uzada bilər.",
          "Yanlış və ya natamam sənəd, müştərinin təqdim etmədiyi məlumat və ya qadağan olunmuş avadanlıq nəticəsində yaranan gecikmə və xərc müştəriyə aid edilə bilər.",
        ],
      },
      {
        id: "teslim",
        title: "11. Təhvil və sənədlər",
        paragraphs: [
          "Təhvil razılaşdırılmış ünvanda və ya anbarda, sənədlər təqdim olunmaqla həyata keçirilir. Müştəri və ya vəkalətli şəxs avtomobili qəbul etdikdə görünən zədələri dərhal qeyd etməlidir.",
          "Təhvil verilmiş göndəriş arxivdə saxlanılır və razılaşdırılmış müddətdən sonra silinə bilər. Bu, mühasibat sənədlərinə şamil olunmur.",
        ],
      },
      {
        id: "mesuliyyet",
        title: "12. Məsuliyyətin həddi",
        paragraphs: [
          "Auto Nex xidməti vicdanla və peşəkar qayğı ilə yerinə yetirir. Dolayı zərər, itirilmiş mənfəət, gözləmə xərci və bazar qiymətinin dəyişməsi üzrə məsuliyyət, qanunun məcburi normasından başqa, məhdudlaşdırılır.",
          "Maksimum məsuliyyət, icazə verilən həddə, müvafiq sifariş üzrə Auto Nex-ə ödənilmiş xidmət haqqı ilə məhdudlaşır; hərraca, daşıyıcıya və dövlətə ödənilən məbləğlər bu həddə daxil deyil, əgər zərər birbaşa Auto Nex-in qəsdən və ya kobud ehtiyatsızlığından yaranmayıbsa.",
          "Sığorta ayrıca razılaşdırılmadıqca daxil deyil. Müştəri əlavə yük sığortası tələb edə bilər.",
        ],
      },
      {
        id: "melumat",
        title: "13. Məlumat və məxfilik",
        paragraphs: [
          "Ad, əlaqə, VIN, göndəriş hadisələri və sənədlər yalnız idxal, izləmə və çatdırılma üçün işlənir. Ətraflı qayda Məxfilik səhifəsindədir.",
          "İzləmə kodu hesab olmadan işləyir. Admin panel yalnız Auto Nex əməkdaşları üçündür.",
        ],
      },
      {
        id: "huquq",
        title: "14. Əqli mülkiyyət",
        paragraphs: [
          "Saytın dizaynı, mətni, loqosu və proqram hissəsi Auto Nex-ə və ya lisenziya verənlərə məxsusdur. İcazəsiz kopyalama qadağandır.",
          "Hərrac və tərəfdaş loqoları müvafiq hüquq sahiblərinindir və yalnız məlumat məqsədilə göstərilir.",
        ],
      },
      {
        id: "qanun",
        title: "15. Tətbiq olunan hüquq",
        paragraphs: [
          "Bu şərtlər Azərbaycan Respublikasının qanunvericiliyinə tabedir. Mübahisələr ilk növbədə danışıq yolu ilə, sonra Bakı üzrə səlahiyyətli məhkəmələrdə həll olunur, imperativ norma başqa cür tələb etmədikcə.",
        ],
      },
      {
        id: "deyisiklik",
        title: "16. Dəyişikliklər",
        paragraphs: [
          "Auto Nex bu sənədi yeniləyə bilər. Yeni redaksiya saytda dərc olunduğu gündən qüvvədədir. Aktiv göndərişlərə, əksinə yazılı razılaşma yoxdursa, sifariş zamanı qüvvədə olan şərtlər tətbiq edilir.",
        ],
      },
      {
        id: "elaqe",
        title: "17. Bildiriş və əlaqə",
        paragraphs: [
          "Rəsmi yazışma: auto@nex.autos. Operativ əlaqə: WhatsApp 070 966 81 11. Ünvan: Bakı şəhəri, Bakıxanov qəsəbəsi.",
          "Mərhələ dəyişikliyi barədə SMS və ya WhatsApp yalnız müştəri nömrə verdikdə göndərilə bilər. Xidmətin texniki nasazlığı bildirişin çatmamasına səbəb ola bilər; izləmə səhifəsi əsas məlumat mənbəyidir.",
        ],
      },
    ],
  },
  en: {
    kicker: "Legal",
    title: "Terms of service",
    updated: "Last updated: 4 September 2026",
    toc: "Contents",
    intro:
      "These terms govern the relationship between Auto Nex and the client, and the use of the website, tracking, consultation, auction purchase, ocean freight, customs and delivery. By using the site, a tracking code, WhatsApp or email, you accept them.",
    sections: [
      {
        id: "parties",
        title: "1. Parties and scope",
        paragraphs: [
          "Auto Nex is a vehicle import house in Bakıxanov, Baku. Contact: auto@nex.autos; WhatsApp and telephone: 070 966 81 11 (primary), 070 964 64 66, 099 730 03 13.",
          "These terms apply to nex.autos (and related domains), the tracking pages, the consultation form and written or WhatsApp correspondence with Auto Nex staff.",
          "Services are provided to individuals and companies: vehicle selection, auction purchase under instruction, ocean freight, customs support and delivery to Azerbaijan from USA, Korea and China export lanes.",
        ],
      },
      {
        id: "status",
        title: "2. Status of Auto Nex",
        paragraphs: [
          "Auto Nex acts as import agent and organiser. We are not the auction (Copart, IAAI, Manheim or otherwise), the ocean carrier, the terminal or Azerbaijani Customs.",
          "Auction purchases are executed on the client’s written or WhatsApp instruction. Vessel, container and terminal operations follow the rules of the relevant carrier and port.",
          "Auto Nex is responsible only within its agency role for the acts or omissions of third parties (auction, yard, line, forwarder, broker).",
        ],
      },
      {
        id: "site",
        title: "3. Website and consultation",
        paragraphs: [
          "Inventory, price bands, images and copy on the site are informational and may not constitute an offer. Lots can change, sell or be withdrawn at auction.",
          "A consultation request creates no obligation. A purchase starts only after lot, budget and settlement are agreed and invoice terms are confirmed.",
          "Technical interruption, error or third-party downtime may occur and does not by itself terminate a shipment engagement.",
        ],
      },
      {
        id: "auction",
        title: "4. Auctions and client instruction",
        paragraphs: [
          "Purchases may be made through Copart, IAAI, Manheim and licensed partners, and selected Korea and China export channels.",
          "The client confirms the lot, a maximum bid and any extra conditions. Auto Nex bids and settles within that mandate.",
          "Auction rules, including as-is sale, title, damage notes and payment deadlines, are those of the platform. The client is deemed to have accepted the lot description.",
        ],
      },
      {
        id: "condition",
        title: "5. Vehicle condition",
        paragraphs: [
          "Auction cars are often damaged, incomplete or sold with limited inspection. Auto Nex reviews auction photos, VIN data and available reports before a bid; this is not a warranty against latent defects.",
          "Hidden issues in the powertrain, electronics, structure or paint may not appear in auction media. The client accepts that risk.",
          "Additional inspection, scanning or mechanical checks are agreed separately and billed extra.",
        ],
      },
      {
        id: "payment",
        title: "6. Price, invoice and payment",
        paragraphs: [
          "The client receives a formal invoice. Amounts are typically allocated across auction, freight, documentation, customs support and delivery. The exact split is confirmed in writing per order.",
          "Auction and export charges may fall due in foreign currency on the platform’s timetable. Late payment can cause loss of the lot, penalties or storage — arising from auction or yard rules.",
          "Customs duty, VAT and other state charges are calculated under Azerbaijani law at the time of clearance. They may differ from an early estimate and are the client’s cost unless agreed otherwise in writing.",
        ],
      },
      {
        id: "ocean",
        title: "7. Ocean freight and timing",
        paragraphs: [
          "The vehicle moves in a container or another agreed sea arrangement. USA, Korea and China lanes are all subject to the sailing.",
          "Transit time is set by the vessel schedule, loading window and destination corridor. The voyage may run shorter or longer. Stated day counts and ETAs are indicative, not a guaranteed calendar handover.",
          "Container, vessel name, IMO and port data appear on tracking when available. Line or terminal delay is not solely within Auto Nex’s control.",
        ],
      },
      {
        id: "force",
        title: "8. Force majeure and schedule change",
        paragraphs: [
          "The following are force majeure or events reasonably beyond Auto Nex’s control and may lengthen or shorten the timeline: port congestion; weather and sea state; vessel rotation, cancellation or substitution; strike, blockade, armed or political restriction; epidemic; government act; extended customs examination; operational decisions of the carrier or terminal.",
          "Auto Nex will notify as soon as practicable and update tracking. Such events do not, of themselves, give rise to penalty, damages or automatic termination except where mandatory law requires otherwise.",
        ],
      },
      {
        id: "track",
        title: "9. Tracking code",
        paragraphs: [
          "Each shipment receives a unique tracking code (for example client and vehicle initials plus digits). No account is required.",
          "Stages, dates, transits, photos and notes are informational. They may not match live AIS or terminal status at every moment.",
          "Sharing the code with third parties is the client’s responsibility. Loss of the code should be notified to Auto Nex in writing.",
        ],
      },
      {
        id: "customs",
        title: "10. Customs clearance",
        paragraphs: [
          "Clearance in Azerbaijan follows the law, tariffs and procedure in force. The document set (invoice, bill of lading, title and others) depends on the carrier and the export country.",
          "Further inspection, laboratory, valuation or storage is a matter for the customs authority and may extend delivery.",
          "Delay or cost arising from incomplete documents, information the client failed to provide, or prohibited equipment may be allocated to the client.",
        ],
      },
      {
        id: "delivery",
        title: "11. Handover and documents",
        paragraphs: [
          "Handover takes place at the agreed address or yard, against documents. Visible damage should be noted immediately by the client or an authorised person.",
          "Delivered shipments may be archived and later removed after an agreed retention period. This does not affect accounting records.",
        ],
      },
      {
        id: "liability",
        title: "12. Limitation of liability",
        paragraphs: [
          "Auto Nex performs the service with professional care. Liability for indirect loss, lost profit, waiting cost and market movement is limited except where mandatory law provides otherwise.",
          "Where permitted, aggregate liability is capped at the service fee paid to Auto Nex on the relevant order; sums paid to the auction, carrier or the state are excluded unless the loss results from Auto Nex’s wilful misconduct or gross negligence.",
          "Insurance is not included unless agreed. The client may request additional cargo cover.",
        ],
      },
      {
        id: "data",
        title: "13. Data and privacy",
        paragraphs: [
          "Name, contact, VIN, shipment events and documents are processed only to import, track and deliver. See the Privacy page.",
          "Tracking codes work without an account. The admin panel is for Auto Nex staff only.",
        ],
      },
      {
        id: "ip",
        title: "14. Intellectual property",
        paragraphs: [
          "Site design, copy, mark and software belong to Auto Nex or its licensors. Unauthorised copying is prohibited.",
          "Auction and partner marks belong to their owners and are shown for identification only.",
        ],
      },
      {
        id: "law",
        title: "15. Governing law",
        paragraphs: [
          "These terms are governed by the laws of the Republic of Azerbaijan. Disputes are first negotiated, then submitted to the competent courts in Baku unless mandatory law requires otherwise.",
        ],
      },
      {
        id: "changes",
        title: "16. Changes",
        paragraphs: [
          "Auto Nex may update this document. The new version applies from publication on the site. Active shipments remain under the terms in force at order unless otherwise agreed in writing.",
        ],
      },
      {
        id: "contact",
        title: "17. Notices and contact",
        paragraphs: [
          "Formal correspondence: auto@nex.autos. Operational contact: WhatsApp 070 966 81 11. Address: Bakıxanov, Baku.",
          "Stage SMS or WhatsApp is sent only if the client has provided a number. Technical failure may prevent delivery of a notice; the tracking page is the primary record.",
        ],
      },
    ],
  },
  ru: {
    kicker: "Правовой документ",
    title: "Условия использования",
    updated: "Обновлено: 4 сентября 2026",
    toc: "Содержание",
    intro:
      "Настоящий документ регулирует отношения Auto Nex и клиента, пользование сайтом, трекингом, консультацией, покупкой на аукционе, морской перевозкой, таможней и доставкой. Пользуясь сайтом, трек-кодом, WhatsApp или электронной почтой, вы принимаете эти условия.",
    sections: [
      {
        id: "parties",
        title: "1. Стороны и сфера",
        paragraphs: [
          "Auto Nex — импортный дом в посёлке Бакиханов, Баку. Связь: auto@nex.autos; WhatsApp и телефон: 070 966 81 11 (основная линия), 070 964 64 66, 099 730 03 13.",
          "Условия распространяются на nex.autos (и связанные домены), страницы трекинга, форму консультации и переписку с сотрудниками, в том числе в WhatsApp.",
          "Услуги оказываются физическим и юридическим лицам: подбор, покупка на аукционе по поручению, море, таможенное сопровождение и доставка в Азербайджан с линий США, Кореи и Китая.",
        ],
      },
      {
        id: "status",
        title: "2. Статус Auto Nex",
        paragraphs: [
          "Auto Nex действует как импортный агент и организатор. Мы не являемся аукционом (Copart, IAAI, Manheim и др.), морской линией, терминалом или таможенным органом Азербайджана.",
          "Покупка на аукционе исполняется по письменному или WhatsApp-поручению клиента. Судно, контейнер и порт работают по правилам перевозчика и терминала.",
          "За действия третьих лиц (аукцион, площадка, линия, экспедитор, брокер) Auto Nex отвечает лишь в пределах своей агентской функции.",
        ],
      },
      {
        id: "site",
        title: "3. Сайт и консультация",
        paragraphs: [
          "Каталог, ценовые ориентиры, фото и описания носят информационный характер и могут не быть офертой. Лот на аукционе может измениться, быть продан или снят.",
          "Запрос консультации не создаёт обязательства. Покупка начинается после согласования лота, бюджета и порядка расчёта по счёту.",
          "Технический сбой или простой стороннего сервиса сам по себе не прекращает сопровождение отгрузки.",
        ],
      },
      {
        id: "auction",
        title: "4. Аукцион и поручение",
        paragraphs: [
          "Покупки возможны через Copart, IAAI, Manheim и лицензированных партнёров, а также выбранные экспортные каналы Кореи и Китая.",
          "Клиент подтверждает лот, максимальную ставку и особые условия. Auto Nex торгует и рассчитывается в этих пределах.",
          "Правила аукциона, включая продажу as-is, правоустанавливающие документы, повреждения и сроки оплаты, определяются площадкой. Клиент считается принявшим описание лота.",
        ],
      },
      {
        id: "condition",
        title: "5. Состояние автомобиля",
        paragraphs: [
          "Аукционные автомобили часто повреждены, некомплектны или продаются с ограниченным осмотром. Auto Nex до ставки сверяет фото, VIN и доступные отчёты; это не гарантия отсутствия скрытых дефектов.",
          "Скрытые неисправности агрегатов, электрики, кузова и ЛКП могут не быть видны на аукционе. Клиент принимает этот риск.",
          "Дополнительная экспертиза, сканирование и механика согласовываются отдельно и оплачиваются дополнительно.",
        ],
      },
      {
        id: "payment",
        title: "6. Цена, счёт и оплата",
        paragraphs: [
          "Клиент получает официальный счёт. Сумма обычно распределяется на аукцион, фрахт, документы, таможенное сопровождение и выдачу. Точная структура фиксируется письменно по заказу.",
          "Платежи аукциона и экспорта могут требоваться в иностранной валюте по графику площадки. Просрочка может привести к потере лота, штрафу или хранению — по правилам аукциона или стоянки.",
          "Пошлина, НДС и иные платежи государству считаются по праву Азербайджана на момент оформления. Они могут отличаться от сметы и относятся на клиента, если иное не согласовано письменно.",
        ],
      },
      {
        id: "ocean",
        title: "7. Морская перевозка и сроки",
        paragraphs: [
          "Автомобиль перевозится в контейнере или по иной согласованной морской схеме. Линии США, Кореи и Китая подчиняются рейсу судна.",
          "Срок определяется расписанием судна, окном погрузки и коридором назначения. Переход может быть короче или длиннее. Указанные дни и ETA — ориентир, а не гарантированный календарный день выдачи.",
          "Контейнер, имя судна, IMO и порт отражаются в трекинге при наличии данных. Задержка линии или порта не находится исключительно под контролем Auto Nex.",
        ],
      },
      {
        id: "force",
        title: "8. Форс-мажор и изменение графика",
        paragraphs: [
          "Форс-мажором или обстоятельствами вне разумного контроля Auto Nex признаются в том числе: заторы в порту; погода и состояние моря; ротация, отмена или замена судна; забастовка, блокада, военные и политические ограничения; эпидемия; акты власти; продлённый таможенный досмотр; операционные решения перевозчика или терминала. Они могут удлинить или сократить срок.",
          "Auto Nex уведомляет при первой возможности и обновляет трекинг. Сами по себе такие события не влекут неустойку, убытки или автоматическое расторжение, кроме случаев, прямо предусмотренных императивной нормой.",
        ],
      },
      {
        id: "track",
        title: "9. Трек-код",
        paragraphs: [
          "Каждой отгрузке присваивается уникальный код (например, инициалы клиента и автомобиля плюс цифры). Аккаунт не требуется.",
          "Этапы, даты, транзиты, фото и заметки носят информационный характер и могут не совпадать с живым AIS или статусом терминала в каждый момент.",
          "Передача кода третьим лицам — ответственность клиента. Об утрате кода следует письменно сообщить Auto Nex.",
        ],
      },
      {
        id: "customs",
        title: "10. Таможенное оформление",
        paragraphs: [
          "Оформление в Азербайджане ведётся по действующему закону, тарифам и процедуре. Комплект документов (инвойс, коносамент, title и др.) зависит от перевозчика и страны экспорта.",
          "Досмотр, лаборатория, оценка или хранение — решения таможенного органа и могут продлить доставку.",
          "Просрочка и расходы из-за неполного комплекта, сведений, которые клиент не предоставил, или запрещённого оборудования могут быть отнесены на клиента.",
        ],
      },
      {
        id: "delivery",
        title: "11. Выдача и документы",
        paragraphs: [
          "Выдача производится по согласованному адресу или на складе против документов. Видимые повреждения фиксирует клиент или уполномоченное лицо немедленно.",
          "Выданные отгрузки могут архивироваться и удаляться по истечении согласованного срока. Это не затрагивает бухгалтерские документы.",
        ],
      },
      {
        id: "liability",
        title: "12. Ограничение ответственности",
        paragraphs: [
          "Auto Nex оказывает услугу с профессиональной заботливостью. Ответственность за косвенный ущерб, упущенную выгоду, простой и изменение рыночной цены ограничивается, кроме императивных норм закона.",
          "Там, где это допустимо, совокупная ответственность ограничена агентским вознаграждением Auto Nex по соответствующему заказу; суммы, уплаченные аукциону, перевозчику и государству, не входят в этот предел, если убыток не причинён умыслом или грубой неосторожностью Auto Nex.",
          "Страхование не включено, пока не согласовано отдельно. Клиент вправе запросить дополнительное страхование груза.",
        ],
      },
      {
        id: "data",
        title: "13. Данные и конфиденциальность",
        paragraphs: [
          "Имя, контакты, VIN, события отгрузки и документы обрабатываются только для импорта, трекинга и выдачи. Подробности — на странице конфиденциальности.",
          "Трек-код работает без аккаунта. Админ-панель предназначена только сотрудникам Auto Nex.",
        ],
      },
      {
        id: "ip",
        title: "14. Интеллектуальная собственность",
        paragraphs: [
          "Дизайн, тексты, знак и программная часть сайта принадлежат Auto Nex или лицензиарам. Копирование без разрешения запрещено.",
          "Знаки аукционов и партнёров принадлежат правообладателям и приведены для идентификации.",
        ],
      },
      {
        id: "law",
        title: "15. Применимое право",
        paragraphs: [
          "Условия регулируются правом Азербайджанской Республики. Споры сначала урегулируются переговорами, затем — в компетентных судах Баку, если императивная норма не требует иного.",
        ],
      },
      {
        id: "changes",
        title: "16. Изменения",
        paragraphs: [
          "Auto Nex может обновить документ. Новая редакция действует с публикации на сайте. К активным отгрузкам применяются условия на дату заказа, если иное не согласовано письменно.",
        ],
      },
      {
        id: "contact",
        title: "17. Уведомления и связь",
        paragraphs: [
          "Официальная переписка: auto@nex.autos. Оперативная связь: WhatsApp 070 966 81 11. Адрес: Бакиханов, Баку.",
          "SMS или WhatsApp об этапе отправляется только при наличии номера клиента. Технический сбой может помешать доставке уведомления; основная запись — страница трекинга.",
        ],
      },
    ],
  },
  tr: {
    kicker: "Hukuki belge",
    title: "Kullanım şartları",
    updated: "Son güncelleme: 4 Eylül 2026",
    toc: "İçindekiler",
    intro:
      "Bu belge Auto Nex ile müşteri ilişkisini; sitenin, takibin, danışmanın, açık artırma alımının, deniz taşımasının, gümrüğün ve teslimin kullanımını düzenler. Siteyi, takip kodunu, WhatsApp’ı veya e-postayı kullanmakla bu şartları kabul etmiş sayılırsınız.",
    sections: [
      {
        id: "parties",
        title: "1. Taraflar ve kapsam",
        paragraphs: [
          "Auto Nex, Bakü Bakıxanov’ta faaliyet gösteren bir araç ithalat evidir. İletişim: auto@nex.autos; WhatsApp ve telefon: 070 966 81 11 (ana hat), 070 964 64 66, 099 730 03 13.",
          "Şartlar nex.autos (ve bağlı alan adları), takip sayfaları, danışma formu ve Auto Nex ekibiyle yazılı veya WhatsApp yazışmalarına uygulanır.",
          "Hizmet, gerçek ve tüzel kişilere; ABD, Kore ve Çin ihracat hatlarından seçim, talimatla açık artırma alımı, deniz taşıması, gümrük eşliği ve Azerbaycan’a teslim olarak sunulur.",
        ],
      },
      {
        id: "status",
        title: "2. Auto Nex’in sıfatı",
        paragraphs: [
          "Auto Nex ithalat temsilcisi ve organizatördür. Açık artırma (Copart, IAAI, Manheim vb.), gemi hattı, liman işletmesi veya Azerbaycan gümrüğü değiliz.",
          "Açık artırma alımı müşterinin yazılı veya WhatsApp talimatıyla yapılır. Gemi, konteyner ve liman işlemleri ilgili taşıyıcı ve terminal kurallarına tabidir.",
          "Üçüncü kişilerin (açık artırma, saha, hat, forwarder, broker) fiil veya ihmallerinden Auto Nex yalnızca temsilcilik rolü ölçüsünde sorumludur.",
        ],
      },
      {
        id: "site",
        title: "3. Site ve danışma",
        paragraphs: [
          "Katalog, fiyat aralığı, görseller ve metinler bilgilendirme amaçlıdır; teklif teşkil etmeyebilir. Lot açık artırmada değişebilir, satılabilir veya çekilebilir.",
          "Danışma talebi yükümlülük doğurmaz. Alım; lot, bütçe ve fatura koşulları yazılı olarak netleştikten sonra başlar.",
          "Teknik kesinti veya üçüncü taraf hizmet durması tek başına sevkiyat ilişkisini sona erdirmez.",
        ],
      },
      {
        id: "auction",
        title: "4. Açık artırma ve talimat",
        paragraphs: [
          "Alımlar Copart, IAAI, Manheim ve lisanslı ortaklar ile seçili Kore ve Çin ihracat kanalları üzerinden yapılabilir.",
          "Müşteri lotu, tavan teklifi ve özel şartları onaylar. Auto Nex bu yetki içinde teklif verir ve ödemeyi kapatır.",
          "As-is satış, tapu, hasar kaydı ve ödeme süreleri dahil açık artırma kuralları platforma aittir. Müşteri lot açıklamasını kabul etmiş sayılır.",
        ],
      },
      {
        id: "condition",
        title: "5. Araç durumu",
        paragraphs: [
          "Açık artırma araçları çoğu zaman hasarlı, eksik veya sınırlı ekspertizle satılır. Auto Nex tekliften önce fotoğraf, VIN ve mevcut raporları inceler; bu, gizli ayıba karşı garanti değildir.",
          "Aktarma organı, elektrik, gövde ve boyada gizli arızalar açık artırma görsellerinde görünmeyebilir. Müşteri bu riski kabul eder.",
          "Ek ekspertiz, tarama veya mekanik kontrol ayrıca kararlaştırılır ve ayrıca ücretlendirilir.",
        ],
      },
      {
        id: "payment",
        title: "6. Bedel, fatura ve ödeme",
        paragraphs: [
          "Müşteri resmi fatura alır. Tutar genellikle açık artırma, navlun, evrak, gümrük eşliği ve teslim olarak bölünür. Kesin yapı her siparişte yazıyla teyit edilir.",
          "Açık artırma ve ihracat ödemeleri platform takvimine göre döviz cinsinden istenebilir. Gecikme lot kaybı, ceza veya ardiye doğurabilir; bunlar açık artırma veya saha kurallarından kaynaklanır.",
          "Gümrük vergisi, KDV ve diğer kamu ödemeleri Azerbaycan hukukuna ve tescil anındaki tarifeye göre hesaplanır. Ön kestirimden sapabilir ve aksi yazıyla kararlaştırılmadıkça müşteriye aittir.",
        ],
      },
      {
        id: "ocean",
        title: "7. Deniz taşıması ve süre",
        paragraphs: [
          "Araç konteynerle veya kararlaştırılan başka bir deniz düzeniyle taşınır. ABD, Kore ve Çin hatlarının tümü gemi seferine tabidir.",
          "Süre; gemi programı, yükleme penceresi ve varış koridoruyla belirlenir. Sefer hem kısalabilir hem uzayabilir. Belirtilen gün sayısı ve ETA yönlendiricidir, garantili takvim teslim günü değildir.",
          "Konteyner, gemi adı, IMO ve liman bilgisi mevcut oldukça takipte görünür. Hat veya liman gecikmesi yalnızca Auto Nex’in kontrolünde değildir.",
        ],
      },
      {
        id: "force",
        title: "8. Mücbir sebep ve program değişikliği",
        paragraphs: [
          "Aşağıdakiler mücbir sebep veya Auto Nex’in makul kontrolü dışındaki hallerdendir ve süreyi uzatabilir veya kısaltabilir: liman yoğunluğu; hava ve deniz durumu; gemi rotasyonu, iptal veya ikame; grev, abluka, silahlı veya siyasi kısıt; salgın; idari tasarruf; uzayan gümrük incelemesi; taşıyıcı veya terminalin işletme kararı.",
          "Auto Nex mümkün olan en kısa sürede bildirir ve takibi günceller. Bu haller, emredici hukukun aksini gerektirmediği sürece tek başına cezai şart, tazminat veya kendiliğinden fesih sebebi oluşturmaz.",
        ],
      },
      {
        id: "track",
        title: "9. Takip kodu",
        paragraphs: [
          "Her sevkiyata benzersiz bir kod verilir (örneğin müşteri ve araç baş harfi artı rakamlar). Hesap açmak gerekmez.",
          "Aşamalar, tarihler, transitler, fotoğraflar ve notlar bilgilendirme amaçlıdır; canlı AIS veya terminal durumuyla her an örtüşmeyebilir.",
          "Kodun üçüncü kişilerle paylaşılması müşterinin sorumluluğundadır. Kayıp yazılı olarak Auto Nex’e bildirilmelidir.",
        ],
      },
      {
        id: "customs",
        title: "10. Gümrükleme",
        paragraphs: [
          "Azerbaycan’da tescil yürürlükteki kanun, tarife ve usule göredir. Evrak seti (fatura, konşimento, title vb.) taşıyıcıya ve ihracat ülkesine bağlıdır.",
          "Ek muayene, laboratuvar, kıymet veya ardiye gümrük idaresinin kararıdır ve teslimi uzatabilir.",
          "Eksik evrak, müşterinin vermediği bilgi veya yasak teçhizattan doğan gecikme ve masraf müşteriye yüklenebilir.",
        ],
      },
      {
        id: "delivery",
        title: "11. Teslim ve belgeler",
        paragraphs: [
          "Teslim, kararlaştırılan adreste veya sahada evrak karşılığı yapılır. Görünür hasar müşteri veya yetkili tarafından derhal kayda geçirilmelidir.",
          "Teslim edilmiş sevkiyatlar arşivlenebilir ve kararlaştırılan süreden sonra silinebilir. Bu, muhasebe kayıtlarını etkilemez.",
        ],
      },
      {
        id: "liability",
        title: "12. Sorumluluğun sınırı",
        paragraphs: [
          "Auto Nex hizmeti özenle ifa eder. Dolaylı zarar, kâr kaybı, bekleme maliyeti ve piyasa hareketi için sorumluluk, emredici hükümler saklı kalmak kaydıyla sınırlıdır.",
          "İzin verilen ölçüde toplam sorumluluk, ilgili siparişte Auto Nex’e ödenen hizmet bedeliyle sınırlıdır; açık artırmaya, taşıyıcıya ve kamuya ödenen tutarlar bu sınıra girmez — zarar Auto Nex’in kastı veya ağır kusurundan doğmadıkça.",
          "Sigorta ayrıca kararlaştırılmadıkça dahil değildir. Müşteri ek yük sigortası talep edebilir.",
        ],
      },
      {
        id: "data",
        title: "13. Veri ve gizlilik",
        paragraphs: [
          "Ad, iletişim, VIN, sevkiyat olayları ve belgeler yalnızca ithalat, takip ve teslim için işlenir. Ayrıntı Gizlilik sayfasındadır.",
          "Takip kodu hesapsız çalışır. Yönetim paneli yalnızca Auto Nex personeline aittir.",
        ],
      },
      {
        id: "ip",
        title: "14. Fikri mülkiyet",
        paragraphs: [
          "Sitenin tasarımı, metni, markası ve yazılımı Auto Nex’e veya lisans verenlere aittir. İzinsiz kopyalama yasaktır.",
          "Açık artırma ve ortak markaları hak sahiplerine aittir; yalnızca tanıtım için gösterilir.",
        ],
      },
      {
        id: "law",
        title: "15. Uygulanacak hukuk",
        paragraphs: [
          "Bu şartlar Azerbaycan Cumhuriyeti hukukuna tabidir. Uyuşmazlıklar önce müzakere, ardından — emredici hüküm aksini gerektirmediği sürece — Bakü yetkili mahkemelerinde çözülür.",
        ],
      },
      {
        id: "changes",
        title: "16. Değişiklik",
        paragraphs: [
          "Auto Nex bu belgeyi güncelleyebilir. Yeni metin sitede yayımlandığı günden itibaren geçerlidir. Aktif sevkiyatlara, aksi yazıyla kararlaştırılmadıkça, sipariş anındaki şartlar uygulanır.",
        ],
      },
      {
        id: "contact",
        title: "17. Bildirim ve iletişim",
        paragraphs: [
          "Resmi yazışma: auto@nex.autos. Operasyonel hat: WhatsApp 070 966 81 11. Adres: Bakıxanov, Bakü.",
          "Aşama SMS veya WhatsApp yalnızca müşteri numara verdiyse gönderilebilir. Teknik arıza bildirimin ulaşmasını engelleyebilir; asıl kayıt takip sayfasıdır.",
        ],
      },
    ],
  },
};
