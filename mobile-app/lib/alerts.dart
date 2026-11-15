import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import 'main.dart';
import 'motion.dart';
import 'screens_admin.dart';
import 'screens_main.dart';
import 'screens_public.dart';
import 'state.dart';
import 'ui.dart';

// ---------------------------------------------------------------------------
// Notifications on the phone screen.
// - News slides down from the top as a banner with a short summary. Slide it down to read it all;
//   tap anywhere else (or slide it up) to put it away.
// - Something you must do pops up the same way, but putting it away only flies it up to a strip at
//   the top of every screen. It stays there until it's done, then leaves with a thumbs-up.
// - Tips react to what you're doing ("Uploaded. Now wait for review"), then float away.
// ---------------------------------------------------------------------------

/// The app's navigator, so a banner (which sits above every page) can open pages.
final appNavigator = GlobalKey<NavigatorState>();
BuildContext? get navContext => appNavigator.currentState?.overlay?.context;

class TipData {
  final String text;
  final IconData icon;
  final int id;
  const TipData(this.text, this.icon, this.id);
}

final tipNote = ValueNotifier<TipData?>(null);
int _tipSeq = 0;
final _tipsShown = <String>{};

/// A short, friendly note that appears, then floats away by itself.
void tip(String text, [IconData icon = Icons.lightbulb_outline_rounded, String? once]) {
  if (once != null && !_tipsShown.add(once)) return;
  tipNote.value = TipData(text, icon, ++_tipSeq);
}

/// What the chosen files say about the story, said back to the person sharing it.
void fileTip(List<LocalFile> files) {
  if (files.isEmpty) return;
  final big = files.where((f) => f.size > 40 * 1024 * 1024).firstOrNull;
  final ext = files.map((f) => f.name.split('.').last.toLowerCase()).toSet();
  const img = {'jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'}, av = {'mp3', 'm4a', 'wav', 'ogg', 'aac', 'mp4', 'mov', 'webm', '3gp'};
  if (big != null) return tip('${big.name} is large (${fmtSize(big.size)}). Keep the app open while it uploads.', Icons.cloud_upload_outlined);
  if (ext.any(img.contains)) {
    return tip(files.length > 1 ? '${files.length} photos ready. Say who or what is in them below.' : 'Nice photo. Say who or what is in it, and roughly when it was taken.', Icons.photo_outlined);
  }
  if (ext.any(av.contains)) return tip('A recording. Mention who is speaking and where, so the team can catalogue it.', Icons.mic_none_rounded);
  tip(files.length > 1 ? '${files.length} files ready to send.' : '${files.first.name} is ready to send.', Icons.attach_file_rounded);
}

IconData noteIcon(String kind) => switch (kind) {
      'submission' => Icons.hourglass_top_rounded,
      'review' => Icons.inbox_outlined,
      'accepted' => Icons.verified_outlined,
      'declined' => Icons.chat_bubble_outline_rounded,
      'message' => Icons.mail_outline_rounded,
      'reply' => Icons.reply_rounded,
      'password' => Icons.key_outlined,
      'reminder' => Icons.alarm_rounded,
      _ => Icons.notifications_none_rounded,
    };

String ago(DateTime? d) {
  if (d == null) return '';
  final s = DateTime.now().difference(d).inSeconds;
  if (s < 60) return 'just now';
  if (s < 3600) return '${s ~/ 60} min ago';
  if (s < 86400) return '${s ~/ 3600} h ago';
  return fmtDate(d);
}

/// Opens what a notification is about.
void openNote(Note n) {
  final ctx = navContext;
  if (ctx == null) return;
  switch (n.kind) {
    case 'review':
      push(ctx, const SubmissionsScreen());
    case 'message':
      push(ctx, MessagesScreen(openId: n.target));
    case 'reply':
      push(ctx, const EnquiriesScreen());
    case 'password':
      changePasswordDialog(ctx);
    case 'reminder':
      push(ctx, const RemindersScreen());
    default:
      mySubmissions(ctx);
  }
}

String _actionLabel(Note n) => n.actionLabel.isNotEmpty ? n.actionLabel : switch (n.kind) {
      'reply' => 'Read the reply',
      'reminder' => 'Open reminders',
      'accepted' || 'declined' || 'submission' => 'My submissions',
      _ => 'Open',
    };

/// The buttons under a notification. [onLeave] runs first (closes or pins the banner).
List<Widget> noteButtons(Note n, VoidCallback onLeave, {bool dark = false}) {
  final s = navContext == null ? null : AppScope.read(navContext!);
  final outline = OutlinedButton.styleFrom(foregroundColor: dark ? C.text : C.abyss, side: BorderSide(color: dark ? C.line : C.abyss.withValues(alpha: .2)),
      minimumSize: const Size(0, 40), visualDensity: VisualDensity.compact);
  const filled = ButtonStyle(minimumSize: WidgetStatePropertyAll(Size(0, 40)), visualDensity: VisualDensity.compact);
  if (n.kind == 'reminder' && n.requiresAction) {
    return [
      FilledButton.icon(style: filled, onPressed: () async {
        try { await s?.alerts.reminderDone(n.target); } catch (e) { final c = navContext; if (c != null && c.mounted) toast(c, errText(e), Icons.error_outline_rounded); }
      }, icon: const Icon(Icons.check_rounded, size: 18), label: const Text('Done')),
      OutlinedButton.icon(style: outline, onPressed: () async {
        onLeave();
        try { await s?.alerts.reminderSnooze(n.target); tip('Snoozed. It will ring again in 10 minutes.', Icons.alarm_rounded); } catch (_) {}
      }, icon: const Icon(Icons.snooze_rounded, size: 18), label: const Text('In 10 minutes')),
    ];
  }
  return [FilledButton.icon(style: filled, onPressed: () { onLeave(); openNote(n); }, icon: const Icon(Icons.arrow_forward_rounded, size: 18), label: Text(_actionLabel(n)))];
}

// ---------------------------------------------------------------------------
// The layer above every page
// ---------------------------------------------------------------------------
class AlertsLayer extends StatefulWidget {
  final Widget child;
  const AlertsLayer({super.key, required this.child});
  @override
  State<AlertsLayer> createState() => _AlertsLayerState();
}

class _AlertsLayerState extends State<AlertsLayer> with WidgetsBindingObserver {
  final _banner = GlobalKey<_BannerState>();
  String? _lastPinned;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final a = AppScope.read(context).alerts;
    if (state == AppLifecycleState.resumed) { a.poll(); a.syncReminders(); }
    if (state == AppLifecycleState.paused) a.pause();
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final a = s.alerts;
    final top = MediaQuery.of(context).padding.top;
    return ListenableBuilder(
      listenable: a,
      builder: (context, _) {
        final n = a.showing;
        if (a.justPinned != null && a.justPinned != _lastPinned) {
          _lastPinned = a.justPinned;
          WidgetsBinding.instance.addPostFrameCallback((_) => tip('Pinned up here. It stays on every screen until it is done.', Icons.push_pin_outlined, 'pinned'));
        }
        return Stack(children: [
          widget.child,
          if (s.me != null && a.hasStrip)
            Positioned(left: 0, right: 0, top: top + kToolbarHeight + 2, child: _PinStrip(alerts: a)),
          if (n != null) ...[
            Positioned.fill(child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _banner.currentState?.leave(),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 300),
                builder: (_, v, _) => ColoredBox(color: C.abyss.withValues(alpha: .55 * v)),
              ),
            )),
            Positioned(left: 12, right: 12, top: top + 8, child: _Banner(key: _banner, note: n, thanks: a.showingThanks, alerts: a)),
          ],
          const _TipBubble(),
        ]);
      },
    );
  }
}

// ---------------------------------------------------------------------------
// The banner
// ---------------------------------------------------------------------------
class _Banner extends StatefulWidget {
  final Note note;
  final bool thanks;
  final Alerts alerts;
  const _Banner({super.key, required this.note, required this.thanks, required this.alerts});
  @override
  State<_Banner> createState() => _BannerState();
}

class _BannerState extends State<_Banner> with TickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 650))..forward();
  late final AnimationController _out = AnimationController(vsync: this, duration: const Duration(milliseconds: 380));
  late final AnimationController _ripple = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
  bool _open = false, _leaving = false;
  double _drag = 0;

  @override
  void didUpdateWidget(covariant _Banner old) {
    super.didUpdateWidget(old);
    if (old.note.id != widget.note.id) { _open = false; _leaving = false; _drag = 0; _out.value = 0; _in.forward(from: 0); }
    if (widget.thanks && !old.thanks) WidgetsBinding.instance.addPostFrameCallback((_) => celebrateNow());
  }

  @override
  void dispose() { _in.dispose(); _out.dispose(); _ripple.dispose(); super.dispose(); }

  /// Put it away: news slides up and goes; a to-do shrinks up into the strip at the top.
  Future<void> leave() async {
    if (_leaving) return;
    _leaving = true;
    if (MediaQuery.of(context).disableAnimations) { widget.alerts.dismiss(); return; }
    await _out.forward(from: 0);
    if (mounted) widget.alerts.dismiss();
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.note;
    final must = n.requiresAction;
    final canExpand = n.hasMore || n.summary.length > 90;
    return AnimatedBuilder(
      animation: Listenable.merge([_in, _out]),
      builder: (context, child) {
        final i = Curves.elasticOut.transform(_in.value.clamp(0.0, 1.0).toDouble());
        final o = Curves.easeInCubic.transform(_out.value);
        final dy = -80 * (1 - i) + _drag - (must ? 30 : 140) * o;
        final scale = must ? 1 - .55 * o : 1.0;
        return Opacity(
          opacity: ((_in.value * 3).clamp(0.0, 1.0) * (1 - (must ? .6 : 1) * o)).clamp(0.0, 1.0).toDouble(),
          child: Transform.translate(offset: Offset(0, dy), child: Transform.scale(scale: scale, alignment: Alignment.topCenter, child: child)),
        );
      },
      child: GestureDetector(
        onVerticalDragUpdate: (d) => setState(() => _drag = (_drag + d.delta.dy * .6).clamp(-120.0, 70.0).toDouble()),
        onVerticalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (_drag < -40 || v < -500) { leave(); return; }
          setState(() { if ((_drag > 28 || v > 400) && canExpand) _open = true; _drag = 0; });
        },
        child: Material(
          color: Colors.transparent,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
                  colors: widget.thanks ? const [Color(0xFFE8FFF0), Colors.white] : const [Colors.white, Color(0xFFE9F1FF)]),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: widget.thanks ? const Color(0xFF16A34A) : must ? C.blue : Colors.white, width: must || widget.thanks ? 2.5 : 1),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: .45), blurRadius: 34, offset: const Offset(0, 16)),
                if (must) BoxShadow(color: C.blue.withValues(alpha: .5), blurRadius: 30),
              ],
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 40, height: 5, margin: const EdgeInsets.only(bottom: 8), decoration: BoxDecoration(color: C.abyss.withValues(alpha: .18), borderRadius: BorderRadius.circular(9))),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _RippleIcon(icon: widget.thanks ? Icons.thumb_up_alt_rounded : noteIcon(n.kind), ripple: _ripple, green: widget.thanks),
                const SizedBox(width: 12),
                Expanded(child: AnimatedSize(
                  duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic, alignment: Alignment.topCenter,
                  child: widget.thanks
                      ? const Padding(padding: EdgeInsets.only(top: 6), child: Text('Done. Thank you!', style: TextStyle(color: C.abyss, fontWeight: FontWeight.w800, fontSize: 17)))
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Icon(must ? Icons.push_pin_rounded : Icons.fiber_new_rounded, size: 15, color: C.blue),
                            const SizedBox(width: 4),
                            Text(must ? 'To do' : 'New', style: const TextStyle(color: C.blue, fontWeight: FontWeight.w800, fontSize: 12)),
                            const SizedBox(width: 6),
                            Text(ago(n.createdAt), style: const TextStyle(color: Color(0xFF5B6D88), fontSize: 12, fontWeight: FontWeight.w600)),
                          ]),
                          const SizedBox(height: 2),
                          Text(n.title, style: const TextStyle(color: C.abyss, fontWeight: FontWeight.w800, fontSize: 16, height: 1.25)),
                          const SizedBox(height: 3),
                          Text(n.summary, maxLines: _open ? null : 2, overflow: _open ? null : TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF24344D), height: 1.35)),
                          if (_open && n.hasMore) Padding(padding: const EdgeInsets.only(top: 8), child: Text(n.body, style: const TextStyle(color: Color(0xFF24344D), height: 1.4))),
                          if (canExpand)
                            InkWell(
                              onTap: () => setState(() => _open = !_open),
                              child: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(mainAxisSize: MainAxisSize.min, children: [
                                AnimatedRotation(turns: _open ? .5 : 0, duration: const Duration(milliseconds: 300), child: const Icon(Icons.expand_more_rounded, size: 20, color: C.blue)),
                                Text(_open ? 'Show less' : 'Slide down to read it all', style: const TextStyle(color: C.blue, fontWeight: FontWeight.w700, fontSize: 13)),
                              ])),
                            ),
                          const SizedBox(height: 6),
                          Wrap(spacing: 8, runSpacing: 6, children: noteButtons(n, () { if (must) { widget.alerts.dismiss(); } else { widget.alerts.close(); } })),
                          const SizedBox(height: 4),
                          Text(must ? 'Tap outside to pin it at the top until it is done.' : 'Tap outside or slide up to close.', style: const TextStyle(color: Color(0xFF5B6D88), fontSize: 11.5)),
                        ]),
                )),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  void celebrateNow() { final c = navContext; if (c != null) celebrate(c); }
}

class _RippleIcon extends StatelessWidget {
  final IconData icon;
  final AnimationController ripple;
  final bool green;
  const _RippleIcon({required this.icon, required this.ripple, this.green = false});
  @override
  Widget build(BuildContext context) {
    final c = green ? const Color(0xFF16A34A) : C.blue;
    return SizedBox(width: 50, height: 50, child: AnimatedBuilder(
      animation: ripple,
      builder: (_, _) {
        final v = MediaQuery.of(context).disableAnimations ? 0.0 : ripple.value;
        return Stack(alignment: Alignment.center, children: [
          Transform.scale(scale: .8 + .5 * v, child: Container(decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.withValues(alpha: 1 - v), width: 2)))),
          Container(width: 44, height: 44, decoration: BoxDecoration(shape: BoxShape.circle, color: c), child: Icon(icon, color: Colors.white, size: 22)),
        ]);
      },
    ));
  }
}

// ---------------------------------------------------------------------------
// The strip of things still to do
// ---------------------------------------------------------------------------
class _PinStrip extends StatelessWidget {
  final Alerts alerts;
  const _PinStrip({required this.alerts});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 50,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          children: [
            for (final t in alerts.thanks) Padding(padding: const EdgeInsets.only(right: 8), child: _ThanksChip(key: ValueKey('t${t.id}'))),
            for (final p in alerts.pinned) Padding(padding: const EdgeInsets.only(right: 8), child: _PinChip(key: ValueKey(p.id), note: p, alerts: alerts, landing: alerts.justPinned == p.id)),
          ],
        ),
      );
}

class _PinChip extends StatefulWidget {
  final Note note;
  final Alerts alerts;
  final bool landing;
  const _PinChip({super.key, required this.note, required this.alerts, required this.landing});
  @override
  State<_PinChip> createState() => _PinChipState();
}

class _PinChipState extends State<_PinChip> with TickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
  late final AnimationController _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))..repeat();
  @override
  void dispose() { _in.dispose(); _glow.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final n = widget.note;
    final reduce = MediaQuery.of(context).disableAnimations;
    return AnimatedBuilder(
      animation: Listenable.merge([_in, _glow]),
      builder: (context, child) {
        final i = reduce ? 1.0 : Curves.elasticOut.transform(_in.value);
        final g = reduce ? 0.0 : math.sin(_glow.value * math.pi);
        final wiggle = reduce || _glow.value < .85 ? 0.0 : math.sin((_glow.value - .85) / .15 * math.pi * 4) * .25;
        return Transform.scale(scale: .4 + .6 * i, child: Opacity(opacity: _in.value.clamp(0.0, 1.0).toDouble(),
          child: Material(
            color: Colors.white,
            shape: StadiumBorder(side: BorderSide(color: C.blue, width: 2 + g)),
            elevation: 6,
            shadowColor: C.blue2.withValues(alpha: .4 + .5 * g),
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: () => widget.alerts.reopen(n),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 4, 0),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Transform.rotate(angle: wiggle, child: Icon(noteIcon(n.kind), size: 18, color: C.blue)),
                  const SizedBox(width: 6),
                  ConstrainedBox(constraints: const BoxConstraints(maxWidth: 170),
                      child: Text(n.title, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.abyss, fontWeight: FontWeight.w800, fontSize: 13))),
                  const SizedBox(width: 4),
                  if (n.kind == 'reminder')
                    IconButton.filled(visualDensity: VisualDensity.compact, iconSize: 18,
                        onPressed: () => widget.alerts.reminderDone(n.target).catchError((_) {}), icon: const Icon(Icons.check_rounded))
                  else
                    IconButton.filled(visualDensity: VisualDensity.compact, iconSize: 18, onPressed: () => openNote(n), icon: const Icon(Icons.arrow_forward_rounded)),
                ]),
              ),
            ),
          )));
      },
    );
  }
}

class _ThanksChip extends StatelessWidget {
  const _ThanksChip({super.key});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 650),
        curve: Curves.elasticOut,
        builder: (_, v, child) => Transform.scale(scale: .5 + .5 * v, child: child),
        child: Container(
          padding: const EdgeInsets.fromLTRB(6, 4, 14, 4),
          decoration: BoxDecoration(color: const Color(0xFF16A34A), borderRadius: BorderRadius.circular(99),
              boxShadow: [BoxShadow(color: const Color(0xFF16A34A).withValues(alpha: .5), blurRadius: 18)]),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [
            CircleAvatar(radius: 15, backgroundColor: Colors.white, child: Icon(Icons.sentiment_very_satisfied_rounded, color: Color(0xFF16A34A), size: 22)),
            SizedBox(width: 8),
            Icon(Icons.thumb_up_alt_rounded, color: Colors.white, size: 18),
            SizedBox(width: 6),
            Text('Done. Thank you!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ]),
        ),
      );
}

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------
class _TipBubble extends StatelessWidget {
  const _TipBubble();
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<TipData?>(
        valueListenable: tipNote,
        builder: (context, t, _) => t == null ? const SizedBox.shrink() : Positioned(
          left: 20, right: 20, bottom: 96 + MediaQuery.of(context).padding.bottom,
          child: _TipCard(key: ValueKey(t.id), data: t),
        ),
      );
}

class _TipCard extends StatefulWidget {
  final TipData data;
  const _TipCard({super.key, required this.data});
  @override
  State<_TipCard> createState() => _TipCardState();
}

class _TipCardState extends State<_TipCard> with SingleTickerProviderStateMixin {
  late final Duration _life = Duration(milliseconds: math.max(3800, math.min(8000, widget.data.text.length * 70)));
  late final AnimationController _c = AnimationController(vsync: this, duration: _life)..forward().whenComplete(() { if (tipNote.value?.id == widget.data.id) tipNote.value = null; });
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, child) {
          final ms = _life.inMilliseconds.toDouble(), t = _c.value * ms;
          final inn = Curves.elasticOut.transform((t / 600).clamp(0.0, 1.0).toDouble());
          final out = ((t - (ms - 450)) / 450).clamp(0.0, 1.0).toDouble();
          final bob = math.sin(t / 500) * 3;
          return Opacity(opacity: ((1 - out) * (t / 150).clamp(0.0, 1.0)).toDouble(),
              child: Transform.translate(offset: Offset(0, 20 * (1 - inn) - 16 * out + bob), child: Transform.scale(scale: .75 + .25 * inn, child: child)));
        },
        child: GestureDetector(
          onTap: () => tipNote.value = null,
          child: Material(
            color: const Color(0xFFFFD166),
            elevation: 12,
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 14, 8),
              child: Row(children: [
                CircleAvatar(radius: 17, backgroundColor: Colors.white, child: Icon(widget.data.icon, size: 18, color: const Color(0xFFB45309))),
                const SizedBox(width: 10),
                Expanded(child: Text(widget.data.text, style: const TextStyle(color: Color(0xFF2B1D00), fontWeight: FontWeight.w700, height: 1.35))),
              ]),
            ),
          ),
        ),
      );
}

// ---------------------------------------------------------------------------
// The bell and enquiries buttons, with counts
// ---------------------------------------------------------------------------
class AlertButtons extends StatelessWidget {
  const AlertButtons({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return ListenableBuilder(
      listenable: s.alerts,
      builder: (context, _) => Row(mainAxisSize: MainAxisSize.min, children: [
        _CountButton(icon: Icons.notifications_none_rounded, count: s.alerts.bell, tooltip: 'Notifications', onTap: () => openBell(context)),
        _CountButton(icon: Icons.chat_bubble_outline_rounded, count: s.alerts.enquiries, tooltip: 'Enquiries',
            onTap: () => push(context, s.isAdmin ? const MessagesScreen() : const EnquiriesScreen())),
      ]),
    );
  }
}

class _CountButton extends StatefulWidget {
  final IconData icon;
  final int count;
  final String tooltip;
  final VoidCallback onTap;
  const _CountButton({required this.icon, required this.count, required this.tooltip, required this.onTap});
  @override
  State<_CountButton> createState() => _CountButtonState();
}

class _CountButtonState extends State<_CountButton> with SingleTickerProviderStateMixin {
  late final AnimationController _ring = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
  @override
  void didUpdateWidget(covariant _CountButton old) {
    super.didUpdateWidget(old);
    if (widget.count > old.count) _ring.forward(from: 0);
  }
  @override
  void dispose() { _ring.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: widget.count > 0 ? '${widget.tooltip}, ${widget.count} new' : widget.tooltip,
        onPressed: widget.onTap,
        icon: AnimatedBuilder(
          animation: _ring,
          builder: (_, child) => Transform.rotate(angle: math.sin(_ring.value * math.pi * 6) * .35 * (1 - _ring.value), alignment: Alignment.topCenter, child: child),
          child: Badge(
            isLabelVisible: widget.count > 0,
            backgroundColor: Colors.white,
            textColor: C.abyss,
            label: Text(widget.count > 99 ? '99+' : '${widget.count}', style: const TextStyle(fontWeight: FontWeight.w800)),
            child: Icon(widget.icon),
          ),
        ),
      );
}

/// Everything, newest first. Opening one counts it as seen.
void openBell(BuildContext context) {
  final s = AppScope.read(context);
  sheet(context, title: 'Notifications', icon: Icons.notifications_none_rounded, builder: (ctx) => Loaded<Map<String, dynamic>>(
        load: () async => await s.api.get('/notifications', {'pageSize': 40}) as Map<String, dynamic>,
        builder: (ctx, j, reload) {
          final items = (j['items'] as List? ?? const []).whereType<Map<String, dynamic>>().map(Note.fromJson).toList();
          final unseen = (j['unviewed'] as num?)?.toInt() ?? 0;
          if (items.isEmpty) {
            return const Padding(padding: EdgeInsets.symmetric(vertical: 30), child: Column(children: [
              Icon(Icons.notifications_none_rounded, size: 46, color: C.sky),
              SizedBox(height: 8),
              Text('Nothing yet. News about your stories, replies and reminders will appear here.', textAlign: TextAlign.center, style: TextStyle(color: C.muted)),
            ]));
          }
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Text(unseen > 0 ? '$unseen not seen yet' : 'All caught up', style: const TextStyle(color: C.muted)),
              const Spacer(),
              if (unseen > 0) TextButton.icon(onPressed: () async {
                try { s.alerts.seen(await s.api.post('/notifications/viewed') as Map<String, dynamic>); await reload(); } catch (_) {}
              }, icon: const Icon(Icons.done_all_rounded), label: const Text('Mark all as seen')),
            ]),
            for (final n in items) _NoteTile(note: n, onSeen: (m) => s.alerts.seen(m), onClose: () => Navigator.of(ctx).pop()),
          ]);
        },
      ));
}

class _NoteTile extends StatefulWidget {
  final Note note;
  final void Function(Map<String, dynamic>) onSeen;
  final VoidCallback onClose;
  const _NoteTile({required this.note, required this.onSeen, required this.onClose});
  @override
  State<_NoteTile> createState() => _NoteTileState();
}

class _NoteTileState extends State<_NoteTile> {
  bool _open = false;
  @override
  Widget build(BuildContext context) {
    final n = widget.note;
    final todo = n.requiresAction && !n.done;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: _open ? C.blue.withValues(alpha: .14) : C.glass, borderRadius: BorderRadius.circular(16),
          border: Border.all(color: n.viewed ? C.line : C.blue2)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ListTile(
          onTap: () async {
            setState(() => _open = !_open);
            if (!n.viewed) {
              setState(() => n.viewed = true);
              try { widget.onSeen(await AppScope.read(context).api.post('/notifications/${n.id}/viewed') as Map<String, dynamic>); } catch (_) {}
            }
          },
          leading: CircleIcon(noteIcon(n.kind), size: 40, solid: todo),
          title: Text(n.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          subtitle: Text('${n.summary}\n${ago(n.createdAt)}${n.requiresAction ? (n.done ? ' · done' : ' · to do') : ''}', style: const TextStyle(color: C.muted, fontSize: 12.5)),
          trailing: n.viewed ? null : Container(width: 10, height: 10, decoration: const BoxDecoration(color: C.blue2, shape: BoxShape.circle)),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 280),
          child: !_open ? const SizedBox(width: double.infinity) : Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (n.hasMore) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(n.body)),
              Wrap(spacing: 8, runSpacing: 6, children: n.done ? const [] : noteButtons(n, widget.onClose, dark: true)),
            ]),
          ),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------
class RemindersScreen extends StatefulWidget {
  const RemindersScreen({super.key});
  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

String _when(DateTime d) {
  final l = d.toLocal();
  return '${fmtDate(l)}, ${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

String _until(DateTime d) {
  final s = d.difference(DateTime.now()).inSeconds;
  if (s <= 0) return 'Due now';
  if (s < 3600) return 'In ${math.max(1, (s / 60).round())} min';
  if (s < 86400) return 'In ${(s / 3600).round()} h';
  final days = (s / 86400).round();
  return 'In $days day${days == 1 ? '' : 's'}';
}

class _RemindersScreenState extends State<RemindersScreen> {
  bool _done = false;
  Key _key = UniqueKey();
  final _subject = TextEditingController(), _desc = TextEditingController();
  DateTime _at = DateTime.now().add(const Duration(hours: 1)).copyWith(minute: 0, second: 0, millisecond: 0, microsecond: 0);
  bool _busy = false;
  String? _err;

  void _reload() => setState(() => _key = UniqueKey());

  Future<DateTime?> _pick(DateTime from) async {
    final d = await showDatePicker(context: context, initialDate: from, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 3650)));
    if (d == null || !mounted) return null;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(from));
    if (t == null) return null;
    return DateTime(d.year, d.month, d.day, t.hour, t.minute);
  }

  void _quick(String k) {
    final now = DateTime.now();
    DateTime d;
    switch (k) {
      case 'eve':
        d = DateTime(now.year, now.month, now.day, 18);
        if (d.isBefore(now)) d = d.add(const Duration(days: 1));
      case 'tom':
        d = DateTime(now.year, now.month, now.day + 1, 9);
      case 'week':
        d = now.add(const Duration(days: 7));
      default:
        d = now.add(const Duration(hours: 1));
    }
    setState(() => _at = d);
    tip('It will ring ${_when(d)}.', Icons.alarm_rounded);
  }

  Future<void> _save() async {
    final s = AppScope.read(context);
    if (_subject.text.trim().isEmpty) { setState(() => _err = 'Give the reminder a subject.'); return; }
    setState(() { _busy = true; _err = null; });
    try {
      await s.api.post('/reminders', {'subject': _subject.text.trim(), 'description': _desc.text.trim(), 'dueAt': _at.toUtc().toIso8601String()});
      if (!mounted) return;
      final allowed = await PhoneAlerts.permission();
      await s.alerts.syncReminders();
      await s.alerts.poll();
      if (!mounted) return;
      toast(context, 'Reminder saved', Icons.alarm_rounded);
      tip(allowed ? "Saved. Your phone will ring at that time, even if the app is closed." : 'Saved. Allow notifications for this app so your phone can ring when it is due.', Icons.alarm_on_rounded);
      _subject.clear(); _desc.clear();
      setState(() => _busy = false);
      _reload();
    } catch (e) {
      if (mounted) setState(() { _busy = false; _err = errText(e); });
    }
  }

  Future<void> _edit(Reminder r) async {
    final s = AppScope.read(context);
    final subj = TextEditingController(text: r.subject), desc = TextEditingController(text: r.description);
    var at = r.dueAt.toLocal();
    String? err;
    await showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      icon: const CircleIcon(Icons.edit_outlined, size: 52),
      title: const Text('Change reminder'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: subj, decoration: InputDecoration(labelText: 'Subject', errorText: err)),
        const SizedBox(height: 12),
        TextField(controller: desc, minLines: 2, maxLines: 5, decoration: const InputDecoration(labelText: 'Description')),
        const SizedBox(height: 12),
        OutlinedButton.icon(onPressed: () async { final d = await _pick(at); if (d != null) set(() => at = d); }, icon: const Icon(Icons.event_rounded), label: Text(_when(at))),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          if (subj.text.trim().isEmpty) { set(() => err = 'Give the reminder a subject.'); return; }
          try {
            await s.api.patch('/reminders/${r.id}', {'subject': subj.text.trim(), 'description': desc.text.trim(), 'dueAt': at.toUtc().toIso8601String()});
            if (ctx.mounted) Navigator.pop(ctx);
            await s.alerts.syncReminders();
            await s.alerts.poll();
            if (mounted) { toast(context, 'Reminder saved', Icons.alarm_rounded); _reload(); }
          } catch (e) { set(() => err = errText(e)); }
        }, child: const Text('Save changes')),
      ],
    )));
  }

  Future<void> _act(Future<void> Function() f) async {
    try { await f(); if (mounted) _reload(); } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final past = _at.isBefore(DateTime.now());
    return AppPageFrame(
      icon: Icons.alarm_rounded,
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 110), children: [
        const PageTitle('Reminders', sub: "A subject, a note, a date and a time. When it's due, your phone rings and it pops up here."),
        const SizedBox(height: 10),
        Center(child: SegmentedButton<bool>(
          segments: const [ButtonSegment(value: false, label: Text('Coming up'), icon: Icon(Icons.alarm_rounded)), ButtonSegment(value: true, label: Text('Done'), icon: Icon(Icons.check_rounded))],
          selected: {_done}, showSelectedIcon: false, onSelectionChanged: (v) { _done = v.first; _reload(); },
        )),
        const SizedBox(height: 14),
        if (!_done) Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CoachTarget(text: 'Start with what the reminder is about.', priority: 10, when: () => _subject.text.trim().isEmpty,
              child: TextField(controller: _subject, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.title_rounded)), onChanged: (_) => setState(() {}))),
          const SizedBox(height: 12),
          TextField(controller: _desc, minLines: 2, maxLines: 5, textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Description (optional)', alignLabelWithHint: true)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async { final d = await _pick(_at); if (d != null) { setState(() => _at = d); if (d.isBefore(DateTime.now())) tip('That time has already passed, so it will ring as soon as you save it.', Icons.alarm_rounded); } },
            icon: const Icon(Icons.event_rounded),
            label: Text('${_when(_at)}  ·  ${_until(_at)}'),
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final q in const [('hour', 'In 1 hour'), ('eve', 'This evening'), ('tom', 'Tomorrow 9:00'), ('week', 'In a week')])
              ActionChip(avatar: const Icon(Icons.schedule_rounded, size: 16), label: Text(q.$2), onPressed: () => _quick(q.$1)),
          ]),
          if (past) const Padding(padding: EdgeInsets.only(top: 8), child: Text('This time has passed: it will ring straight away.', style: TextStyle(color: Color(0xFFFFD166)))),
          if (_err != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_err!, style: const TextStyle(color: C.danger))),
          const SizedBox(height: 14),
          CoachTarget(text: 'All set. Press here to save it.', priority: 11, when: () => _subject.text.trim().isNotEmpty && !_busy,
              child: FilledButton.icon(onPressed: _busy ? null : _save, icon: const Icon(Icons.alarm_add_rounded), label: Text(_busy ? 'Saving' : 'Set reminder'))),
        ])),
        const SizedBox(height: 14),
        Loaded<List<Reminder>>(
          key: _key,
          load: () async => (await s.api.get('/reminders', {'show': _done ? 'done' : 'upcoming'}) as List).whereType<Map<String, dynamic>>().map(Reminder.fromJson).toList(),
          builder: (ctx, list, _) => list.isEmpty
              ? Padding(padding: const EdgeInsets.all(24), child: Text(_done ? 'Reminders move here when you mark them as done.' : 'No reminders coming up. Set one above.', textAlign: TextAlign.center, style: const TextStyle(color: C.muted)))
              : Column(children: [for (final r in list) _ReminderCard(
                  r: r,
                  onDone: () => _act(() => s.alerts.reminderDone(r.id)),
                  onSnooze: () => _act(() => s.alerts.reminderSnooze(r.id)),
                  onEdit: () => _edit(r),
                  onDelete: () => _act(() async { await s.api.delete('/reminders/${r.id}'); await PhoneAlerts.cancel(r.id); await s.alerts.poll(); }),
                )]),
        ),
      ]),
    );
  }
}

class _ReminderCard extends StatelessWidget {
  final Reminder r;
  final VoidCallback onDone, onSnooze, onEdit, onDelete;
  const _ReminderCard({required this.r, required this.onDone, required this.onSnooze, required this.onEdit, required this.onDelete});
  @override
  Widget build(BuildContext context) {
    final due = r.fired && !r.done;
    final l = r.dueAt.toLocal();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Glass(
        border: due ? C.blue2 : null,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 62, height: 62,
              decoration: BoxDecoration(shape: BoxShape.circle, color: due ? C.blue : C.blue.withValues(alpha: .18),
                  boxShadow: due ? [BoxShadow(color: C.blue2.withValues(alpha: .6), blurRadius: 20)] : null),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('${l.day} ${const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][l.month - 1]}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                Text('${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}', style: TextStyle(color: due ? Colors.white : C.sky, fontSize: 12)),
              ]),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.subject, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
              if (r.description.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 3), child: Text(r.description, style: const TextStyle(color: C.muted))),
              const SizedBox(height: 4),
              Text(r.done ? 'Done ${fmtDate(r.doneAt)}' : due ? 'Due now' : _until(r.dueAt),
                  style: TextStyle(color: due ? const Color(0xFFFFD166) : C.sky, fontWeight: FontWeight.w700, fontSize: 12.5)),
            ])),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 4, children: [
            if (!r.done) FilledButton.icon(onPressed: onDone, icon: const Icon(Icons.check_rounded, size: 18), label: const Text('Done'),
                style: const ButtonStyle(minimumSize: WidgetStatePropertyAll(Size(0, 38)))),
            if (due) OutlinedButton.icon(onPressed: onSnooze, icon: const Icon(Icons.snooze_rounded, size: 18), label: const Text('In 10 minutes')),
            if (!r.done) TextButton.icon(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18), label: const Text('Change')),
            TextButton.icon(onPressed: onDelete, icon: const Icon(Icons.delete_outline_rounded, size: 18), label: const Text('Delete')),
          ]),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// My enquiries and the team's replies
// ---------------------------------------------------------------------------
class EnquiriesScreen extends StatelessWidget {
  const EnquiriesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPageFrame(
      icon: Icons.chat_bubble_outline_rounded,
      body: Loaded<Map<String, dynamic>>(
        load: () async {
          final j = await s.api.get('/messages/mine') as Map<String, dynamic>;
          s.alerts.enquiriesSeen();
          final unseen = (j['unseen'] as num?)?.toInt() ?? 0;
          if (unseen > 0) {
            tip('$unseen new ${unseen == 1 ? 'reply' : 'replies'} from the research team.', Icons.reply_rounded);
            final c = navContext;
            if (c != null) celebrate(c);
          }
          return j;
        },
        builder: (ctx, j, reload) {
          final items = (j['items'] as List? ?? const []).whereType<Map<String, dynamic>>().map(Message.fromJson).toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 110), children: [
              const PageTitle('Your enquiries', sub: "Questions you've sent to the research team, and their replies. Replies also arrive by email."),
              const SizedBox(height: 10),
              Center(child: FilledButton.icon(onPressed: () => push(context, const ContactScreen()), icon: const Icon(Icons.edit_outlined), label: const Text('Ask something'))),
              const SizedBox(height: 16),
              if (items.isEmpty) const Padding(padding: EdgeInsets.all(20), child: Text('Questions you send from Contact appear here with the reply.', textAlign: TextAlign.center, style: TextStyle(color: C.muted))),
              for (final m in items)
                Padding(padding: const EdgeInsets.only(bottom: 12), child: Glass(
                  border: m.isNew ? C.blue2 : null,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Icon(m.reply != null ? Icons.reply_rounded : Icons.hourglass_top_rounded, color: C.sky, size: 20),
                      const SizedBox(width: 8),
                      Expanded(child: Text(m.subject, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                      Text(fmtDate(m.createdAt), style: const TextStyle(color: C.muted, fontSize: 12)),
                    ]),
                    const SizedBox(height: 8),
                    Text(m.body),
                    const SizedBox(height: 10),
                    if (m.reply != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: C.blue.withValues(alpha: .16), borderRadius: BorderRadius.circular(14), border: Border.all(color: C.blue2.withValues(alpha: .6))),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            if (m.isNew) Container(margin: const EdgeInsets.only(right: 6), padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                                decoration: BoxDecoration(color: C.blue, borderRadius: BorderRadius.circular(99)), child: const Text('New', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800))),
                            Expanded(child: Text('Reply from the research team, ${fmtDateTime(m.repliedAt)}', style: const TextStyle(color: C.muted, fontSize: 12))),
                          ]),
                          const SizedBox(height: 6),
                          Text(m.reply!),
                        ]),
                      )
                    else
                      const Row(children: [
                        Icon(Icons.hourglass_empty_rounded, size: 16, color: C.muted),
                        SizedBox(width: 6),
                        Expanded(child: Text("Waiting for a reply. You'll get a notification and an email.", style: TextStyle(color: C.muted, fontSize: 12.5))),
                      ]),
                  ]),
                )),
            ]),
          );
        },
      ),
    );
  }
}

/// A plain page with a back button, used by the screens in this file.
class AppPageFrame extends StatelessWidget {
  final IconData icon;
  final Widget body;
  const AppPageFrame({super.key, required this.icon, required this.body});
  @override
  Widget build(BuildContext context) => AppPage(showBack: true, background: PageBg(icon), body: body);
}
