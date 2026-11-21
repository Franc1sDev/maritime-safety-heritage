import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

export 'api.dart';

/// Kinds of archive material.
class MType {
  final String key, label, plural;
  final IconData icon;
  const MType(this.key, this.label, this.plural, this.icon);
}

const types = <String, MType>{
  'oral': MType('oral', 'Oral history', 'Oral histories', Icons.mic_none_rounded),
  'photo': MType('photo', 'Photograph', 'Photographs', Icons.photo_camera_outlined),
  'record': MType('record', 'Record or report', 'Records', Icons.description_outlined),
  'testimony': MType('testimony', 'Testimony', 'Testimonies', Icons.format_quote_rounded),
};

const formats = <String, (IconData, String)>{
  'audio': (Icons.headphones_outlined, 'Audio'),
  'video': (Icons.videocam_outlined, 'Video'),
  'image': (Icons.image_outlined, 'Image'),
  'document': (Icons.description_outlined, 'Document'),
  'text': (Icons.notes_rounded, 'Text'),
};

const waterIcons = <String, IconData>{
  'Indian Ocean coast': Icons.waves_rounded,
  'Lake Victoria': Icons.set_meal_outlined,
  'Lake Turkana': Icons.wb_sunny_outlined,
  'Lake Naivasha': Icons.sailing_outlined,
  'Lake Baringo': Icons.explore_outlined,
  'Rivers': Icons.water_outlined,
};

String fmtTime(num sec) {
  final s = sec.floor().clamp(0, 1 << 30);
  final h = s ~/ 3600, m = (s % 3600) ~/ 60, r = (s % 60).toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$r' : '$m:$r';
}

int? parseTime(String t) {
  final p = t.trim().split(':').map(int.tryParse).toList();
  if (p.isEmpty || p.length > 3 || p.any((n) => n == null)) return null;
  return p.fold<int>(0, (a, n) => a * 60 + n!);
}

String fmtSize(int b) => b < 1024 * 1024 ? '${(b / 1024).ceil()} KB' : '${(b / 1024 / 1024).toStringAsFixed(1)} MB';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String fmtDate(DateTime? d) => d == null ? '' : '${d.toLocal().day} ${_months[d.toLocal().month - 1]} ${d.toLocal().year}';
String fmtDateTime(DateTime? d) {
  if (d == null) return '';
  final l = d.toLocal();
  return '${fmtDate(l)}, ${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

String _s(dynamic v, [String d = '']) => v == null ? d : v.toString();
int _i(dynamic v, [int d = 0]) => v is num ? v.toInt() : int.tryParse('$v') ?? d;
int? _in(dynamic v) => v == null ? null : _i(v);
double? _dn(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}');
DateTime? _dt(dynamic v) => v == null ? null : DateTime.tryParse('$v');
List<Map<String, dynamic>> _list(dynamic v) => (v as List? ?? const []).whereType<Map<String, dynamic>>().toList();

class WaterBody {
  final int id;
  final String name;
  WaterBody(this.id, this.name);
}

class Subject {
  final int id;
  final String slug, label;
  Subject(this.id, this.slug, this.label);
}

class MediaFile {
  final String id, role, name, mime, sha256, url;
  final int size;
  final DateTime? created;
  MediaFile.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), role = _s(j['role'], 'original'), name = _s(j['originalName']), mime = _s(j['mimeType']),
        sha256 = _s(j['sha256']), url = _s(j['url']), size = _i(j['sizeBytes']), created = _dt(j['createdAt']);
  bool get isAudio => mime.startsWith('audio/');
  bool get isVideo => mime.startsWith('video/');
  bool get isImage => mime.startsWith('image/');
  IconData get icon => isAudio ? Icons.headphones_outlined : isVideo ? Icons.videocam_outlined : isImage ? Icons.image_outlined : Icons.description_outlined;
}

class Segment {
  final int start;
  final String text;
  Segment(this.start, this.text);
}

/// An archive item. List results carry the summary fields; the detail view adds the rest.
class Rec {
  final String id, identifier, type, format, title, summary, county, place, status;
  final int? year, durationSeconds;
  final bool yearApproximate;
  final WaterBody? water;
  final String waterName;
  final double? lat, lng;
  final List<Subject> subjects;
  final int views;
  final DateTime? publishedAt, createdAt;
  final String? snippet, body, creator, narrator, interviewer, photographer, language, rights, consent, citation;
  final List<Segment> transcript;
  final List<MediaFile> media;
  final List<Rec> related;

  Rec.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), identifier = _s(j['identifier']), type = types.containsKey(j['type']) ? j['type'] as String : 'record',
        format = _s(j['format'], 'text'), title = _s(j['title']), summary = _s(j['summary']), county = _s(j['county']),
        place = _s(j['place']), status = _s(j['status'], 'published'), year = _in(j['year']), durationSeconds = _in(j['durationSeconds']),
        yearApproximate = j['yearApproximate'] == true,
        water = j['waterBody'] is Map ? WaterBody(_i(j['waterBody']['id']), _s(j['waterBody']['name'])) : null,
        waterName = j['waterBody'] is Map ? _s(j['waterBody']['name']) : _s(j['waterBody']),
        lat = _dn(j['latitude']), lng = _dn(j['longitude']),
        subjects = _list(j['subjects']).map((s) => Subject(_i(s['id']), _s(s['slug']), _s(s['label']))).toList(),
        views = _i(j['views']), publishedAt = _dt(j['publishedAt']), createdAt = _dt(j['createdAt']),
        snippet = j['snippet'] as String?, body = j['body'] as String?, creator = j['creator'] as String?,
        narrator = j['narrator'] as String?, interviewer = j['interviewer'] as String?, photographer = j['photographer'] as String?,
        language = j['language'] as String?, rights = j['rights'] as String?, consent = j['consent'] as String?,
        citation = j['citation'] as String?,
        transcript = _list(j['transcript']).map((t) => Segment(_i(t['startSeconds']), _s(t['text']))).toList(),
        media = _list(j['media']).map(MediaFile.fromJson).toList(),
        related = _list(j['related']).map(Rec.fromJson).toList();

  String get yearText => year == null ? 'Date unknown' : '${yearApproximate ? 'c. ' : ''}$year';
  String get placeText {
    final p = [place, county].where((x) => x.isNotEmpty).join(', ');
    return p.isNotEmpty ? p : (waterName.isNotEmpty ? waterName : 'Place not recorded');
  }
  bool get hasLocation => lat != null && lng != null;
  MediaFile? get image => media.where((m) => m.isImage && m.role != 'thumbnail').firstOrNull ?? media.where((m) => m.isImage).firstOrNull;
}

class AppUser {
  final String id, name, email, role, status, organisation;
  final DateTime? lastLoginAt, createdAt;
  /// False for accounts made with Google or Apple until the person chooses a password.
  final bool hasPassword;
  AppUser.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), name = _s(j['name']), email = _s(j['email']), role = _s(j['role'], 'user'), status = _s(j['status'], 'active'),
        organisation = _s(j['organisation']), lastLoginAt = _dt(j['lastLoginAt']), createdAt = _dt(j['createdAt']), hasPassword = j['hasPassword'] != false;
  bool get isAdmin => role == 'admin';
  /// Editors and admins catalogue, publish and review. Only admins manage people, messages and reports.
  bool get isStaff => role == 'admin' || role == 'editor';
  String get roleName => role == 'admin' ? 'Admin' : role == 'editor' ? 'Editor' : 'Member';
  String get first => name.split(' ').first;
  String get initials => name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join().toUpperCase();
}

class Submission {
  final String id, reference, type, title, description, place, status, reviewNote;
  final int? year;
  final String waterName;
  final String? recordId, byName, byEmail;
  final DateTime? createdAt;
  final List<MediaFile> files;
  Submission.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), reference = _s(j['reference']), type = types.containsKey(j['type']) ? j['type'] as String : 'record',
        title = _s(j['title']), description = _s(j['description']), place = _s(j['place']), status = _s(j['status'], 'pending'),
        reviewNote = _s(j['reviewNote']), year = _in(j['year']), waterName = j['waterBody'] is Map ? _s(j['waterBody']['name']) : '',
        recordId = j['recordId'] as String?, byName = j['submittedBy'] is Map ? _s(j['submittedBy']['name']) : null,
        byEmail = j['submittedBy'] is Map ? _s(j['submittedBy']['email']) : null, createdAt = _dt(j['createdAt']),
        files = _list(j['files']).map(MediaFile.fromJson).toList();
}

class Message {
  final String id, name, email, subject, body;
  final bool read;
  final DateTime? createdAt, repliedAt;
  /// The research team's reply, once there is one.
  final String? reply, userId;
  /// For a member's own enquiries: a reply they haven't seen yet.
  final bool isNew;
  Message.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), name = _s(j['name']), email = _s(j['email']), subject = _s(j['subject']), body = _s(j['body']),
        read = j['read'] == true, createdAt = _dt(j['createdAt']), repliedAt = _dt(j['repliedAt']),
        reply = j['reply'] as String?, userId = j['userId'] as String?, isNew = j['new'] == true;
}

/// Something to tell the person: news, or an action that stays until it's done.
class Note {
  final String id, kind, title, summary, body, link, actionLabel;
  final String? actionKey;
  final bool requiresAction, done;
  bool viewed;
  final DateTime? createdAt;
  Note.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), kind = _s(j['kind']), title = _s(j['title']), summary = _s(j['summary']), body = _s(j['body']), link = _s(j['link']),
        actionLabel = _s(j['actionLabel']), actionKey = j['actionKey'] as String?, requiresAction = j['requiresAction'] == true,
        done = j['done'] == true, viewed = j['viewed'] == true, createdAt = _dt(j['createdAt']);
  /// The id of the thing the action is about (a reminder, a submission, a message).
  String get target => (actionKey ?? '').split(':').last;
  bool get hasMore => body.trim().isNotEmpty && body.trim() != summary.trim();
}

class Reminder {
  final String id, subject, description;
  final DateTime dueAt;
  final DateTime? doneAt;
  final bool fired, done;
  Reminder.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), subject = _s(j['subject']), description = _s(j['description']), dueAt = _dt(j['dueAt']) ?? DateTime.now(),
        doneAt = _dt(j['doneAt']), fired = j['fired'] == true, done = j['done'] == true;
}

/// Notifications on the phone itself (Android alarms and iOS local notifications), so reminders ring
/// on time even when the app is closed. Written in the app's own Android and iOS code (MainActivity.kt, AppDelegate.swift).
class PhoneAlerts {
  static const _ch = MethodChannel('msh/alerts');
  static Future<bool> permission() async {
    try { return await _ch.invokeMethod<bool>('permission') ?? false; } catch (_) { return false; }
  }
  static Future<void> schedule(String id, String title, String body, DateTime at) async {
    try { await _ch.invokeMethod('schedule', {'id': id, 'title': title, 'body': body, 'at': at.millisecondsSinceEpoch}); } catch (_) {}
  }
  static Future<void> cancel(String id) async {
    try { await _ch.invokeMethod('cancel', {'id': id}); } catch (_) {}
  }
}

/// Keeps the bell and enquiries counts, pop-ups and to-dos up to date.
/// - News pops up once, as a banner at the top of the screen.
/// - A to-do pops up once per sign-in; put away, it stays pinned at the top until it is done.
class Alerts extends ChangeNotifier {
  Alerts(this._s);
  final AppState _s;

  int bell = 0, enquiries = 0;
  /// The banner on screen now.
  Note? showing;
  /// The banner's to-do was just done: it says thank you before leaving.
  bool showingThanks = false;
  /// To-dos waiting at the top of the screen.
  final pinned = <Note>[];
  /// Done to-dos saying thank you on their way out.
  final thanks = <Note>[];
  /// The to-do that just flew up (it lands with a bounce).
  String? justPinned;
  final _queue = <Note>[];
  final _shownFresh = <String>{};
  Set<String> _centred = {};
  Timer? _timer, _due;
  bool _running = false;

  bool get hasStrip => pinned.isNotEmpty || thanks.isNotEmpty;
  String get _key => 'centred-${_s.me?.id ?? ''}';

  void start({required bool freshLogin}) {
    stop(notify: false);
    _running = true;
    _centred = freshLogin ? <String>{} : (_s._prefs.getStringList(_key) ?? const <String>[]).toSet();
    if (freshLogin) _s._prefs.setStringList(_key, const []);
    poll();
    syncReminders();
  }

  void stop({bool notify = true}) {
    _running = false;
    _timer?.cancel(); _due?.cancel();
    bell = 0; enquiries = 0; showing = null; showingThanks = false; justPinned = null;
    pinned.clear(); thanks.clear(); _queue.clear(); _shownFresh.clear();
    if (notify) notifyListeners();
  }

  /// The app went to the background: check less, and again as soon as it's back.
  void pause() { _timer?.cancel(); }

  Future<void> poll() async {
    _timer?.cancel();
    if (!_running || _s.me == null) return;
    try {
      final j = await _s.api.get('/notifications/summary') as Map<String, dynamic>;
      if (_running) _apply(j);
    } catch (_) {/* try again next round */}
    if (_running) _timer = Timer(const Duration(seconds: 20), poll);
  }

  void _apply(Map<String, dynamic> j) {
    bell = _i(j['unviewed']);
    enquiries = _i(j['enquiries']);
    if (_s.isAdmin) _s.unread = enquiries;
    final actions = _list(j['actions']).map(Note.fromJson).toList();
    final fresh = _list(j['fresh']).map(Note.fromJson).toList();
    final open = actions.map((a) => a.id).toSet();
    // Done since last time: thank you, then gone.
    for (final p in pinned.where((p) => !open.contains(p.id)).toList()) {
      pinned.remove(p);
      thanks.add(p);
      Timer(const Duration(milliseconds: 2200), () { thanks.remove(p); notifyListeners(); });
    }
    final sh = showing;
    if (sh != null && sh.requiresAction && !open.contains(sh.id) && !showingThanks) {
      showingThanks = true;
      Timer(const Duration(milliseconds: 1700), () { if (showing?.id == sh.id) close(); });
    }
    for (final a in actions) {
      if (pinned.any((p) => p.id == a.id) || showing?.id == a.id || _queue.any((q) => q.id == a.id)) continue;
      if (_centred.contains(a.id)) { pinned.add(a); } else { _queue.add(a); }
    }
    for (final f in fresh) {
      if (!_shownFresh.contains(f.id) && !_queue.any((q) => q.id == f.id)) _queue.add(f);
    }
    _next();
    notifyListeners();
  }

  void _next() {
    if (showing != null || _queue.isEmpty) return;
    final n = _queue.removeAt(0);
    showing = n;
    showingThanks = false;
    if (n.requiresAction) {
      _centred.add(n.id);
      _s._prefs.setStringList(_key, _centred.toList());
    } else {
      _shownFresh.add(n.id);
    }
    if (!n.viewed) {
      n.viewed = true;
      _s.api.post('/notifications/${n.id}/viewed').then((r) {
        final m = r as Map<String, dynamic>;
        bell = _i(m['unviewed']); enquiries = _i(m['enquiries']);
        notifyListeners();
      }).catchError((_) {});
    }
  }

  /// Put the banner away: news goes; a to-do flies up to the top of the screen.
  void dismiss() {
    final n = showing;
    if (n == null) return;
    if (n.requiresAction && !showingThanks) {
      if (!pinned.any((p) => p.id == n.id)) pinned.add(n);
      justPinned = n.id;
      Timer(const Duration(milliseconds: 900), () { justPinned = null; notifyListeners(); });
    }
    close();
  }

  void close() {
    showing = null;
    showingThanks = false;
    notifyListeners();
    Timer(const Duration(milliseconds: 450), () { _next(); notifyListeners(); });
  }

  /// Opens a pinned to-do in the banner again.
  void reopen(Note n) {
    if (showing != null) return;
    pinned.removeWhere((p) => p.id == n.id);
    showing = n;
    showingThanks = false;
    notifyListeners();
  }

  void seen(Map<String, dynamic> summary) {
    bell = _i(summary['unviewed']);
    enquiries = _i(summary['enquiries']);
    notifyListeners();
  }

  void setEnquiries(int n) { if (enquiries != n) { enquiries = n; notifyListeners(); } }

  void enquiriesSeen() { if (enquiries != 0) { enquiries = 0; notifyListeners(); } }

  Future<void> reminderDone(String id) async {
    await _s.api.post('/reminders/$id/done');
    await PhoneAlerts.cancel(id);
    await poll();
  }

  Future<void> reminderSnooze(String id, [int minutes = 10]) async {
    await _s.api.post('/reminders/$id/snooze', {'minutes': minutes});
    await syncReminders();
    await poll();
  }

  /// Hands every upcoming reminder to the phone, and checks back the moment the next one is due.
  Future<void> syncReminders() async {
    _due?.cancel();
    if (!_running) return;
    try {
      final list = (await _s.api.get('/reminders') as List).whereType<Map<String, dynamic>>().map(Reminder.fromJson).toList();
      final upcoming = list.where((r) => !r.done && !r.fired).toList();
      final keep = upcoming.map((r) => r.id).toSet();
      for (final old in _s._prefs.getStringList('scheduled') ?? const <String>[]) {
        if (!keep.contains(old)) await PhoneAlerts.cancel(old);
      }
      for (final r in upcoming) {
        await PhoneAlerts.schedule(r.id, 'Reminder: ${r.subject}', r.description.isEmpty ? "It's time." : r.description, r.dueAt);
      }
      await _s._prefs.setStringList('scheduled', keep.toList());
      if (upcoming.isNotEmpty) {
        upcoming.sort((a, b) => a.dueAt.compareTo(b.dueAt));
        final wait = upcoming.first.dueAt.difference(DateTime.now()) + const Duration(seconds: 1);
        _due = Timer(wait.isNegative ? Duration.zero : wait, () { poll(); syncReminders(); });
      }
    } catch (_) {}
  }

  /// Signing out: the phone forgets this person's reminders.
  Future<void> forgetReminders() async {
    for (final id in _s._prefs.getStringList('scheduled') ?? const <String>[]) { await PhoneAlerts.cancel(id); }
    await _s._prefs.setStringList('scheduled', const []);
  }
}

class Activity {
  final String who, action, summary, ip;
  final DateTime? at;
  Activity.fromJson(Map<String, dynamic> j)
      : who = _s(j['actorName']), action = _s(j['action']), summary = _s(j['summary']), ip = _s(j['ip']), at = _dt(j['createdAt']);
}

class PageOf<T> {
  final List<T> items;
  final int total, page, pages;
  PageOf(this.items, this.total, this.page, this.pages);
  factory PageOf.fromJson(dynamic j, T Function(Map<String, dynamic>) f) {
    final m = j as Map<String, dynamic>;
    return PageOf(_list(m['items']).map(f).toList(), _i(m['total']), _i(m['page'], 1), _i(m['pages'], 1));
  }
}

/// The signed-in session, display settings and small caches.
class AppState extends ChangeNotifier {
  static const defaultServer = String.fromEnvironment('API_URL', defaultValue: '');

  late SharedPreferences _prefs;
  late Api api;
  AppUser? me;
  bool lowBw = false, largeText = false, ready = false;
  /// The guide that points to the next thing to press.
  bool hints = true;
  String server = defaultServer;
  List<WaterBody> waterBodies = [];
  List<Subject> subjects = [];
  int pending = 0, unread = 0;
  late final Alerts alerts = Alerts(this);

  bool get isAdmin => me?.isAdmin ?? false;
  bool get isStaff => me?.isStaff ?? false;
  bool get hasServer => server.isNotEmpty;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    lowBw = _prefs.getBool('lowBw') ?? false;
    largeText = _prefs.getBool('largeText') ?? false;
    hints = _prefs.getBool('hints') ?? true;
    server = _prefs.getString('server') ?? defaultServer;
    api = Api(server)..onSignedOut = _signedOutElsewhere;
    if (hasServer) {
      final u = await api.restore();
      if (u != null) me = AppUser.fromJson(u);
    }
    ready = true;
    notifyListeners();
    if (me != null) { refreshVocab(); alerts.start(freshLogin: false); }
  }

  void _signedOutElsewhere() {
    me = null;
    alerts.stop();
    notifyListeners();
  }

  /// Saves the server address, for example http://192.168.1.20:4000 or https://archive.example.org
  Future<String?> setServer(String value) async {
    var v = value.trim().replaceAll(RegExp(r'/+$'), '');
    if (v.isEmpty) return 'Enter the server address.';
    if (!v.startsWith('http://') && !v.startsWith('https://')) v = 'http://$v';
    final u = Uri.tryParse(v);
    if (u == null || u.host.isEmpty) return "That doesn't look like a web address.";
    if (me != null && v != server) { await alerts.forgetReminders(); alerts.stop(); await api.logout(); }
    server = v;
    _providers = null;
    api = Api(v)..onSignedOut = _signedOutElsewhere;
    me = null;
    await _prefs.setString('server', v);
    notifyListeners();
    try {
      await api.get('/health');
      return null;
    } catch (e) {
      return 'Saved, but the archive could not be reached there: $e';
    }
  }

  Future<void> signIn(String email, String password) async {
    me = AppUser.fromJson(await api.login(email.trim(), password));
    notifyListeners();
    refreshVocab();
    alerts.start(freshLogin: true);
  }

  /// Signs in with a Google or Apple ID token. Returns true when this made a new account.
  Future<bool> signInWith(String provider, String idToken, {String? name}) async {
    final r = await api.oauth(provider, idToken, name: name);
    me = AppUser.fromJson(r['user'] as Map<String, dynamic>);
    notifyListeners();
    refreshVocab();
    alerts.start(freshLogin: true);
    return r['created'] == true;
  }

  Map<String, dynamic>? _providers;
  /// Which quick sign-in options this archive offers (Google, Apple), with their public client ids.
  Future<Map<String, dynamic>> providers() async {
    if (_providers != null) return _providers!;
    return _providers = await api.get('/auth/providers') as Map<String, dynamic>;
  }

  Future<void> register(String name, String email, String password, String org) async {
    me = AppUser.fromJson(await api.register({'name': name.trim(), 'email': email.trim(), 'password': password, if (org.trim().isNotEmpty) 'organisation': org.trim()}));
    notifyListeners();
    refreshVocab();
    alerts.start(freshLogin: true);
  }

  Future<void> signOut({bool everywhere = false}) async {
    await alerts.forgetReminders();
    alerts.stop();
    await api.logout(everywhere: everywhere);
    me = null;
    pending = 0;
    unread = 0;
    notifyListeners();
  }

  Future<void> forgetSession() async {
    await alerts.forgetReminders();
    alerts.stop();
    await api.forget();
    me = null;
    notifyListeners();
  }

  void setMe(Map<String, dynamic> j) { me = AppUser.fromJson(j); notifyListeners(); }

  Future<void> refreshVocab() async {
    try {
      final v = await api.get('/vocab') as Map<String, dynamic>;
      waterBodies = _list(v['waterBodies']).map((w) => WaterBody(_i(w['id']), _s(w['name']))).toList();
      subjects = _list(v['subjects']).map((s) => Subject(_i(s['id']), _s(s['slug']), _s(s['label']))).toList();
      notifyListeners();
    } catch (_) {/* filters fall back to none */}
    refreshCounts();
  }

  Future<void> refreshCounts() async {
    if (!isStaff) return;
    try {
      final s = await api.get('/submissions', {'status': 'pending', 'pageSize': 1}) as Map<String, dynamic>;
      pending = _i(s['total']);
      if (isAdmin) {
        final m = await api.get('/messages', {'filter': 'unread', 'pageSize': 1}) as Map<String, dynamic>;
        unread = _i(m['unread']);
        alerts.setEnquiries(unread);
      }
      notifyListeners();
    } catch (_) {}
  }

  void toggleLowBw() { lowBw = !lowBw; _prefs.setBool('lowBw', lowBw); notifyListeners(); }
  void toggleLargeText() { largeText = !largeText; _prefs.setBool('largeText', largeText); notifyListeners(); }
  void toggleHints() { hints = !hints; _prefs.setBool('hints', hints); notifyListeners(); }
}
