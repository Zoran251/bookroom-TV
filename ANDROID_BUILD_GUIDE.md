# Android TV APK build guide

Ovaj vodič koristi postojeći Kotlin projekat `hotel-tv-android`; ne zahtijeva Android
Studio. Aplikacija zadržava `applicationId` `com.bookroom.hoteltv`, učitava produkcijski
URL `https://bookroom-tv.vercel.app/hotel-tv-panel.html`, koristi postojeći Supabase
sistem i pokreće POWER TV paket `power.bestapps.uk`.

Pošto WebView učitava produkcijski URL, internet veza je potrebna za početni ekran i
Supabase podatke. Android aplikacija prikazuje poruku i dugme za ponovni pokušaj ako
konekcija ili produkcijska stranica nisu dostupni.

## Šta je u projektu

- Jedan Android modul: `hotel-tv-android/app`.
- Android Gradle Plugin 8.5.2, Kotlin Gradle plugin 2.0.21, Gradle Wrapper 8.7 i JDK 17.
- `compileSdk` / `targetSdk` 35 i `minSdk` 23.
- Android TV launcher kategorija, aplikacijska ikona i TV banner.
- Release APK je potpisan samo ako su podešena sva četiri signing secreta; bez njih se
  pravi jasno označena unsigned APK datoteka.

## GitHub Actions build

Repozitorij trenutno koristi granu `master`. Workflow `.github/workflows/android-build.yml`
pokreće se na push na `master` ili `main`, ručno kroz `workflow_dispatch`, i na tagove
oblika `v*`. Postojeći stari workflow je zadržan kao ručni migration notice i više ne
pokreće dupli build na push.

1. Otvori GitHub repozitorij i izaberi **Actions → Android TV APK**.
2. Za ručni build klikni **Run workflow**, odaberi granu i potvrdi pokretanje. Za
   automatski build dovoljno je pushati promjenu na `master` ili `main`.
3. Otvori završen workflow run i preuzmi artifact **`hotel-tv-release-apk`**.
4. Ako APK ima sufiks `-UNSIGNED`, nije potpisan i nije spreman za distribuciju ili
   ažuriranje instalacije koju je potpisao drugi ključ.

Obični branch push pravi build i artifact, ali ne kreira GitHub Release. Release se
kreira samo za `v*` tag.

## Signing secrets

Ne postoji keystore u Android projektu i nisam generisao niti zamijenio signing ključ.
Prije izrade novog ključa provjeri da li već postoji keystore iz ranije Android
distribucije. **Isti `applicationId` mora se ažurirati ključem kojim je potpisana
postojeća aplikacija.** Novi ključ ne može potpisati ažuriranje postojeće instalacije.

Ako nema postojećeg ključa, napravi ga lokalno uz JDK 17 `keytool`. Sačuvaj ga izvan
repozitorija, u sigurnosnoj kopiji kojoj samo ovlašteni administratori imaju pristup.
Nikad ga nemoj commitati niti slati kroz chat:

```powershell
keytool -genkeypair -v `
  -keystore "$HOME\hotel-tv-release.jks" `
  -alias hotel-tv `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

U GitHubu otvori **Settings → Secrets and variables → Actions → New repository secret**
i dodaj:

| Secret | Vrijednost |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64 sadržaj `.jks` datoteke |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore lozinka |
| `ANDROID_KEY_ALIAS` | Alias iz `keytool` komande, ovdje `hotel-tv` |
| `ANDROID_KEY_PASSWORD` | Lozinka ključa |

PowerShell može kopirati Base64 sadržaj u clipboard bez pravljenja dodatne datoteke:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("$HOME\hotel-tv-release.jks")
) | Set-Clipboard
```

Clipboard tretiraj kao tajnu i očisti ga nakon unosa. Nemoj ispisivati Base64 tekst u
terminal koji se snima ili dijeli. Ako nedostaje makar jedan signing secret, workflow
namjerno pravi unsigned APK i ispisuje upozorenje; djelimične vrijednosti se ne koriste
za potpisivanje.

## Nova verzija i GitHub Release

`versionName` dolazi iz verzije taga, a workflow računa rastući Android `versionCode`
kao `10000 + workflow run number`, iznad trenutnog koda aplikacije. Za novu verziju
napravi i pushaj semantički tag, na primjer:

```powershell
git tag v1.2.0
git push origin v1.2.0
```

Tag automatski pokreće release build. Ako je signing konfigurisan, Release sadrži
`Hotel-TV-v1.2.0.apk`. Bez signing podataka objavljuje se
`Hotel-TV-v1.2.0-UNSIGNED.apk` uz upozorenje da nije spreman za distribuciju.
Nemoj pomjerati ili ponovo koristiti već objavljen tag; za novu verziju napravi novi
tag.

## Instalacija i ažuriranje na Android TV / Google TV

Preuzmi APK artifact ili release na računar, pa ga prenesi na TV preko pouzdanog USB
uređaja ili odobrenog mrežnog transfera. Na TV-u dozvoli instalaciju iz aplikacije
kojom otvaraš APK, ako uređaj to zatraži, i instaliraj Hotel TV. POWER TV ostaje
zasebna aplikacija i mora biti instalirana da bi je TV ikona mogla pokrenuti.

Za ažuriranje instaliraj novi APK preko postojeće aplikacije **bez prethodnog
deinstaliranja**. Android će sačuvati WebView podatke kada su `applicationId` i
signing key isti. Deinstalacija briše lokalne podatke aplikacije. APK bez potpisa ili
potpisan drugim ključem ne može ažurirati postojeću instalaciju; ne uklanjaj staru
instalaciju dok ne potvrdiš da imaš odgovarajući ključ i backup podataka.

## Pokretanje POWER TV-a u BlueStacks-u na Windowsu

Android aplikacija pokreće POWER TV preko native Android bridge-a. Običan Windows
browser ne može direktno izvršiti lokalni `.exe`; za to je potreban Windows URL
protocol handler. Ako želiš da TV ikona u browseru pokrene POWER TV u BlueStacks-u,
pokreni jednom iz PowerShella, iz root foldera repozitorija:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-bluestacks-power-tv-protocol.ps1
```

Skripta registruje `bookroom-power-tv://` samo za trenutnog Windows korisnika u HKCU.
Koristi postojeći BlueStacks `HD-Player.exe`, instancu `Pie64` i Android paket
`power.bestapps.uk`; ne instalira APK, ne mijenja Android signing i ne zahtijeva
administratorska prava. Ako BlueStacks koristi drugu instalacijsku putanju ili
instancu, prilagodi skriptu prije pokretanja. Nakon registracije zatvori i ponovo
otvori browser, pa klikni TV ikonu i odobri browserov prompt za otvaranje BlueStacks-a.

## Lokalni build bez Android Studija

Instaliraj JDK 17 i Android SDK Platform 35 / Build-Tools 35.0.0. Android Studio nije
potreban. Podesi `ANDROID_HOME` na SDK putanju i prihvati potrebne SDK licence. Zatim:

```powershell
cd hotel-tv-android
.\gradlew.bat assembleRelease
```

Prvi build preuzima Gradle 8.7 preko Wrappera i provjerava SHA-256 distribucije. Bez
signing environment varijabli izlaz je unsigned:
`app\build\outputs\apk\release\app-release-unsigned.apk`.

## Ograničenja provjere

Lokalno se mogu provjeriti manifest, resursi, workflow struktura i Gradle Wrapper
konfiguracija. Kompajliranje Android APK-a i provjera potpisa se izvršavaju na GitHub
Actions runneru; uspjeh potvrdi tek zeleni korak **Build and verify release APK** i
objavljeni artifact.
