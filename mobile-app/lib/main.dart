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
          child: Directionality(textDirection: I18n.code == 'ar' ? TextDirection.rtl : TextDirection.ltr, child: child!)),
      home: s.ready ? const Shell() : const Scaffold(body: Center(child: CircularProgressIndicator())),
    );
  }
}

/// The main screen: five round icons at the top with STORIES in the centre, and the stories below.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  final stories = GlobalKey<StoriesScreenState>();
  StreamSubscription<Uri>? _links;

  @override
  void initState() {
    super.initState();
    // Deep links: a shared story link opens directly in the app.
    try { _links = AppLinks().uriLinkStream.listen(_openLink, onError: (_) {}); } catch (_) {}
  }
  @override
  void dispose() { _links?.cancel(); super.dispose(); }

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
