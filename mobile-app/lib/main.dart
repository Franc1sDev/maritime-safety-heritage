import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'screens_admin.dart';
import 'screens_main.dart';
import 'screens_public.dart';
import 'state.dart';
import 'ui.dart';

/// Maritime Safety Heritage Archive: Android app prototype.
/// Sample content only. The full build connects to the archive's secure API.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light));
  final state = AppState();
  await state.load();
  runApp(AppScope(state: state, child: const HeritageApp()));
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
        child: child!,
      ),
      home: s.me == null ? const LandingScreen() : const Shell(),
    );
  }
}

// ---------------------------------------------------------------------------
// Common page frame: background, top bar (account + sign out), side menu.
// ---------------------------------------------------------------------------
class AppPage extends StatelessWidget {
  final Widget background;
  final Widget body;
  final bool showBack;
  const AppPage({super.key, required this.background, required this.body, this.showBack = false});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final u = s.me;
    return Scaffold(
      extendBodyBehindAppBar: true,
      drawer: const MoreDrawer(),
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
              customBorder: const CircleBorder(),
              onTap: () => u.isAdmin ? push(context, const AccountScreen(asPage: true)) : Nav.goTab(context, 4),
              child: CircleAvatar(radius: 17, backgroundColor: C.blue, child: Text(u.initials, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white))),
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
      ]),
    );
  }
}

void confirmSignOut(BuildContext context) {
  final s = AppScope.read(context);
  toast(context, 'Signed out', Icons.logout_rounded);
  Navigator.of(context).popUntil((r) => r.isFirst);
  s.signOut();
  Nav.tab.value = 0;
}

// ---------------------------------------------------------------------------
// Signed-in shell: bottom tabs (standard for phone apps)
// ---------------------------------------------------------------------------
class Shell extends StatelessWidget {
  const Shell({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final admin = s.isAdmin;
    return ValueListenableBuilder<int>(
      valueListenable: Nav.tab,
      builder: (context, i, _) => Scaffold(
        body: IndexedStack(index: i, children: [
          const WelcomeScreen(),
          const BrowseScreen(),
          MapScreen(active: i == 2),
          const ShareScreen(),
          admin ? const DashboardScreen() : const AccountScreen(),
        ]),
        bottomNavigationBar: NavigationBar(
          selectedIndex: i,
          onDestinationSelected: (v) => Nav.tab.value = v,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
            const NavigationDestination(icon: Icon(Icons.search_rounded), label: 'Browse'),
            const NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map_rounded), label: 'Map'),
            const NavigationDestination(icon: Icon(Icons.volunteer_activism_outlined), selectedIcon: Icon(Icons.volunteer_activism), label: 'Share'),
            NavigationDestination(
                icon: Badge(isLabelVisible: admin && s.pending.isNotEmpty, label: Text('${s.pending.length}'),
                    child: Icon(admin ? Icons.insert_chart_outlined_rounded : Icons.person_outline_rounded)),
                label: admin ? 'Admin' : 'Me'),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// "See more": side menu with every extra option. Items glow blue briefly when it opens.
// ---------------------------------------------------------------------------
class MoreDrawer extends StatefulWidget {
  const MoreDrawer({super.key});
  @override
  State<MoreDrawer> createState() => _MoreDrawerState();
}

class _MoreDrawerState extends State<MoreDrawer> with SingleTickerProviderStateMixin {
  late final AnimationController _flash = AnimationController(vsync: this, duration: const Duration(milliseconds: 1900))..forward();
  @override
  void dispose() { _flash.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final u = s.me;
    var n = 0;
    Widget item(IconData icon, String label, VoidCallback onTap, {Widget? trailing}) {
      final k = n++;
      return AnimatedBuilder(
        animation: _flash,
        builder: (_, child) {
          final t = ((_flash.value * 1.9 - k * .05).clamp(0.0, 1.0));
          final glow = t < .25 ? t / .25 : 1 - (t - .25) / .75;
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: C.blue.withValues(alpha: .28 * glow),
              boxShadow: [BoxShadow(color: C.blue2.withValues(alpha: .7 * glow), blurRadius: 18 * glow, spreadRadius: 1)],
              border: Border.all(color: C.blue2.withValues(alpha: .85 * glow)),
            ),
            child: child,
          );
        },
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          leading: CircleIcon(icon, size: 36, solid: false),
          title: Text(label, style: const TextStyle(color: C.text, fontWeight: FontWeight.w600)),
          trailing: trailing,
          onTap: () { Navigator.of(context).pop(); onTap(); },
        ),
      );
    }

    Widget head(String t) => Padding(padding: const EdgeInsets.fromLTRB(22, 16, 22, 6), child: Text(t, style: const TextStyle(color: C.muted, fontWeight: FontWeight.w600, fontSize: 12.5)));
    Widget badge(int v) => v > 0 ? CircleAvatar(radius: 12, backgroundColor: C.blue, child: Text('$v', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800))) : const SizedBox();
    Widget onOff(bool v) => Text(v ? 'On' : 'Off', style: TextStyle(color: v ? C.sky : C.muted, fontWeight: FontWeight.w700));

    return Drawer(
      backgroundColor: const Color(0xF2040E1E),
      child: SafeArea(child: ListView(padding: const EdgeInsets.only(bottom: 20), children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 12, 10, 4),
          child: Row(children: [
            const Expanded(child: Text('More options', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white))),
            IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close_rounded), tooltip: 'Close'),
          ]),
        ),
        if (u != null) ...[
          head('Explore'),
          item(Icons.home_outlined, 'Welcome', () => Nav.goTab(context, 0)),
          item(Icons.grid_view_rounded, 'Browse the archive', () => Nav.goTab(context, 1)),
          item(Icons.map_outlined, 'Incident map', () => Nav.goTab(context, 2)),
          for (final t in types.values) item(t.icon, t.plural, () => Nav.goTab(context, 1, type: t.key, setType: true)),
          head('Take part'),
          item(Icons.volunteer_activism_outlined, 'Share a story', () => Nav.goTab(context, 3)),
        ] else ...[
          head('Get started'),
          item(Icons.login_rounded, 'Sign in or create account', () => push(context, const SignInScreen())),
        ],
        item(Icons.mail_outline_rounded, 'Contact the team', () => push(context, const ContactScreen())),
        if (u != null && u.isAdmin) ...[
          head('Admin'),
          item(Icons.insert_chart_outlined_rounded, 'Dashboard', () => Nav.goTab(context, 4)),
          item(Icons.inventory_2_outlined, 'Records', () => push(context, const RecordsAdminScreen())),
          item(Icons.upload_rounded, 'Upload and catalogue', () => push(context, const RecordFormScreen())),
          item(Icons.inbox_outlined, 'Submissions', () => push(context, const SubmissionsScreen()), trailing: badge(s.pending.length)),
          item(Icons.group_outlined, 'Users and roles', () => push(context, const UsersScreen())),
          item(Icons.mail_outline_rounded, 'Messages', () => push(context, const MessagesScreen()), trailing: badge(s.unread.length)),
          item(Icons.monitor_heart_outlined, 'Reports and logs', () => push(context, const ReportsScreen())),
        ],
        head('About'),
        item(Icons.anchor_rounded, 'About the archive', () => push(context, const AboutScreen())),
        if (u != null) item(Icons.person_outline_rounded, 'My account', () => u.isAdmin ? push(context, const AccountScreen(asPage: true)) : Nav.goTab(context, 4)),
        head('Display'),
        item(Icons.text_fields_rounded, 'Larger text', s.toggleLargeText, trailing: onOff(s.largeText)),
        item(Icons.wifi_off_rounded, 'Light mode: no video', s.toggleLowBw, trailing: onOff(s.lowBw)),
        head('Prototype'),
        item(Icons.restart_alt_rounded, 'Reset demo data', () {
          s.resetDemo();
          Nav.tab.value = 0;
        }),
      ])),
    );
  }
}
