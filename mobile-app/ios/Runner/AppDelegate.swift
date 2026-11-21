import Flutter
import UIKit
import UserNotifications
import Vision
import ImageIO

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
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "MshFaces") {
      AppDelegate.registerFaces(messenger: registrar.messenger())
    }
  }

  /// Finds faces in a photo so the app can blur them before it is sent (“Blur faces in the photos I add next”).
  /// Uses Apple's Vision framework on the phone; nothing leaves the device. Answers [left, top, width, height]
  /// boxes in the photo's pixels, measured from the top left.
  static func registerFaces(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "msh/faces", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "find", let path = (call.arguments as? [String: Any])?["path"] as? String else {
        result(FlutterMethodNotImplemented)
        return
      }
      DispatchQueue.global(qos: .userInitiated).async {
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
          DispatchQueue.main.async { result(FlutterError(code: "unreadable", message: "The photo could not be read.", details: nil)) }
          return
        }
        let width = CGFloat(image.width), height = CGFloat(image.height)
        let request = VNDetectFaceRectanglesRequest()
        do {
          // The app saves the photo upright before asking, so the pixels and the boxes share one orientation.
          try VNImageRequestHandler(cgImage: image, orientation: .up, options: [:]).perform([request])
          let boxes: [[Int]] = (request.results ?? []).map { face in
            let b = face.boundingBox // normalised, origin at the bottom left
            return [Int(b.minX * width), Int((1 - b.maxY) * height), Int(b.width * width), Int(b.height * height)]
          }
          DispatchQueue.main.async { result(boxes) }
        } catch {
          DispatchQueue.main.async { result(FlutterError(code: "unavailable", message: error.localizedDescription, details: nil)) }
        }
      }
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
