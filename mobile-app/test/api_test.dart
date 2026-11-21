import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:maritime_heritage/api.dart';
import 'package:maritime_heritage/core.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Weak and missing connections (master plan, Section 8): retries, offline reading, the offline queue and uploads in pieces.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() { Api.retryWait = Duration.zero; Api.retries = 2; });

  group('retries', () {
    test('a read that fails because of the network is tried again', () async {
      var calls = 0;
      final api = Api('http://archive.test', client: MockClient((req) async { calls++; if (calls < 3) throw http.ClientException('down'); return http.Response('{"ok":true}', 200); }));
      expect(await api.get('/stories'), {'ok': true});
      expect(calls, 3);
    });

    test('a submission without a key is sent once only', () async {
      var calls = 0;
      final api = Api('http://archive.test', client: MockClient((req) async { calls++; throw http.ClientException('down'); }));
      await expectLater(api.post('/stories/1/comments', {'text': 'hello'}), throwsA(isA<ApiError>().having((e) => e.status, 'status', 0)));
      expect(calls, 1);
    });

    test('a submission with a key is tried again with the same key, so it cannot be duplicated', () async {
      final keys = <String?>[];
      final api = Api('http://archive.test', client: MockClient((req) async { keys.add(req.headers['Idempotency-Key']); if (keys.length < 3) throw http.ClientException('down'); return http.Response('{"id":"s1"}', 201); }));
      expect(await api.post('/stories', {'text': 'hello'}, 'key-1'), {'id': 's1'});
      expect(keys, ['key-1', 'key-1', 'key-1']);
    });

    test('a refusal from the archive is not retried', () async {
      var calls = 0;
      final api = Api('http://archive.test', client: MockClient((req) async { calls++; return http.Response('{"statusCode":400,"code":"invalid_input","message":"Check the form."}', 400); }));
      await expectLater(api.get('/stories'), throwsA(isA<ApiError>().having((e) => e.message, 'message', 'Check the form.').having((e) => e.code, 'code', 'invalid_input')));
      expect(calls, 1);
    });

    test('new keys are different each time', () {
      expect(Api.newKey(), hasLength(32));
      expect(Api.newKey(), isNot(Api.newKey()));
    });
  });

  group('offline reading', () {
    late Directory dir;
    setUp(() async { dir = await Directory.systemTemp.createTemp('answers'); });
    tearDown(() async { await dir.delete(recursive: true); });

    test('a page already seen is still readable offline, and only by the same person', () async {
      var down = false;
      final reached = <bool>[];
      final api = Api('http://archive.test', client: MockClient((req) async { if (down) throw http.ClientException('down'); return http.Response('{"items":[{"id":"s1"}]}', 200); }))
        ..cacheDir = dir.path..cacheOwner = 'amina'..onReach = reached.add;
      expect(await api.get('/stories', {'tab': 'trending'}), {'items': [{'id': 's1'}]});
      await Future<void>.delayed(const Duration(milliseconds: 100)); // the answer is kept in the background
      down = true;
      expect(await api.get('/stories', {'tab': 'trending'}), {'items': [{'id': 's1'}]});
      expect(reached.first, true);
      expect(reached.last, false);
      // A different page, a different language or a different person has nothing kept.
      await expectLater(api.get('/stories', {'tab': 'recent'}), throwsA(isA<ApiError>()));
      api.cacheOwner = 'omari';
      await expectLater(api.get('/stories', {'tab': 'trending'}), throwsA(isA<ApiError>()));
      api.cacheOwner = 'amina';
      api.language = 'sw';
      await expectLater(api.get('/stories', {'tab': 'trending'}), throwsA(isA<ApiError>()));
    });

    test('private settings are never kept, and signing out forgets everything', () async {
      var down = false;
      final api = Api('http://archive.test', client: MockClient((req) async { if (down) throw http.ClientException('down'); return http.Response('{"a":1}', 200); }))..cacheDir = dir.path;
      await api.get('/me/settings');
      await api.get('/announcements');
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(dir.listSync().length, 1);
      await api.clearCache();
      expect(dir.listSync(), isEmpty);
      down = true;
      await expectLater(api.get('/announcements'), throwsA(isA<ApiError>()));
    });
  });

  group('offline queue', () {
    test('an action made offline waits, is sent once when the connection returns, and keeps its key', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      var down = true;
      final got = <String>[];
      final api = Api('http://archive.test', client: MockClient((req) async {
        if (down) throw http.ClientException('down');
        got.add('${req.method} ${req.url.path} ${req.headers['Idempotency-Key']} ${req.body}');
        return req.url.path.endsWith('/refused') ? http.Response('{"statusCode":403,"code":"forbidden","message":"No."}', 403) : http.Response('{"ok":true}', 200);
      }));
      final box = Outbox(prefs, api);
      expect(await box.send('Comment', 'POST', '/stories/1/comments', {'text': 'hello'}), isNull);
      expect(await box.send('Reaction', 'PUT', '/stories/1/refused', {'type': 'heart'}), isNull);
      expect(await box.send('Reaction', 'PUT', '/stories/1/reaction', {'type': 'heart'}), isNull);
      expect(box.items.map((q) => q['label']), ['Comment', 'Reaction', 'Reaction']);
      await box.flush();
      expect(box.items, hasLength(3)); // still offline: nothing is lost
      down = false;
      final keys = box.items.map((q) => q['id']).toList();
      await box.flush();
      expect(box.items, isEmpty);
      expect(got, [
        'POST /api/v1/stories/1/comments ${keys[0]} {"text":"hello"}',
        'PUT /api/v1/stories/1/refused ${keys[1]} {"type":"heart"}',
        'PUT /api/v1/stories/1/reaction ${keys[2]} {"type":"heart"}',
      ]);
      // Online: sent straight away, nothing waits.
      expect(await box.send('Comment', 'POST', '/stories/1/comments', {'text': 'again'}), {'ok': true});
      expect(box.items, isEmpty);
    });

    test('a refusal while online is reported, not queued', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final api = Api('http://archive.test', client: MockClient((req) async => http.Response('{"statusCode":403,"code":"forbidden","message":"No."}', 403)));
      final box = Outbox(prefs, api);
      await expectLater(box.send('Comment', 'POST', '/stories/1/comments', {'text': 'x'}), throwsA(isA<ApiError>().having((e) => e.status, 'status', 403)));
      expect(box.items, isEmpty);
    });
  });

  group('uploads in pieces', () {
    late Directory dir;
    late File file;
    late Uint8List bytes;
    late List<int> arrived;
    late List<String> calls;
    var dropNext = false;
    void Function()? afterPiece;

    Api server() => Api('http://archive.test', client: MockClient((req) async {
          final path = req.url.path;
          calls.add('${req.method} $path');
          if (req.method == 'POST' && path == '/api/v1/uploads') {
            expect(req.headers['Upload-Length'], '${bytes.length}');
            expect(req.headers['Tus-Resumable'], '1.0.0');
            return http.Response('', 201, headers: {'location': 'http://archive.test/api/v1/uploads/u1', 'upload-offset': '0'});
          }
          if (req.method == 'HEAD') return http.Response('', 200, headers: {'upload-offset': '${arrived.length}'});
          if (req.method == 'PATCH') {
            if (dropNext) { dropNext = false; throw http.ClientException('dropped'); }
            if (req.headers['Upload-Offset'] != '${arrived.length}') return http.Response('', 409, headers: {'upload-offset': '${arrived.length}'});
            expect(req.headers['Content-Type'], startsWith('application/offset+octet-stream'));
            arrived.addAll(req.bodyBytes);
            afterPiece?.call();
            return http.Response('', 204, headers: {'upload-offset': '${arrived.length}'});
          }
          if (req.method == 'GET' && path == '/api/v1/uploads/u1') return http.Response('{"complete":true,"media":{"id":"m1","kind":"video"}}', 200);
          if (req.method == 'DELETE') return http.Response('', 204);
          return http.Response('{}', 404);
        }));

    setUp(() async {
      dir = await Directory.systemTemp.createTemp('upload');
      bytes = Uint8List.fromList(List.generate(4500000, (i) => (i * 31 + i ~/ 7) % 251));
      file = File('${dir.path}/film.mp4');
      await file.writeAsBytes(bytes);
      arrived = [];
      calls = [];
      dropNext = false;
      afterPiece = null;
    });
    tearDown(() async { await dir.delete(recursive: true); });

    test('a large file arrives whole, piece by piece', () async {
      final t = UploadTask(LocalFile(file.path, 'film.mp4', bytes.length), 'story');
      await server().runUpload(t);
      expect(t.state, 'done');
      expect(t.pct, 1);
      expect(t.media, {'id': 'm1', 'kind': 'video'});
      expect(arrived, bytes);
      expect(calls.where((c) => c.startsWith('PATCH')).length, 5);
    });

    test('a dropped connection continues from where it stopped', () async {
      final t = UploadTask(LocalFile(file.path, 'film.mp4', bytes.length), 'story');
      var pieces = 0;
      afterPiece = () { if (++pieces == 2) dropNext = true; };
      await server().runUpload(t);
      expect(t.state, 'done');
      expect(arrived, bytes);
    });

    test('pause stops after the piece being sent, and resume finishes the same upload', () async {
      final t = UploadTask(LocalFile(file.path, 'film.mp4', bytes.length), 'story');
      final api = server();
      var pieces = 0;
      afterPiece = () { if (++pieces == 2) t.hold('paused'); };
      await api.runUpload(t);
      expect(t.state, 'paused');
      expect(arrived.length, 2 * 1024 * 1024);
      afterPiece = null;
      await api.runUpload(t);
      expect(t.state, 'done');
      expect(arrived, bytes);
      expect(calls.where((c) => c == 'POST /api/v1/uploads').length, 1);
    });

    test('cancel stops the upload and removes what the archive has of it', () async {
      final t = UploadTask(LocalFile(file.path, 'film.mp4', bytes.length), 'story');
      final api = server();
      afterPiece = () => api.cancelUpload(t);
      await api.runUpload(t);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(t.state, 'cancelled');
      expect(arrived.length, lessThan(bytes.length));
      expect(calls, contains('DELETE /api/v1/uploads/u1'));
    });

    test('a refusal from the archive is reported on the upload', () async {
      final t = UploadTask(LocalFile(file.path, 'film.mp4', bytes.length), 'story');
      final api = Api('http://archive.test', client: MockClient((req) async => http.Response('{"statusCode":413,"code":"file_too_large","message":"This file is too large. The maximum for a video is 200 MB."}', 413)));
      await api.runUpload(t);
      expect(t.state, 'failed');
      expect(t.error, 'This file is too large. The maximum for a video is 200 MB.');
    });
  });
}
