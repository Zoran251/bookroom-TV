package com.bookroom.hoteltv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.http.SslError
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

                val launchIntent = packageManager.getLaunchIntentForPackage(POWER_TV_PACKAGE)
                if (launchIntent == null) {
                    android.util.Log.e(TAG, "Power TV package not found")
                    Toast.makeText(
                        this@MainActivity,
                        "Power TV nije instaliran na ovom TV uređaju.",
                        Toast.LENGTH_LONG,
                    ).show()
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
