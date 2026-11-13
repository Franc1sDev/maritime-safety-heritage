import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// An error the archive's API returned, with a message that can be shown to people.
class ApiError implements Exception {
  final int status;
  final String message;
  ApiError(this.status, this.message);
  @override
  String toString() => message;
}

/// A file chosen on the phone, ready to upload.
class LocalFile {
  final String path, name;
  final int size;
  LocalFile(this.path, this.name, this.size);
}

/// Talks to the archive's secure API.
/// The access token is kept in memory only. The refresh token is kept in the phone's
/// secure storage (Android Keystore / iOS Keychain) and rotated on every use.
class Api {
  Api(this.base);

  String base;
  String? _access;
  DateTime _accessExpires = DateTime.fromMillisecondsSinceEpoch(0);
  String? _refresh;
  Future<bool>? _refreshing;
  void Function()? onSignedOut;

  static const _store = FlutterSecureStorage();
  static const _refreshKey = 'msh_refresh_token';
  static const _timeout = Duration(seconds: 30);
  final _client = http.Client();

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

  Future<dynamic> request(String method, String path, {Object? body, Map<String, Object?>? query, bool retry = true}) async {
    if (!path.startsWith('/auth/')) await _ensureFresh();
    final req = http.Request(method, _uri(path, query))..headers.addAll(_headers(json: body != null));
    if (body != null) req.body = jsonEncode(body);
    http.Response res;
    try {
      res = await http.Response.fromStream(await _client.send(req).timeout(_timeout));
    } on TimeoutException {
      throw ApiError(0, 'The archive is taking too long to answer. Try again.');
    } catch (_) {
      throw ApiError(0, _message(null, 0));
    }
    if (res.statusCode == 401 && retry && !path.startsWith('/auth/') && _refresh != null) {
      if (await refresh()) return request(method, path, body: body, query: query, retry: false);
      await _clear();
      onSignedOut?.call();
    }
    final data = _decode(res.body);
    if (res.statusCode >= 400) throw ApiError(res.statusCode, _message(data, res.statusCode));
    return data;
  }

  Future<dynamic> get(String path, [Map<String, Object?>? query]) => request('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => request('POST', path, body: body ?? const {});
  Future<dynamic> patch(String path, Object body) => request('PATCH', path, body: body);
  Future<dynamic> delete(String path) => request('DELETE', path);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final s = await request('POST', '/auth/login', body: {'email': email, 'password': password}) as Map<String, dynamic>;
    _setSession(s);
    return s['user'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register(Map<String, Object?> data) async {
    final s = await request('POST', '/auth/register', body: data) as Map<String, dynamic>;
    _setSession(s);
    return s['user'] as Map<String, dynamic>;
  }

  Future<void> logout({bool everywhere = false}) async {
    try {
      if (everywhere) {
        await request('POST', '/auth/logout-all', body: const {});
      } else if (_refresh != null) {
        await request('POST', '/auth/logout', body: {'refreshToken': _refresh});
      }
    } catch (_) {/* signed out on this phone anyway */}
    await _clear();
  }

  /// Ends the session on this phone only (for example after a password change).
  Future<void> forget() => _clear();

  /// Multipart upload with progress. [fileField] is "files" for submissions and "file" for admin uploads.
  Future<dynamic> upload(String path, Map<String, String> fields, List<LocalFile> files,
      {String fileField = 'files', void Function(double)? onProgress}) async {
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
    if (res.statusCode >= 400) throw ApiError(res.statusCode, _message(data, res.statusCode));
    return data;
  }
}
