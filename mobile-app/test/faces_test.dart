import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:maritime_heritage/faces.dart';

/// The blurring itself (the face finding is the phone's own and is checked on real devices).
void main() {
  img.Image photo() {
    // A sharp checkerboard: easy to tell whether detail survived.
    final im = img.Image(width: 200, height: 160);
    for (var y = 0; y < im.height; y++) {
      for (var x = 0; x < im.width; x++) {
        final on = ((x ~/ 2) + (y ~/ 2)).isEven;
        im.setPixelRgb(x, y, on ? 255 : 0, on ? 255 : 0, on ? 255 : 0);
      }
    }
    return im;
  }

  double detail(img.Image im, int x0, int y0, int w, int h) {
    var sum = 0.0;
    for (var y = y0; y < y0 + h; y++) {
      for (var x = x0; x < x0 + w - 1; x++) {
        sum += (im.getPixel(x, y).r - im.getPixel(x + 1, y).r).abs();
      }
    }
    return sum / (w * h);
  }

  test('a face box loses its detail, and the rest of the photo is untouched', () {
    final im = photo();
    final before = detail(im, 60, 50, 40, 40), outside = detail(im, 0, 0, 20, 20);
    expect(blurRegion(im, 60, 50, 40, 40), isTrue);
    expect(detail(im, 60, 50, 40, 40), lessThan(before * 0.2));
    expect(detail(im, 0, 0, 20, 20), outside);
  });

  test('a box at the edge is clipped to the photo, and a box outside it is ignored', () {
    final im = photo();
    expect(blurRegion(im, 180, 140, 60, 60), isTrue);
    expect(im.width, 200);
    expect(im.height, 160);
    expect(blurRegion(im, 400, 400, 20, 20), isFalse);
  });
}
