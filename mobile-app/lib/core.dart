import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/services.dart' show MethodChannel, rootBundle;
import 'package:local_auth/local_auth.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

// ---------- Design tokens: the same blue-and-white values as the website ----------
class C {
  static const blue = Color(0xFF0B5FBF), blueDark = Color(0xFF5AA7FF), ink = Color(0xFF0B2540), soft = Color(0xFFE6F0FB);
  static const green = Color(0xFF1A8A4C), yellow = Color(0xFFB98900), red = Color(0xFFC9302C);
  static const bgDark = Color(0xFF071426), surfaceDark = Color(0xFF0E2038);
  static Color flag(String? f) => f == 'GREEN' ? green : f == 'YELLOW' ? yellow : f == 'RED' ? red : const Color(0xFF6B7C8E);
}

ThemeData appTheme({required bool dark, required bool highContrast}) {
  final primary = dark ? (highContrast ? const Color(0xFF9FD0FF) : C.blueDark) : (highContrast ? const Color(0xFF003A8C) : C.blue);
  final scheme = ColorScheme.fromSeed(seedColor: C.blue, brightness: dark ? Brightness.dark : Brightness.light).copyWith(
      primary: primary, surface: dark ? C.surfaceDark : Colors.white, onSurface: dark ? const Color(0xFFE8F0FA) : C.ink, error: dark ? const Color(0xFFFF7A75) : C.red);
  return ThemeData(
    useMaterial3: true, colorScheme: scheme, scaffoldBackgroundColor: dark ? C.bgDark : Colors.white,
    appBarTheme: AppBarTheme(backgroundColor: dark ? C.bgDark : Colors.white, foregroundColor: scheme.onSurface, elevation: 0, scrolledUnderElevation: 0),
    inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)), isDense: true),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(48, 46), shape: const StadiumBorder())),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 46), shape: const StadiumBorder(), side: BorderSide(color: primary, width: 1.5))),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: scheme.surface, showDragHandle: true),
    dividerTheme: DividerThemeData(color: dark ? const Color(0xFF24405F) : const Color(0xFFD3DDE8)),
  );
}

// ---------- Languages: English text is the key; the wording comes from the same source as the website ----------
class I18n {
  static Map<String, dynamic> _map = {};
  static String code = 'en';
  static const launch = {'en': 'English', 'sw': 'Kiswahili', 'luo': 'Dholuo'};
  static Future<void> load(String c) async {
    code = launch.containsKey(c) ? c : 'en';
    _map = {};
    if (code != 'en') {
      try { _map = jsonDecode(await rootBundle.loadString('assets/i18n/$code.json')) as Map<String, dynamic>; } catch (_) {/* English */}
    }
  }
}

/// Translates interface text and fills in values written as {name}.
String t(String key, [Map<String, Object?>? vars]) {
  var s = (I18n._map[key] as String?) ?? key;
  vars?.forEach((k, v) => s = s.replaceAll('{$k}', '${v ?? ''}'));
  return s;
}

// ---------- Small helpers for reading the API's JSON ----------
typedef J = Map<String, dynamic>;
J asMap(dynamic v) => v is Map<String, dynamic> ? v : <String, dynamic>{};
List<J> asList(dynamic v) => v is List ? v.whereType<Map<String, dynamic>>().toList() : <J>[];
String str(dynamic v, [String d = '']) => v == null ? d : '$v';
int num0(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String compact(int n) => n >= 1000000 ? '${(n / 1000000).toStringAsFixed(1)}M' : n >= 1000 ? '${(n / 1000).toStringAsFixed(n >= 10000 ? 0 : 1)}k' : '$n';
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String fmtDate(dynamic iso, {bool time = false}) {
  final d = DateTime.tryParse(str(iso));
  if (d == null) return '';
  final l = str(iso).length <= 10 ? d : d.toLocal();
  final base = '${l.day} ${_months[l.month - 1]} ${l.year}';
  return time ? '$base, ${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}' : base;
}
String ago(dynamic iso) {
  final d = DateTime.tryParse(str(iso));
  if (d == null) return '';
  final s = DateTime.now().difference(d).inSeconds;
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', {'n': s ~/ 60});
  if (s < 86400) return t('{n} h ago', {'n': s ~/ 3600});
  if (s < 30 * 86400) return t('{n} d ago', {'n': s ~/ 86400});
  return fmtDate(iso);
}

// ---------- Uploads that carry on while the person browses ----------
/// A story waiting for its files: it is sent as soon as they have all arrived.
class PendingSend {
  PendingSend(this.title, this.needs, this.send);
  final String title;
  final List<UploadTask> needs;
  final Future<String> Function() send;
  bool sending = false;
  String? error;
}

/// Files are sent in pieces, can be paused, resumed and cancelled, wait for Wi-Fi when the person asked for that,
/// and keep going while they browse. On Android a notification shows the progress and keeps the upload alive
/// while the app is in the background.
class Uploads extends ChangeNotifier {
  Uploads(this.app);
  final AppState app;
  final tasks = <UploadTask>[];
  final pending = <PendingSend>[];
  /// The last thing worth telling the person (a story sent, or why it could not be).
  String? notice;
  bool onWifi = true;
  StreamSubscription<List<ConnectivityResult>>? _net;
  static const _native = MethodChannel('msh/alerts');
  int _shownPct = -1;
  String _shownText = '';

  bool get wifiOnly => app.settings['wifiOnly'] == true;
  List<UploadTask> get live => tasks.where((x) => x.active).toList();
  bool get busy => live.isNotEmpty || pending.isNotEmpty;
  double get pct { final l = tasks.where((x) => x.active || x.state == 'done').toList(); if (l.isEmpty) return 0; final total = l.fold<int>(0, (a, x) => a + x.file.size); return total == 0 ? 0 : l.fold<double>(0, (a, x) => a + x.pct * x.file.size) / total; }

  void watchNetwork() {
    bool wifi(List<ConnectivityResult> r) => r.contains(ConnectivityResult.wifi) || r.contains(ConnectivityResult.ethernet);
    try {
      Connectivity().checkConnectivity().then((r) { onWifi = wifi(r); _network(); }, onError: (_) {});
      _net = Connectivity().onConnectivityChanged.listen((r) { onWifi = wifi(r); _network(); }, onError: (_) {});
    } catch (_) {/* not available on this device: treat as Wi-Fi */}
  }

  /// When the network (or the Wi-Fi-only choice) changes: hold uploads that must wait, and continue those that can go.
  void _network() {
    for (final x in tasks) {
      if (wifiOnly && !onWifi && (x.state == 'sending' || x.state == 'waiting')) x.hold('wifi');
      if ((!wifiOnly || onWifi) && x.state == 'wifi') _run(x);
    }
    _changed();
  }
  void settingsChanged() => _network();
  void clearNotice() { notice = null; notifyListeners(); }

  UploadTask add(LocalFile f, String purpose) {
    final x = UploadTask(f, purpose)..onChange = _changed;
    tasks.add(x);
    _run(x);
    return x;
  }
  Future<void> _run(UploadTask x) async {
    if (wifiOnly && !onWifi) { x.mark('wifi'); return; }
    await app.api.runUpload(x);
  }
  void pause(UploadTask x) => x.hold('paused');
  void resume(UploadTask x) { if (x.state == 'paused' || x.state == 'failed' || x.state == 'wifi') _run(x); }
  void cancel(UploadTask x) { app.api.cancelUpload(x); tasks.remove(x); _changed(); }
  void pauseAll() { for (final x in live) { if (x.state == 'sending' || x.state == 'waiting') pause(x); } }
  void resumeAll() { for (final x in live) { resume(x); } }

  /// Sends a story once its files have arrived, so the person does not have to wait on the form.
  void sendWhenReady(PendingSend p) { pending.add(p); _changed(); }
  void drop(PendingSend p) { pending.remove(p); _changed(); }
  void retry(PendingSend p) { p.error = null; for (final x in p.needs) { resume(x); } _changed(); }

  void _changed() {
    for (final p in List<PendingSend>.of(pending)) {
      if (p.sending || p.error != null) continue;
      if (p.needs.any((x) => x.active)) continue;
      if (p.needs.any((x) => x.state == 'failed')) { p.error = p.needs.firstWhere((x) => x.state == 'failed').error; continue; }
      p.sending = true;
      p.send().then((message) { pending.remove(p); notice = message; _tidy(); notifyListeners(); },
          onError: (Object e) { p.sending = false; p.error = e is ApiError ? e.message : '$e'; notifyListeners(); });
    }
    _tidy();
    _notify();
    notifyListeners();
  }

  /// Finished uploads that no waiting story needs are forgotten once nothing is in flight.
  void _tidy() { if (live.isEmpty && pending.isEmpty) tasks.removeWhere((x) => !x.active); }

  /// Android: a notification with the progress, which also keeps the upload going while the app is in the background.
  void _notify() {
    final l = live;
    final sending = l.where((x) => x.state == 'sending').length;
    final text = l.isEmpty ? '' : sending > 0 ? t('Uploading… {n}%', {'n': (pct * 100).round()}) : l.any((x) => x.state == 'wifi') ? t('Waiting for Wi-Fi') : t('Paused');
    final p = l.isEmpty ? -1 : (pct * 100).round();
    if (text == _shownText && (p - _shownPct).abs() < 2) return;
    _shownText = text; _shownPct = p;
    _native.invokeMethod<void>('uploads', {'active': l.isNotEmpty, 'title': 'Remembering the Waters', 'text': text, 'pct': p}).then((_) {}, onError: (_) {});
  }

  @override
  void dispose() { _net?.cancel(); super.dispose(); }
}

// ---------- The signed-in session, settings and counts ----------
class AppState extends ChangeNotifier {
  static const defaultServer = String.fromEnvironment('API_URL', defaultValue: 'https://maritime-heritage.onrender.com');
  late SharedPreferences prefs;
  late Api api;
  late final Uploads uploads = Uploads(this);
  J? me;
  J config = {};
  J counts = {};
  bool ready = false, online = true, updateRequired = false;
  List<J> priority = [];
  bool floated = false;
  Timer? _poll;

  /// Guided hints on first use (how to browse, react, comment and share): the hint being shown, or null.
  int? guideStep;
  void startGuide({bool again = false}) {
    if (!again && prefs.getBool('guided') == true) return;
    if (guideStep != null) return;
    guideStep = 0; notifyListeners();
  }
  void nextGuide(int total) { if (guideStep == null) return; if (guideStep! + 1 >= total) { endGuide(); } else { guideStep = guideStep! + 1; notifyListeners(); } }
  void endGuide() { prefs.setBool('guided', true); guideStep = null; notifyListeners(); }

  // Optional fingerprint or face unlock for admin accounts. The choice is kept on this phone.
  bool get isTeam => isAdmin || isSuper;
  bool get bioLock => isTeam && (prefs.getBool('bioLock') ?? false);
  bool locked = false;
  DateTime? _leftAt;
  Future<bool> confirmOwner(String reason) async {
    try {
      final auth = LocalAuthentication();
      if (!await auth.isDeviceSupported()) return false;
      return await auth.authenticate(localizedReason: reason, options: const AuthenticationOptions(stickyAuth: true));
    } catch (_) { return false; }
  }
  /// Turning the lock on or off both need the owner's fingerprint, face or screen lock.
  Future<bool> setBioLock(bool on, String reason) async {
    if (!await confirmOwner(reason)) return false;
    await prefs.setBool('bioLock', on);
    notifyListeners();
    return true;
  }
  void lockIfSet() { if (bioLock && !locked) { locked = true; notifyListeners(); } }
  void leftApp() => _leftAt ??= DateTime.now();
  void cameBack() { final at = _leftAt; _leftAt = null; if (at != null && DateTime.now().difference(at) > const Duration(seconds: 60)) lockIfSet(); }
  Future<void> unlock(String reason) async { if (await confirmOwner(reason)) { locked = false; notifyListeners(); } }

  String get role => str(me?['role']);
  bool get signedIn => me != null;
  bool get isAdmin => role == 'admin';
  bool get isSuper => role == 'super_admin';
  J get settings => asMap(me?['settings']);
  String get theme => str(me?['theme'], prefs.getString('theme') ?? 'auto');
  bool get highContrast => me != null ? settings['highContrast'] == true : (prefs.getBool('highContrast') ?? false);
  bool get lowData => me != null ? settings['lowData'] == true : (prefs.getBool('lowData') ?? false);
  bool get reducedMotion => me != null ? settings['reducedMotion'] == true : (prefs.getBool('reducedMotion') ?? false);
  double get textScale => const {'small': 0.9, 'medium': 1.0, 'large': 1.15, 'xlarge': 1.3}[me != null ? str(settings['textSize'], 'medium') : (prefs.getString('textSize') ?? 'medium')] ?? 1.0;
  List<String> list(String key) => (config[key] as List? ?? const []).map((e) => '$e').toList();

  Future<void> start() async {
    prefs = await SharedPreferences.getInstance();
    api = Api(prefs.getString('server') ?? defaultServer)..onSignedOut = _signedOut;
    await setLanguage(prefs.getString('lang') ?? 'en', save: false);
    try { me = await api.restore(); } catch (_) {}
    if (me != null) await setLanguage(str(me!['language'], I18n.code), save: false);
    unawaited(loadConfig());
    uploads.watchNetwork();
    if (bioLock) locked = true;
    ready = true;
    notifyListeners();
    refresh();
    _poll = Timer.periodic(const Duration(seconds: 40), (_) => refresh());
  }

  @override
  void dispose() { _poll?.cancel(); super.dispose(); }

  void _signedOut() { me = null; counts = {}; priority = []; locked = false; notifyListeners(); }

  Future<void> loadConfig() async {
    try { config = asMap(await api.get('/config')); online = true; } on ApiError catch (e) { if (e.status == 0) online = false; if (e.status == 426) updateRequired = true; }
    notifyListeners();
  }

  Future<void> setLanguage(String code, {bool save = true}) async {
    await I18n.load(code);
    api.language = I18n.code;
    if (save) { await prefs.setString('lang', I18n.code); unawaited(loadConfig()); }
    notifyListeners();
  }

  /// Counts for the round icons and the items that need action. Checked regularly and after each action.
  Future<void> refresh() async {
    if (me == null) return;
    try {
      final r = asMap(await api.get('/me/notifications'));
      counts = asMap(r['counts']);
      priority = asList(r['items']).where((n) => n['priority'] == true && n['doneAt'] == null).toList();
      if (!online) online = true;
      notifyListeners();
    } on ApiError catch (e) {
      if (e.status == 0 && online) { online = false; notifyListeners(); }
      if (e.status == 426) { updateRequired = true; notifyListeners(); }
    }
  }

  Future<void> useSession(J s) async {
    api.useSession(s);
    me = asMap(s['user']);
    floated = false;
    await setLanguage(str(me!['language'], I18n.code), save: false);
    notifyListeners();
    unawaited(refresh());
  }

  Future<void> reloadMe() async {
    try { me = asMap(await api.get('/auth/me')); notifyListeners(); } catch (_) {}
  }

  /// Saves a setting to the account, or to this phone for visitors.
  Future<void> saveSettings(J patch) async {
    if (me == null) {
      for (final e in patch.entries) {
        if (e.value is bool) await prefs.setBool(e.key, e.value as bool);
        if (e.value is String) await prefs.setString(e.key, e.value as String);
      }
      if (patch['language'] is String) await setLanguage(patch['language'] as String);
      notifyListeners();
      return;
    }
    final r = asMap(await api.patch('/me/settings', patch));
    me = asMap(r['user']);
    if (patch.containsKey('wifiOnly')) uploads.settingsChanged();
    if (patch['language'] is String) await setLanguage(patch['language'] as String);
    notifyListeners();
  }

  Future<void> signOut() async {
    await api.logout();
    _signedOut();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
  static AppState read(BuildContext c) => c.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

// ---------- Shared widgets ----------
const avatarIcons = <String, IconData>{
  'wave': Icons.waves, 'anchor': Icons.anchor, 'dhow': Icons.sailing, 'lighthouse': Icons.light, 'fish': Icons.set_meal, 'lifebuoy': Icons.support,
  'compass': Icons.explore, 'canoe': Icons.kayaking, 'shell': Icons.spa, 'heron': Icons.flutter_dash, 'turtle': Icons.pets, 'sail': Icons.directions_boat, 'anonymous': Icons.person_off,
};

class Avatar extends StatelessWidget {
  final J? person;
  final double size;
  const Avatar(this.person, {super.key, this.size = 40});
  @override
  Widget build(BuildContext context) {
    final a = str(person?['avatar'], 'logo');
    final s = AppScope.of(context);
    final cs = Theme.of(context).colorScheme;
    Widget child;
    if (a == 'logo') {
      child = Container(color: C.blue, alignment: Alignment.center, child: Icon(Icons.support, color: Colors.white, size: size * .6));
    } else if (a.startsWith('avatar:')) {
      child = Container(color: cs.primary.withValues(alpha: .14), alignment: Alignment.center, child: Icon(avatarIcons[a.substring(7)] ?? Icons.waves, color: cs.primary, size: size * .58));
    } else {
      final url = a.startsWith('media:') ? '${s.api.base}/api/v1/media/avatar/${a.substring(6)}' : a;
      child = Image.network(url, fit: BoxFit.cover, width: size, height: size, errorBuilder: (_, __, ___) => Icon(Icons.person, size: size * .6));
    }
    return ExcludeSemantics(child: ClipOval(child: SizedBox(width: size, height: size, child: child)));
  }
}

String personName(J? p) => p == null ? t('A contributor') : (p['username'] != null && p['role'] != 'admin' ? '@${p['username']}' : str(p['name']));

class Pill extends StatelessWidget {
  final String text;
  final Color? color;
  const Pill(this.text, {super.key, this.color});
  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Container(margin: const EdgeInsets.only(right: 6, bottom: 4), padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: c.withValues(alpha: .14), borderRadius: BorderRadius.circular(8)), child: Text(text, style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w700)));
  }
}

class FlagChip extends StatelessWidget {
  final String? flag;
  const FlagChip(this.flag, {super.key});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2), decoration: BoxDecoration(color: C.flag(flag), borderRadius: BorderRadius.circular(99)),
      child: Text(flag ?? t('Not reviewed'), style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)));
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? text;
  final Widget? action;
  const EmptyState(this.title, {super.key, this.icon = Icons.waves, this.text, this.action});
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 54, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 10),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        if (text != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(text!, textAlign: TextAlign.center)),
        if (action != null) Padding(padding: const EdgeInsets.only(top: 14), child: action!),
      ])));
}

void toast(BuildContext context, String text, {bool error = false}) {
  final m = ScaffoldMessenger.maybeOf(context);
  m?.hideCurrentSnackBar();
  m?.showSnackBar(SnackBar(content: Text(text), behavior: SnackBarBehavior.floating, backgroundColor: error ? C.red : null, duration: Duration(seconds: error ? 6 : 3)));
}

String errText(Object e) => e is ApiError ? e.message : t('Something went wrong. Please try again.');

/// Runs an action, showing the server's message (or the general error with the reason).
Future<T?> run<T>(BuildContext context, Future<T> Function() fn, {String? ok}) async {
  try {
    final r = await fn();
    if (context.mounted) {
      final msg = r is Map && r['message'] is String ? r['message'] as String : ok;
      if (msg != null) toast(context, msg);
    }
    return r;
  } catch (e) {
    if (context.mounted) toast(context, errText(e), error: true);
    return null;
  }
}

/// Panels open as sheets sliding up from the bottom, with the story dimmed behind.
Future<T?> sheet<T>(BuildContext context, String title, Widget Function(BuildContext) builder, {bool tall = false}) => showModalBottomSheet<T>(
    context: context, isScrollControlled: true, useSafeArea: true,
    builder: (c) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom), child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(c).size.height * (tall ? .92 : .8)),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.fromLTRB(18, 0, 8, 6), child: Row(children: [
            Expanded(child: Semantics(header: true, child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)))),
            IconButton(onPressed: () => Navigator.pop(c), icon: const Icon(Icons.close), tooltip: t('Close')),
          ])),
          Flexible(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(18, 0, 18, 18), child: builder(c))),
        ]))));

/// A confirmation, optionally asking for a reason. Returns the reason ('' when none is asked), or null if cancelled.
Future<String?> confirm(BuildContext context, String title, {String? text, required String yes, String? reasonLabel, bool danger = false}) {
  final ctl = TextEditingController();
  return showDialog<String>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
        title: Text(title),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (text != null) Text(text),
          if (reasonLabel != null) Padding(padding: const EdgeInsets.only(top: 10), child: TextField(controller: ctl, maxLines: 3, onChanged: (_) => set(() {}), decoration: InputDecoration(labelText: reasonLabel))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: Text(t('Cancel'))),
          FilledButton(style: danger ? FilledButton.styleFrom(backgroundColor: C.red) : null,
              onPressed: reasonLabel != null && ctl.text.trim().length < 3 ? null : () => Navigator.pop(c, ctl.text.trim()), child: Text(yes)),
        ],
      )));
}

/// Loads something from the API and shows loading, the error with Retry, or the content.
class Loader<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Widget Function(BuildContext, T, Future<void> Function() reload) builder;
  const Loader({super.key, required this.load, required this.builder});
  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  T? data;
  Object? error;
  bool loading = true;
  @override
  void initState() { super.initState(); reload(); }
  Future<void> reload() async {
    if (mounted) setState(() { loading = data == null; error = null; });
    try { final d = await widget.load(); if (mounted) setState(() { data = d; loading = false; }); }
    catch (e) { if (mounted) setState(() { error = e; loading = false; }); }
  }
  @override
  Widget build(BuildContext context) {
    if (loading) return const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
    if (error != null && data == null) return EmptyState(errText(error!), icon: Icons.warning_amber, action: OutlinedButton(onPressed: reload, child: Text(t('Retry'))));
    return widget.builder(context, data as T, reload);
  }
}

class Field extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final int lines;
  final bool obscure;
  final TextInputType? type;
  final String? hint;
  final ValueChanged<String>? onChanged;
  const Field(this.label, this.controller, {super.key, this.lines = 1, this.obscure = false, this.type, this.hint, this.onChanged});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12), child: TextField(controller: controller, maxLines: obscure ? 1 : lines, minLines: lines > 1 ? 2 : 1, obscureText: obscure,
      keyboardType: type, onChanged: onChanged, decoration: InputDecoration(labelText: label, hintText: hint, alignLabelWithHint: true)));
}

class Choice<T> extends StatelessWidget {
  final String label;
  final T? value;
  final Map<T, String> options;
  final ValueChanged<T?> onChanged;
  const Choice(this.label, this.value, this.options, this.onChanged, {super.key});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12), child: InputDecorator(decoration: InputDecoration(labelText: label),
      child: DropdownButtonHideUnderline(child: DropdownButton<T>(value: options.containsKey(value) ? value : null, isExpanded: true, isDense: true,
          items: options.entries.map((e) => DropdownMenuItem<T>(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis))).toList(), onChanged: onChanged))));
}

class Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final Widget? trailing;
  const Section(this.title, this.children, {super.key, this.trailing});
  @override
  Widget build(BuildContext context) => Card(margin: const EdgeInsets.only(bottom: 12), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Theme.of(context).dividerTheme.color ?? Colors.grey)),
      child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5))), if (trailing != null) trailing!]),
        const SizedBox(height: 8), ...children,
      ])));
}

class Note extends StatelessWidget {
  final String text;
  final Color? color;
  final Widget? child;
  const Note(this.text, {super.key, this.color, this.child});
  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Container(margin: const EdgeInsets.only(bottom: 10), padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: c.withValues(alpha: .12), borderRadius: BorderRadius.circular(10)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(text), if (child != null) child!]));
  }
}

/// A simple chart drawn by the app itself (lines for daily figures, bars otherwise).
class MiniChart extends StatelessWidget {
  final List<String> labels;
  final List<J> series;
  final bool bars;
  const MiniChart(this.labels, this.series, {super.key, this.bars = false});
  @override
  Widget build(BuildContext context) => Semantics(
      label: series.map((s) => '${t(str(s['name']))}: ${(s['values'] as List).fold<num>(0, (a, b) => a + (b as num))}').join(', '),
      child: SizedBox(height: 150, child: CustomPaint(painter: _ChartPainter(series, bars, Theme.of(context).colorScheme.onSurface.withValues(alpha: .25), Theme.of(context).colorScheme.primary), size: Size.infinite)));
}

class _ChartPainter extends CustomPainter {
  final List<J> series;
  final bool bars;
  final Color grid, primary;
  _ChartPainter(this.series, this.bars, this.grid, this.primary);
  Color _color(J s) { final h = str(s['color']).replaceAll('#', ''); final v = int.tryParse(h, radix: 16); return v == null ? primary : Color(0xFF000000 | v); }
  @override
  void paint(Canvas canvas, Size size) {
    num max = 1;
    for (final s in series) { for (final v in (s['values'] as List)) { if ((v as num) > max) max = v; } }
    final g = Paint()..color = grid..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) { final y = size.height * i / 3; canvas.drawLine(Offset(0, y), Offset(size.width, y), g); }
    for (var si = 0; si < series.length; si++) {
      final vals = (series[si]['values'] as List).map((e) => (e as num).toDouble()).toList();
      if (vals.isEmpty) continue;
      final p = Paint()..color = series.length == 1 ? primary : _color(series[si])..strokeWidth = 2.5..style = bars ? PaintingStyle.fill : PaintingStyle.stroke..strokeCap = StrokeCap.round;
      final step = size.width / (vals.length <= 1 ? 1 : (bars ? vals.length : vals.length - 1));
      if (bars) {
        final w = step / (series.length + .5);
        for (var i = 0; i < vals.length; i++) { final h = size.height * vals[i] / max; canvas.drawRect(Rect.fromLTWH(i * step + si * w, size.height - h, w * .9, h), p); }
      } else {
        final path = Path();
        for (var i = 0; i < vals.length; i++) { final o = Offset(i * step, size.height - size.height * vals[i] / max); if (i == 0) { path.moveTo(o.dx, o.dy); } else { path.lineTo(o.dx, o.dy); } }
        canvas.drawPath(path, p);
      }
    }
  }
  @override
  bool shouldRepaint(covariant _ChartPainter old) => old.series != series || old.bars != bars;
}
