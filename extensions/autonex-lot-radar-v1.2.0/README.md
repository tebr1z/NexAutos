# Auto Nex · Lot Radar 1.2.0

Kalkulyator və Market Analizi əlavələrindən ayrı Chrome Manifest V3 extension-udur. Mövcud əlavələrin sessiyasına və fayllarına toxunmur.

## Funksiyalar

- Marka, model, il aralığı, mühərrik həcmi (litr), əsas/ikinci zədənin yeri və sənəd kateqoriyası üzrə adminin təyin etdiyi sayda aktiv axtarış.
- Zədə seçimləri OR prinsipi ilə işləyir: seçilən yerlərdən ən az biri əsas və ya ikinci zədədə olmalıdır. “Yan” qeyri-müəyyən tərəfdir; sağ/sol ayrıca saxlanır.
- Clean title, salvage/rebuilt, məhdud/parts-only/non-repairable/bill-of-sale və naməlum sənəd ayrı kateqoriyalardır. Adi salvage avtomatik “sənəd problemsizdir” sayılmır. Naməlum mühərrik məhdud həcmli axtarışa uyğun sayılmır.
- Adi müştəri axtarışında ilk uğurlu skan mövcud lotları baseline edir və bildiriş göndərmir. Sonrakı yeni uyğun lot hər axtarış üçün bir dəfə bildirilir. Adminin `buy_now` qaydasında isə ilk skanda da həddə uyğun ucuz lot bildirilir. Sonrakı yoxlamalarda tanınan lotların qiyməti təkrar oxunur; əvvəllər baha olan lot həddə düşəndə xəbər verilir. Eyni lot bir qaydada yalnız bir dəfə bildirilir. Lot nömrəsi ilə təkrarlar silinir; yeni nömrə ilə relist yeni lotdur. Yenidən skan, Chrome/API restart baseline-i sıfırlamır.
- Extension bildirişi, badge və son 100 nəticə. E-poçt/WhatsApp istifadəçi ayrıca seçəndə yalnız həmin Auto Nex hesabının profilindəki ünvan/nömrəyə gedir. Telefon yoxdursa WhatsApp seçimi rədd edilir.
- Çatdırılma nəticələri ayrıca görünür. SMTP/WhatsApp qurulmayıbsa “göndərildi” göstərilmir. Uğursuz kanala server növbəsində 5 cəhdə qədər təkrar edilir; uğurlu kanal təkrarlanmır. Server qəzası provider qəbulundan sonra, DB yazısından əvvəl olarsa nadir təkrar mesaj mümkündür (provider idempotency dəstəyi yoxdur).

## Quraşdırma və server deploy

`/account` müştəri səhifəsində və `/lot-radar` ünvanında istək forması var. `/admin/users` bölməsində CUSTOMER hesabı yaradılır, WhatsApp nömrəsi, aktiv axtarış limiti və aylıq bildiriş limiti yazılır. Başlanğıc dəyərlər 3 aktiv axtarış / 100 yeni lot bildirişidir. Admin həmin hesab üçün Radar-ı bağlaya və limitləri 0 edə bilər. Aşağı limitə keçəndə artıq aktiv axtarışlar dayandırılır. Öz-özünə qeydiyyatdan keçən müştəri Radar üçün admin aktivləşdirməsini gözləyir.

v1.2.0: `/admin/lot-radar` bölməsində admin Buy Now üçün maksimum USD məbləği və ya adminin yazdığı bazar dəyərindən minimum faiz endirimi təyin edir. Hər iki hədd qoyulubsa hər ikisi ödənməlidir. Bu bazar qiymətinin avtomatik qiymətləndirilməsi deyil. Mənbədə dəqiq USD Buy Now qiyməti yoxdursa lot qiymət fürsəti sayılmır; current/final bid və ACV alış qiyməti əvəzinə istifadə edilmir. Bildirişdə oxunan qiymət var; vergi, auksion/xidmət haqqı və daşınma bu məbləğə daxil deyil.

`20261106020000_radar_customer_plans` migrasiyası da tətbiq edilməlidir. v1.2.0 admin kollektoru üçün əlavə `20261106030000_radar_browser_collector` migrasiyası tələb olunur: iş sahibi və lease qoruması üçün 3 watch sütunu artırılır. Production DB backup-dan sonra adi `node apps/web/api/scripts/migrate-deploy.cjs` deploy axını ilə bütün pending migrasiyalar tətbiq edilməlidir; sonra API restart edilir. Bu əməliyyat lokalda avtomatik icra edilmir. Kollektorun admin icazəsi və işi götürən adminə bağlı lease-i server tərəfindən yoxlanır.

Aylıq istifadə Bakı vaxtı ilə hesablanır və axtarış silinməklə sıfırlanmır. Bir axtarışda bir yeni lot bir istifadədir; eyni lot üçün WhatsApp və e-poçt iki istifadə sayılmır. Limit bitəndən sonra tapılan lotlar `quotaBlocked` kimi saxlanılır və həmin ay üçün göndərilmir; limiti artırmaq əvvəl bloklanmış lotları avtomatik yenidən bildirmir. Paralel skanlar istifadəçi sətrini kilidləyərək eyni kvotanı keçə bilmir.

Mesajda hərrac günü/saatı və link var. ISO tarixində `Z`/UTC offset məlumdursa Bakı vaxtına çevrilir. Saat qurşağı məlum deyilsə mənbənin yazısı göstərilir və dəqiq Bakı vaxtı kimi təqdim edilmir. Tövsiyə olunan başqa lotun Event metadata-sı cari lotun vaxtı kimi götürülmür.

1. API dəyişiklikləri və `prisma/migrations/20261106010000_lot_radar/migration.sql` serverə daşınmalıdır. Production DB backup-dan sonra repo kökündə `node apps/web/api/scripts/migrate-deploy.cjs` işlədin. Bu əməliyyat lokalda avtomatik icra edilmir.
2. `apps/web/api` daxilində `npm ci`, `npx prisma generate`, `npm run build` işlədin. API prosesini restart edin. Yeni endpoint-lər `/api/v1/lot-radar` altındadır, JWT və istifadəçi sahibliyi yoxlanılır.
3. Server polling üçün `LOT_RADAR_ENABLED=true`. Hər dəqiqə növbədəki axtarışlar yoxlanır; hər axtarış ən tez 20 dəqiqədən bir uyğun gəlir. Server çox yüklənəndə müddət uzana bilər. Ayrı worker/cron quraşdırması tələb olunmur. Bir neçə API prosesi DB lease vasitəsilə eyni axtarışı paralel yoxlamır.
4. E-poçt üçün mövcud `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; WhatsApp üçün mövcud Vexira/Meta/Twilio konfiqurasiyası istifadə olunur. Provider hesabı, göndərmə icazəsi və lazım gəldikdə WhatsApp template razılığı ayrıca olmalıdır. Açarları extension-a yazmayın. Twilio SMS fallback istifadə edilmir.
5. `chrome://extensions` → Developer mode → Load unpacked → bu qovluğu seçin. İkona vurun və öz Auto Nex hesabınızla daxil olun.
6. Filtrləri və kanalları seçib axtarışı saxlayın. “Chrome ilə yoxla” ilk skanı başladır; şəxsi axtarışların davamlı browser polling-i üçün “Chrome ilə avtomatik yoxla” seçin. Avtomatik rejim əvvəlcədən bağlıdır. Chrome alarm-ı hər 30 saniyə işin davamını və bildirişləri yoxlasa da eyni axtarışın normal təkrar skanı 20 dəqiqədən tez başlamır.

## Admin kollektoru — serverə Chrome vasitəsilə nəticə göndərilməsi

API-nin birbaşa BidCars sorğusu JavaScript nəticələrini və ya təhlükəsizlik yoxlamasını keçə bilməyəndə admin Chrome-u normal səhifə oxuyan relay kimi işlədə bilər. Bu rəsmi BidCars API inteqrasiyası və ya CAPTCHA keçidi deyil.

1. Extension-da ADMIN və ya SUPER_ADMIN hesabı ilə daxil olun. Köhnə sessiyada admin seçimi görünmürsə çıxıb yenidən daxil olun.
2. “Chrome ilə avtomatik yoxla” və ayrıca “Admin kollektoru” seçimlərini aktivləşdirin. Müştəri və digər rollar kollektor seçimini aktiv edə bilmir; endpoint-ləri server də admin rolu ilə qoruyur.
3. Kollektor `/lot-radar/admin/collector/next` vasitəsilə serverin növbəti vaxtı çatmış işini götürür. Bu növbəyə icazəsi açıq olan aktiv müştəri axtarışları və admin Buy Now qaydaları daxildir. Şəxsi axtarış rejimi ilə eyni anda iki iş aparılmır.
4. Arxa planda açdığı sekmədə hazır nəticə və ilk 30 lotun avtomobil məlumatını oxuyur; Specs tabındakı gizli mühərrik sahələri də qorunur, history/related bölmələri ayrılır. Buy Now yalnız görünən, dəqiq USD qiymətidir. `/lot-radar/admin/collector/:id/finish` vasitəsilə yalnız lot snapshot-larını və lease-i API-yə göndərir. Müştəri telefonu/e-poçtu, BidCars sessiya cookie-si, şifrə və API token-ləri bu relay-in məlumatına daxil edilmir. Mesajı alıcının profilinə uyğun server göndərir.
5. Chrome açıq qalmalıdır. Kompüter yuxudadırsa və ya Chrome bağlanıbsa skan dayanır. Təhlükəsizlik yoxlaması və ya yarımçıq səhifə çıxanda boş inventar kimi uğurlu qeyd edilmir; browser/kollektor rejimi dayanır və xəbərdarlıq görünür. Normal BidCars səhifəsini özünüz yoxladıqdan sonra seçimləri yenidən aktivləşdirin. Alış, bid, login və CAPTCHA düymələrinə avtomatik klik edilmir.

“Son uğurlu Chrome göndərişi”, işin qalan lot sayı və son xəta dashboard-da görünür. Kollektor boş növbəni ən çox dəqiqədə bir yoxlayır; hər qaydanın skan müddətini server 20 dəqiqəlik interval və lease ilə idarə edir. “Dərhal bildiriş” uyğun lot uğurla oxunandan sonrakı göndərişdir — 20 dəqiqəlik intervallar arasındakı qiymət dəyişikliklərinin real vaxt zəmanəti deyil.

## Mənbə və əhatə sərhədi

Bu versiya axtarış nəticəsində yüklənmiş ilk **30 lotu Chrome-da**, ilk **60 lotu serverdə** oxuyur. “Load more”/bütün arxiv skan edilmir; dar marka/model/il filtrləri istifadə edin. Yeni lot bu pəncərədən kənardadırsa dərhal tapılmaya bilər. Axtarışların hamısını əhatə edən və brauzerdən asılı olmayan zəmanətli monitor üçün BidCars-dan icazəli tam inventar feed-i/API lazımdır.

BidCars Cloudflare yoxlaması tələb edə bilər. Server bunu açıq xəta kimi saxlayır, boş inventar kimi qəbul etmir və baseline yaratmır. Browser rejimi normal, aktiv olmayan BidCars sekməsi açır, hazır DOM-u oxuyur, sonra yalnız öz yaratdığı sekməni bağlayır. Challenge/CAPTCHA avtomatik həll edilmir və qoruma keçilmir; rejim dayanır və istifadəçidən normal saytı açması gözlənilir. Chrome bağlananda browser skanı dayanır. Server mənbəni oxuya bilirsə WhatsApp/e-poçt Chrome bağlı olanda da işləyir.

Sənəd kateqoriyası elandakı sözlərdən çıxarılır; Azərbaycan qeydiyyatı və ixracın hüquqi yoxlaması deyil. Zədənin dərəcəsi və fotodakı vəziyyət AI ilə təxmin edilmir.

## Yoxlamalar

API qovluğunda: `node node_modules/jest/bin/jest.js --runInBand lot-radar` və `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.build.json --incremental false`.

Repo kökündə: `node --test extensions/autonex-lot-radar/test-background.cjs extensions/autonex-lot-radar/test-content.cjs`; `node --check` ilə background/content/dashboard sintaksisi.

Real göndərmə testləri üçün deploy edilmiş API, DB, hesab və SMTP/WhatsApp xidməti lazımdır. İnkişaf zamanı heç bir real alıcıya mesaj göndərilmir.

## Brauzersiz inventar mənbə adapteri

Cloudflare birbaşa HTTP oxunmasını saxladıqda 24/7 axtarış üçün operatorun istifadə etməyə icazəsi olan inventar mənbəsi qoşulmalıdır. Hazır adapter provider abunəsi və ya hazır məlumat feed-i deyil. `LOT_RADAR_FEED_URL` və `LOT_RADAR_FEED_TOKEN` yalnız serverdə saxlanır. Sistem bu HTTPS ünvana Bearer token ilə `{ filters, limit: 200 }` JSON POST edir. Redirect izlənmir.

Adapterin cavab müqaviləsi:

```json
{
  "complete": true,
  "lots": [{
    "url": "https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry",
    "title": "2021 Toyota Camry, LE",
    "make": "Toyota", "model": "Camry", "year": 2021,
    "engineCc": 2500, "primaryDamage": "Right front", "secondaryDamage": "Rear",
    "document": "Salvage certificate", "active": true,
    "auctionAt": "2026-12-01T15:30:00Z", "buyNowUsd": 4500
  }]
}
```

`complete: true` yalnız həqiqətən tam oxunmuş cavab üçündür; boş `lots` da bu halda qəbul edilir. Əks halda ilk baseline irəliləmir. Ən çox 200 lot qəbul olunur. Vaxt qurşağı olmayan `auctionAt` rədd edilir; qeyri-dəqiq yazını `auctionTimeText` kimi qaytarmaq olar. Bu mənbə qoşulmadan və real göndərmə xidməti yoxlanmadan sistemin fasiləsiz işlədiyi iddia edilmir.
