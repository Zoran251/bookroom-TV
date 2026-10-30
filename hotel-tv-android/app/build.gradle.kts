plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersionCode = providers.gradleProperty("appVersionCode").orNull?.toIntOrNull() ?: 3
val appVersionName = providers.gradleProperty("appVersionName").orNull ?: "1.2.0"

val signingStorePath = System.getenv("ANDROID_KEYSTORE_PATH")
val signingStorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val signingKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
val signingKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
val releaseSigningAvailable = listOf(
    signingStorePath,
    signingStorePassword,
    signingKeyAlias,
    signingKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "com.bookroom.hoteltv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bookroom.hoteltv"
        minSdk = 23
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
    }

    if (releaseSigningAvailable) {
        signingConfigs {
            create("release") {
                storeFile = file(requireNotNull(signingStorePath))
                storePassword = requireNotNull(signingStorePassword)
                keyAlias = requireNotNull(signingKeyAlias)
                keyPassword = requireNotNull(signingKeyPassword)
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = if (releaseSigningAvailable) {
                signingConfigs.getByName("release")
            } else {
                null
            }
        }
    }
}

kotlin {
    jvmToolchain(17)
}
