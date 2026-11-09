# Müştəri bildirişləri

## Vacib mərhələlər

Aşağıdakı mərhələlərdə müştəriyə WhatsApp bildirişi göndərilməsinə cəhd edilir:

- Maşın alınıb (`PURCHASED`), şirkətin hesabına pul daxil olub (`PAYMENT_RECEIVED`).
- Maşın götürülüb (`PICKED_UP`), sənədlər hazırlanır / ixrac sənədi hazırdır (`EXPORT_DOCUMENTS`, `EXPORT_READY`).
- Konteynerə yüklənib (`LOADED_CONTAINER`), gəmi yola çıxıb (`SHIP_DEPARTED`), təyinat limanına çatıb (`DESTINATION_PORT`).
- Konteyner açılıb (`CONTAINER_OPENED`), TIR-a yüklənib / TIR yola çıxıb (`TIR_LOADED`, `TIR_DEPARTED`).
- Gömrük sənədləri hazırdır (`CUSTOMS_DOCUMENTS_READY`), Bakı gömrüyünə çatıb (`TIR_BAKU_CUSTOMS`), təhvil üçün hazırdır (`READY_FOR_DELIVERY`).
- Təhvil verilib / ləğv edilib (`DELIVERED`, `CANCELLED`).

Gözləmə kimi aralıq mərhələlər izləmə səhifəsində görünür, lakin əlavə avtomatik mesaj yaratmır. Yeni maşın yaradılarkən düzgün müştəri nömrəsi varsa ilkin alış bildirişi də göndərilir; eyni sifarişin təkrar yaradılma sorğusu bunu təkrarlamır.

## Yeni şəkillər

Şəkil saxlandıqdan sonra bildiriş serverdə növbəyə yazılır. Ardıcıl yükləmələr birləşdirilir: son şəkildən təxminən 45 saniyə sonra, uzun yükləmələrdə isə ən çox 3 dəqiqəlik gözləmə ilə bir ümumi bildiriş hazırlanır. İşçi növbəni 10 saniyəlik intervalla yoxlayır. Mesajda marka/model və müştərinin izləmə linki var; şəkil faylları SMS-ə əlavə edilmir.

Növbə məlumat bazasında saxlanılır, ona görə prosesin yenidən başlaması gözləyən bildirişi itirmir. Yalnız bu funksiya aktivləşdikdən sonra uğurla yüklənmiş yeni şəkillər növbəyə düşür; köhnə qalereyalar üçün kütləvi bildiriş göndərilmir. Silinmiş və yarımçıq şəkillər göndərişdən əvvəl yoxlanılır. Adminin əl ilə şəkil bildirişi düyməsi eyni növbəni istifadə edir, ayrıca dublikat yaratmır.

## Kanallar və təhlükəsiz nəticələr

Hazırkı seçim yalnız WhatsApp-dır; bu bildirişlərdə adi telefon SMS-i standart olaraq bağlıdır. Adi SMS yalnız ayrıca razılaşdırıldıqdan sonra `SHIPMENT_SMS_ENABLED=true` və `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` ilə qoşula bilər. O halda hər iki kanal ayrıca cəhd edilər və WhatsApp-ın qəbulu SMS cəhdini dayandırmaz. WhatsApp açarı adi SMS xidməti yaratmır. Açarları Git-ə və müştəri tərəfinə çıxarmayın.

Nəticədə `channelResults.whatsapp` və `channelResults.sms` ayrı göstərilir. Xidmətin mesajı qəbul etməsi çatdırılma və ya oxunma təsdiqi deyil. Şəbəkə xətası və qeyri-müəyyən cavablar uğur kimi göstərilmir; belə mesajlar avtomatik təkrar göndərilmir. Şəkil növbəsində xarici göndərişdən əvvəl birdəfəlik davamlı qeyd yaradılır: proses həmin anda dayansa nəticə naməlum qala bilər, amma avtomatik dublikat göndəriş olmur.

Telegram botunda əməkdaşın yazdığı şəxsi mətn yalnız WhatsApp ilə, ayrıca önizləmə və təsdiqlə göndərilir. Onun SMS-ə keçidi yoxdur. OTP, radar və sığorta axınlarının əvvəlki qaydaları bu dəyişikliklə dəyişmir. İstifadə olunmayan, təsdiqsiz `/api/notify` göndəriş yolu bağlanıb; bildirişlər qorunan sifariş əməliyyatları vasitəsilə yaradılır.
