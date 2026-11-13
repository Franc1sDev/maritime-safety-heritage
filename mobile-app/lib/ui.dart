import 'dart:async';
import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:video_player/video_player.dart';

import 'state.dart';

// ---------------------------------------------------------------------------
// Colours: abyss black, navy, signal blue, white (same as the web prototype)
// ---------------------------------------------------------------------------
class C {
  static const abyss = Color(0xFF02060E);
  static const deep = Color(0xFF061325);
  static const navy = Color(0xFF0B2242);
  static const blue = Color(0xFF1E6BFF);
  static const blue2 = Color(0xFF4D8DFF);
  static const sky = Color(0xFF9CC2FF);
  static const text = Color(0xFFE9F1FF);
  static const muted = Color(0xFF93A7C6);
  static const danger = Color(0xFFFF6B6B);
  static Color line = const Color(0xFF9CC2FF).withValues(alpha: .16);
  static Color glass = const Color(0xFF0A2242).withValues(alpha: .62);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: C.abyss,
    colorScheme: const ColorScheme.dark(primary: C.blue, secondary: C.sky, surface: C.deep, onSurface: C.text, error: C.danger),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: C.text, displayColor: Colors.white),
    appBarTheme: const AppBarTheme(backgroundColor: Colors.transparent, elevation: 0, scrolledUnderElevation: 0, foregroundColor: Colors.white),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.abyss.withValues(alpha: .55),
      labelStyle: const TextStyle(color: C.sky),
      hintStyle: const TextStyle(color: Color(0xFF6E84A6)),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: C.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: C.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.blue2, width: 1.6)),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(backgroundColor: C.blue, foregroundColor: Colors.white,
        minimumSize: const Size(0, 48), shape: const StadiumBorder(), textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(foregroundColor: C.text,
        minimumSize: const Size(0, 44), shape: const StadiumBorder(), side: BorderSide(color: C.line))),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: C.deep, showDragHandle: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28)))),
    dialogTheme: const DialogThemeData(backgroundColor: C.deep),
    snackBarTheme: const SnackBarThemeData(backgroundColor: Colors.white, contentTextStyle: TextStyle(color: C.abyss, fontWeight: FontWeight.w600),
        behavior: SnackBarBehavior.floating, shape: StadiumBorder()),
    navigationBarTheme: NavigationBarThemeData(backgroundColor: C.abyss.withValues(alpha: .94), indicatorColor: C.blue.withValues(alpha: .3)),
    dividerColor: C.line,
  );
}

// ---------------------------------------------------------------------------
// App state access
// ---------------------------------------------------------------------------
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

/// Lets any page switch the bottom tab (Home, Browse, Map, Share, Me/Admin).
class Nav {
  static final tab = ValueNotifier<int>(0);
  static final browseType = ValueNotifier<String?>(null);
  static void goTab(BuildContext context, int i, {String? type, bool setType = false}) {
    Navigator.of(context).popUntil((r) => r.isFirst);
    if (setType || i == 1) browseType.value = type;
    tab.value = i;
  }
}

void toast(BuildContext context, String msg, [IconData icon = Icons.check_circle_outline_rounded]) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Row(children: [Icon(icon, color: C.blue, size: 20), const SizedBox(width: 10), Expanded(child: Text(msg))])));
}

Future<T?> push<T>(BuildContext context, Widget page) =>
    Navigator.of(context).push<T>(PageRouteBuilder(
      pageBuilder: (_, a, _) => page,
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: SlideTransition(
          position: Tween(begin: const Offset(0, .03), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: child)),
    ));

Future<T?> sheet<T>(BuildContext context, {required String title, required IconData icon, required Widget Function(BuildContext) builder}) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: .62,
        maxChildSize: .94,
        builder: (ctx, sc) => ListView(controller: sc, padding: const EdgeInsets.fromLTRB(22, 0, 22, 28), children: [
          Row(children: [CircleIcon(icon, size: 44), const SizedBox(width: 12), Expanded(child: Text(title, style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)))]),
          const SizedBox(height: 16),
          builder(ctx),
        ]),
      ),
    );

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
class CircleIcon extends StatelessWidget {
  final IconData icon;
  final double size;
  final bool solid;
  const CircleIcon(this.icon, {super.key, this.size = 40, this.solid = true});
  @override
  Widget build(BuildContext context) => Container(
        width: size, height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: solid ? C.blue : C.blue.withValues(alpha: .22)),
        child: Icon(icon, size: size * .48, color: solid ? Colors.white : C.sky),
      );
}

class Glass extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? border;
  const Glass({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.border});
  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: C.glass, borderRadius: BorderRadius.circular(22), border: Border.all(color: border ?? C.line)),
        child: child,
      );
}

class TypeTag extends StatelessWidget {
  final String type;
  const TypeTag(this.type, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = types[type]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: C.blue.withValues(alpha: .2), borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(t.icon, size: 15, color: C.sky), const SizedBox(width: 6),
        Text(t.label, style: const TextStyle(color: C.sky, fontWeight: FontWeight.w700, fontSize: 12.5))]),
    );
  }
}

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});
  @override
  Widget build(BuildContext context) {
    final solid = const {'published', 'approved', 'active'}.contains(status);
    final bad = const {'rejected', 'suspended'}.contains(status);
    final fg = solid ? Colors.white : bad ? C.danger : status == 'unpublished' ? C.muted : C.sky;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: solid ? C.blue : Colors.transparent, borderRadius: BorderRadius.circular(99),
          border: Border.all(color: solid ? C.blue : bad ? C.danger.withValues(alpha: .5) : fg.withValues(alpha: .6))),
      child: Text(status[0].toUpperCase() + status.substring(1), style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

class Fact extends StatelessWidget {
  final IconData icon;
  final String text;
  const Fact(this.icon, this.text, {super.key});
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: C.muted), const SizedBox(width: 5),
        Flexible(child: Text(text, style: const TextStyle(color: C.muted, fontSize: 13), overflow: TextOverflow.ellipsis)),
      ]);
}

class PageTitle extends StatelessWidget {
  final String title;
  final String? sub;
  const PageTitle(this.title, {super.key, this.sub});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 4),
        child: Column(children: [
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -.5)),
          if (sub != null) ...[const SizedBox(height: 8), Text(sub!, textAlign: TextAlign.center, style: const TextStyle(color: C.muted, height: 1.45))],
        ]),
      );
}

// ---------------------------------------------------------------------------
// Orbs: round main options. Tap = zoom in + fading description, then act.
// A second tap during the animation acts straight away.
// ---------------------------------------------------------------------------
class OrbItem {
  final IconData icon;
  final String label, desc;
  final VoidCallback? onRun;
  final bool primary, on, ghost;
  final int badge;
  const OrbItem(this.icon, this.label, this.desc, this.onRun, {this.primary = false, this.on = false, this.ghost = false, this.badge = 0});
}

class Orb extends StatefulWidget {
  final OrbItem item;
  final double size;
  const Orb(this.item, {super.key, this.size = 76});
  @override
  State<Orb> createState() => _OrbState();
}

class _OrbState extends State<Orb> {
  final _link = LayerLink();
  bool _zoom = false;
  OverlayEntry? _entry;
  Timer? _timer;
  static _OrbState? _active;

  void _tap() {
    if (_zoom || widget.item.desc.isEmpty) return _run();
    _active?._cancel();
    _active = this;
    final reduce = MediaQuery.of(context).disableAnimations;
    final life = Duration(milliseconds: reduce ? 500 : 1500);
    setState(() => _zoom = true);
    _entry = OverlayEntry(builder: (_) => Positioned(
          width: 230,
          child: CompositedTransformFollower(
            link: _link,
            targetAnchor: Alignment.bottomCenter,
            followerAnchor: Alignment.topCenter,
            offset: const Offset(0, 14),
            child: IgnorePointer(child: _DescBubble(text: widget.item.desc, life: life)),
          ),
        ));
    Overlay.of(context).insert(_entry!);
    _timer = Timer(life - const Duration(milliseconds: 150), _run);
  }

  void _cancel() {
    _timer?.cancel();
    _entry?.remove();
    _entry = null;
    if (mounted) setState(() => _zoom = false);
    if (_active == this) _active = null;
  }

  void _run() {
    _cancel();
    widget.item.onRun?.call();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _entry?.remove();
    if (_active == this) _active = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final it = widget.item, s = widget.size;
    final Color bg = it.on ? Colors.white : it.primary ? C.blue : Colors.white.withValues(alpha: .08);
    final Color fg = it.on ? C.abyss : Colors.white;
    return Semantics(
      button: true,
      label: '${it.label}. ${it.desc}',
      child: GestureDetector(
        onTap: _tap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: s + 28,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CompositedTransformTarget(
              link: _link,
              child: AnimatedScale(
                scale: _zoom ? 1.22 : 1,
                duration: const Duration(milliseconds: 380),
                curve: Curves.easeOutBack,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: s, height: s,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _zoom ? C.blue : bg,
                    border: Border.all(color: _zoom ? Colors.white : Colors.white.withValues(alpha: it.ghost ? .35 : .28), width: it.ghost ? 1.4 : 1),
                    boxShadow: [
                      BoxShadow(color: (_zoom || it.primary ? C.blue : Colors.black).withValues(alpha: _zoom ? .6 : .35), blurRadius: _zoom ? 36 : 22, spreadRadius: _zoom ? 6 : 0, offset: const Offset(0, 8)),
                    ],
                  ),
                  child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
                    Icon(it.icon, size: s * .38, color: _zoom ? Colors.white : fg),
                    if (it.badge > 0)
                      Positioned(top: -2, right: -2, child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
                        child: Text('${it.badge}', style: const TextStyle(color: C.abyss, fontWeight: FontWeight.w800, fontSize: 12)),
                      )),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 9),
            Text(it.label, textAlign: TextAlign.center, maxLines: 2,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5, height: 1.2,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 6)])),
          ]),
        ),
      ),
    );
  }
}

class _DescBubble extends StatefulWidget {
  final String text;
  final Duration life;
  const _DescBubble({required this.text, required this.life});
  @override
  State<_DescBubble> createState() => _DescBubbleState();
}

class _DescBubbleState extends State<_DescBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.life)..forward();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, child) {
          final v = _c.value;
          final o = v < .15 ? v / .15 : v > .75 ? (1 - (v - .75) / .25) : 1.0;
          return Opacity(opacity: o.clamp(0, 1).toDouble(), child: Transform.translate(offset: Offset(0, v < .15 ? 8 * (1 - v / .15) : 0), child: child));
        },
        child: Material(
          color: Colors.white,
          elevation: 12,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(widget.text, textAlign: TextAlign.center, style: const TextStyle(color: C.abyss, fontSize: 13.5, height: 1.35, fontWeight: FontWeight.w500)),
          ),
        ),
      );
}

/// A centred group of orbs, always ending with "See more" (opens the side menu).
class OrbRow extends StatelessWidget {
  final List<OrbItem?> items;
  final double size;
  final bool seeMore;
  const OrbRow(this.items, {super.key, this.size = 72, this.seeMore = true});
  @override
  Widget build(BuildContext context) {
    final list = items.whereType<OrbItem>().toList();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 6,
        runSpacing: 16,
        children: [
          for (final o in list) Orb(o, size: size),
          if (seeMore)
            Orb(OrbItem(Icons.more_horiz_rounded, 'See more', 'Opens every other option in the side menu.', () => Scaffold.of(context).openDrawer(), ghost: true), size: size),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------
/// Every page except the welcome page: a large faded icon of what the page is about.
class PageBg extends StatelessWidget {
  final IconData icon;
  const PageBg(this.icon, {super.key});
  @override
  Widget build(BuildContext context) => Stack(fit: StackFit.expand, children: [
        const DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(.6, -.7), radius: 1.3, colors: [Color(0xFF0D2C5A), C.deep, C.abyss], stops: [0, .45, 1]))),
        Positioned(right: -60, bottom: -40, child: Icon(icon, size: 360, color: C.blue2.withValues(alpha: .09))),
        Positioned(left: 0, right: 0, bottom: 0, height: 140, child: CustomPaint(painter: _WavesPainter())),
      ]);
}

class _WavesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    for (var k = 0; k < 2; k++) {
      final p = Paint()..style = PaintingStyle.stroke..strokeWidth = 1.6..color = (k == 0 ? C.blue : C.blue2).withValues(alpha: k == 0 ? .45 : .3);
      final path = Path();
      final y = size.height * (k == 0 ? .5 : .75);
      path.moveTo(0, y);
      for (double x = 0; x <= size.width; x += 4) {
        path.lineTo(x, y + math.sin(x / size.width * math.pi * 4 + k) * 12);
      }
      canvas.drawPath(path, p);
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Welcome-page footage: Mixkit free licence (no attribution required).
class SeaClip {
  final int id;
  final String caption;
  const SeaClip(this.id, this.caption);
  String get url => 'https://assets.mixkit.co/videos/$id/$id-720.mp4';
  String get poster => 'https://assets.mixkit.co/videos/$id/$id-thumb-360-0.jpg';
}

const clips = [
  SeaClip(7194, 'Waves rolling in from the open ocean'),
  SeaClip(48365, 'Fishermen heading out on a wooden boat'),
  SeaClip(48525, 'The tide running onto the shore'),
  SeaClip(4004, 'Passenger ferries arriving at port'),
  SeaClip(50244, 'Rowing a small boat off the beach'),
  SeaClip(18758, 'A fishing boat crossing at dusk'),
];

/// Sea video slideshow with crossfades, captions and dots.
class SeaVideoBg extends StatefulWidget {
  const SeaVideoBg({super.key});
  @override
  State<SeaVideoBg> createState() => _SeaVideoBgState();
}

class _SeaVideoBgState extends State<SeaVideoBg> {
  static int _remember = 0;
  final _ctrls = <int, VideoPlayerController>{};
  int _idx = _remember;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _show(_idx);
    _restart();
  }

  void _restart() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 9), (_) => _show((_idx + 1) % clips.length));
  }

  Future<void> _prepare(int i) async {
    if (_ctrls.containsKey(i)) return;
    final c = VideoPlayerController.networkUrl(Uri.parse(clips[i].url), videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true));
    _ctrls[i] = c;
    try {
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(0);
      if (i == _idx) await c.play();
    } catch (_) {/* offline: the poster image stays visible */}
    if (mounted) setState(() {});
  }

  void _show(int i) {
    final old = _idx;
    setState(() { _idx = i; _remember = i; });
    _prepare(i).then((_) {
      final c = _ctrls[i];
      if (c != null && c.value.isInitialized) { c.seekTo(Duration.zero); c.play(); }
    });
    _prepare((i + 1) % clips.length);
    Future.delayed(const Duration(milliseconds: 1800), () {
      if (!mounted) return;
      final keep = {_idx, (_idx + 1) % clips.length};
      for (final k in _ctrls.keys.toList()) {
        if (!keep.contains(k)) { _ctrls.remove(k)?.dispose(); }
        else if (k != _idx) { _ctrls[k]?.pause(); }
      }
      if (old != _idx && !keep.contains(old)) _ctrls.remove(old)?.dispose();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _ctrls.values) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(fit: StackFit.expand, children: [
      const ColoredBox(color: Colors.black),
      for (var i = 0; i < clips.length; i++)
        if (i == _idx || _ctrls.containsKey(i))
          AnimatedOpacity(
            opacity: i == _idx ? 1 : 0,
            duration: const Duration(milliseconds: 1400),
            child: Stack(fit: StackFit.expand, children: [
              Image.network(clips[i].poster, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()),
              if (_ctrls[i]?.value.isInitialized ?? false)
                FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge,
                    child: SizedBox(width: _ctrls[i]!.value.size.width, height: _ctrls[i]!.value.size.height, child: VideoPlayer(_ctrls[i]!))),
            ]),
          ),
      // shade + navy tint keeps the theme blue, black and white
      DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [C.abyss.withValues(alpha: .62), C.abyss.withValues(alpha: .3), C.abyss.withValues(alpha: .88)], stops: const [0, .45, 1]))),
      ColoredBox(color: const Color(0xFF0A2864).withValues(alpha: .28)),
      Positioned(
        left: 18, right: 18, bottom: 14,
        child: SafeArea(top: false, child: Row(children: [
          for (var i = 0; i < clips.length; i++)
            GestureDetector(
              onTap: () { _show(i); _restart(); },
              child: AnimatedContainer(duration: const Duration(milliseconds: 300), margin: const EdgeInsets.only(right: 6), height: 8,
                  width: i == _idx ? 24 : 8, decoration: BoxDecoration(color: Colors.white.withValues(alpha: i == _idx ? 1 : .4), borderRadius: BorderRadius.circular(99))),
            ),
          const SizedBox(width: 8),
          Expanded(child: Text(clips[_idx].caption, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFD6E4FB), fontSize: 12.5))),
        ])),
      ),
    ]);
  }
}

/// Generated placeholder artwork standing in for real archive media.
class SeaArt extends StatelessWidget {
  final Rec rec;
  final bool label;
  const SeaArt(this.rec, {super.key, this.label = true});
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _SeaArtPainter(rec, label), child: const SizedBox.expand());
}

class _SeaArtPainter extends CustomPainter {
  final Rec rec;
  final bool label;
  _SeaArtPainter(this.rec, this.label);

  int get _seed { var h = 0; for (final c in (rec.id + rec.title).codeUnits) { h = (h * 31 + c) & 0x7fffffff; } return h; }

  @override
  void paint(Canvas canvas, Size size) {
    final pal = {
      'oral': const [Color(0xFF03122A), Color(0xFF0D3D8A), Color(0xFF9CC2FF)],
      'photo': const [Color(0xFF061A36), Color(0xFF1E6BFF), Color(0xFFE9F1FF)],
      'record': const [Color(0xFF020A18), Color(0xFF123A73), Color(0xFFB8D2FF)],
      'testimony': const [Color(0xFF04102A), Color(0xFF2A58B8), Color(0xFFD4E4FF)],
    }[rec.type]!;
    final s = _seed, w = size.width, h = size.height, k = w / 800;
    final hor = h * (230 + s % 60) / 450;
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [pal[0], pal[1]]).createShader(rect));
    canvas.drawCircle(Offset(w * (120 + s % 560) / 800, hor - 40 * k), 46 * k, Paint()..color = pal[2].withValues(alpha: .5));
    final hills = Path()..moveTo(0, hor)..lineTo(w * .17, hor - 22 * k)..lineTo(w * .33, hor - 8 * k)..lineTo(w * .5, hor - 30 * k)..lineTo(w * .65, hor - 6 * k)..lineTo(w, hor - 18 * k)..lineTo(w, hor)..close();
    canvas.drawPath(hills, Paint()..color = pal[0].withValues(alpha: .6));
    final sea = Rect.fromLTWH(0, hor, w, h - hor);
    canvas.drawRect(sea, Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [pal[1], pal[0]]).createShader(sea));
    for (var i = 0; i < 6; i++) {
      final y = hor + (12 + i * 34) * k;
      final p = Path()..moveTo(0, y);
      for (double x = 0; x <= w; x += 6) { p.lineTo(x, y - math.sin(x / w * math.pi * 8) * 4 * k); }
      canvas.drawPath(p, Paint()..style = PaintingStyle.stroke..strokeWidth = 3 * k..color = pal[2].withValues(alpha: (.2 - i * .025).clamp(0, 1).toDouble()));
    }
    for (var i = 0; i < 1 + s % 3; i++) {
      final x = w * (90 + (s >> (i * 3)) % 600) / 800, y = hor + (30 + i * 28) * k, sc = (.7 + i * .25) * k;
      canvas.save();
      canvas.translate(x, y);
      canvas.scale(sc);
      canvas.drawPath(Path()..moveTo(-60, 0)..lineTo(60, 0)..lineTo(42, 18)..lineTo(-44, 18)..close(), Paint()..color = pal[0]);
      if (rec.scene == 'harbour' && i == 0) {
        canvas.drawRect(const Rect.fromLTWH(-20, -34, 40, 34), Paint()..color = pal[0]);
      } else {
        canvas.drawPath(Path()..moveTo(0, -70)..lineTo(0, 0)..lineTo(36, 0)..close(), Paint()..color = pal[2].withValues(alpha: .85));
        canvas.drawRect(const Rect.fromLTWH(-2, -72, 3, 72), Paint()..color = pal[0]);
      }
      canvas.restore();
    }
    if (label) {
      final tp = TextPainter(
        text: TextSpan(text: '${rec.type == 'photo' ? 'SAMPLE PHOTOGRAPH' : types[rec.type]!.label.toUpperCase()}  ${rec.id}',
            style: TextStyle(color: Colors.white.withValues(alpha: .5), fontSize: math.max(8, 14 * k), letterSpacing: 2)),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: w);
      tp.paint(canvas, Offset(14, h - tp.height - 10));
    }
  }

  @override
  bool shouldRepaint(covariant _SeaArtPainter old) => old.rec.id != rec.id;
}
