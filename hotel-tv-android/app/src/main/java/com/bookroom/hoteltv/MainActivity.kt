package com.bookroom.hoteltv

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.Gravity
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
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    companion object {
        private const val TAG = "[HOTEL-TV]"
        private const val POWER_TV_PACKAGE = "power.bestapps.uk"
        private const val POWER_TV_APK_MIME_TYPE = "application/vnd.android.package-archive"
        private const val REQUEST_SELECT_POWER_TV_APK = 1001
        private const val REQUEST_INSTALL_PERMISSION = 1002
        private const val CONSOLE_URL = "https://bookroom-tv.vercel.app/hotel-tv-panel.html"
        private const val CONSOLE_HOST = "bookroom-tv.vercel.app"
    }

    private lateinit var webView: WebView
    private lateinit var rootView: FrameLayout
    private lateinit var connectionErrorPanel: LinearLayout
    private lateinit var connectionErrorText: TextView
    private lateinit var retryButton: Button

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
                    if (!isTrustedConsoleUrl(Uri.parse(url))) {
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
                    if (isTrustedConsoleUrl(Uri.parse(url))) {
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
        }
        setContentView(rootView)
        webView.requestFocus(View.FOCUS_DOWN)
        loadConsole()
    }

    private fun hasInternetConnection(): Boolean {
        val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun loadConsole() {
        if (!hasInternetConnection()) {
            showConnectionError("Nema internet konekcije. Povežite TV na internet i pokušajte ponovo.")
            return
        }
        connectionErrorPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(CONSOLE_URL)
    }

    private fun showConnectionError(message: String) {
        connectionErrorText.text = message
        webView.visibility = View.GONE
        connectionErrorPanel.visibility = View.VISIBLE
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
        fun openPowerTv() {
            runOnUiThread {
                if (!isTrustedConsoleUrl(Uri.parse(webView.url ?: ""))) {
                    android.util.Log.w(TAG, "Ignored POWER TV request from an untrusted page")
                    return@runOnUiThread
                }

                android.util.Log.i(TAG, "Launching Power TV")
                android.util.Log.i(TAG, "Package: $POWER_TV_PACKAGE")

                val launchIntent = getPowerTvLaunchIntent()
                if (launchIntent == null) {
                    if (packageManager.getPackageInfoOrNull(POWER_TV_PACKAGE) == null) {
                        android.util.Log.e(TAG, "Power TV package not found")
                        promptToInstallPowerTv()
                    } else {
                        android.util.Log.e(TAG, "Power TV has no launcher activity for this device")
                        Toast.makeText(
                            this@MainActivity,
                            "Power TV nema kompatibilnu početnu aktivnost na ovom uređaju.",
                            Toast.LENGTH_LONG,
                        ).show()
                    }
                    return@runOnUiThread
                }

                try {
                    startActivity(launchIntent)
                    android.util.Log.i(TAG, "Power TV launched successfully")
                } catch (error: android.content.ActivityNotFoundException) {
                    android.util.Log.e(TAG, "Power TV launch activity not found", error)
                    Toast.makeText(
                        this@MainActivity,
                        "POWER TV se ne može pronaći na ovom uređaju.",
                        Toast.LENGTH_LONG,
                    ).show()
                } catch (error: SecurityException) {
                    android.util.Log.e(TAG, "Failed to launch Power TV", error)
                    Toast.makeText(
                        this@MainActivity,
                        "Power TV se ne može pokrenuti.",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun getPowerTvLaunchIntent(): Intent? =
        packageManager.getLeanbackLaunchIntentForPackage(POWER_TV_PACKAGE)
            ?: packageManager.getLaunchIntentForPackage(POWER_TV_PACKAGE)

    @Suppress("DEPRECATION")
    private fun android.content.pm.PackageManager.getPackageInfoOrNull(
        packageName: String,
    ): android.content.pm.PackageInfo? =
        try {
            getPackageInfo(packageName, 0)
        } catch (_: android.content.pm.PackageManager.NameNotFoundException) {
            null
        }

    private fun promptToInstallPowerTv() {
        AlertDialog.Builder(this)
            .setTitle("POWER TV nije instaliran")
            .setMessage(
                "Power TV aplikacija nije instalirana na ovom uređaju. " +
                    "Želite li odabrati POWER TV APK sa USB-a ili memorije uređaja?",
            )
            .setNegativeButton("Otkaži", null)
            .setPositiveButton("Odaberi APK") { _, _ -> requestInstallPermissionOrChooseApk() }
            .show()
    }

    private fun requestInstallPermissionOrChooseApk() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()) {
            choosePowerTvApk()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Dozvoli instalaciju")
            .setMessage(
                "Da biste instalirali POWER TV, dozvolite Hotel TV aplikaciji " +
                    "instalaciju aplikacija iz ovog izvora. Android će zatim tražiti potvrdu instalacije.",
            )
            .setNegativeButton("Otkaži", null)
            .setPositiveButton("Otvori postavke") { _, _ ->
                val settingsIntent = Intent(
                    android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName"),
                )
                try {
                    startActivityForResult(settingsIntent, REQUEST_INSTALL_PERMISSION)
                } catch (error: android.content.ActivityNotFoundException) {
                    android.util.Log.e(TAG, "Unknown-app installation settings are unavailable", error)
                    Toast.makeText(
                        this,
                        "Postavke za dozvolu instalacije nisu dostupne na ovom uređaju.",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
            .show()
    }

    private fun choosePowerTvApk() {
        val pickerIntent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = POWER_TV_APK_MIME_TYPE
        }
        try {
            startActivityForResult(
                Intent.createChooser(pickerIntent, "Odaberite POWER TV APK"),
                REQUEST_SELECT_POWER_TV_APK,
            )
        } catch (error: android.content.ActivityNotFoundException) {
            android.util.Log.e(TAG, "No document picker is available for POWER TV APK", error)
            Toast.makeText(
                this,
                "Nije pronađen upravitelj datoteka za odabir POWER TV APK-a.",
                Toast.LENGTH_LONG,
            ).show()
        }
    }

    @Deprecated("Deprecated in Android API 30, retained for document-picker compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQUEST_INSTALL_PERMISSION -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && packageManager.canRequestPackageInstalls()) {
                    choosePowerTvApk()
                } else {
                    Toast.makeText(
                        this,
                        "Dozvola za instalaciju POWER TV aplikacije nije odobrena.",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
            REQUEST_SELECT_POWER_TV_APK -> {
                if (resultCode != RESULT_OK) return
                val apkUri = data?.data
                if (apkUri == null) {
                    Toast.makeText(this, "APK datoteka nije odabrana.", Toast.LENGTH_LONG).show()
                    return
                }
                installPowerTv(apkUri)
            }
        }
    }

    private fun installPowerTv(apkUri: Uri) {
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, POWER_TV_APK_MIME_TYPE)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            startActivity(installIntent)
        } catch (error: android.content.ActivityNotFoundException) {
            android.util.Log.e(TAG, "No package installer can open the selected POWER TV APK", error)
            Toast.makeText(
                this,
                "Nije pronađen Android instalater za odabrani APK.",
                Toast.LENGTH_LONG,
            ).show()
        } catch (error: SecurityException) {
            android.util.Log.e(TAG, "Not allowed to install the selected POWER TV APK", error)
            Toast.makeText(
                this,
                "Android nije dozvolio otvaranje instalacije POWER TV aplikacije.",
                Toast.LENGTH_LONG,
            ).show()
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

    override fun onDestroy() {
        webView.removeJavascriptInterface("HotelTvAndroid")
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }
}
