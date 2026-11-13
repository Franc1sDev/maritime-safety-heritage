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
  AppUser.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), name = _s(j['name']), email = _s(j['email']), role = _s(j['role'], 'user'), status = _s(j['status'], 'active'),
        organisation = _s(j['organisation']), lastLoginAt = _dt(j['lastLoginAt']), createdAt = _dt(j['createdAt']);
  bool get isAdmin => role == 'admin';
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
  final DateTime? createdAt;
  Message.fromJson(Map<String, dynamic> j)
      : id = _s(j['id']), name = _s(j['name']), email = _s(j['email']), subject = _s(j['subject']), body = _s(j['body']),
        read = j['read'] == true, createdAt = _dt(j['createdAt']);
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
  String server = defaultServer;
  List<WaterBody> waterBodies = [];
  List<Subject> subjects = [];
  int pending = 0, unread = 0;

  bool get isAdmin => me?.isAdmin ?? false;
  bool get hasServer => server.isNotEmpty;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    lowBw = _prefs.getBool('lowBw') ?? false;
    largeText = _prefs.getBool('largeText') ?? false;
    server = _prefs.getString('server') ?? defaultServer;
    api = Api(server)..onSignedOut = _signedOutElsewhere;
    if (hasServer) {
      final u = await api.restore();
      if (u != null) me = AppUser.fromJson(u);
    }
    ready = true;
    notifyListeners();
    if (me != null) refreshVocab();
  }

  void _signedOutElsewhere() {
    me = null;
    notifyListeners();
  }

  /// Saves the server address, for example http://192.168.1.20:4000 or https://archive.example.org
  Future<String?> setServer(String value) async {
    var v = value.trim().replaceAll(RegExp(r'/+$'), '');
    if (v.isEmpty) return 'Enter the server address.';
    if (!v.startsWith('http://') && !v.startsWith('https://')) v = 'http://$v';
    final u = Uri.tryParse(v);
    if (u == null || u.host.isEmpty) return "That doesn't look like a web address.";
    if (me != null && v != server) await api.logout();
    server = v;
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
  }

  Future<void> register(String name, String email, String password, String org) async {
    me = AppUser.fromJson(await api.register({'name': name.trim(), 'email': email.trim(), 'password': password, if (org.trim().isNotEmpty) 'organisation': org.trim()}));
    notifyListeners();
    refreshVocab();
  }

  Future<void> signOut({bool everywhere = false}) async {
    await api.logout(everywhere: everywhere);
    me = null;
    pending = 0;
    unread = 0;
    notifyListeners();
  }

  Future<void> forgetSession() async {
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
    if (!isAdmin) return;
    try {
      final s = await api.get('/submissions', {'status': 'pending', 'pageSize': 1}) as Map<String, dynamic>;
      final m = await api.get('/messages', {'filter': 'unread', 'pageSize': 1}) as Map<String, dynamic>;
      pending = _i(s['total']);
      unread = _i(m['unread']);
      notifyListeners();
    } catch (_) {}
  }

  void toggleLowBw() { lowBw = !lowBw; _prefs.setBool('lowBw', lowBw); notifyListeners(); }
  void toggleLargeText() { largeText = !largeText; _prefs.setBool('largeText', largeText); notifyListeners(); }
}
