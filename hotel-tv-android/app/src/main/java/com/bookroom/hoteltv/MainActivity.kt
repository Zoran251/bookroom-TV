package com.bookroom.hoteltv

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    companion object {
        private const val TAG = "[HOTEL-TV]"
        private const val POWER_TV_PACKAGE = "power.bestapps.uk"
        private const val CONSOLE_URL = "https://bookroom-tv.vercel.app/hotel-tv-panel.html"
        private const val CONSOLE_HOST = "bookroom-tv.vercel.app"
        const val PREFERENCES_NAME = "hotel_tv"
        private const val PAIRING_CODE_KEY = "pairing_code"
        const val AUTO_START_ON_BOOT_KEY = "auto_start_on_boot"
        const val EXTRA_LAUNCHED_FROM_BOOT = "launched_from_boot"
        private const val OVERLAY_PROMPT_SHOWN_KEY = "overlay_prompt_shown"
    }

    private lateinit var webView: WebView
    private lateinit var rootView: FrameLayout
    private lateinit var connectionErrorPanel: LinearLayout
    private lateinit var connectionErrorText: TextView
    private lateinit var retryButton: Button
    private lateinit var pairingPanel: LinearLayout
    private lateinit var pairingCodeInput: EditText
    private lateinit var pairingErrorText: TextView
    @Volatile
    private var isTrustedConsolePage = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        applyImmersiveMode()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.loadsImagesAutomatically = true
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            isFocusable = true
            isFocusableInTouchMode = true
            webChromeClient = WebChromeClient()
            setOnLongClickListener {
                showTvSettingsDialog()
                true
            }
            webViewClient = object : WebViewClient() {
                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
                    handleNavigation(Uri.parse(url), isForMainFrame = true)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean = handleNavigation(request.url, request.isForMainFrame)

                override fun onPageStarted(
                    view: WebView,
                    url: String,
                    favicon: Bitmap?,
                ) {
                    isTrustedConsolePage = isTrustedConsoleUrl(Uri.parse(url))
                    if (!isTrustedConsolePage) {
                        view.stopLoading()
                        showConnectionError("Blokirano je preusmjeravanje izvan TV konzole.")
                        return
                    }
                    super.onPageStarted(view, url, favicon)
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    super.onReceivedError(view, request, error)
                    if (request.isForMainFrame) {
                        showConnectionError("Ne mogu učitati TV konzolu. Provjerite internet konekciju.")
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView,
                    request: WebResourceRequest,
                    errorResponse: WebResourceResponse,
                ) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    if (request.isForMainFrame) {
                        showConnectionError(
                            "TV konzola je odgovorila greškom (${errorResponse.statusCode}). Pokušajte ponovo.",
                        )
                    }
                }

                override fun onReceivedSslError(
                    view: WebView,
                    handler: SslErrorHandler,
                    error: SslError,
                ) {
                    handler.cancel()
                    if (error.url?.let { Uri.parse(it).host == CONSOLE_HOST } == true) {
                        showConnectionError("Sigurna veza s TV konzolom nije uspjela.")
                    }
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    isTrustedConsolePage = isTrustedConsoleUrl(Uri.parse(url))
                    if (isTrustedConsolePage) {
                        connectionErrorPanel.visibility = View.GONE
                    }
                }
            }
            addJavascriptInterface(HotelTvBridge(), "HotelTvAndroid")
        }

        connectionErrorText = TextView(this).apply {
            text = "Povezivanje s TV konzolom nije uspjelo."
            textSize = 20f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        retryButton = Button(this).apply {
            text = "Pokušaj ponovo"
            isFocusable = true
            isFocusableInTouchMode = true
            setOnClickListener { loadConsole() }
        }
        connectionErrorPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 36, 48, 36)
            setBackgroundColor(Color.rgb(29, 26, 36))
            addView(
                connectionErrorText,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = 24 },
            )
            addView(
                retryButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
            visibility = View.GONE
            isFocusable = true
        }

        pairingErrorText = TextView(this).apply {
            textSize = 16f
            setTextColor(Color.rgb(255, 150, 150))
            gravity = Gravity.CENTER
        }
        pairingCodeInput = EditText(this).apply {
            hint = "32-znakovni kod iz admin panela"
            textSize = 18f
            setTextColor(Color.WHITE)
            setHintTextColor(Color.LTGRAY)
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or
                InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            isSingleLine = true
            isFocusable = true
            isFocusableInTouchMode = true
        }
        val pairButton = Button(this).apply {
            text = "Poveži ovaj TV"
            isFocusable = true
            isFocusableInTouchMode = true
            setOnClickListener {
                val code = pairingCodeInput.text.toString().trim().lowercase()
                if (!Regex("^[0-9a-f]{32}$").matches(code)) {
                    pairingErrorText.text = "Kod mora imati 32 znaka (slova A–F i brojevi 0–9)."
                    pairingCodeInput.requestFocus()
                    return@setOnClickListener
                }

                getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(PAIRING_CODE_KEY, code)
                    .apply()
                pairingErrorText.text = ""
                loadConsole()
                maybePromptOverlayPermissionOnce()
            }
        }
        pairingPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 36, 48, 36)
            setBackgroundColor(Color.rgb(29, 26, 36))
            addView(
                TextView(this@MainActivity).apply {
                    text = "Poveži Hotel TV sa sobom"
                    textSize = 26f
                    setTextColor(Color.WHITE)
                    gravity = Gravity.CENTER
                },
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = 18 },
            )
            addView(
                TextView(this@MainActivity).apply {
                    text = "U admin panelu otvori „Uparivanje TV-a“, napravi kod za ovu sobu i unesi ga ispod."
                    textSize = 18f
                    setTextColor(Color.LTGRAY)
                    gravity = Gravity.CENTER
                },
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = 18 },
            )
            addView(
                pairingCodeInput,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = 8 },
            )
            addView(
                pairingErrorText,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = 8 },
            )
            addView(
                pairButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
            visibility = View.GONE
            isFocusable = true
        }

        rootView = FrameLayout(this).apply {
            addView(
                webView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
            addView(
                connectionErrorPanel,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
            addView(
                pairingPanel,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
        }
        setContentView(rootView)
        webView.requestFocus(View.FOCUS_DOWN)
        loadConsole()
        if (getSavedPairingCode().isNotBlank()) {
            maybePromptOverlayPermissionOnce()
        }
    }

    private fun hasInternetConnection(): Boolean {
        val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun loadConsole() {
        if (getSavedPairingCode().isBlank()) {
            showPairingPrompt()
            return
        }
        if (!hasInternetConnection()) {
            showConnectionError("Nema internet konekcije. Povežite TV na internet i pokušajte ponovo.")
            return
        }
        connectionErrorPanel.visibility = View.GONE
        pairingPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(CONSOLE_URL)
    }

    private fun getSavedPairingCode(): String =
        getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
            .getString(PAIRING_CODE_KEY, "")
            .orEmpty()

    private fun showPairingPrompt() {
        connectionErrorPanel.visibility = View.GONE
        webView.visibility = View.GONE
        pairingPanel.visibility = View.VISIBLE
        pairingErrorText.text = ""
        pairingCodeInput.setText(getSavedPairingCode())
        pairingCodeInput.requestFocus()
    }

    private fun showConnectionError(message: String) {
        connectionErrorText.text = message
        webView.visibility = View.GONE
        connectionErrorPanel.visibility = View.VISIBLE
        pairingPanel.visibility = View.GONE
        retryButton.requestFocus()
    }

    private fun isTrustedConsoleUrl(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host == CONSOLE_HOST

    private fun handleNavigation(uri: Uri, isForMainFrame: Boolean): Boolean {
        if (!isForMainFrame) return true
        if (isTrustedConsoleUrl(uri)) return false
        if (uri.scheme == "https" || uri.scheme == "http") return openExternalLink(uri)
        return true
    }

    @Suppress("DEPRECATION")
    private fun applyImmersiveMode() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
    }

    private fun openExternalLink(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (error: android.content.ActivityNotFoundException) {
            android.util.Log.e(TAG, "No application can open $uri", error)
            Toast.makeText(
                this,
                "Nije pronađena aplikacija za otvaranje linka.",
                Toast.LENGTH_LONG,
            ).show()
            true
        } catch (error: SecurityException) {
            android.util.Log.e(TAG, "Not allowed to open $uri", error)
            Toast.makeText(this, "Link se ne može otvoriti na ovom uređaju.", Toast.LENGTH_LONG).show()
            true
        }
    }

    inner class HotelTvBridge {
        @JavascriptInterface
        fun getPairingCode(): String {
            if (!isTrustedConsolePage) {
                android.util.Log.w(TAG, "Ignored pairing-code request from an untrusted page")
                return ""
            }
            return getSavedPairingCode()
        }

        @JavascriptInterface
        fun showPairingError(message: String) {
            if (!isTrustedConsolePage) {
                android.util.Log.w(TAG, "Ignored pairing-error request from an untrusted page")
                return
            }
            runOnUiThread {
                pairingErrorText.text = message
                webView.visibility = View.GONE
                connectionErrorPanel.visibility = View.GONE
                pairingPanel.visibility = View.VISIBLE
                pairingCodeInput.requestFocus()
            }
        }

        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun openPowerTv() {
            runOnUiThread {
                try {
                    if (!isTrustedConsolePage) {
                        android.util.Log.w(TAG, "Ignored POWER TV request from an untrusted page")
                        return@runOnUiThread
                    }

                    val launchIntent = packageManager.getLaunchIntentForPackage(POWER_TV_PACKAGE)
                        ?: packageManager.getLeanbackLaunchIntentForPackage(POWER_TV_PACKAGE)
                        ?: Intent(Intent.ACTION_MAIN).apply {
                            addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
                            component = ComponentName(
                                POWER_TV_PACKAGE,
                                "com.flextv.livestore.MainTVActivity",
                            )
                        }

                    startActivity(launchIntent)
                    android.util.Log.i(TAG, "Power TV launched successfully")
                } catch (error: android.content.ActivityNotFoundException) {
                    android.util.Log.e(TAG, "Power TV is not installed or has no launcher", error)
                    Toast.makeText(
                        this@MainActivity,
                        "Power TV nije instaliran",
                        Toast.LENGTH_LONG,
                    ).show()
                } catch (error: Exception) {
                    android.util.Log.e(TAG, "Failed to launch Power TV", error)
                    Toast.makeText(
                        this@MainActivity,
                        "Power TV se ne može pokrenuti.",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }

        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun isPowerTvInstalled(): Boolean =
            try {
                packageManager.getPackageInfo(POWER_TV_PACKAGE, 0)
                true
            } catch (error: android.content.pm.PackageManager.NameNotFoundException) {
                android.util.Log.i(TAG, "Power TV package is not installed")
                false
            } catch (error: Exception) {
                android.util.Log.e(TAG, "Failed to check whether Power TV is installed", error)
                false
            }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
            if (::connectionErrorPanel.isInitialized &&
                connectionErrorPanel.visibility == View.VISIBLE &&
                hasInternetConnection()
            ) {
                loadConsole()
            }
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveMode()
    }

    @Deprecated("Deprecated in Android API 33, retained for older TV devices")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyImmersiveMode()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showTvSettingsDialog()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun isAutoStartEnabled(): Boolean =
        getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
            .getBoolean(AUTO_START_ON_BOOT_KEY, true)

    private fun setAutoStartEnabled(enabled: Boolean) {
        getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(AUTO_START_ON_BOOT_KEY, enabled)
            .apply()
    }

    private fun needsOverlayPermissionForBootLaunch(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            isAutoStartEnabled() &&
            !Settings.canDrawOverlays(this)

    private fun maybePromptOverlayPermissionOnce() {
        if (!needsOverlayPermissionForBootLaunch()) return
        val prefs = getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
        if (prefs.getBoolean(OVERLAY_PROMPT_SHOWN_KEY, false)) return
        prefs.edit().putBoolean(OVERLAY_PROMPT_SHOWN_KEY, true).apply()

        AlertDialog.Builder(this)
            .setTitle("Automatsko pokretanje TV-a")
            .setMessage(
                "Da bi se Hotel TV automatski pokretao odmah pri paljenju na Android 10+ uređajima, " +
                    "odobrite dozvolu \"Prikaz preko drugih aplikacija\" ili postavite Hotel TV kao početni ekran (Launcher).",
            )
            .setPositiveButton("Otvori dozvolu") { _, _ ->
                openOverlayPermissionSettings()
            }
            .setNegativeButton("Kasnije", null)
            .show()
    }

    private fun openOverlayPermissionSettings() {
        val packageUri = Uri.parse("package:$packageName")
        val overlayIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, packageUri)
        val detailsIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
        try {
            startActivity(overlayIntent)
        } catch (_: Exception) {
            try {
                startActivity(detailsIntent)
            } catch (_: Exception) {
                Toast.makeText(
                    this,
                    "Postavite dozvolu u Postavkama TV-a -> Aplikacije -> Hotel TV.",
                    Toast.LENGTH_LONG,
                ).show()
            }
        }
    }

    private fun showTvSettingsDialog() {
        val autoStartEnabled = isAutoStartEnabled()
        val options = mutableListOf<String>()
        val actions = mutableListOf<() -> Unit>()

        options += if (autoStartEnabled) {
            "Automatsko pokretanje pri paljenju TV-a: UKLJUČENO (isključi)"
        } else {
            "Automatsko pokretanje pri paljenju TV-a: ISKLJUČENO (uključi)"
        }
        actions += {
            val next = !autoStartEnabled
            setAutoStartEnabled(next)
            Toast.makeText(
                this,
                if (next) {
                    "Automatsko pokretanje pri paljenju TV-a je uključeno."
                } else {
                    "Automatsko pokretanje pri paljenju TV-a je isključeno."
                },
                Toast.LENGTH_LONG,
            ).show()
            if (next) openOverlayPermissionIfNeededWithToast()
        }

        if (needsOverlayPermissionForBootLaunch()) {
            options += "Odobri dozvolu za pokretanje pri paljenju (Android 10+)"
            actions += { openOverlayPermissionSettings() }
        }

        if (getSavedPairingCode().isNotBlank()) {
            options += "Promijeni kod sobe (uparivanje TV-a)"
            actions += { showPairingChangeDialog() }
        }

        AlertDialog.Builder(this)
            .setTitle("Postavke Hotel TV-a")
            .setItems(options.toTypedArray()) { _, which ->
                actions.getOrNull(which)?.invoke()
            }
            .setNegativeButton("Zatvori", null)
            .show()
    }

    private fun openOverlayPermissionIfNeededWithToast() {
        if (!needsOverlayPermissionForBootLaunch()) return
        AlertDialog.Builder(this)
            .setTitle("Dozvola na Android 10+")
            .setMessage("Želite li otvoriti postavke da odobrite prikaz preko drugih aplikacija?")
            .setPositiveButton("Otvori postavke") { _, _ -> openOverlayPermissionSettings() }
            .setNegativeButton("Kasnije", null)
            .show()
    }

    private fun showPairingChangeDialog() {
        AlertDialog.Builder(this)
            .setTitle("Uparivanje TV-a")
            .setMessage("Želiš li promijeniti sobu povezanu s ovim TV-om?")
            .setPositiveButton("Promijeni kod") { _, _ ->
                getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
                    .edit()
                    .remove(PAIRING_CODE_KEY)
                    .apply()
                showPairingPrompt()
            }
            .setNegativeButton("Odustani", null)
            .show()
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("HotelTvAndroid")
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }
}
