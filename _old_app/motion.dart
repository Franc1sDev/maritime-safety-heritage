import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import 'ui.dart';

/// Motion, the orbit menu and the guide.
///
/// - The orbit: every option floats around the centre of the screen, never scrolling.
///   Sliding a finger over it zooms in the option under it while the others make way and fade back.
/// - The Menu button: one round, gently glowing button at the bottom left of every other page.
///   It opens the orbit over the page.
/// - The guide: when you pause, a tapping hand, a pulsing ring and a short note point to the
///   next useful thing to press.

// ---------------------------------------------------------------------------
// Menu entries
// ---------------------------------------------------------------------------
class NavEntry {
  final String key;
  final OrbItem item;
  final String? hint;
  const NavEntry(this.key, this.item, {this.hint});
}

/// Set by main.dart: builds the menu and opens it. Kept here so every screen can reach it.
class MenuHook {
  static List<NavEntry> Function(BuildContext context)? entries;
  static String? current;
  static final visited = <String>{};
  static void open(BuildContext context) => openMenu(context);
}

// ---------------------------------------------------------------------------
// The orbit
// ---------------------------------------------------------------------------
class OrbitMenu extends StatefulWidget {
  final List<NavEntry> entries;
  final Widget center;
  final String? current;
  final VoidCallback? onChosen;
  const OrbitMenu({super.key, required this.entries, required this.center, this.current, this.onChosen});
  @override
  State<OrbitMenu> createState() => _OrbitMenuState();
}

class _OrbitMenuState extends State<OrbitMenu> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();
  Offset? _finger;

  @override
  void dispose() { _in.dispose(); super.dispose(); }

  /// Points spaced evenly along an ellipse (by length, not angle), so tall phone screens don't bunch them up.
  List<Offset> _along(double a, double b, int count, double offset) {
    const n = 360;
    final pts = <Offset>[];
    final len = <double>[0];
    for (var i = 0; i <= n; i++) {
      final t = -math.pi / 2 + i / n * 2 * math.pi;
      pts.add(Offset(a * math.cos(t), b * math.sin(t)));
      if (i > 0) len.add(len[i - 1] + (pts[i] - pts[i - 1]).distance);
    }
    final total = len[n];
    final out = <Offset>[];
    for (var j = 0; j < count; j++) {
      final want = (j + offset) / count * total;
      var i = 0;
      while (i < n && len[i] < want) { i++; }
      out.add(pts[i]);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    return LayoutBuilder(builder: (context, box) {
      final w = box.maxWidth, h = box.maxHeight, n = widget.entries.length;
      var s = math.min(64.0, math.max(48.0, math.min(w, h) / 6.5));
      final rx = math.max(70.0, w / 2 - s / 2 - 34), ry = math.max(90.0, h / 2 - s / 2 - 30);
      final perimeter = math.pi * (3 * (rx + ry) - math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      final cap = (perimeter / (s + 34)).floor();
      final rings = <List<double>>[];
      if (n <= cap) {
        rings.add([rx, ry, n.toDouble()]);
      } else {
        s = math.max(44.0, s * .85);
        final outer = math.min(n, math.max((n * .62).ceil(), (perimeter / (s + 28)).floor()));
        rings.add([rx, ry, outer.toDouble()]);
        rings.add([rx * .58, ry * .6, (n - outer).toDouble()]);
      }
      final c = Offset(w / 2, h / 2);
      final places = <Offset>[];
      for (var r = 0; r < rings.length; r++) {
        places.addAll(_along(rings[r][0], rings[r][1], rings[r][2].toInt(), r == 0 ? 0 : .5).map((p) => c + p));
      }
      final inner = rings.last;
      final slot = s + 30;

      // Finger zoom: the option nearest the finger grows, close neighbours make way, the rest fade back.
      double best = 0;
      final fs = <double>[];
      for (final p in places) {
        final f = _finger == null ? 0.0 : math.max(0.0, 1 - ((_finger! - p).distance / 120));
        fs.add(f);
        best = math.max(best, f);
      }

      return GestureDetector(
        behavior: HitTestBehavior.translucent,
        onPanStart: reduce ? null : (d) => setState(() => _finger = d.localPosition),
        onPanUpdate: reduce ? null : (d) => setState(() => _finger = d.localPosition),
        onPanEnd: (_) => setState(() => _finger = null),
        onPanCancel: () => setState(() => _finger = null),
        child: Stack(clipBehavior: Clip.none, children: [
          // Faint rings that breathe.
          for (var r = 0; r < rings.length; r++)
            Positioned(
              left: c.dx - rings[r][0], top: c.dy - rings[r][1], width: rings[r][0] * 2, height: rings[r][1] * 2,
              child: IgnorePointer(child: _Breathe(child: DecoratedBox(decoration: BoxDecoration(
                borderRadius: BorderRadius.all(Radius.elliptical(rings[r][0], rings[r][1])),
                border: Border.all(color: C.sky.withValues(alpha: .13)),
              )))),
            ),
          Positioned(
            left: c.dx - inner[0] * .82, top: c.dy - inner[1] * .7, width: inner[0] * 1.64, height: inner[1] * 1.4,
            child: FadeTransition(opacity: CurvedAnimation(parent: _in, curve: const Interval(0, .5)), child: Center(child: widget.center)),
          ),
          for (var i = 0; i < places.length; i++)
            AnimatedBuilder(
              animation: _in,
              builder: (context, child) {
                final t = reduce ? 1.0 : Curves.easeOutBack.transform(((_in.value - i * .035).clamp(0.0, .65) / .65));
                final p = Offset.lerp(c, places[i], t)!;
                final f = fs[i];
                var push = Offset.zero;
                if (_finger != null && f > 0 && f < .95) {
                  final v = places[i] - _finger!;
                  if (v.distance > 1) push = v / v.distance * (22 * f * (1 - f) * 4 * best);
                }
                final scale = (1 + .55 * f * f) * (.3 + .7 * t);
                final recede = best > .6 && f < .35;
                return Positioned(
                  left: p.dx - slot / 2 + push.dx, top: p.dy - s / 2 + push.dy, width: slot,
                  child: Opacity(
                    opacity: t.clamp(0.0, 1.0).toDouble() * (recede ? .5 : 1),
                    child: Transform.scale(scale: scale, alignment: Alignment.topCenter, child: child),
                  ),
                );
              },
              child: _entry(widget.entries[i], s),
            ),
        ]),
      );
    });
  }

  Widget _entry(NavEntry e, double s) {
    final it = e.item;
    final here = e.key == widget.current;
    final orb = Orb(OrbItem(it.icon, it.label, it.desc, () { widget.onChosen?.call(); MenuHook.visited.add(e.key); it.onRun?.call(); },
        primary: it.primary, on: here || it.on, badge: it.badge), size: s);
    return e.hint == null ? orb : CoachTarget(text: e.hint!, priority: 5, round: true, child: orb);
  }
}

class _Breathe extends StatefulWidget {
  final Widget child;
  const _Breathe({required this.child});
  @override
  State<_Breathe> createState() => _BreatheState();
}

class _BreatheState extends State<_Breathe> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 6))..repeat(reverse: true);
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, child) => Opacity(opacity: .45 + .55 * _c.value, child: Transform.scale(scale: 1 + .012 * _c.value, child: child)),
        child: widget.child,
      );
}

/// Opens every option around the screen, over the current page (which blurs behind it).
Future<void> openMenu(BuildContext context) {
  final build = MenuHook.entries;
  if (build == null) return Future.value();
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Close the menu',
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 380),
    pageBuilder: (ctx, a, _) => _MenuOverlay(entries: build(context)),
    transitionBuilder: (ctx, a, _, child) {
      final v = Curves.easeOutCubic.transform(a.value);
      return BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 10 * v, sigmaY: 10 * v),
        child: Opacity(opacity: v, child: Transform.scale(scale: .92 + .08 * v, child: child)),
      );
    },
  );
}

class _MenuOverlay extends StatelessWidget {
  final List<NavEntry> entries;
  const _MenuOverlay({required this.entries});
  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xE6020A16),
        child: SafeArea(child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 16, 8, 16),
          child: OrbitMenu(
            entries: entries,
            current: MenuHook.current,
            onChosen: () => Navigator.of(context).pop(),
            center: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Where to next?', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              OutlinedButton.icon(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close_rounded), label: const Text('Close')),
            ]),
          ),
        )),
      );
}

// ---------------------------------------------------------------------------
// The round Menu button (bottom left on every page except the welcome orbit)
// ---------------------------------------------------------------------------
class MenuFab extends StatefulWidget {
  const MenuFab({super.key});
  @override
  State<MenuFab> createState() => _MenuFabState();
}

class _MenuFabState extends State<MenuFab> with TickerProviderStateMixin {
  late final AnimationController _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: 2800))..repeat();
  late final AnimationController _land = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));
  static int _tips = 0;
  bool _down = false;

  @override
  void initState() {
    super.initState();
    // When a page opens from the menu, the button bounces and lights up so you can see where the menu went.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _land.forward(from: 0);
      if (_tips < 2 && AppScope.read(context).hints) {
        _tips++;
        Timer(const Duration(milliseconds: 700), () { if (mounted) _tip(); });
      }
    });
  }

  void _tip() {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached) return;
    final at = box.localToGlobal(Offset.zero);
    final entry = OverlayEntry(builder: (_) => Positioned(
          left: at.dx + box.size.width + 12, bottom: MediaQuery.of(context).size.height - at.dy - box.size.height / 2 - 30,
          width: 230,
          child: IgnorePointer(child: _PopNote(text: 'Your menu is here. Press it any time to see every option around the screen.')),
        ));
    Overlay.of(context).insert(entry);
    Timer(const Duration(milliseconds: 5000), entry.remove);
  }

  @override
  void dispose() { _glow.dispose(); _land.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    return CoachTarget(
      text: 'Every option is behind this Menu button.',
      priority: 90,
      round: true,
      child: Semantics(
        button: true,
        label: 'Menu: every option around the screen',
        child: GestureDetector(
          onTapDown: (_) => setState(() => _down = true),
          onTapCancel: () => setState(() => _down = false),
          onTapUp: (_) { setState(() => _down = false); openMenu(context); },
          child: AnimatedScale(
            scale: _down ? .88 : 1,
            duration: const Duration(milliseconds: 120),
            child: AnimatedBuilder(
              animation: Listenable.merge([_glow, _land]),
              builder: (_, _) {
                final g = reduce ? 0.0 : _glow.value;
                final l = _land.value;
                final bounce = reduce ? 1.0 : 1 + .25 * math.sin(l * math.pi * 3) * (1 - l);
                return Transform.scale(
                  scale: bounce,
                  child: Container(
                    width: 64, height: 64,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle, color: C.blue,
                      border: Border.all(color: Colors.white.withValues(alpha: .55)),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: .45), blurRadius: 18, offset: const Offset(0, 8)),
                        BoxShadow(color: C.blue2.withValues(alpha: .55 * (1 - g)), blurRadius: 4, spreadRadius: 14 * g),
                        if (l > 0 && l < 1) BoxShadow(color: C.sky.withValues(alpha: .9 * (1 - l)), blurRadius: 30, spreadRadius: 10 * (1 - l)),
                      ],
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Transform.rotate(angle: reduce ? 0 : g * 2 * math.pi / 6, child: const Icon(Icons.explore_rounded, color: Colors.white, size: 24)),
                      const Text('Menu', style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _PopNote extends StatefulWidget {
  final String text;
  const _PopNote({required this.text});
  @override
  State<_PopNote> createState() => _PopNoteState();
}

class _PopNoteState extends State<_PopNote> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 5000))..forward();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, child) {
          final v = _c.value;
          final o = v < .08 ? v / .08 : v > .88 ? (1 - v) / .12 : 1.0;
          return Opacity(opacity: o.clamp(0.0, 1.0).toDouble(), child: Transform.translate(offset: Offset(v < .08 ? -20 * (1 - v / .08) : 0, 0), child: child));
        },
        child: _NoteCard(text: widget.text),
      );
}

class _NoteCard extends StatelessWidget {
  final String text;
  const _NoteCard({required this.text});
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 14,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 10, height: 10, margin: const EdgeInsets.only(top: 5, right: 10), decoration: const BoxDecoration(color: C.blue, shape: BoxShape.circle)),
            Expanded(child: Text(text, style: const TextStyle(color: C.abyss, fontSize: 13.5, height: 1.35, fontWeight: FontWeight.w700))),
          ]),
        ),
      );
}

// ---------------------------------------------------------------------------
// The guide
// ---------------------------------------------------------------------------
/// Marks something the guide may point to. Lower [priority] wins. [when] decides if it applies right now.
class CoachTarget extends StatefulWidget {
  final String text;
  final int priority;
  final bool round;
  final bool Function()? when;
  final Widget child;
  const CoachTarget({super.key, required this.text, required this.child, this.priority = 50, this.round = false, this.when});
  @override
  State<CoachTarget> createState() => CoachTargetState();
}

class CoachTargetState extends State<CoachTarget> {
  static final all = <CoachTargetState>{};
  @override
  void initState() { super.initState(); all.add(this); }
  @override
  void dispose() { all.remove(this); super.dispose(); }

  /// The rectangle on screen, or null when it isn't showing on the current page.
  Rect? get rect {
    if (!mounted) return null;
    if (widget.when != null && !widget.when!()) return null;
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return null;
    final tab = CoachTab.of(context);
    if (tab != null && tab != Nav.tab.value) return null;
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached || !box.hasSize) return null;
    final r = box.localToGlobal(Offset.zero) & box.size;
    final screen = MediaQuery.of(context).size;
    if (r.bottom < 60 || r.top > screen.height - 20 || r.width == 0) return null;
    return r;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Tells guide targets which shell tab they belong to.
class CoachTab extends InheritedWidget {
  final int tab;
  const CoachTab({super.key, required this.tab, required super.child});
  static int? of(BuildContext context) => context.getInheritedWidgetOfExactType<CoachTab>()?.tab;
  @override
  bool updateShouldNotify(CoachTab old) => old.tab != tab;
}

/// Sits above the whole app. Waits for a pause, then points at the best target on screen.
class CoachLayer extends StatefulWidget {
  final Widget child;
  const CoachLayer({super.key, required this.child});
  @override
  State<CoachLayer> createState() => _CoachLayerState();
}

class _CoachLayerState extends State<CoachLayer> with TickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
  Timer? _idle;
  CoachTargetState? _target;
  Rect? _rect;

  @override
  void initState() {
    super.initState();
    _pulse.addListener(_follow);
    Nav.tab.addListener(_restart);
    _schedule(const Duration(milliseconds: 1800));
  }

  @override
  void dispose() {
    _idle?.cancel();
    _pulse.dispose();
    Nav.tab.removeListener(_restart);
    super.dispose();
  }

  void _restart() { _hide(); _schedule(const Duration(milliseconds: 1600)); }

  void _schedule([Duration d = const Duration(milliseconds: 2600)]) {
    _idle?.cancel();
    _idle = Timer(d, _show);
  }

  void _hide() {
    if (_target != null || _rect != null) setState(() { _target = null; _rect = null; });
  }

  void _show() {
    if (!mounted) return;
    final s = AppScope.read(context);
    if (!s.hints) return _hide();
    CoachTargetState? best;
    Rect? bestRect;
    for (final t in CoachTargetState.all) {
      final r = t.rect;
      if (r == null) continue;
      if (best == null || t.widget.priority < best.widget.priority) { best = t; bestRect = r; }
    }
    if (best == null) return _hide();
    setState(() { _target = best; _rect = bestRect; });
  }

  void _follow() {
    final t = _target;
    if (t == null) return;
    final r = t.rect;
    if (r == null) { _hide(); _schedule(); return; }
    if (r != _rect) setState(() => _rect = r);
  }

  @override
  Widget build(BuildContext context) {
    final r = _rect, t = _target;
    final size = MediaQuery.of(context).size;
    final reduce = MediaQuery.of(context).disableAnimations;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) { _hide(); _schedule(); },
      child: Stack(children: [
        widget.child,
        if (r != null && t != null)
          Positioned.fill(child: IgnorePointer(child: AnimatedBuilder(
            animation: _pulse,
            builder: (_, _) {
              final v = reduce ? .5 : _pulse.value;
              final grow = 1 + .1 * math.sin(v * math.pi);
              const pad = 10.0;
              final ring = t.widget.round
                  ? Rect.fromCenter(center: r.center, width: (r.shortestSide + pad * 2) * grow, height: (r.shortestSide + pad * 2) * grow)
                  : Rect.fromCenter(center: r.center, width: (r.width + pad * 2) * grow, height: (r.height + pad * 2) * grow);
              final tapT = v < .45 ? v / .45 : v < .6 ? 1.0 : 1 - (v - .6) / .4;
              final hand = Offset(r.center.dx + math.min(r.width / 2, 34) - 6 + 8 * (1 - tapT), r.center.dy + math.min(r.height / 2, 26) - 2 + 10 * (1 - tapT));
              final below = r.bottom + 130 < size.height;
              final noteW = math.min(270.0, size.width - 24);
              final noteLeft = (r.center.dx - noteW / 2).clamp(12.0, math.max(12.0, size.width - noteW - 12)).toDouble();
              return Stack(children: [
                Positioned.fromRect(rect: ring, child: Container(decoration: BoxDecoration(
                  shape: t.widget.round ? BoxShape.circle : BoxShape.rectangle,
                  borderRadius: t.widget.round ? null : BorderRadius.circular(18),
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [BoxShadow(color: C.blue2.withValues(alpha: .75 * (1.15 - grow * .9)), blurRadius: 30, spreadRadius: 4)],
                ))),
                Positioned(left: hand.dx, top: hand.dy, child: Transform.rotate(angle: -.2, child: Transform.scale(scale: 1 - .08 * tapT,
                    child: const Icon(Icons.touch_app_rounded, size: 44, color: Colors.white, shadows: [Shadow(color: Colors.black87, blurRadius: 10)])))),
                Positioned(left: noteLeft, width: noteW, top: below ? r.bottom + 44 : math.max(70.0, r.top - 86),
                    child: Transform.translate(offset: Offset(0, -3 * math.sin(v * 2 * math.pi)), child: _NoteCard(text: t.widget.text))),
              ]);
            },
          ))),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Little moments
// ---------------------------------------------------------------------------
/// A short burst of colour when something worked.
void celebrate(BuildContext context) {
  if (MediaQuery.of(context).disableAnimations) return;
  final overlay = Overlay.maybeOf(context);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(builder: (_) => const IgnorePointer(child: _Confetti()));
  overlay.insert(entry);
  Timer(const Duration(milliseconds: 1600), entry.remove);
}

class _Confetti extends StatefulWidget {
  const _Confetti();
  @override
  State<_Confetti> createState() => _ConfettiState();
}

class _ConfettiState extends State<_Confetti> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..forward();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (_, _) => CustomPaint(size: Size.infinite, painter: _ConfettiPainter(_c.value)));
}

class _ConfettiPainter extends CustomPainter {
  final double t;
  _ConfettiPainter(this.t);
  static const colours = [C.blue, C.sky, Colors.white, Color(0xFF4DD4FF), Color(0xFFFFD166)];
  @override
  void paint(Canvas canvas, Size size) {
    final origin = Offset(size.width / 2, size.height - 140);
    final e = Curves.easeOutCubic.transform(t);
    for (var i = 0; i < 36; i++) {
      final a = i / 36 * 2 * math.pi;
      final d = 110.0 + (i * 53) % 140;
      final p = origin + Offset(math.cos(a) * d * e, math.sin(a) * d * e - 60 * e + 220 * t * t);
      final paint = Paint()..color = colours[i % colours.length].withValues(alpha: (1 - t).clamp(0.0, 1.0).toDouble());
      canvas.save();
      canvas.translate(p.dx, p.dy);
      canvas.rotate(t * 6 + i);
      canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-4, -6, 8, 12), const Radius.circular(2)), paint);
      canvas.restore();
    }
  }
  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}

/// Pages come into focus: blurred and slightly small at first, then sharp.
Route<T> focusRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 520),
      reverseTransitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (context, a, b, child) {
        if (MediaQuery.of(context).disableAnimations) return FadeTransition(opacity: a, child: child);
        return AnimatedBuilder(
          animation: Listenable.merge([a, b]),
          builder: (_, child) {
            final v = Curves.easeOutCubic.transform(a.value);
            final out = Curves.easeIn.transform(b.value);
            final blur = 12 * (1 - v) + 6 * out;
            return Opacity(
              opacity: v,
              child: Transform.scale(
                scale: (.94 + .06 * v) * (1 - .03 * out),
                child: blur < .2 ? child : ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur), child: child),
              ),
            );
          },
          child: child,
        );
      },
    );
