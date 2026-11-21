import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'admin.dart';
import 'auth.dart';
import 'core.dart';
import 'pages.dart';
import 'stories.dart';

/// Remembering the Waters: the Android and iOS app. Same API, accounts and design as the website.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState();
  runApp(AppScope(state: state, child: const HeritageApp()));
  await state.start();
}

class HeritageApp extends StatelessWidget {
  const HeritageApp({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final mode = !s.ready ? ThemeMode.system : s.theme == 'dark' ? ThemeMode.dark : s.theme == 'light' ? ThemeMode.light : ThemeMode.system;
    return MaterialApp(
      title: 'Remembering the Waters', debugShowCheckedModeBanner: false, themeMode: mode,
      theme: appTheme(dark: false, highContrast: s.ready && s.highContrast), darkTheme: appTheme(dark: true, highContrast: s.ready && s.highContrast),
      builder: (c, child) => MediaQuery(data: MediaQuery.of(c).copyWith(textScaler: TextScaler.linear((s.ready ? s.textScale : 1.0) * MediaQuery.of(c).textScaler.scale(1)), disableAnimations: (s.ready && s.reducedMotion) || MediaQuery.of(c).disableAnimations),
          child: Directionality(textDirection: I18n.code == 'ar' ? TextDirection.rtl : TextDirection.ltr, child: Stack(children: [child!, if (s.ready && s.locked) const Positioned.fill(child: LockScreen())]))),
      home: s.ready ? const Shell() : const Scaffold(body: Center(child: CircularProgressIndicator())),
    );
  }
}

/// A slim bar on the main screen while files are uploading or a story is waiting for them.
class UploadsBar extends StatelessWidget {
  const UploadsBar({super.key});
  @override
  Widget build(BuildContext context) {
    final u = AppScope.read(context).uploads;
    return ListenableBuilder(listenable: u, builder: (context, _) {
      final cs = Theme.of(context).colorScheme;
      if (!u.busy) {
        if (u.notice == null) return const SizedBox.shrink();
        return Container(width: double.infinity, color: cs.primaryContainer, padding: const EdgeInsets.only(left: 12), child: Row(children: [
          Icon(Icons.check_circle_outline, size: 18, color: cs.onPrimaryContainer), const SizedBox(width: 8),
          Expanded(child: Text(u.notice!, style: TextStyle(fontSize: 13, color: cs.onPrimaryContainer))),
          IconButton(icon: const Icon(Icons.close, size: 18), tooltip: t('Close'), onPressed: u.clearNotice),
        ]));
      }
      final failed = u.pending.where((p) => p.error != null).toList();
      final sending = u.live.any((x) => x.state == 'sending' || x.state == 'waiting');
      final waitingWifi = !sending && u.live.any((x) => x.state == 'wifi');
      final line = failed.isNotEmpty ? '${t('Could not send “{title}”. It is saved in your drafts.', {'title': failed.first.title})} ${failed.first.error}'
          : u.pending.isNotEmpty ? t('Sending “{title}” when its files finish', {'title': u.pending.first.title})
          : waitingWifi ? t('Waiting for Wi-Fi') : sending ? t('Uploading… {n}%', {'n': (u.pct * 100).round()}) : t('Paused');
      return Container(width: double.infinity, color: failed.isNotEmpty ? cs.errorContainer : cs.surfaceContainerHighest, padding: const EdgeInsets.only(left: 12), child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Expanded(child: Text(line, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
          if (failed.isNotEmpty) ...[
            IconButton(icon: const Icon(Icons.refresh, size: 20), tooltip: t('Retry'), onPressed: () => u.retry(failed.first)),
            IconButton(icon: const Icon(Icons.close, size: 20), tooltip: t('Close'), onPressed: () { for (final x in List.of(failed.first.needs)) { if (x.active || x.state == 'failed') u.cancel(x); } u.drop(failed.first); }),
          ] else if (u.live.any((x) => x.large || x.state != 'sending')) IconButton(icon: Icon(sending ? Icons.pause : Icons.play_arrow, size: 20), tooltip: sending ? t('Pause') : t('Resume'), onPressed: sending ? u.pauseAll : u.resumeAll),
        ]),
        if (u.live.isNotEmpty) Padding(padding: const EdgeInsets.only(right: 12, bottom: 6), child: LinearProgressIndicator(value: u.pct)),
      ]));
    });
  }
}

/// Shown over the whole app while an admin's app lock is on: nothing behind it can be read or touched.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});
  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  bool asking = false;
  @override
  void initState() { super.initState(); WidgetsBinding.instance.addPostFrameCallback((_) => _ask()); }
  Future<void> _ask() async {
    if (asking || !mounted) return;
    setState(() => asking = true);
    await AppScope.read(context).unlock(t('Confirm it is you'));
    if (mounted) setState(() => asking = false);
  }
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(color: cs.surface, child: SafeArea(child: Center(child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.lock_outline, size: 54, color: cs.primary), const SizedBox(height: 14),
      Text(t('The app is locked'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800), textAlign: TextAlign.center), const SizedBox(height: 6),
      Text(t('Use your fingerprint, face or screen lock to open Remembering the Waters.'), textAlign: TextAlign.center), const SizedBox(height: 18),
      FilledButton.icon(onPressed: asking ? null : _ask, icon: const Icon(Icons.fingerprint), label: Text(t('Unlock'))), const SizedBox(height: 6),
      TextButton(onPressed: () => AppScope.read(context).signOut(), child: Text(t('Sign out'))),
    ])))));
  }
}

/// The main screen: five round icons at the top with STORIES in the centre, and the stories below.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> with WidgetsBindingObserver {
  final stories = GlobalKey<StoriesScreenState>();
  StreamSubscription<Uri>? _links;

  // Admin app lock: asks again after a minute away from the app.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final s = AppScope.read(context);
    if (state == AppLifecycleState.paused) s.leftApp();
    if (state == AppLifecycleState.resumed) s.cameBack();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Deep links: a shared story link opens directly in the app.
    try { _links = AppLinks().uriLinkStream.listen(_openLink, onError: (_) {}); } catch (_) {}
  }
  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); _links?.cancel(); super.dispose(); }

  void _openLink(Uri u) => openPath(u.path + (u.hasQuery ? '?${u.query}' : ''));

  /// Opens a place in the app from a path such as /stories/MS-2026-00001 or /inbox (used by links and notifications).
  void openPath(String path) {
    final u = Uri.parse(path.replaceFirst(RegExp(r'^https?://[^/]+'), ''));
    final seg = u.pathSegments;
    final app = AppScope.read(context);
    Navigator.of(context).popUntil((r) => r.isFirst);
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));
    if (seg.isEmpty) return;
    switch (seg.first) {
      case 'stories': if (seg.length > 1) stories.currentState?.openStory(seg[1]);
      case 'incidents': if (seg.length > 1) go(IncidentPage(seg[1]));
      case 'contributors': if (seg.length > 1) go(ContributorPage(seg[1]));
      case 'resources': go(AboutPage(tab: 1, resource: seg.length > 1 ? seg[1] : null));
      case 'about': go(const AboutPage());
      case 'safety': go(const SafetyConcernPage());
      case 'inbox': if (app.signedIn) go(InboxPage(open: seg.length > 1 ? seg[1] : null));
      case 'announcements': go(const AnnouncementsPage());
      case 'profile': if (app.signedIn) go(ProfilePage(section: seg.length > 1 ? seg[1] : null));
      case 'responsibilities': if (app.isAdmin) go(const ResponsibilitiesPage());
      case 'reports': if (app.isSuper) { go(const SuperPage(area: 'reports')); } else if (app.isAdmin) { go(const AdminPage(tab: 'analytics')); }
      case 'admin':
        if (seg.length > 1 && seg[1] == 'register') { go(AdminRegisterPage(invite: u.queryParameters['invite'])); }
        else if (app.isAdmin) { go(AdminPage(tab: seg.length > 1 ? (seg[1] == 'export' ? 'import' : seg[1]) : 'moderation')); }
        else if (!app.signedIn) { go(const AdminSignInPage()); }
      case 'super': if (app.isSuper) go(SuperPage(area: seg.length > 1 ? seg[1] : 'analytics'));
      case 'privacy' || 'terms' || 'rules': go(LegalPage(seg.first));
    }
  }

  Widget _round(IconData icon, String label, VoidCallback onTap, {int count = 0, bool centre = false, bool on = false}) {
    final cs = Theme.of(context).colorScheme;
    final size = centre ? 62.0 : 52.0;
    return Semantics(button: true, selected: on, label: count > 0 ? '$label: $count' : label, excludeSemantics: true, child: InkResponse(onTap: onTap, radius: 36, child: Stack(clipBehavior: Clip.none, children: [
      Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, color: on ? cs.primary : cs.surface, border: Border.all(color: cs.primary, width: 2)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: centre ? 24 : 20, color: on ? Colors.white : cs.primary),
            Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.clip, style: TextStyle(fontSize: centre ? 7.5 : 6.2, height: 1, fontWeight: FontWeight.w800, color: on ? Colors.white : cs.primary)),
          ])),
      if (count > 0) Positioned(right: -4, top: -4, child: Container(padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1), decoration: BoxDecoration(color: C.red, borderRadius: BorderRadius.circular(10)), child: Text(count > 99 ? '99+' : '$count', style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800)))),
    ])));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w)).then((_) => s.refresh());
    // Priority notifications float in the centre once after sign-in, then stay pinned at the top.
    if (s.signedIn && s.priority.isNotEmpty && !s.floated && s.me?['profileComplete'] != false) {
      s.floated = true;
      WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _float(s); });
    }
    final storiesIcon = _round(Icons.auto_stories, t('STORIES'), () { Navigator.of(context).popUntil((r) => r.isFirst); stories.currentState?.open('trending'); }, centre: true, on: true);
    final icons = !s.signedIn
        ? [_round(Icons.info_outline, t('ABOUT & RESOURCES'), () => go(const AboutPage())), storiesIcon, _round(Icons.login, t('SIGN IN'), () => go(const SignInPage()))]
        : s.isSuper
            ? [_round(Icons.person, t('MY PROFILE'), () => go(const ProfilePage())), _round(Icons.insights, t('LIVE ANALYTICS'), () => go(const SuperPage(area: 'analytics'))), storiesIcon,
                _round(Icons.picture_as_pdf, t('REPORTS'), () => go(const SuperPage(area: 'reports'))), _round(Icons.admin_panel_settings, t('MANAGE ADMINS'), () => go(const SuperPage(area: 'admins')), count: num0(s.counts['priority']))]
            : [_round(Icons.person, t('MY PROFILE'), () => go(const ProfilePage())), _round(Icons.info_outline, t('ABOUT & RESOURCES'), () => go(const AboutPage())), storiesIcon,
                _round(Icons.mail_outline, t('INBOX'), () => go(const InboxPage()), count: num0(s.counts['inbox'])), _round(Icons.campaign, t('ANNOUNCEMENTS'), () => go(const AnnouncementsPage()), count: num0(s.counts['announcements'])),
                if (s.isAdmin) _round(Icons.checklist, t('MY RESP.'), () => go(const ResponsibilitiesPage()), count: num0(s.counts['priority']))];
    return Scaffold(
      body: SafeArea(child: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(6, 6, 6, 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, crossAxisAlignment: CrossAxisAlignment.center, children: icons)),
        if (s.updateRequired) MaterialBanner(content: Text(t('Please update the app to continue.')), actions: [TextButton(onPressed: () => launchUrl(Uri.parse(s.api.base), mode: LaunchMode.externalApplication), child: Text(t('Update now')))]),
        if (!s.online) Container(width: double.infinity, color: C.yellow, padding: const EdgeInsets.all(6), child: Text(t('You are offline. Some features are unavailable.'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5))),
        if (s.priority.isNotEmpty) SizedBox(height: 34, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 10), children: [
          for (final n in s.priority.take(4)) Padding(padding: const EdgeInsets.only(right: 6), child: ActionChip(avatar: const Icon(Icons.notifications_active, size: 16), label: Text(str(n['title']), style: const TextStyle(fontSize: 12)), onPressed: () => _openNotice(s, n))),
        ])),
        const UploadsBar(),
        Expanded(child: StoriesScreen(key: stories)),
        if (s.isAdmin) SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(12, 0, 12, 6), child: FilledButton.icon(onPressed: () => openAdminPanel(context), icon: const Icon(Icons.tune), label: Text(t('ADMINISTRATIVE CONTROLS'))))),
      ])),
    );
  }

  void _openNotice(AppState s, J n) { s.api.post('/me/notifications/${n['id']}/read').catchError((_) => null); openPath(str(n['link'], '/')); }

  void _float(AppState s) => showDialog<void>(context: context, builder: (c) => AlertDialog(
        title: Text(t('Needs your action')),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final n in s.priority.take(4)) Card(child: ListTile(title: Text(str(n['title']), style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(str(n['body'])), onTap: () { Navigator.pop(c); _openNotice(s, n); })),
        ])),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: Text(t('Not now')))],
      ));
}
