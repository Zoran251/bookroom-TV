package com.bookroom.hoteltv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : Activity() {
    companion object {
        private const val TAG = "[HOTEL-TV]"
        private const val POWER_TV_PACKAGE = "power.bestapps.uk"
        private const val CONSOLE_URL =
            "https://appassets.androidplatform.net/assets/console/hotel-tv-panel.html"
    }

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ) = assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val uri = request.url
                    if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net") {
                        return false
                    }

                    if (uri.scheme == "https" || uri.scheme == "http") {
                        return openExternalLink(uri)
                    }

                    return true
                }
            }
            addJavascriptInterface(HotelTvBridge(), "HotelTvAndroid")
            loadUrl(CONSOLE_URL)
        }

        setContentView(webView)
    }

    private fun openExternalLink(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (error: android.content.ActivityNotFoundException) {
            android.util.Log.e(TAG, "No application can open $uri", error)
            Toast.makeText(this, "Nije pronađena aplikacija za otvaranje linka.", Toast.LENGTH_LONG)
                .show()
            true
        }
    }

    inner class HotelTvBridge {
        @JavascriptInterface
        fun openPowerTv() {
            runOnUiThread {
                android.util.Log.i(TAG, "Launching Power TV")
                android.util.Log.i(TAG, "Package: $POWER_TV_PACKAGE")

                val launchIntent = packageManager.getLaunchIntentForPackage(POWER_TV_PACKAGE)
                if (launchIntent == null) {
                    android.util.Log.e(TAG, "Power TV package not found")
                    Toast.makeText(
                        this,
                        "Power TV nije instaliran na ovom TV uređaju.",
                        Toast.LENGTH_LONG,
                    ).show()
                    return@runOnUiThread
                }

                try {
                    launchIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                    android.util.Log.i(TAG, "Power TV launched successfully")
                } catch (error: Exception) {
                    android.util.Log.e(TAG, "Failed to launch Power TV", error)
                    Toast.makeText(
                        this,
                        "Power TV se ne može pokrenuti.",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }
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
        webView.destroy()
        super.onDestroy()
    }
}
