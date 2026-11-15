import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "MshAlerts") {
      AppDelegate.registerAlerts(messenger: registrar.messenger())
    }
  }

  /// Reminders ring on the phone at their time, even when the app is closed (local notifications).
  static func registerAlerts(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "msh/alerts", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      let center = UNUserNotificationCenter.current()
      let args = call.arguments as? [String: Any] ?? [:]
      switch call.method {
      case "permission":
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
          DispatchQueue.main.async { result(granted) }
        }
      case "schedule":
        guard let id = args["id"] as? String, let at = args["at"] as? NSNumber else {
          result(FlutterError(code: "bad_args", message: "id and at are required", details: nil))
          return
        }
        let content = UNMutableNotificationContent()
        content.title = args["title"] as? String ?? "Reminder"
        let body = args["body"] as? String ?? ""
        content.body = body.isEmpty ? "It's time." : body
        content.sound = .default
        let seconds = max(1, at.doubleValue / 1000 - Date().timeIntervalSince1970)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { _ in
          DispatchQueue.main.async { result(nil) }
        }
      case "cancel":
        if let id = args["id"] as? String {
          center.removePendingNotificationRequests(withIdentifiers: [id])
          center.removeDeliveredNotifications(withIdentifiers: [id])
        }
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
