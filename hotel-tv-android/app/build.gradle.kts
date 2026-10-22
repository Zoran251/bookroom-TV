plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val repositoryRoot = rootProject.projectDir.parentFile
val generatedConsoleAssets = layout.buildDirectory.dir("generated/consoleAssets")
val isWindows = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)

val buildConsoleWeb = tasks.register<Exec>("buildConsoleWeb") {
    workingDir(repositoryRoot)
    environment("VITE_BASE_PATH", "./")
    commandLine(
        if (isWindows) listOf("cmd", "/c", "npm", "--prefix", "admin", "run", "build")
        else listOf("npm", "--prefix", "admin", "run", "build"),
    )

    doFirst {
        val envFile = repositoryRoot.resolve("admin/.env")
        val envContents = if (envFile.isFile) envFile.readText() else ""
        val hasSupabaseUrl = !System.getenv("VITE_SUPABASE_URL").isNullOrBlank() ||
            Regex("(?m)^VITE_SUPABASE_URL=.+$").containsMatchIn(envContents)
        val hasSupabaseKey = !System.getenv("VITE_SUPABASE_ANON_KEY").isNullOrBlank() ||
            Regex("(?m)^VITE_SUPABASE_ANON_KEY=.+$").containsMatchIn(envContents)

        check(hasSupabaseUrl && hasSupabaseKey) {
            "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in admin/.env or the build environment."
        }
    }
}

val prepareConsoleAssets = tasks.register<Sync>("prepareConsoleAssets") {
    dependsOn(buildConsoleWeb)
    from(repositoryRoot.resolve("admin-deploy"))
    into(generatedConsoleAssets.map { it.dir("console") })
    doFirst {
        val consoleHtml = repositoryRoot.resolve("admin-deploy/hotel-tv-panel.html")
        check(consoleHtml.isFile) {
            "The built TV console was not found in admin-deploy."
        }
        val referencedAssets = Regex("""(?:src|href)=["']\./assets/([^"']+)["']""")
            .findAll(consoleHtml.readText())
            .map { it.groupValues[1] }
            .toList()
        check(referencedAssets.isNotEmpty() && referencedAssets.all {
            repositoryRoot.resolve("admin-deploy/assets/$it").isFile
        }) {
            "The TV console build must use relative paths and include all referenced assets."
        }
    }
}

android {
    namespace = "com.bookroom.hoteltv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bookroom.hoteltv"
        minSdk = 23
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
    }

    sourceSets.getByName("main").assets.srcDir(generatedConsoleAssets)
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

tasks.named("preBuild").configure {
    dependsOn(prepareConsoleAssets)
}

kotlin {
    jvmToolchain(17)
}
