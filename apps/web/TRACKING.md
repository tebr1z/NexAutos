# Konteyner və gəmi izləmə

`/track` səhifəsində konteyner nömrəsi ilə axtarış, sifariş səhifəsində isə konteynerin avtomatik sorğusu var. Xəritə Leaflet + OpenStreetMap ilə işləyir və ayrıca xəritə açarı tələb etmir. Xəritədə miqyas, sürüşdürmə, zoom və mövqe nöqtəsi var. OpenStreetMap attribution saxlanılır; yüksək trafikdə lisenziyalı tile xidməti seçilməlidir.

Canlı daşıma məlumatı üçün serverdə `SEARATES_API_KEY` qurun. Mövcud alternativ `SHIPSGO_API_KEY`-dir. Açarları brauzerə və `NEXT_PUBLIC_*` dəyişənlərinə yazmayın. Docker Compose bu dəyişənləri API-yə ötürür. Env dəyişəndən sonra prosesi/container-i yenidən başladın. Mövcud AISStream açarı Admin → Ayarlar-dan idarə olunur.

SeaRates konteynerdən səfər və gəmi identifikasiyasını verir; təsdiqlənmiş IMO olduqda mövqe AIS xidmətindən də axtarılır. Planlaşdırılmış gələcək gəmi cari gəmi kimi seçilmir. Daşıyıcı prefiksi gəminin kimliyini müəyyən etmir. API açarı yoxdursa bu hal istifadəçiyə göstərilir. Mövqe məlumatı və müşahidə vaxtı olmayan nəticə canlı GPS kimi təqdim edilmir.

AIS gəminin son bildirilən koordinatıdır, konteynerin GPS-i deyil. Son məlum liman ayrıca işarələnir. Okeanda AIS əhatəsi/peyk məlumatı abunə planından asılıdır; daimi və tam dəqiq canlı mövqe zəmanəti yoxdur. Liman və təyinat məlumatından gəminin cari koordinatı uydurulmur. Demo konteyner production sorğularında istifadə olunmur.

Quraşdırma: `npm ci` (`apps/web`), `npm run build:next`; API üçün `npm ci` və `npm run build` (`apps/web/api`). Yeni DB migrasiyası yoxdur.

Yoxlama: `node node_modules/jest/bin/jest.js --runInBand containers` (`apps/web/api`). SeaRates-in real hesabı ilə konteyner sınağı üçün aktiv API açarı və etibarlı konteyner nömrəsi lazımdır.

Rəsmi mənbələr: [Leaflet](https://leafletjs.com/examples/quick-start/), [SeaRates Container Tracking](https://docs.searates.com/reference/tracking/v2/introduction), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).
