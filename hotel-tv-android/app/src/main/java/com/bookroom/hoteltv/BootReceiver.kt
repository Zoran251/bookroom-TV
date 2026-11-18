package com.bookroom.hoteltv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "[HOTEL-TV-BOOT]"
        private val BOOT_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON",
        )
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action !in BOOT_ACTIONS) return

        val prefs = context.getSharedPreferences(MainActivity.PREFERENCES_NAME, Context.MODE_PRIVATE)
        val autoStartEnabled = prefs.getBoolean(MainActivity.AUTO_START_ON_BOOT_KEY, true)
        if (!autoStartEnabled) {
            Log.i(TAG, "Auto-start on boot is disabled; skipping launch")
            return
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP,
            )
            putExtra(MainActivity.EXTRA_LAUNCHED_FROM_BOOT, true)
        }

        try {
            context.startActivity(launchIntent)
            Log.i(TAG, "Launched Hotel TV on boot ($action)")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to launch Hotel TV on boot ($action)", error)
        }
    }
}
