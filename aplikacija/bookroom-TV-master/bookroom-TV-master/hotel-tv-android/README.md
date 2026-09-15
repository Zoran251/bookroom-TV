# Hotel TV Android aplikacija

Ovo je Android TV omotac za postojece web stranice:

- `hotel-tv-panel.html` je pocetna TV konzola.
- `tv-info.html` se otvara unutar istog WebView-a kada korisnik izabere karticu.
- Klik na TV karticu poziva native `HotelTvAndroid.openPowerTv()` bridge.
- Native kod pokrece instalirani `com.flextv.livestore` preko `PackageManager`-a.

## Pokretanje

Otvoriti folder `hotel-tv-android` u Android Studio, sinhronizovati Gradle i napraviti APK.
Instalirati APK na Android TV uredjaj zajedno sa Power TV aplikacijom.

GitHub automatski pravi debug APK nakon push-a. Fajl se nalazi u GitHub Actions rezultatu
workflow-a `Build Hotel TV Android APK`, pod nazivom `hotel-tv-debug-apk`.

Ako Power TV nije instaliran, Hotel TV aplikacija prikazuje jasnu poruku umesto rusenja.