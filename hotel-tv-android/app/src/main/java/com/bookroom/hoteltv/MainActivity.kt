package com.bookroom.hoteltv

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class MainActivity : Activity() {
    companion object {
        private const val TAG = "[HOTEL-TV]"
        private const val POWER_TV_PACKAGE = "power.bestapps.uk"
        private const val CONSOLE_URL = "https://bookroom-tv.vercel.app/hotel-tv-panel.html"
    }

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            webViewClient = WebViewClient()
            addJavascriptInterface(HotelTvBridge(), "HotelTvAndroid")
            loadUrl(CONSOLE_URL)
        }

        setContentView(webView)
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
}
