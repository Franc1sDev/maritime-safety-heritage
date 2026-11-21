import 'dart:async';
import 'dart:convert';
import 'dart:io' show Directory, File;
import 'dart:math' show Random;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// An error the archive's API returned, with a message that can be shown to people.
class ApiError implements Exception {
  final int status;
  final String message;
  /// The server's short code for the error (for example account_suspended) and any extra details.
  final String code;
  final dynamic details;
  ApiError(this.status, this.message, {this.code = '', this.details});
  @override
  String toString() => message;
}

/// A file chosen on the phone, ready to upload.
class LocalFile {
  final String path, name;
  final int size;
  LocalFile(this.path, this.name, this.size);
}

/// One upload that can be paused, resumed and cancelled (Section 8.4). Large files go in pieces
/// (the tus protocol) and continue from where they stopped; small ones go in one request.
class UploadTask {
  UploadTask(this.file, this.purpose);
  final LocalFile file;
  final String purpose;
  /// waiting, sending, paused, wifi (waiting for Wi-Fi), done, failed or cancelled
  String state = 'waiting';
  double pct = 0;
  String? error;
  Map<String, dynamic>? media;
  /// The server's id for a large upload, kept so it can continue later.
  String? id;
  bool _halt = false;
  void Function()? onChange;
  bool get active => state == 'waiting' || state == 'sending' || state == 'paused' || state == 'wifi';
  bool get large => file.size >= Api.pieceThreshold;
  void mark(String s, {String? err}) { state = s; error = err; onChange?.call(); }
  /// Stops after the piece being sent. [to] is paused or wifi.
  void hold(String to) { _halt = true; _holdAs = to; if (state != 'sending' || !large) mark(to); }
  String _holdAs = 'paused';
}

/// Talks to the archive's secure API.
/// The access token is kept in memory only. The refresh token is kept in the phone's
/// secure storage (Android Keystore / iOS Keychain) and rotated on every use.
class Api {
  Api(this.base, {http.Client? client}) : _client = client ?? http.Client();

  String base;
  String? _access;
  DateTime _accessExpires = DateTime.fromMillisecondsSinceEpoch(0);
  String? _refresh;
  Future<bool>? _refreshing;
  void Function()? onSignedOut;
  /// The reader's language, so the server answers in it.
  String language = 'en';
  static const appVersion = '2.0.0';

  static const _store = FlutterSecureStorage();
  static const _refreshKey = 'msh_refresh_token';
  static const _timeout = Duration(seconds: 30);
  final http.Client _client;

  // ---- Weak and missing connections (Section 8) ----
  /// How many times a request that failed because of the network is tried again, and the first wait (it doubles each time).
  static int retries = 2;
  static Duration retryWait = const Duration(milliseconds: 600);
  /// Folder where answers are kept, so pages already seen can still be read offline. Set by the app at start.
  String? cacheDir;
  /// Whose answers they are: one person's pages are never shown to another.
  String cacheOwner = 'visitor';
  /// Told true when the archive answers and false when it cannot be reached.
  void Function(bool reached)? onReach;
  /// Told how long each read took, so a slow connection can be noticed.
  void Function(Duration took)? onTiming;

  /// A fresh key for a submission, so a retry never creates a duplicate.
  static String newKey() { final r = Random.secure(); return List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join(); }

  static final _keep = RegExp(r'^/(config|stories|incidents|announcements|resources|collections|timeline|places|contributors|people|inbox|me/stories|me/notifications|me/reminders)(/|$)');
  File? _cacheFile(Uri uri) {
    final dir = cacheDir;
    if (dir == null) return null;
    // FNV-1a hash of the address, language and owner: a short, safe file name.
    var h = 0x811c9dc5;
    for (final c in utf8.encode('$cacheOwner|$language|$uri')) { h = ((h ^ c) * 0x01000193) & 0xffffffff; }
    return File('$dir/${h.toRadixString(16).padLeft(8, '0')}.json');
  }
  Future<void> _remember(Uri uri, String body) async {
    try { await _cacheFile(uri)?.writeAsString(jsonEncode({'for': '$cacheOwner|$language|$uri', 'body': body}), flush: false); } catch (_) {/* a full disk must not break reading */}
  }
  Future<dynamic> _remembered(Uri uri) async {
    try {
      final f = _cacheFile(uri);
      if (f == null || !await f.exists()) return null;
      final saved = jsonDecode(await f.readAsString());
      if (saved is! Map || saved['for'] != '$cacheOwner|$language|$uri') return null;
      return _decode(saved['body'] as String);
    } catch (_) { return null; }
  }
  /// Forgets everything kept for offline reading (on sign-out), or only the oldest when there is a lot.
  Future<void> clearCache({bool all = true}) async {
    final dir = cacheDir;
    if (dir == null) return;
    try {
      final files = await Directory(dir).list().where((e) => e is File && e.path.endsWith('.json')).cast<File>().toList();
      if (all) { for (final f in files) { await f.delete(); } return; }
      if (files.length <= 400) return;
      final dated = [for (final f in files) (f, await f.lastModified())]..sort((a, b) => a.$2.compareTo(b.$2));
      for (final (f, _) in dated.take(files.length - 300)) { await f.delete(); }
    } catch (_) {}
  }

  bool get hasSession => _refresh != null;

  /// Turns a link from the API (often relative) into a full address.
  String abs(String url) => url.startsWith('http') ? url : '$base$url';

  Uri _uri(String path, [Map<String, Object?>? query]) {
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v == null) return;
      final s = v is List ? v.join(',') : '$v';
      if (s.isNotEmpty) q[k] = s;
    });
    final u = Uri.parse('$base/api/v1$path');
    return q.isEmpty ? u : u.replace(queryParameters: q);
  }

  Map<String, String> _headers({bool json = false}) => {
        'X-Client': 'app',
        'X-App-Version': appVersion,
        'X-Language': language,
        'Accept': 'application/json',
        if (json) 'Content-Type': 'application/json',
        if (_access != null) 'Authorization': 'Bearer $_access',
      };

  static String _message(dynamic body, int status) {
    final m = body is Map ? body['message'] : null;
    if (m is List) return m.join(' ');
    if (m is String && m.isNotEmpty) return m;
    if (status == 0) return "Can't reach the archive. Check your internet connection and the server address.";
    if (status == 413) return 'That file is too large.';
    return 'Something went wrong (error $status). Try again.';
  }

  static dynamic _decode(String text) {
    if (text.isEmpty) return null;
    try { return jsonDecode(text); } catch (_) { return null; }
  }

  void _setSession(Map<String, dynamic> s) {
    _access = s['accessToken'] as String?;
    final secs = (s['expiresIn'] as num?)?.toInt() ?? 900;
    _accessExpires = DateTime.now().add(Duration(seconds: secs - 30));
    final r = s['refreshToken'] as String?;
    if (r != null) {
      _refresh = r;
      _store.write(key: _refreshKey, value: r);
    }
  }

  Future<void> _clear() async {
    _access = null;
    _refresh = null;
    _accessExpires = DateTime.fromMillisecondsSinceEpoch(0);
    await _store.delete(key: _refreshKey);
  }

  /// Loads a saved session. Returns the signed-in user, or null.
  Future<Map<String, dynamic>?> restore() async {
    try { _refresh = await _store.read(key: _refreshKey); } catch (_) { _refresh = null; }
    if (_refresh == null) return null;
    final s = await _doRefresh();
    return s;
  }

  Future<Map<String, dynamic>?> _doRefresh() async {
    final token = _refresh;
    if (token == null) return null;
    try {
      final res = await _client.post(_uri('/auth/refresh'), headers: {'X-Client': 'app', 'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': token})).timeout(_timeout);
      final body = _decode(res.body);
      if (res.statusCode == 200 && body is Map<String, dynamic>) {
        _setSession(body);
        return body['user'] as Map<String, dynamic>?;
      }
      if (res.statusCode == 401) await _clear();
      return null;
    } catch (_) {
      return null; // offline: keep the saved token for next time
    }
  }

  /// Gets a new access token. Callers at the same moment share one attempt.
  Future<bool> refresh() {
    return _refreshing ??= _doRefresh().then((u) => u != null).whenComplete(() => _refreshing = null);
  }

  Future<void> _ensureFresh() async {
    if (_refresh != null && (_access == null || DateTime.now().isAfter(_accessExpires))) await refresh();
  }

  /// One call to the archive.
  /// Reads, and submissions that carry a [key], are tried again after a network failure, waiting longer each time;
  /// the key makes sure a retry never creates a duplicate. A read that still fails is answered from what was
  /// kept the last time it worked, so pages already seen stay readable offline.
  Future<dynamic> request(String method, String path, {Object? body, Map<String, Object?>? query, bool retry = true, String? key}) async {
    if (!path.startsWith('/auth/')) await _ensureFresh();
    final uri = _uri(path, query);
    final read = method == 'GET';
    final again = read || key != null;
    final keep = read && _keep.hasMatch(path);
    final started = DateTime.now();
    late http.Response res;
    for (var attempt = 0; ; attempt++) {
      final req = http.Request(method, uri)..headers.addAll(_headers(json: body != null));
      if (key != null) req.headers['Idempotency-Key'] = key;
      if (body != null) req.body = jsonEncode(body);
      try {
        res = await http.Response.fromStream(await _client.send(req).timeout(_timeout));
        if (again && attempt < retries && res.statusCode >= 502 && res.statusCode <= 504) { await Future<void>.delayed(retryWait * (1 << attempt)); continue; }
        break;
      } catch (e) {
        final slow = e is TimeoutException;
        if (again && !slow && attempt < retries) { await Future<void>.delayed(retryWait * (1 << attempt)); continue; }
        onReach?.call(false);
        if (keep) { final saved = await _remembered(uri); if (saved != null) return saved; }
        throw ApiError(0, slow ? 'The archive is taking too long to answer. Try again.' : _message(null, 0));
      }
    }
    onReach?.call(true);
    if (read) onTiming?.call(DateTime.now().difference(started));
    if (res.statusCode == 401 && retry && !path.startsWith('/auth/') && _refresh != null) {
      if (await refresh()) return request(method, path, body: body, query: query, retry: false, key: key);
      await _clear();
      onSignedOut?.call();
    }
    final data = _decode(res.body);
    if (res.statusCode >= 400) throw ApiError(res.statusCode, _message(data, res.statusCode), code: data is Map ? '${data['code'] ?? ''}' : '', details: data is Map ? data['details'] : null);
    if (keep) unawaited(_remember(uri, res.body));
    return data;
  }

  Future<dynamic> get(String path, [Map<String, Object?>? query]) => request('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body, String? key]) => request('POST', path, body: body ?? const {}, key: key);
  Future<dynamic> patch(String path, Object body) => request('PATCH', path, body: body);
  Future<dynamic> put(String path, [Object? body]) => request('PUT', path, body: body ?? const {});

  /// Starts a session from a sign-in answer (Google, Apple, admin code, restored account).
  void useSession(Map<String, dynamic> s) => _setSession(s);
  Future<dynamic> delete(String path) => request('DELETE', path);

  /// Sign in with Google or Apple: the server checks the ID token they gave the app. The answer also says whether the account is new.
  Future<Map<String, dynamic>> oauth(String provider, String idToken, {String? name}) async {
    final s = await request('POST', '/auth/oauth/$provider', body: {'idToken': idToken, if (name != null && name.trim().isNotEmpty) 'name': name.trim()}) as Map<String, dynamic>;
    _setSession(s);
    return s;
  }

  Future<void> logout({bool everywhere = false}) async {
    try {
      if (everywhere) {
        await request('POST', '/auth/sessions/end-all', body: const {});
      } else if (_refresh != null) {
        await request('POST', '/auth/logout', body: {'refreshToken': _refresh});
      }
    } catch (_) {/* signed out on this phone anyway */}
    await _clear();
  }

  /// Ends the session on this phone only (for example after a password change).
  Future<void> forget() => _clear();

  /// Uploads one file (story, comment, message, avatar, concern …) and returns the stored file.
  Future<Map<String, dynamic>> uploadFile(LocalFile f, String purpose, {void Function(double)? onProgress, String path = '/media', String field = 'file'}) async =>
      (await upload(path, {'purpose': purpose}, [f], fileField: field, onProgress: onProgress)) as Map<String, dynamic>;

  // ---- Uploads in pieces (tus) ----
  static const pieceThreshold = 4000000;
  static const _piece = 1024 * 1024;

  Future<http.Response> _tusCall(String method, String path, Map<String, String> headers, [List<int>? body]) async {
    await _ensureFresh();
    final req = http.Request(method, _uri(path))..headers.addAll(_headers())..headers.addAll({'Tus-Resumable': '1.0.0', ...headers});
    if (body != null) req.bodyBytes = body;
    try {
      return await http.Response.fromStream(await _client.send(req).timeout(const Duration(minutes: 2)));
    } catch (_) {
      throw ApiError(0, 'The upload was interrupted. Check your connection and try again.');
    }
  }

  ApiError _tusError(http.Response r) { final data = _decode(r.body); return ApiError(r.statusCode, _message(data, r.statusCode), code: data is Map ? '${data['code'] ?? ''}' : ''); }

  /// Sends (or continues) one upload. Returns when it is done, paused, failed or cancelled; the task says which.
  Future<void> runUpload(UploadTask t) async {
    if (t.state == 'sending' || t.state == 'done' || t.state == 'cancelled') return;
    t._halt = false;
    t._holdAs = 'paused';
    t.mark('sending');
    try {
      if (!t.large) {
        final m = await uploadFile(t.file, t.purpose, onProgress: (p) { t.pct = p * .98; t.onChange?.call(); });
        if (t.state == 'cancelled') return;
        t.media = m;
      } else {
        final m = await _sendInPieces(t);
        if (t.state == 'cancelled') return;
        if (m == null) { t.mark(t._holdAs); return; }
        t.media = m;
      }
      t.pct = 1;
      t.mark('done');
    } catch (e) {
      if (t.state != 'cancelled') t.mark('failed', err: e is ApiError ? e.message : 'The upload was interrupted. Check your connection and try again.');
    }
  }

  Future<Map<String, dynamic>?> _sendInPieces(UploadTask t) async {
    String b64(String s) => base64.encode(utf8.encode(s));
    final size = t.file.size;
    if (t.id == null) {
      final r = await _tusCall('POST', '/uploads', {'Upload-Length': '$size', 'Upload-Metadata': 'filename ${b64(t.file.name)},purpose ${b64(t.purpose)}'});
      if (r.statusCode >= 400) throw _tusError(r);
      t.id = (r.headers['location'] ?? '').split('/').last;
      if (t.id!.isEmpty) { t.id = null; throw ApiError(0, 'The upload was interrupted. Check your connection and try again.'); }
    }
    Future<int> arrived() async {
      final r = await _tusCall('HEAD', '/uploads/${t.id}', const {});
      if (r.statusCode == 404) { t.id = null; throw ApiError(404, 'The upload was interrupted. Check your connection and try again.'); }
      if (r.statusCode >= 400) throw _tusError(r);
      return int.tryParse(r.headers['upload-offset'] ?? '') ?? 0;
    }
    var offset = await arrived();
    final file = await File(t.file.path).open();
    try {
      var fails = 0;
      while (offset < size) {
        if (t._halt) return null;
        await file.setPosition(offset);
        final bytes = await file.read(size - offset < _piece ? size - offset : _piece);
        try {
          final r = await _tusCall('PATCH', '/uploads/${t.id}', {'Upload-Offset': '$offset', 'Content-Type': 'application/offset+octet-stream'}, bytes);
          if (r.statusCode == 409) { offset = int.tryParse(r.headers['upload-offset'] ?? '') ?? await arrived(); continue; }
          if (r.statusCode >= 500) throw ApiError(0, 'The upload was interrupted. Check your connection and try again.');
          if (r.statusCode >= 400) throw _tusError(r);
          offset = int.tryParse(r.headers['upload-offset'] ?? '') ?? offset + bytes.length;
          fails = 0;
          t.pct = offset / size * .98;
          t.onChange?.call();
        } on ApiError catch (e) {
          // A dropped connection: wait a little, ask the server how much arrived, and carry on from there.
          if (e.status != 0 || ++fails > 6) rethrow;
          await Future<void>.delayed(retryWait * (3 * fails));
          if (t._halt) return null;
          try { offset = await arrived(); } on ApiError catch (e2) { if (e2.status != 0) rethrow; }
        }
      }
    } finally {
      await file.close();
    }
    final done = await get('/uploads/${t.id}');
    final m = done is Map ? done['media'] : null;
    if (m is! Map<String, dynamic>) throw ApiError(0, 'The upload was interrupted. Check your connection and try again.');
    return m;
  }

  /// Cancels an upload and removes what the server has of it.
  void cancelUpload(UploadTask t) {
    t._halt = true;
    final id = t.id;
    t.mark('cancelled');
    if (id != null && t.media == null) _tusCall('DELETE', '/uploads/$id', const {}).then((_) {}, onError: (_) {});
  }

  /// Multipart upload with progress.
  Future<dynamic> upload(String path, Map<String, String> fields, List<LocalFile> files,
      {String fileField = 'file', void Function(double)? onProgress}) async {
    await _ensureFresh();
    final mr = http.MultipartRequest('POST', _uri(path))..fields.addAll(fields);
    for (final f in files) {
      mr.files.add(await http.MultipartFile.fromPath(fileField, f.path, filename: f.name));
    }
    final total = mr.contentLength;
    final stream = mr.finalize();
    final sr = http.StreamedRequest('POST', mr.url)
      ..headers.addAll(_headers())
      ..headers.addAll(mr.headers)
      ..contentLength = total;
    var sent = 0;
    stream.listen((chunk) {
      sent += chunk.length;
      onProgress?.call(total == 0 ? 1 : sent / total);
      sr.sink.add(chunk);
    }, onDone: () => sr.sink.close(), onError: (Object e) => sr.sink.addError(e), cancelOnError: true);
    http.Response res;
    try {
      res = await http.Response.fromStream(await _client.send(sr).timeout(const Duration(minutes: 30)));
    } catch (_) {
      throw ApiError(0, 'The upload was interrupted. Check your connection and try again.');
    }
    final data = _decode(res.body);
    if (res.statusCode >= 400) throw ApiError(res.statusCode, _message(data, res.statusCode), code: data is Map ? '${data['code'] ?? ''}' : '', details: data is Map ? data['details'] : null);
    return data;
  }
}
