# Hotel TV Android TV aplikacija

Android aplikacija sadrži lokalnu produkcionu kopiju TV konzole. Pri Gradle buildu
pokreće se Vite build, a HTML, JavaScript, stilovi i ostali web resursi iz `admin-deploy`
pakiraju se u APK. Konzola se otvara iz APK-a preko `WebViewAssetLoader`, ne preuzima se
sa laptopa niti zahtijeva Vercel da bi se otvorio početni ekran.

## Supabase konfiguracija

Konzola koristi isti Supabase projekat kao web verzija. Prije lokalnog builda postavi
`VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` u `admin/.env` (kopiraj
`admin/.env.example`) ili ih proslijedi kao environment varijable. Vite ih ugrađuje u
lokalni web bundle. APK zato sadrži javni Supabase anon ključ; nikad ne koristi service
role ključ i ne dodaj `.env` u Git.

Na GitHub Actions postavi repository secrets `VITE_SUPABASE_URL` i
`VITE_SUPABASE_ANON_KEY` kako bi CI mogao napraviti APK.

## Lokalni build

Potrebni su Node.js 22, Java 17, Android SDK 35 i Gradle 8.7.

```powershell
cd admin
npm ci
cd ../hotel-tv-android
gradle assembleDebug
```

Alternativno, otvori folder `hotel-tv-android` u Android Studio i pokreni Gradle task
`assembleDebug` nakon jednokratne instalacije web zavisnosti:

```powershell
cd admin
npm ci
```

Gradle automatski izgradi web konzolu i uključi njene fajlove u aplikaciju. APK se
nalazi na `app/build/outputs/apk/debug/app-debug.apk`. Instaliraj ga na Android TV
zajedno s POWER TV aplikacijom (`power.bestapps.uk`).

## GitHub Actions build

Workflow `Build Hotel TV Android APK` pravi APK pri pushu Android/web izmjena ili ručnim
pokretanjem. Preuzmi `hotel-tv-debug-apk` iz artifacts sekcije završenog workflow runa.

Kada je internet dostupan, Android konzola učitava aktuelne podatke iz Supabase-a.
Početni HTML i web resursi su lokalni u APK-u. TV ikona poziva Android bridge i pokreće
instalirani POWER TV; pri povratku se nastavlja Hotel TV konzola.