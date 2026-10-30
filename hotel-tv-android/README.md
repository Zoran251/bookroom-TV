# Hotel TV Android TV app

The existing Kotlin app loads the production console at
`https://bookroom-tv.vercel.app/hotel-tv-panel.html` in Android WebView. Supabase
continues to provide the existing online data synchronization, and the TV tile launches
the installed POWER TV package `power.bestapps.uk`.

The project keeps its existing `com.bookroom.hoteltv` application ID. Android TV and
Google TV launcher metadata, a TV banner, a launcher icon, immersive display, D-pad
focus, network error/retry feedback, and Android Back navigation are configured in the
existing app module.

## Build without Android Studio

Install JDK 17 and Android SDK Platform 35 plus Build-Tools 35.0.0. From this directory,
run:

```powershell
.\gradlew.bat assembleRelease
```

The first wrapper run downloads the pinned Gradle 8.7 distribution and verifies its
SHA-256 checksum. By default, the release APK is unsigned. For signing and GitHub
Actions instructions, see [ANDROID_BUILD_GUIDE.md](../ANDROID_BUILD_GUIDE.md).
