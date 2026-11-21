import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

/// “Blur faces in the photos I add next” (master plan, Section 4.4).
/// The phone's own face finder is used (Apple Vision on iPhone, Google's on-device detection through Play services
/// on Android), so the photo never leaves the phone to be checked. The faces are pixelated and blurred before the
/// photo is uploaded, and the copy that is sent carries no camera data.
class FaceBlur {
  static const _channel = MethodChannel('msh/faces');

  /// A new photo with every face found blurred, and how many faces were found.
  /// Throws [FaceBlurUnavailable] when the phone cannot look for faces; the caller then does not send the photo.
  static Future<({String path, int faces})> blur(String path) async {
    final dir = await getTemporaryDirectory();
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final upright = '${dir.path}/upright-$stamp.jpg';
    // Saved upright first, so the face finder and the blurring read the same pixels the same way up.
    final ok = await compute(_saveUpright, [path, upright]);
    if (!ok) throw FaceBlurUnavailable('unreadable');
    List<List<int>> boxes;
    try {
      final raw = await _channel.invokeMethod<List<Object?>>('find', {'path': upright});
      boxes = [for (final b in raw ?? const <Object?>[]) [for (final v in (b as List)) (v as num).toInt()]];
    } on PlatformException catch (e) {
      throw FaceBlurUnavailable(e.code);
    } on MissingPluginException {
      throw FaceBlurUnavailable('unsupported');
    }
    if (boxes.isEmpty) return (path: upright, faces: 0);
    final out = '${dir.path}/faces-blurred-$stamp.jpg';
    final done = await compute(_blurBoxes, [upright, out, boxes]);
    if (!done) throw FaceBlurUnavailable('unreadable');
    return (path: out, faces: boxes.length);
  }
}

class FaceBlurUnavailable implements Exception {
  FaceBlurUnavailable(this.code);
  final String code;
  @override
  String toString() => 'Faces could not be blurred ($code)';
}

/// Decodes the photo, turns it the right way up, removes its camera data and saves it as JPEG.
bool _saveUpright(List<Object> a) {
  final image = img.decodeImage(File(a[0] as String).readAsBytesSync());
  if (image == null) return false;
  final upright = img.bakeOrientation(image)..exif = img.ExifData();
  File(a[1] as String).writeAsBytesSync(img.encodeJpg(upright, quality: 88));
  return true;
}

/// Pixelates and blurs each face box, with a margin so hair, ears and chin are covered too.
bool _blurBoxes(List<Object> a) {
  final image = img.decodeJpg(File(a[0] as String).readAsBytesSync());
  if (image == null) return false;
  for (final b in a[2] as List<List<int>>) {
    blurRegion(image, b[0], b[1], b[2], b[3]);
  }
  image.exif = img.ExifData();
  File(a[1] as String).writeAsBytesSync(img.encodeJpg(image, quality: 88));
  return true;
}

/// Hides one face in [image] in place. Public so it can be tested. Returns false for a box outside the photo.
@visibleForTesting
bool blurRegion(img.Image image, int left, int top, int width, int height) {
  final mx = (width * 0.25).round(), my = (height * 0.3).round();
  final x = math.max(0, left - mx), y = math.max(0, top - my);
  final w = math.min(image.width - x, width + 2 * mx), h = math.min(image.height - y, height + 2 * my);
  if (w <= 1 || h <= 1) return false;
  final face = img.copyCrop(image, x: x, y: y, width: w, height: h);
  // Pixelating removes the detail; blurring then hides the block edges. Both scale with the face.
  img.pixelate(face, size: math.max(6, math.min(w, h) ~/ 7));
  img.gaussianBlur(face, radius: math.max(4, math.min(w, h) ~/ 18));
  img.compositeImage(image, face, dstX: x, dstY: y);
  return true;
}
