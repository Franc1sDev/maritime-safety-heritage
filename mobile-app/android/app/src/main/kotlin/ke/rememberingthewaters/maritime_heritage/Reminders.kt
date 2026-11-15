package ke.rememberingthewaters.maritime_heritage

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * Reminders ring on the phone at their time, even when the app is closed:
 * an alarm wakes ReminderReceiver, which shows a notification. Tapping it opens the app.
 */
object Reminders {
    private const val CHANNEL = "reminders"
    private const val ACTION = "ke.rememberingthewaters.maritime_heritage.REMINDER"

    fun schedule(ctx: Context, id: String, title: String, body: String, at: Long) {
        val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val time = maxOf(at, System.currentTimeMillis() + 1000)
        val intent = pending(ctx, id, title, body)
        if (Build.VERSION.SDK_INT >= 23) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, intent)
        else alarms.set(AlarmManager.RTC_WAKEUP, time, intent)
    }

    fun cancel(ctx: Context, id: String) {
        val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarms.cancel(pending(ctx, id, "", ""))
        (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(id.hashCode())
    }

    private fun pending(ctx: Context, id: String, title: String, body: String): PendingIntent {
        val intent = Intent(ctx, ReminderReceiver::class.java)
            .setAction(ACTION)
            .putExtra("id", id)
            .putExtra("title", title)
            .putExtra("body", body)
        return PendingIntent.getBroadcast(ctx, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun show(ctx: Context, id: String, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_HIGH)
            channel.description = "Reminders you set in the Maritime Heritage app"
            manager.createNotificationChannel(channel)
        }
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val tap = PendingIntent.getActivity(ctx, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val text = body.ifBlank { "It's time." }
        val notification = builder(ctx)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(tap)
            .build()
        manager.notify(id.hashCode(), notification)
    }

    @Suppress("DEPRECATION")
    private fun builder(ctx: Context): Notification.Builder =
        if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL)
        else Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        Reminders.show(context, id, intent.getStringExtra("title") ?: "Reminder", intent.getStringExtra("body") ?: "")
    }
}
