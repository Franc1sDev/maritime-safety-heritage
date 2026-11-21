package ke.rememberingthewaters.maritime_heritage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Shows upload progress in a notification, and keeps the app alive while it is in the background
 * so the upload carries on (Section 8.4). The upload itself is done by the app; this only holds it open.
 * Every call is guarded: if the phone refuses the service, the upload still runs while the app is open.
 */
class UploadService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val n = Uploads.notification(this, intent?.getStringExtra("title") ?: "Uploading", intent?.getStringExtra("text") ?: "", intent?.getIntExtra("pct", -1) ?: -1)
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(Uploads.ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            else startForeground(Uploads.ID, n)
            Uploads.running = true
        } catch (e: Exception) {
            Uploads.running = false
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() { Uploads.running = false; super.onDestroy() }
}

object Uploads {
    const val ID = 4101
    private const val CHANNEL = "uploads"
    @Volatile var running = false

    /** Called by the app as an upload moves: starts the notification, updates it, or takes it away. */
    fun update(ctx: Context, active: Boolean, title: String, text: String, pct: Int) {
        try {
            if (!active) {
                if (running) ctx.stopService(Intent(ctx, UploadService::class.java))
                (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID)
                running = false
                return
            }
            if (running) {
                (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(ID, notification(ctx, title, text, pct))
                return
            }
            val start = Intent(ctx, UploadService::class.java).putExtra("title", title).putExtra("text", text).putExtra("pct", pct)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(start) else ctx.startService(start)
        } catch (e: Exception) {
            // Not allowed just now (for example the app is already in the background): the upload continues without the notification.
        }
    }

    fun notification(ctx: Context, title: String, text: String, pct: Int): Notification {
        val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL, "Uploads", NotificationManager.IMPORTANCE_LOW)
            channel.description = "Progress of the files you are sending"
            manager.createNotificationChannel(channel)
        }
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(ctx, ID, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else Notification.Builder(ctx).setPriority(Notification.PRIORITY_LOW)
        b.setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle(title).setContentText(text).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(tap)
        if (pct in 0..100) b.setProgress(100, pct, false)
        return b.build()
    }
}
