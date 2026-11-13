import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'seed.dart';

/// Kinds of archive material.
class MType {
  final String key, label, plural;
  final IconData icon;
  const MType(this.key, this.label, this.plural, this.icon);
}

const types = <String, MType>{
  'oral': MType('oral', 'Oral history', 'Oral histories', Icons.mic_none_rounded),
  'photo': MType('photo', 'Photograph', 'Photographs', Icons.photo_camera_outlined),
  'record': MType('record', 'Record / report', 'Records', Icons.description_outlined),
  'testimony': MType('testimony', 'Testimony', 'Testimonies', Icons.format_quote_rounded),
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
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

String _s(dynamic v, [String d = '']) => v == null ? d : v.toString();
int _i(dynamic v, [int d = 0]) => v is num ? v.toInt() : int.tryParse('$v') ?? d;
double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

class Rec {
  String id, type, format, title, summary, water, county, place, creator, language, rights, consent, status, added;
  int year, views;
  int? duration;
  double lat, lng;
  List<String> tags;
  String? interviewer, narrator, photographer, body, scene, file;
  List<MapEntry<int, String>>? transcript;
  List<String>? pages;

  Rec({
    required this.id, required this.type, required this.format, required this.title, required this.summary,
    required this.water, required this.county, required this.place, required this.creator, required this.language,
    required this.rights, required this.consent, required this.status, required this.added, required this.year,
    required this.views, required this.lat, required this.lng, required this.tags, this.duration, this.interviewer,
    this.narrator, this.photographer, this.body, this.scene, this.file, this.transcript, this.pages,
  });

  factory Rec.fromJson(Map<String, dynamic> j) => Rec(
        id: _s(j['id']), type: _s(j['type'], 'oral'), format: _s(j['format'], 'text'), title: _s(j['title']),
        summary: _s(j['summary']), water: _s(j['waterBody']), county: _s(j['county']), place: _s(j['place']),
        creator: _s(j['creator']), language: _s(j['language']), rights: _s(j['rights']), consent: _s(j['consent']),
        status: _s(j['status'], 'draft'), added: _s(j['added']), year: _i(j['year']), views: _i(j['views']),
        lat: _d(j['lat']), lng: _d(j['lng']),
        tags: (j['tags'] as List? ?? []).map((e) => '$e').toList(),
        duration: j['duration'] == null ? null : _i(j['duration']),
        interviewer: j['interviewer'] as String?, narrator: j['narrator'] as String?,
        photographer: j['photographer'] as String?, body: j['body'] as String?, scene: j['scene'] as String?,
        file: j['file'] as String?,
        transcript: (j['transcript'] as List?)?.map((e) => MapEntry(_i((e as List)[0]), _s(e[1]))).toList(),
        pages: (j['pages'] as List?)?.map((e) => '$e').toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id, 'type': type, 'format': format, 'title': title, 'summary': summary, 'waterBody': water,
        'county': county, 'place': place, 'creator': creator, 'language': language, 'rights': rights,
        'consent': consent, 'status': status, 'added': added, 'year': year, 'views': views, 'lat': lat, 'lng': lng,
        'tags': tags, 'duration': duration, 'interviewer': interviewer, 'narrator': narrator,
        'photographer': photographer, 'body': body, 'scene': scene, 'file': file,
        'transcript': transcript?.map((e) => [e.key, e.value]).toList(), 'pages': pages,
      };

  String get searchText => [
        id, title, summary, place, county, water, tags.join(' '), creator, language, '$year',
        ...?transcript?.map((e) => e.value), body ?? '', ...?pages,
      ].join(' ').toLowerCase();
}

class User {
  String id, name, email, password, role, status, joined, org;
  User({required this.id, required this.name, required this.email, required this.password, required this.role,
      required this.status, required this.joined, required this.org});
  factory User.fromJson(Map<String, dynamic> j) => User(
      id: _s(j['id']), name: _s(j['name']), email: _s(j['email']), password: _s(j['password']),
      role: _s(j['role'], 'user'), status: _s(j['status'], 'active'), joined: _s(j['joined']), org: _s(j['org']));
  Map<String, dynamic> toJson() =>
      {'id': id, 'name': name, 'email': email, 'password': password, 'role': role, 'status': status, 'joined': joined, 'org': org};
  bool get isAdmin => role == 'admin';
  String get first => name.split(' ').first;
  String get initials => name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join().toUpperCase();
}

class Submission {
  String id, by, date, status, title, type, water, place, description, file;
  int? year;
  bool consent;
  String? recordId;
  Submission({required this.id, required this.by, required this.date, required this.status, required this.title,
      required this.type, required this.water, required this.place, required this.description, required this.file,
      this.year, this.consent = true, this.recordId});
  factory Submission.fromJson(Map<String, dynamic> j) => Submission(
      id: _s(j['id']), by: _s(j['by']), date: _s(j['date']), status: _s(j['status'], 'pending'), title: _s(j['title']),
      type: _s(j['type'], 'oral'), water: _s(j['waterBody']), place: _s(j['place']), description: _s(j['description']),
      file: _s(j['file']), year: j['year'] == null ? null : _i(j['year']), consent: j['consent'] != false,
      recordId: j['recordId'] as String?);
  Map<String, dynamic> toJson() => {'id': id, 'by': by, 'date': date, 'status': status, 'title': title, 'type': type,
      'waterBody': water, 'place': place, 'description': description, 'file': file, 'year': year, 'consent': consent, 'recordId': recordId};
}

class Message {
  String id, name, email, date, subject, body;
  bool read;
  Message({required this.id, required this.name, required this.email, required this.date, required this.subject,
      required this.body, this.read = false});
  factory Message.fromJson(Map<String, dynamic> j) => Message(id: _s(j['id']), name: _s(j['name']), email: _s(j['email']),
      date: _s(j['date']), subject: _s(j['subject']), body: _s(j['body']), read: j['read'] == true);
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'email': email, 'date': date, 'subject': subject, 'body': body, 'read': read};
}

class Activity {
  final String t, who, what;
  Activity(this.t, this.who, this.what);
  factory Activity.fromJson(Map<String, dynamic> j) => Activity(_s(j['t']), _s(j['who']), _s(j['what']));
  Map<String, dynamic> toJson() => {'t': t, 'who': who, 'what': what};
}

/// All app data, kept on the phone (shared_preferences). The full build uses the secure API instead.
class AppState extends ChangeNotifier {
  static const _key = 'msh-app-state';
  SharedPreferences? _prefs;

  List<String> waterBodies = [];
  List<Rec> records = [];
  List<User> users = [];
  List<Submission> submissions = [];
  List<Message> messages = [];
  List<Activity> activity = [];
  List<MapEntry<String, int>> visits = [];
  String? session;
  bool lowBw = false, largeText = false;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    Map<String, dynamic>? data;
    if (raw != null) {
      try { data = jsonDecode(raw) as Map<String, dynamic>; } catch (_) {}
    }
    _apply(data ?? jsonDecode(seedJson) as Map<String, dynamic>);
  }

  void _apply(Map<String, dynamic> j) {
    final seed = jsonDecode(seedJson) as Map<String, dynamic>;
    waterBodies = ((j['waterBodies'] ?? seed['waterBodies']) as List).map((e) => '$e').toList();
    records = (j['records'] as List).map((e) => Rec.fromJson(e as Map<String, dynamic>)).toList();
    users = (j['users'] as List).map((e) => User.fromJson(e as Map<String, dynamic>)).toList();
    submissions = (j['submissions'] as List).map((e) => Submission.fromJson(e as Map<String, dynamic>)).toList();
    messages = (j['messages'] as List).map((e) => Message.fromJson(e as Map<String, dynamic>)).toList();
    activity = (j['activity'] as List).map((e) => Activity.fromJson(e as Map<String, dynamic>)).toList();
    visits = ((j['visitsByMonth'] ?? seed['visitsByMonth']) as List).map((e) => MapEntry(_s((e as List)[0]), _i(e[1]))).toList();
    session = j['session'] as String?;
    lowBw = j['lowBw'] == true;
    largeText = j['largeText'] == true;
  }

  void save() {
    final j = {
      'waterBodies': waterBodies,
      'records': records.map((e) => e.toJson()).toList(),
      'users': users.map((e) => e.toJson()).toList(),
      'submissions': submissions.map((e) => e.toJson()).toList(),
      'messages': messages.map((e) => e.toJson()).toList(),
      'activity': activity.map((e) => e.toJson()).toList(),
      'visitsByMonth': visits.map((e) => [e.key, e.value]).toList(),
      'session': session, 'lowBw': lowBw, 'largeText': largeText,
    };
    _prefs?.setString(_key, jsonEncode(j));
    notifyListeners();
  }

  void resetDemo() {
    _apply(jsonDecode(seedJson) as Map<String, dynamic>);
    session = null;
    save();
  }

  // ----- helpers -----
  User? get me => session == null ? null : users.where((u) => u.id == session).firstOrNull;
  bool get isAdmin => me?.isAdmin ?? false;
  List<Rec> get published => records.where((r) => r.status == 'published').toList();
  List<Submission> get pending => submissions.where((s) => s.status == 'pending').toList();
  List<Message> get unread => messages.where((m) => !m.read).toList();
  User userById(String id) => users.firstWhere((u) => u.id == id,
      orElse: () => User(id: '', name: 'Unknown', email: '', password: '', role: 'user', status: 'active', joined: '', org: ''));
  Rec? recById(String id) => records.where((r) => r.id == id).firstOrNull;

  static String today() => DateTime.now().toIso8601String().substring(0, 10);
  static String nowStamp() {
    final d = DateTime.now();
    return '${today()} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  String nextRecordId() {
    final n = records.map((r) => int.tryParse(r.id.split('-').last) ?? 0).fold(0, (a, b) => a > b ? a : b) + 1;
    return 'MSH-${n.toString().padLeft(4, '0')}';
  }

  void log(String what) {
    activity.insert(0, Activity(nowStamp(), me?.name ?? 'System', what));
    save();
  }

  // ----- auth -----
  /// Returns an error message, or null when signed in.
  String? signIn(String email, String password) {
    final u = users.where((x) => x.email.toLowerCase() == email.trim().toLowerCase()).firstOrNull;
    if (u == null || u.password != password) return "That email and password don't match. Check them and try again.";
    if (u.status == 'suspended') return 'This account is suspended. Contact the research team.';
    session = u.id;
    log('signed in');
    return null;
  }

  String? register(String name, String email, String password, String org) {
    if (users.any((u) => u.email.toLowerCase() == email.trim().toLowerCase())) {
      return 'An account with that email already exists. Sign in instead.';
    }
    final u = User(id: 'U${DateTime.now().millisecondsSinceEpoch}', name: name.trim(), email: email.trim(),
        password: password, role: 'user', status: 'active', joined: today(), org: org.trim());
    users.add(u);
    session = u.id;
    log('created an account');
    return null;
  }

  void signOut() {
    log('signed out');
    session = null;
    save();
  }

  void toggleLowBw() { lowBw = !lowBw; save(); }
  void toggleLargeText() { largeText = !largeText; save(); }

  // ----- search -----
  List<Rec> search({String q = '', String? type, Set<String> waters = const {}, int? decade, String sort = ''}) {
    final words = q.toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final scored = <MapEntry<Rec, int>>[];
    for (final r in published) {
      final txt = r.searchText;
      var score = 0;
      var ok = true;
      for (final w in words) {
        if (!txt.contains(w)) { ok = false; break; }
        if (r.title.toLowerCase().contains(w)) score += 5;
        if (r.tags.join(' ').toLowerCase().contains(w)) score += 3;
        score += 1;
      }
      if (!ok) continue;
      if (type != null && r.type != type) continue;
      if (waters.isNotEmpty && !waters.contains(r.water)) continue;
      if (decade != null && (r.year ~/ 10) * 10 != decade) continue;
      scored.add(MapEntry(r, score));
    }
    final s = sort.isEmpty ? (words.isEmpty ? 'newest' : 'relevance') : sort;
    scored.sort((a, b) => switch (s) {
          'relevance' => b.value.compareTo(a.value),
          'oldest' => a.key.year.compareTo(b.key.year),
          'popular' => b.key.views.compareTo(a.key.views),
          _ => b.key.year.compareTo(a.key.year),
        });
    return scored.map((e) => e.key).toList();
  }
}
