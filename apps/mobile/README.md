# Auto Nex Mobile — müstəqil test tətbiqi

Bu Expo/React Native tətbiqi Chrome extension-dan ayrıdır. `extensions/autonex-bidcars` fayllarını import etmir və onun işləməsinə təsir etmir.

## Hazır olan test axını

- Auto Nex kalkulyator hesabı ilə giriş və tokenlərin `expo-secure-store` daxilində saxlanması;
- tətbiqin içində yalnız `bid.cars` domenini açan brauzer;
- açıq lotdan qiymət, auction və location oxuma;
- mövcud `/shipping/quote` API-si ilə hesabın limiti, son tarixi, fərdi tarifləri və brend adı tətbiq edilərək yol hesabı;
- yığcam mobil nəticə paneli.

Bu ilk prototipdə DGK gömrük nəticəsi hələ mobil panelə qoşulmayıb. Store buraxılışından əvvəl real iPhone/Android cihazında BidCars cookie, giriş, bot yoxlaması və lot parseri ayrıca sınaqdan keçirilməlidir.

## Lokal test

```bash
cd apps/mobile
npm start
```

Expo Go ilə QR kodu açın. API ünvanını dəyişmək lazım olsa:

```bash
EXPO_PUBLIC_API_BASE=https://nex.autos/api/v1 npm start
```

## Internal test build

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

Android üçün preview APK, iOS üçün developer hesabınıza bağlı internal build yaranır. Store identifikatorları `autos.nex.mobile` olaraq nümunə verilib; yayımdan əvvəl sizə aid unikal bundle/package ID ilə dəyişdirilməlidir.
