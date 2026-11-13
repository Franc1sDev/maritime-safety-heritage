import 'package:flutter_test/flutter_test.dart';
import 'package:maritime_heritage/state.dart';

void main() {
  test('formats and parses times', () {
    expect(fmtTime(214), '3:34');
    expect(fmtTime(3725), '1:02:05');
    expect(parseTime('1:05'), 65);
    expect(parseTime('x'), isNull);
  });

  test('reads an archive item from the API', () {
    final r = Rec.fromJson({
      'id': 'a', 'identifier': 'MSH-0001', 'type': 'oral', 'format': 'audio', 'title': 'Night crossings', 'summary': 's',
      'year': 1987, 'waterBody': {'id': 1, 'name': 'Indian Ocean coast'}, 'place': 'Likoni', 'county': 'Mombasa',
      'latitude': -4.07, 'longitude': 39.66, 'subjects': [], 'views': 3,
      'transcript': [{'startSeconds': 0, 'text': 'Hello'}],
      'media': [{'id': 'm', 'mimeType': 'audio/mpeg', 'originalName': 'a.mp3', 'sizeBytes': 10, 'url': '/api/v1/media/file/m?exp=1&sig=x'}],
    });
    expect(r.placeText, 'Likoni, Mombasa');
    expect(r.waterName, 'Indian Ocean coast');
    expect(r.media.single.isAudio, isTrue);
    expect(r.transcript.single.text, 'Hello');
  });
}
