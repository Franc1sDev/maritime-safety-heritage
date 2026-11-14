import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'motion.dart';
import 'screens_admin.dart';
import 'screens_main.dart';
import 'screens_public.dart';
import 'state.dart';
import 'ui.dart';

/// Maritime Safety Heritage Archive: the Android and iOS app.
/// Uses the same secure API, accounts and archive as the website.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light));
  final state = AppState();
  MenuHook.entries = navEntries;
  runApp(AppScope(state: state, child: const HeritageApp()));
  await state.load();
}

class HeritageApp extends StatelessWidget {
  const HeritageApp({super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return MaterialApp(
      title: 'Maritime Heritage',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(s.largeText ? 1.15 : 1)),
        child: CoachLayer(child: child!),
      ),
      home: !s.ready
          ? const Scaffold(body: Center(child: LoadingView(text: 'Opening the archive')))
          : s.me == null ? const LandingScreen() : const Shell(),
    );
  }
}

// ---------------------------------------------------------------------------
// Common page frame: background, top bar (your name opens My account, and Sign out),
// and the round Menu button at the bottom left. There is no side menu: every option is round
// and inside the page.
// ---------------------------------------------------------------------------
class AppPage extends StatelessWidget {
  final Widget background;
  final Widget body;
  final bool showBack;
  /// The welcome orbit is itself the menu, so it hides the Menu button.
  final bool showMenu;
  const AppPage({super.key, required this.background, required this.body, this.showBack = false, this.showMenu = true});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final u = s.me;
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        titleSpacing: 12,
        title: Row(children: [
          if (showBack)
            IconButton(onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(Icons.arrow_back_rounded), tooltip: 'Back')
          else
            const Padding(padding: EdgeInsets.only(left: 4, right: 10), child: CircleIcon(Icons.support_rounded, size: 34)),
          if (!showBack) const Flexible(child: Text('Maritime Heritage', overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17))),
        ]),
        actions: [
          if (u != null) ...[
            Tooltip(message: 'My account', child: InkWell(
              borderRadius: BorderRadius.circular(99),
              onTap: () => u.isStaff ? push(context, const AccountScreen(asPage: true)) : Nav.goTab(context, 4),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  CircleAvatar(radius: 16, backgroundColor: C.blue, child: Text(u.initials, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white))),
                  const SizedBox(width: 8),
                  Text(u.first, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ]),
              ),
            )),
            IconButton(tooltip: 'Sign out', icon: const Icon(Icons.logout_rounded), onPressed: () => confirmSignOut(context)),
          ] else
            TextButton.icon(onPressed: () => push(context, const SignInScreen()), icon: const Icon(Icons.login_rounded, color: Colors.white),
                label: const Text('Sign in', style: TextStyle(color: Colors.white))),
          const SizedBox(width: 6),
        ],
      ),
      body: Stack(fit: StackFit.expand, children: [
        background,
        SafeArea(child: body),
        if (showMenu) const Positioned(left: 16, bottom: 18, child: SafeArea(child: MenuFab())),
      ]),
    );
  }
}

Future<void> confirmSignOut(BuildContext context, {bool everywhere = false}) async {
  final s = AppScope.read(context);
  if (everywhere && !await confirm(context, title: 'Sign out everywhere?', body: "You'll be signed out on every phone and computer, including this one.", action: 'Sign out everywhere', icon: Icons.shield_outlined)) return;
  if (!context.mounted) return;
  toast(context, everywhere ? 'Signed out on every device' : 'Signed out', Icons.logout_rounded);
  Navigator.of(context).popUntil((r) => r.isFirst);
  Nav.tab.value = 0;
  await s.signOut(everywhere: everywhere);
}

// ---------------------------------------------------------------------------
// The menu: what this person can do, in the order they are most likely to want it.
// ---------------------------------------------------------------------------
List<NavEntry> navEntries(BuildContext context) {
  final s = AppScope.read(context);
  final u = s.me;
  final list = <NavEntry>[];
  // The option the guide recommends next.
  String? next;
  if (u == null) {
    next = 'login';
  } else if (u.isStaff && s.pending > 0) {
    next = 'review';
  } else {
    next = ['browse', 'map', 'listen', 'share'].firstWhere((k) => !MenuHook.visited.contains(k), orElse: () => 'search');
  }
  const hints = {
    'login': 'Start here: sign in, or create a free account next to it.',
    'review': 'Submissions are waiting for your review.',
    'browse': 'Try this first: browse everything in the archive.',
    'map': 'Next, see where each story happened on the map.',
    'listen': "Listen to oral histories in people's own voices.",
    'share': 'Have a story or photo? Share it with the research team.',
    'search': 'Search for a place, a year or a word someone said.',
  };
  void add(String key, IconData icon, String label, String desc, VoidCallback run, {bool primary = false, int badge = 0}) =>
      list.add(NavEntry(key, OrbItem(icon, label, desc, run, primary: primary, badge: badge), hint: key == next ? hints[key] : null));

  if (u == null) {
    add('login', Icons.login_rounded, 'Sign in', 'Sign in with your own account to explore the archive.', () => push(context, const SignInScreen()), primary: true);
    add('signup', Icons.person_add_alt_rounded, 'Create account', 'Open a free account in under a minute.', () => push(context, const SignInScreen(create: true)));
  } else {
    add('search', Icons.search_rounded, 'Search', 'Search titles, transcripts, documents and places.', () => quickSearch(context), primary: !u.isStaff);
    add('browse', Icons.grid_view_rounded, 'Browse', 'Explore every item, filtered by type, water and decade.', () => Nav.goTab(context, 1));
    add('map', Icons.map_outlined, 'Incident map', 'See where each story happened, from Likoni to Lake Turkana.', () => Nav.goTab(context, 2));
    add('listen', Icons.headphones_outlined, 'Listen', 'Play oral histories in the voices of those who lived them.', () => Nav.goTab(context, 1, type: 'oral', setType: true));
    add('share', Icons.volunteer_activism_outlined, 'Share a story', 'Send a recording, photo or document to the research team.', () => Nav.goTab(context, 3));
    if (u.isStaff) {
      add('admin', Icons.insert_chart_outlined_rounded, 'Dashboard', 'Usage, collection health and recent activity.', () => Nav.goTab(context, 4), primary: true);
      add('records', Icons.inventory_2_outlined, 'Records', 'Edit, publish, unpublish or restore catalogue records.', () => push(context, const RecordsAdminScreen()));
      add('upload', Icons.upload_rounded, 'Upload', 'Add a new item and catalogue its metadata.', () => push(context, const RecordFormScreen()));
      add('review', Icons.inbox_outlined, 'Review', 'Approve or decline material sent in by the public.', () => push(context, const SubmissionsScreen()), badge: s.pending);
    }
    if (u.isAdmin) {
      add('users', Icons.group_outlined, 'Users', 'Create accounts, change roles, suspend accounts.', () => push(context, const UsersScreen()));
      add('messages', Icons.mail_outline_rounded, 'Messages', 'Messages from the contact form.', () => push(context, const MessagesScreen()), badge: s.unread);
      add('reports', Icons.monitor_heart_outlined, 'Reports', 'Usage, the audit log and CSV exports.', () => push(context, const ReportsScreen()));
    }
  }
  add('about', Icons.anchor_rounded, 'About', 'Who is behind the archive, privacy and terms.', () => push(context, const AboutScreen()));
  add('contact', Icons.mail_outline_rounded, 'Contact', 'Send a message to the research team.', () => push(context, const ContactScreen()));
  add('display', Icons.tune_rounded, 'Display', 'Larger text, light mode for slow connections, and the helper hints.', () => displayOptions(context));
  add('server', Icons.dns_outlined, 'Server', 'The address of the archive this app connects to.', () => changeServer(context));
  return list;
}

/// Larger text, light mode and the guide, as three round switches.
void displayOptions(BuildContext context) {
  showDialog(context: context, builder: (ctx) {
    final s = AppScope.of(ctx);
    return AlertDialog(
      icon: const CircleIcon(Icons.tune_rounded, size: 52),
      title: const Text('Display'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Saved on this phone only.', style: TextStyle(color: C.muted)),
        OrbRow([
          OrbItem(Icons.text_fields_rounded, s.largeText ? 'Larger text: on' : 'Larger text', '', s.toggleLargeText, on: s.largeText),
          OrbItem(Icons.wifi_off_rounded, s.lowBw ? 'Light mode: on' : 'Light mode', '', s.toggleLowBw, on: s.lowBw),
          OrbItem(Icons.auto_awesome_rounded, s.hints ? 'Hints: on' : 'Hints: off', '', s.toggleHints, on: s.hints),
        ], size: 60),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done'))],
    );
  });
}

// ---------------------------------------------------------------------------
// Signed-in shell. Page 0 is the welcome orbit; the others are reached from it or the Menu button.
// ---------------------------------------------------------------------------
class Shell extends StatelessWidget {
  const Shell({super.key});
  static const _keys = ['home', 'browse', 'map', 'share', 'admin'];
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final admin = s.isStaff;
    return ValueListenableBuilder<int>(
      valueListenable: Nav.tab,
      builder: (context, i, _) {
        MenuHook.current = i == 4 && !admin ? null : _keys[i];
        return PopScope(
          // The back button returns to the welcome orbit before leaving the app.
          canPop: i == 0,
          onPopInvokedWithResult: (didPop, _) { if (!didPop) Nav.tab.value = 0; },
          child: Scaffold(
            body: IndexedStack(index: i, children: [
              const CoachTab(tab: 0, child: WelcomeScreen()),
              const CoachTab(tab: 1, child: BrowseScreen()),
              CoachTab(tab: 2, child: MapScreen(active: i == 2)),
              const CoachTab(tab: 3, child: ShareScreen()),
              CoachTab(tab: 4, child: admin ? const DashboardScreen() : const AccountScreen()),
            ]),
          ),
        );
      },
    );
  }
}
