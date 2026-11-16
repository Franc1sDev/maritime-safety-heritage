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

  test('reads notifications, reminders and replies', () {
    final n = Note.fromJson({
      'id': 'n1', 'kind': 'reminder', 'title': 'Reminder: Call the beach unit', 'summary': 'Ask about lifejackets', 'body': 'Ask about lifejackets at Dunga beach',
      'link': '#/reminders', 'requiresAction': true, 'actionKey': 'reminder:r1', 'actionLabel': 'Mark as done', 'viewed': false, 'done': false,
      'createdAt': '2026-11-15T15:00:00Z',
    });
    expect(n.target, 'r1');
    expect(n.requiresAction, isTrue);
    expect(n.hasMore, isTrue);
    final r = Reminder.fromJson({'id': 'r1', 'subject': 'Call', 'description': '', 'dueAt': '2026-11-15T16:00:00Z', 'fired': true, 'done': false});
    expect(r.fired && !r.done, isTrue);
    final m = Message.fromJson({'id': 'm1', 'subject': 'Hours', 'body': 'When?', 'reply': 'Monday to Friday', 'new': true});
    expect(m.reply, 'Monday to Friday');
    expect(m.isNew, isTrue);
  });

  test('knows when an account has no password yet (made with Google or Apple)', () {
    expect(AppUser.fromJson({'id': 'u1', 'name': 'Wanjiru Kamau', 'hasPassword': false}).hasPassword, isFalse);
    expect(AppUser.fromJson({'id': 'u2', 'name': 'Otieno'}).hasPassword, isTrue);
  });
}
