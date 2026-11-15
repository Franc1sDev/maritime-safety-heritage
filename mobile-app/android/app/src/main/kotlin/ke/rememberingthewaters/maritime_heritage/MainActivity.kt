package ke.rememberingthewaters.maritime_heritage

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/** Hosts the app, and lets it ask the phone to ring reminders on time (see Reminders.kt). */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "msh/alerts").setMethodCallHandler { call, result ->
            when (call.method) {
                "permission" -> {
                    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
                        result.success(false)
                    } else {
                        result.success(true)
                    }
                }
                "schedule" -> {
                    val id = call.argument<String>("id")
                    val at = call.argument<Number>("at")
                    if (id == null || at == null) {
                        result.error("bad_args", "id and at are required", null)
                    } else {
                        Reminders.schedule(this, id, call.argument<String>("title") ?: "Reminder", call.argument<String>("body") ?: "", at.toLong())
                        result.success(null)
                    }
                }
                "cancel" -> {
                    call.argument<String>("id")?.let { Reminders.cancel(this, it) }
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
