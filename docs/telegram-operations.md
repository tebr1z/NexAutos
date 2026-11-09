# Telegram ilə daşınma idarəetməsi

Bu, **əməkdaşlar üçün şəxsi idarəetmə botudur**, müştərilər üçün açıq bot deyil.
Bot token olmadan və aktivləşdirilmədən Telegram-a sorğu göndərmir.

## İlk quraşdırma

1. Telegram-da rəsmi [@BotFather](https://t.me/BotFather) hesabını açın və `/newbot` göndərin. Botun adını və `bot` ilə bitən istifadəçi adını seçin.
2. Alınan tokeni yalnız **Admin → Telegram** bölməsindəki token sahəsinə daxil edin. Tokeni söhbətə, GitHub-a və ya `NEXT_PUBLIC_*` dəyişəninə yazmayın.
3. Yadda saxlayın, botu aktivləşdirin və vəziyyəti yeniləyin. “Aktiv” yalnız son uğurlu Telegram sorğusundan sonra görünür.
4. Hər əməkdaş öz admin hesabında **Telegram hesabımı bağla** düyməsi ilə 10 dəqiqəlik birdəfəlik keçid yaradır. Keçidi öz Telegram hesabında açıb **Start** basır. Keçidi başqasına göndərməyin.

Botun tokenini dəyişmək yalnız `SUPER_ADMIN` və `ADMIN` rollarına açıqdır. `MANAGER` və `STAFF` öz hesabını bağlaya və adi maşın idarəetmə icazəsi çərçivəsində işləyə bilər. `CUSTOMER` və `FREIGHT_USER` istifadə edə bilməz.

## Botda işləmək

- `/menu` — əsas menyu.
- `/active` — yolda/prosesdə olan aktiv müştərilər; müştərini seçərək yalnız onun aktiv maşınlarını görmək. Ad/telefon axtarışı və səhifələmə var. Alışdan təhvilə qədər bütün mərhələlər daxildir; `DELIVERED` və `CANCELLED` sifarişləri göstərilmir.
- `/search` — VIN, izləmə/lot kodu, marka/model və ya müştəri ilə axtarış.
- `/customers` — müştərinin adı və ya telefonu ilə onun maşınlarını tapmaq.
- `/containers` — konteynerə bağlı maşınları tapmaq.
- `/cancel` — cari ekrandan çıxmaq; təsdiqlənməmiş dəyişiklik saxlanmır.
- `/help` — istifadə qaydası.

Nəticədən **dəqiq maşını** seçin. Mərhələ, konteyner kodu, daşıyıcının HTTPS izləmə keçidi və konteyner açılma tarixi yenilənə bilər. Konteyner kodu 4 hərf + 7 rəqəm, tarix `YYYY-MM-DD` formatındadır. Hər dəyişiklik müştəri/VIN/izləmə kodu və əvvəlki/yeni məlumatla önizlənir; yalnız təsdiqdən sonra yazılır. Bir konteynerdə bir neçə maşın olsa belə, bu versiyada hər maşın ayrıca seçilir — toplu dəyişiklik edilmir.

Saytın izləmə səhifəsi eyni məlumat bazasından yenilənir. Yalnız mövcud bildiriş qaydalarına düşən mərhələlər üçün WhatsApp/SMS göndərilməsinə cəhd edilir. Bot göndərilmə, ötürülmə və uğursuzluğu ayrıca bildirir. Daşıyıcı keçidi GPS məlumat mənbəyi deyil; müştərini daşıyıcının izləmə səhifəsinə aparır.

## Telegram-dan müştəriyə WhatsApp mesajı

1. `/active`, müştəri axtarışı və ya VIN ilə **dəqiq maşını** seçin.
2. **Müştəriyə WhatsApp yaz** düyməsinə basın və ekranda göstərilən limitə qədər mətn yazın (Vexira/Meta üçün 2000, Twilio üçün 1600 simvol). Abzaslar saxlanılır; yalnız mətn mesajı dəstəklənir.
3. Önizləmədə müştərinin adını, tam telefon nömrəsini, VIN/izləmə kodunu və göndəriləcək mətni yoxlayın.
4. Yalnız **WhatsApp-a göndər** düyməsi ilə təsdiqdən sonra bir dəfə göndərmə cəhdi edilir. `/cancel`, `/menu` və `/start` yazmaq mesajı göndərmədən bu mərhələdən çıxır. Digər `/` ilə başlayan mətnlər mesaj mətni hesab edilir.

Mesaj yalnız seçilmiş maşının qeydiyyatdakı müştərisinin nömrəsinə göndərilir; botdan başqa nömrə daxil etmək və müştərinin nömrəsini dəyişmək olmur. Öz yazdığınız mətn göndərilir; gizli imza, mərhələ dəyişikliyi və ya avtomatik izləmə keçidi əlavə edilmir. Təsdiqdən əvvəl müştəri, nömrə və ya sifariş dəyişərsə, köhnə təsdiq qəbul olunmur.

Bu funksiya mövcud WhatsApp xidmətinin açarları ilə işləyir. WhatsApp hazır deyilsə, göndərmə açılmır. **SMS-ə və ya başqa provayderə avtomatik keçid yoxdur.** Qəbul edilən göndərmə limiti bir əməkdaş üçün 10 dəqiqəyə 10 cəhd, eyni müştəri üçün 10 dəqiqəyə 3 cəhddir. Yalnız razılıq vermiş müştərilərlə əlaqə saxlayın; abunəlikdən çıxmaq istəklərinə hörmət edin.

“WhatsApp xidməti qəbul etdi” cavabı çatdırılma və ya oxunma qəbzi deyil. Vaxt aşımı, anlaşılmaz cavab və ya proses dayanması olduqda nəticə naməlum qala bilər. Dublikat mesaj getməsin deyə avtomatik təkrar cəhd edilmir; yenidən göndərməzdən əvvəl provayder jurnalını yoxlayın. Meta/Twilio kimi rəsmi WhatsApp inteqrasiyalarında sərbəst mətn üçün son müştəri mesajından sonrakı 24 saatlıq pəncərə və şablon qaydaları tətbiq oluna bilər; [rəsmi izah](https://www.twilio.com/docs/whatsapp/api).

Botu dayandırmaq və ya əməkdaşın girişini ləğv etmək gələcək təsdiqləri bağlayır; artıq təsdiqlənmiş və xidmətə ötürülən mesajı geri çağırmır.

## Təhlükəsizlik və istismar

- Yalnız botla **şəxsi söhbətlər** qəbul olunur; qrup, kanal, bot hesabları və redaktə olunmuş mesajlar qəbul edilmir.
- Giriş Telegram istifadəçi adına deyil, rəqəmsal Telegram hesabına və aktiv əməkdaş hesabına bağlanır. İcazə hər əməliyyatda yenidən yoxlanır.
- Admin paneldən öz bağlantınızı və ya tam-admin kimi digər bağlantıları ləğv edə bilərsiniz. Botu dayandırmaq təsdiqlənməmiş əməliyyatları ləğv edir.
- Qoşulma linkinin yalnız SHA-256 heşi saxlanır. Token AES-256-GCM ilə şifrələnir və API-dən geri qaytarılmır. İstəyə görə serverdə ayrıca, Base64 formatında 32 baytlıq `TELEGRAM_ENCRYPTION_KEY` istifadə edin. Əks halda ən az 32 simvolluq `JWT_SECRET`-dən ayrıca domenli açar törədilir. Açar dəyişərsə tokeni paneldən yenidən yadda saxlayın.
- Bir botu başqa sistemlə paylaşmayın. Mövcud webhook aşkarlanarsa sazlama rədd edilir; sistem webhook-u avtomatik silmir. Paralel `getUpdates` istehlakçısı Telegram `409` xətası yarada bilər.
- PM2 prosesi botun uzun sorğu işçisini özü başladır. Ayrı port, cron və ya webhook açmaq lazım deyil. PostgreSQL lease-i yalnız bir işçinin sorğu aparmasını təmin edir; cursor bazada saxlanır.
- Təsdiq 10 dəqiqəlikdir. Təkrar düymə əməliyyatı və bildirişi təkrarlamır. Önizləmədən sonra başqa admin məlumatı dəyişibsə, köhnə təsdiq rədd edilir.
- Maşın/mərhələ/hadisə/audit və birdəfəlik təsdiq eyni tranzaksiyada yazılır. Bildiriş cəhdi commit-dən sonra edilir; şəbəkə və ya proses dayanması zamanı mesaj çatdırılmasına zəmanət verilmir. Botun cavabı gəlməzsə təkrar dəyişməzdən əvvəl maşının cari məlumatını yoxlayın.

Deploy əvvəl `prisma migrate deploy` və API/web build yoxlanmalıdır. Token hələ yaradılmayıbsa, quraşdırma səhifəsi hazır olsa da bot deaktiv qalır.

Rəsmi sənədlər: [Telegram Bot API](https://core.telegram.org/bots/api), [qoşulma keçidləri](https://core.telegram.org/bots/features#deep-linking).
