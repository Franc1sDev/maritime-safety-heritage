import 'dart:async';
import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import 'main.dart';
import 'screens_admin.dart';
import 'screens_public.dart';
import 'state.dart';
import 'ui.dart';

// ---------------------------------------------------------------------------
// Welcome (signed in): sea video slideshow behind the main orbs
// ---------------------------------------------------------------------------
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final u = s.me!;
    final orbs = u.isAdmin
        ? [
            OrbItem(Icons.insert_chart_outlined_rounded, 'Dashboard', 'Visits, collection health and recent activity.', () => Nav.goTab(context, 4), primary: true),
            OrbItem(Icons.inbox_outlined, 'Review', 'Approve or reject material sent in by the public.', () => push(context, const SubmissionsScreen()), badge: s.pending.length),
            OrbItem(Icons.upload_rounded, 'Upload', 'Add a new item and catalogue its metadata.', () => push(context, const RecordFormScreen())),
            OrbItem(Icons.search_rounded, 'Search', 'Search titles, transcripts, documents and places.', () => quickSearch(context)),
            OrbItem(Icons.map_outlined, 'Incident map', 'See where each story happened.', () => Nav.goTab(context, 2)),
          ]
        : [
            OrbItem(Icons.search_rounded, 'Search', 'Search titles, transcripts, documents and places.', () => quickSearch(context), primary: true),
            OrbItem(Icons.grid_view_rounded, 'Browse', 'Explore every item, filtered by type, water and decade.', () => Nav.goTab(context, 1)),
            OrbItem(Icons.map_outlined, 'Incident map', 'See where each story happened, from Likoni to Lake Turkana.', () => Nav.goTab(context, 2)),
            OrbItem(Icons.headphones_outlined, 'Listen', 'Play oral histories in the voices of those who lived them.', () => Nav.goTab(context, 1, type: 'oral', setType: true)),
            OrbItem(Icons.volunteer_activism_outlined, 'Share a story', 'Send a recording, photo or document to the research team.', () => Nav.goTab(context, 3)),
          ];
    return AppPage(
      background: const WelcomeBackground(),
      body: LayoutBuilder(builder: (context, box) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 50),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight - 60),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('${_greeting()}, ${u.first}', textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -.8,
                    shadows: const [Shadow(color: Colors.black54, blurRadius: 24)])),
            const SizedBox(height: 10),
            const Text("Stories, photographs and records from Kenya's coast, lakes and rivers.", textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFFD6E4FB), fontSize: 15.5, height: 1.45)),
            const SizedBox(height: 10),
            OrbRow(orbs),
          ]),
        ),
      )),
    );
  }
}

void quickSearch(BuildContext context) {
  final s = AppScope.read(context);
  var q = '';
  sheet(context, title: 'Quick search', icon: Icons.search_rounded, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
    final res = q.trim().isEmpty ? <Rec>[] : s.search(q: q).take(8).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(autofocus: true, onChanged: (v) => set(() => q = v),
          decoration: const InputDecoration(hintText: 'Try life jackets, ferry, Lake Turkana', prefixIcon: Icon(Icons.search_rounded))),
      const SizedBox(height: 10),
      if (q.trim().isNotEmpty && res.isEmpty) Padding(padding: const EdgeInsets.all(12), child: Text('Nothing matches "$q". Try fewer words.', style: const TextStyle(color: C.muted))),
      for (final r in res)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleIcon(types[r.type]!.icon, solid: false),
          title: Text(r.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          subtitle: Text('${r.place}, ${r.year}', style: const TextStyle(color: C.muted)),
          trailing: const Icon(Icons.chevron_right_rounded, color: C.muted),
          onTap: () { Navigator.pop(ctx); push(context, RecordScreen(id: r.id)); },
        ),
    ]);
  }));
}

// ---------------------------------------------------------------------------
// Browse & search
// ---------------------------------------------------------------------------
class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});
  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  final _q = TextEditingController();
  String? _type;
  Set<String> _waters = {};
  int? _decade;
  String _sort = '';

  @override
  void initState() {
    super.initState();
    _type = Nav.browseType.value;
    Nav.browseType.addListener(_fromNav);
  }

  void _fromNav() => setState(() => _type = Nav.browseType.value);

  @override
  void dispose() {
    Nav.browseType.removeListener(_fromNav);
    super.dispose();
  }

  void _filters() {
    final s = AppScope.read(context);
    final decades = (s.published.map((r) => (r.year ~/ 10) * 10).toSet().toList()..sort());
    var w = {..._waters};
    int? d = _decade;
    var so = _sort;
    sheet(context, title: 'Filters', icon: Icons.tune_rounded, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Water body', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final x in s.waterBodies)
              FilterChip(label: Text(x), avatar: Icon(waterIcons[x], size: 16), selected: w.contains(x), showCheckmark: false,
                  selectedColor: C.blue, onSelected: (on) => set(() => on ? w.add(x) : w.remove(x))),
          ]),
          const SizedBox(height: 18),
          const Text('Decade', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ChoiceChip(label: const Text('Any'), selected: d == null, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => set(() => d = null)),
            for (final x in decades) ChoiceChip(label: Text('${x}s'), selected: d == x, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => set(() => d = x)),
          ]),
          const SizedBox(height: 18),
          const Text('Order', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final o in const [['', 'Best match'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['popular', 'Most viewed']])
              ChoiceChip(label: Text(o[1]), selected: so == o[0], selectedColor: C.blue, showCheckmark: false, onSelected: (_) => set(() => so = o[0])),
          ]),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(child: FilledButton.icon(onPressed: () { setState(() { _waters = w; _decade = d; _sort = so; }); Navigator.pop(ctx); },
                icon: const Icon(Icons.check_rounded), label: const Text('Show results'))),
            const SizedBox(width: 10),
            OutlinedButton(onPressed: () { setState(() { _waters = {}; _decade = null; _sort = ''; }); Navigator.pop(ctx); }, child: const Text('Clear')),
          ]),
        ])));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final res = s.search(q: _q.text, type: _type, waters: _waters, decade: _decade, sort: _sort);
    final nf = _waters.length + (_decade != null ? 1 : 0) + (_sort.isNotEmpty ? 1 : 0);
    return AppPage(
      background: const PageBg(Icons.search_rounded),
      body: CustomScrollView(slivers: [
        SliverPadding(padding: const EdgeInsets.fromLTRB(16, 6, 16, 0), sliver: SliverList.list(children: [
          PageTitle(_type == null ? 'Browse the archive' : types[_type]!.plural),
          const SizedBox(height: 12),
          TextField(
            controller: _q,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            style: const TextStyle(color: C.abyss),
            decoration: InputDecoration(
              hintText: 'Search stories, places, years, transcripts',
              filled: true, fillColor: Colors.white,
              prefixIcon: const Icon(Icons.search_rounded, color: C.blue),
              suffixIcon: _q.text.isEmpty ? null : IconButton(onPressed: () => setState(_q.clear), icon: const Icon(Icons.close_rounded, color: C.abyss), tooltip: 'Clear search'),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: const BorderSide(color: C.blue, width: 2)),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Orb(OrbItem(Icons.layers_outlined, 'Everything', 'Show all types of material.', () => setState(() => _type = null), on: _type == null), size: 58),
              for (final t in types.values)
                Orb(OrbItem(t.icon, t.plural, 'Show only ${t.plural.toLowerCase()}.', () => setState(() => _type = t.key), on: _type == t.key), size: 58),
              Orb(OrbItem(Icons.tune_rounded, nf > 0 ? 'Filters ($nf)' : 'Filters', 'Narrow by water body or decade, or change the order.', _filters), size: 58),
              Builder(builder: (ctx) => Orb(OrbItem(Icons.more_horiz_rounded, 'See more', 'Opens every other option in the side menu.', () => Scaffold.of(ctx).openDrawer(), ghost: true), size: 58)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('${res.length} item${res.length == 1 ? '' : 's'}${_q.text.isNotEmpty ? ' matching "${_q.text}"' : ''}',
                textAlign: TextAlign.center, style: const TextStyle(color: C.muted)),
          ),
        ])),
        if (res.isEmpty)
          SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(16), child: Glass(child: Column(children: [
            const Icon(Icons.waves_rounded, size: 44, color: C.sky),
            const SizedBox(height: 8),
            const Text('Nothing matches yet', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
            const Text('Try fewer words or remove a filter.', style: TextStyle(color: C.muted)),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => setState(() { _q.clear(); _type = null; _waters = {}; _decade = null; _sort = ''; }), child: const Text('Clear search and filters')),
          ])))),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverList.separated(itemCount: res.length, separatorBuilder: (_, _) => const SizedBox(height: 14), itemBuilder: (_, i) => RecCard(res[i], q: _q.text)),
        ),
      ]),
    );
  }
}

class RecCard extends StatelessWidget {
  final Rec r;
  final String q;
  const RecCard(this.r, {super.key, this.q = ''});

  String _snippet() {
    if (q.trim().isEmpty) return r.summary;
    final words = q.toLowerCase().split(RegExp(r'\s+')).where((w) => w.length > 1);
    final pool = [r.summary, ...?r.transcript?.map((e) => e.value), r.body ?? '', ...?r.pages];
    return pool.firstWhere((p) => words.any((w) => p.toLowerCase().contains(w)), orElse: () => r.summary);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Material(
      color: const Color(0xFF081A34).withValues(alpha: .85),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: BorderSide(color: C.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => push(context, RecordScreen(id: r.id)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (!s.lowBw)
            AspectRatio(aspectRatio: 16 / 8, child: SeaArt(r))
          else
            const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CircleIcon(types[r.type]!.icon, size: 42),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(r.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 4),
                Text(_snippet(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 13.5, height: 1.35)),
                const SizedBox(height: 8),
                Wrap(spacing: 12, runSpacing: 4, children: [
                  Fact(Icons.place_outlined, r.place),
                  Fact(Icons.calendar_today_outlined, '${r.year}'),
                  if (r.duration != null) Fact(Icons.schedule_rounded, fmtTime(r.duration!)),
                ]),
              ])),
            ]),
          ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Record (archive item)
// ---------------------------------------------------------------------------
class RecordScreen extends StatefulWidget {
  final String id;
  const RecordScreen({super.key, required this.id});
  @override
  State<RecordScreen> createState() => _RecordScreenState();
}

class _RecordScreenState extends State<RecordScreen> {
  double _t = 0;
  bool _playing = false;
  Timer? _timer;
  final _lineKeys = <GlobalKey>[];

  @override
  void initState() {
    super.initState();
    final s = AppScope.read(context);
    final r = s.recById(widget.id);
    if (r != null) {
      r.views++;
      WidgetsBinding.instance.addPostFrameCallback((_) => s.save());
      _lineKeys.addAll(List.generate(r.transcript?.length ?? 0, (_) => GlobalKey()));
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggle(Rec r) {
    if (_playing) {
      _timer?.cancel();
      setState(() => _playing = false);
      return;
    }
    if (_t >= r.duration!) _t = 0;
    setState(() => _playing = true);
    // The prototype plays at 6x so a demo moves along.
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      setState(() {
        _t += 1.5;
        if (_t >= r.duration!) { _t = r.duration!.toDouble(); _playing = false; _timer?.cancel(); }
      });
      final i = _current(r);
      final ctx = i < _lineKeys.length ? _lineKeys[i].currentContext : null;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), alignment: .5);
    });
  }

  int _current(Rec r) {
    var cur = 0;
    final tr = r.transcript ?? const [];
    for (var i = 0; i < tr.length; i++) { if (_t >= tr[i].key) cur = i; }
    return cur;
  }

  Widget _media(Rec r) {
    switch (r.format) {
      case 'audio':
        final f = _t / r.duration!;
        return Glass(child: Row(children: [
          _playBtn(r, 56),
          const SizedBox(width: 14),
          Expanded(child: LayoutBuilder(builder: (_, box) => GestureDetector(
            onTapDown: (d) => setState(() => _t = (d.localPosition.dx / box.maxWidth).clamp(0.0, 1.0) * r.duration!),
            child: SizedBox(height: 46, width: box.maxWidth, child: CustomPaint(painter: _WavePainter(r.id, f))),
          ))),
          const SizedBox(width: 10),
          Text('${fmtTime(_t)}\n${fmtTime(r.duration!)}', textAlign: TextAlign.right, style: const TextStyle(color: C.muted, fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
        ]));
      case 'video':
        final tr = r.transcript!;
        return ClipRRect(borderRadius: BorderRadius.circular(22), child: AspectRatio(aspectRatio: 16 / 9, child: Stack(fit: StackFit.expand, children: [
          SeaArt(r, label: false),
          Positioned(left: 20, right: 20, bottom: 58, child: Center(child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.black.withValues(alpha: .72), borderRadius: BorderRadius.circular(10)),
            child: Text(tr[_current(r)].value, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 13)),
          ))),
          Positioned(left: 0, right: 0, bottom: 0, child: Container(
            padding: const EdgeInsets.fromLTRB(10, 16, 14, 10),
            decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black87])),
            child: Row(children: [
              _playBtn(r, 40),
              const SizedBox(width: 10),
              Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: _t / r.duration!, minHeight: 5, color: Colors.white, backgroundColor: Colors.white24))),
              const SizedBox(width: 10),
              Text('${fmtTime(_t)} / ${fmtTime(r.duration!)}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ]),
          )),
          const Positioned(top: 10, right: 12, child: _Watermark()),
        ])));
      case 'image':
        return ClipRRect(borderRadius: BorderRadius.circular(22), child: AspectRatio(aspectRatio: 16 / 9, child: Stack(fit: StackFit.expand, children: [
          SeaArt(r), const Positioned(right: 12, bottom: 10, child: _Watermark()),
        ])));
      case 'document':
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: const Color(0xFFEEF3FB), borderRadius: BorderRadius.circular(8)),
          child: Stack(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < r.pages!.length; i++)
                Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(r.pages![i], textAlign: i == 0 ? TextAlign.center : TextAlign.left,
                    style: TextStyle(fontFamily: 'monospace', color: const Color(0xFF12233D), fontWeight: i == 0 ? FontWeight.w700 : FontWeight.w400, height: 1.4))),
              const SizedBox(height: 26),
            ]),
            Positioned(right: 0, bottom: 0, child: Transform.rotate(angle: -.12, child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              decoration: BoxDecoration(border: Border.all(color: C.blue.withValues(alpha: .7), width: 2)),
              child: Text('ARCHIVE COPY', style: TextStyle(color: C.blue.withValues(alpha: .8), fontWeight: FontWeight.w800, fontSize: 12)),
            ))),
          ]),
        );
      default:
        return Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.format_quote_rounded, color: C.blue2, size: 34),
          Text(r.body ?? '', style: const TextStyle(color: Colors.white, fontSize: 17, height: 1.6)),
        ]));
    }
  }

  Widget _playBtn(Rec r, double size) => Semantics(
        button: true,
        label: _playing ? 'Pause' : 'Play',
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: () => _toggle(r),
          child: Container(width: size, height: size, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
              child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: C.abyss, size: size * .5)),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = s.recById(widget.id);
    if (r == null || (r.status != 'published' && !s.isAdmin)) {
      return AppPage(showBack: true, background: const PageBg(Icons.explore_outlined), body: const Center(child: Text("This item isn't available. It may have been unpublished.")));
    }
    final related = s.published.where((x) => x.id != r.id && (x.water == r.water || x.tags.any(r.tags.contains))).take(3).toList();
    final cur = _current(r);
    return AppPage(
      showBack: true,
      background: PageBg(types[r.type]!.icon),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
        if (r.status != 'published')
          Padding(padding: const EdgeInsets.only(bottom: 12), child: Glass(child: Row(children: [
            const Icon(Icons.visibility_outlined, color: C.sky), const SizedBox(width: 10),
            Expanded(child: Text('This item is ${r.status}. Only admins can see it.')),
          ]))),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleIcon(types[r.type]!.icon, size: 56),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: Colors.white, height: 1.15)),
            const SizedBox(height: 8),
            Wrap(spacing: 12, runSpacing: 4, children: [
              Fact(Icons.place_outlined, r.place), Fact(Icons.calendar_today_outlined, '${r.year}'),
              if (r.duration != null) Fact(Icons.schedule_rounded, fmtTime(r.duration!)),
              Fact(Icons.visibility_outlined, '${r.views} views'),
            ]),
          ])),
        ]),
        const SizedBox(height: 14),
        Text(r.summary, style: const TextStyle(color: C.muted, fontSize: 15, height: 1.5)),
        const SizedBox(height: 16),
        _media(r),
        if (r.transcript != null) ...[
          const SizedBox(height: 14),
          Glass(padding: const EdgeInsets.all(8), child: Column(children: [
            for (var i = 0; i < r.transcript!.length; i++)
              InkWell(
                key: _lineKeys[i],
                borderRadius: BorderRadius.circular(12),
                onTap: () { setState(() => _t = r.transcript![i].key.toDouble()); if (!_playing) _toggle(r); },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), color: i == cur && (_playing || _t > 0) ? C.blue.withValues(alpha: .25) : Colors.transparent),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(width: 42, child: Text(fmtTime(r.transcript![i].key), style: const TextStyle(color: C.sky, fontSize: 12.5))),
                    Expanded(child: Text(r.transcript![i].value, style: const TextStyle(height: 1.4))),
                  ]),
                ),
              ),
          ])),
        ],
        OrbRow([
          if (r.duration != null) OrbItem(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, _playing ? 'Pause' : 'Play',
              _playing ? 'Pauses the recording.' : 'Plays the recording. The transcript follows along.', () => _toggle(r), primary: true),
          OrbItem(Icons.info_outline_rounded, 'Details', 'The full catalogue record: people, language, consent and rights.', () => _details(context, r), primary: r.duration == null),
          OrbItem(Icons.place_outlined, 'Location', 'Where this happened, on the map.', () => _location(context, r)),
          OrbItem(Icons.format_quote_rounded, 'Cite', 'A ready-made citation for your work.', () => _cite(context, r)),
          OrbItem(Icons.share_outlined, 'Share', 'Copies a link to this item.', () {
            Clipboard.setData(ClipboardData(text: 'https://archive.example/record/${r.id}'));
            toast(context, 'Link copied', Icons.link_rounded);
          }),
          if (s.isAdmin) OrbItem(Icons.edit_outlined, 'Edit', "Change this item's metadata (admins only).", () => push(context, RecordFormScreen(rec: r))),
        ], size: 64),
        if (related.isNotEmpty) ...[
          Text('Related items', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          for (final x in related) Padding(padding: const EdgeInsets.only(bottom: 14), child: RecCard(x)),
        ],
      ]),
    );
  }

  void _details(BuildContext context, Rec r) {
    final rows = <List<dynamic>>[
      [Icons.tag_rounded, 'Identifier', r.id], [types[r.type]!.icon, 'Type', types[r.type]!.label], [Icons.calendar_today_outlined, 'Date', '${r.year}'],
      [Icons.place_outlined, 'Place', '${r.place}, ${r.county} County'], [Icons.waves_rounded, 'Water body', r.water],
      [Icons.person_outline_rounded, 'Narrator', r.narrator], [Icons.mic_none_rounded, 'Interviewer', r.interviewer], [Icons.photo_camera_outlined, 'Photographer', r.photographer],
      [Icons.groups_outlined, 'Creator', r.creator], [Icons.translate_rounded, 'Language', r.language],
      [Icons.schedule_rounded, 'Duration', r.duration == null ? null : fmtTime(r.duration!)], [Icons.verified_outlined, 'Consent', r.consent],
      [Icons.shield_outlined, 'Rights', r.rights], [Icons.history_rounded, 'Added', r.added],
    ].where((x) => x[2] != null && '${x[2]}'.isNotEmpty).toList();
    sheet(context, title: 'Catalogue record', icon: Icons.info_outline_rounded, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (final x in rows)
        Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(x[0] as IconData, size: 20, color: C.sky), const SizedBox(width: 12),
          SizedBox(width: 100, child: Text(x[1] as String, style: const TextStyle(color: C.muted))),
          Expanded(child: Text('${x[2]}')),
        ])),
      const SizedBox(height: 14),
      const Text('Subjects', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [for (final t in r.tags) Chip(avatar: const Icon(Icons.sell_outlined, size: 15), label: Text(t))]),
      const SizedBox(height: 14),
      Text('© Remembering the Waters and contributors. Shared under ${r.rights}. Please credit the archive and ${r.id} when reusing.', style: const TextStyle(color: C.muted, fontSize: 12.5)),
    ]));
  }

  void _location(BuildContext context, Rec r) {
    sheet(context, title: r.place, icon: Icons.place_outlined, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${r.county} County, ${r.water}', style: const TextStyle(color: C.muted)),
      const SizedBox(height: 12),
      ClipRRect(borderRadius: BorderRadius.circular(18), child: SizedBox(height: 260, child: ArchiveMap(recs: [r], center: LatLng(r.lat, r.lng), zoom: 8, interactive: false))),
      const SizedBox(height: 14),
      OutlinedButton.icon(onPressed: () { Navigator.pop(ctx); Nav.goTab(context, 2); }, icon: const Icon(Icons.map_outlined), label: const Text('Open the full map')),
    ]));
  }

  void _cite(BuildContext context, Rec r) {
    final c = '${r.narrator ?? r.creator}. "${r.title}." ${r.year}. Maritime Safety Heritage Archive, Remembering the Waters, ${r.id}.';
    sheet(context, title: 'Cite this item', icon: Icons.format_quote_rounded, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Glass(child: Text(c, style: const TextStyle(height: 1.5))),
      const SizedBox(height: 14),
      FilledButton.icon(onPressed: () { Clipboard.setData(ClipboardData(text: c)); Navigator.pop(ctx); toast(context, 'Citation copied', Icons.copy_rounded); },
          icon: const Icon(Icons.copy_rounded), label: const Text('Copy citation')),
    ]));
  }
}

class _Watermark extends StatelessWidget {
  const _Watermark();
  @override
  Widget build(BuildContext context) => const Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.support_rounded, size: 14, color: Colors.white70), SizedBox(width: 5),
        Text('Remembering the Waters', style: TextStyle(color: Colors.white70, fontSize: 11, shadows: [Shadow(blurRadius: 4)])),
      ]);
}

class _WavePainter extends CustomPainter {
  final String seed;
  final double progress;
  _WavePainter(this.seed, this.progress);
  @override
  void paint(Canvas canvas, Size size) {
    const n = 46;
    final w = size.width / n;
    for (var i = 0; i < n; i++) {
      final h = '$seed$i'.codeUnits.fold<int>(0, (a, b) => (a * 31 + b) & 0xffff) % 82 + 18;
      final bh = size.height * h / 100;
      final paint = Paint()..color = i / n < progress ? C.sky : C.sky.withValues(alpha: .3);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(i * w + 1, (size.height - bh) / 2, math.max(1, w - 2), bh), const Radius.circular(2)), paint);
    }
  }
  @override
  bool shouldRepaint(covariant _WavePainter old) => old.progress != progress;
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
class ArchiveMap extends StatelessWidget {
  final List<Rec> recs;
  final LatLng center;
  final double zoom;
  final bool interactive;
  final MapController? controller;
  const ArchiveMap({super.key, required this.recs, required this.center, this.zoom = 5.6, this.interactive = true, this.controller});

  @override
  Widget build(BuildContext context) => FlutterMap(
        mapController: controller,
        options: MapOptions(
          initialCenter: center,
          initialZoom: zoom,
          backgroundColor: const Color(0xFF07162B),
          interactionOptions: InteractionOptions(flags: interactive ? InteractiveFlag.all & ~InteractiveFlag.rotate : InteractiveFlag.none),
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            subdomains: const ['a', 'b', 'c', 'd'],
            userAgentPackageName: 'ke.rememberingthewaters.maritime_heritage',
          ),
          MarkerLayer(markers: [
            for (final r in recs)
              Marker(
                point: LatLng(r.lat, r.lng),
                width: 40, height: 40,
                child: GestureDetector(
                  onTap: interactive ? () => _pinSheet(context, r) : null,
                  child: Container(
                    decoration: BoxDecoration(color: C.blue, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2),
                        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 10)]),
                    child: Icon(types[r.type]!.icon, color: Colors.white, size: 19),
                  ),
                ),
              ),
          ]),
          const Align(alignment: Alignment.bottomRight, child: Padding(padding: EdgeInsets.all(4),
              child: Text('© OpenStreetMap contributors © CARTO', style: TextStyle(fontSize: 9.5, color: C.muted)))),
        ],
      );

  void _pinSheet(BuildContext context, Rec r) => showModalBottomSheet(context: context, builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 28),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TypeTag(r.type),
          const SizedBox(height: 10),
          Text(r.title, style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Fact(Icons.place_outlined, '${r.place}, ${r.year}'),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: () { Navigator.pop(ctx); push(context, RecordScreen(id: r.id)); }, icon: const Icon(Icons.open_in_new_rounded), label: const Text('Open this item')),
        ]),
      ));
}

class MapScreen extends StatefulWidget {
  final bool active;
  const MapScreen({super.key, this.active = false});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  String? _type;
  final _ctrl = MapController();

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final recs = s.published.where((r) => _type == null || r.type == _type).toList();
    Widget orb(OrbItem o) => Orb(o, size: 52);
    return AppPage(
      background: const ColoredBox(color: C.abyss),
      body: Stack(children: [
        Positioned.fill(child: ArchiveMap(recs: recs, center: const LatLng(0.1, 37.9), controller: _ctrl)),
        Positioned(
          left: 10, right: 10, bottom: 12,
          child: Container(
            padding: const EdgeInsets.fromLTRB(6, 12, 6, 6),
            decoration: BoxDecoration(color: C.abyss.withValues(alpha: .78), borderRadius: BorderRadius.circular(28), border: Border.all(color: C.line)),
            child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              orb(OrbItem(Icons.layers_outlined, 'Everything', 'Show every item on the map.', () => setState(() => _type = null), on: _type == null)),
              for (final t in types.values) orb(OrbItem(t.icon, t.plural, 'Show only ${t.plural.toLowerCase()}.', () => setState(() => _type = t.key), on: _type == t.key)),
              orb(OrbItem(Icons.list_rounded, 'List', 'The items on the map. Pick one to fly to it.', () => _list(recs))),
              Builder(builder: (ctx) => orb(OrbItem(Icons.more_horiz_rounded, 'See more', 'Opens every other option in the side menu.', () => Scaffold.of(ctx).openDrawer(), ghost: true))),
            ])),
          ),
        ),
      ]),
    );
  }

  void _list(List<Rec> recs) => sheet(context, title: '${recs.length} places', icon: Icons.list_rounded, builder: (ctx) => Column(children: [
        for (final r in recs)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleIcon(types[r.type]!.icon, solid: false),
            title: Text(r.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            subtitle: Text('${r.place}, ${r.year}', style: const TextStyle(color: C.muted)),
            onTap: () { Navigator.pop(ctx); _ctrl.move(LatLng(r.lat, r.lng), 9); },
          ),
      ]));
}

// ---------------------------------------------------------------------------
// Share a story
// ---------------------------------------------------------------------------
class ShareScreen extends StatefulWidget {
  const ShareScreen({super.key});
  @override
  State<ShareScreen> createState() => _ShareScreenState();
}

class _ShareScreenState extends State<ShareScreen> {
  String? _type;
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController(), _year = TextEditingController(), _place = TextEditingController(), _desc = TextEditingController();
  String? _water, _file;
  bool _consent = false;

  static const _descs = {
    'oral': 'A recorded memory: audio or video.',
    'photo': 'A photograph from a family or community collection.',
    'record': 'A document, licence, notice or report.',
    'testimony': 'Your own written account.',
  };

  void _attach() => showModalBottomSheet(context: context, builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 28),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Attach a file', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 6),
          const Text('In the full build these open the camera, microphone or your files. The prototype attaches a sample file.', style: TextStyle(color: C.muted)),
          const SizedBox(height: 14),
          for (final o in const [[Icons.photo_camera_outlined, 'Take a photo', 'photo_from_camera.jpg'], [Icons.mic_none_rounded, 'Record audio', 'voice_recording.m4a'], [Icons.folder_open_outlined, 'Choose a file', 'document_scan.pdf']])
            ListTile(leading: CircleIcon(o[0] as IconData, solid: false), title: Text(o[1] as String),
                onTap: () { setState(() => _file = o[2] as String); Navigator.pop(ctx); }),
        ]),
      ));

  void _send() {
    if (!_form.currentState!.validate()) return;
    if (!_consent) { toast(context, 'Please confirm you have the right to share this.', Icons.info_outline_rounded); return; }
    final s = AppScope.read(context);
    s.submissions.insert(0, Submission(id: 'SUB-${100 + s.submissions.length + 1}', by: s.session!, date: AppState.today(), status: 'pending',
        title: _title.text.trim(), type: _type!, water: _water ?? s.waterBodies.first, place: _place.text.trim(), description: _desc.text.trim(),
        file: _file ?? '(no file attached)', year: int.tryParse(_year.text)));
    s.log("submitted '${_title.text.trim()}' for review");
    toast(context, 'Sent. The research team will review it.');
    setState(() { _type = null; _title.clear(); _year.clear(); _place.clear(); _desc.clear(); _file = null; _consent = false; });
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final mine = s.submissions.where((x) => x.by == s.session).toList();
    return AppPage(
      background: const PageBg(Icons.volunteer_activism_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Share a story', sub: 'The research team checks consent and catalogues every submission before it appears in the archive.'),
        OrbRow([
          for (final t in types.values) OrbItem(t.icon, t.label, _descs[t.key]!, () => setState(() => _type = t.key), on: _type == t.key),
          OrbItem(Icons.folder_open_outlined, 'My submissions', "What you've sent and its review status.", () => mySubmissions(context), badge: mine.where((x) => x.status == 'pending').length),
        ], size: 64),
        if (_type == null)
          Glass(child: Column(children: const [
            Icon(Icons.volunteer_activism_outlined, size: 42, color: C.sky), SizedBox(height: 8),
            Text("Choose what you're sharing", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
            Text('Tap one of the circles above to start.', style: TextStyle(color: C.muted)),
          ]))
        else
          Glass(child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Align(alignment: Alignment.centerLeft, child: TypeTag(_type!)),
            const SizedBox(height: 14),
            TextFormField(controller: _title, decoration: const InputDecoration(labelText: 'Title', hintText: "My grandfather's fishing boat at Mbita"),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Give it a title' : null),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextFormField(controller: _year, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Year (approx.)'))),
              const SizedBox(width: 10),
              Expanded(flex: 2, child: TextFormField(controller: _place, decoration: const InputDecoration(labelText: 'Place'))),
            ]),
            const SizedBox(height: 14),
            const Text('Water body', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final w in s.waterBodies)
                ChoiceChip(avatar: Icon(waterIcons[w], size: 16), label: Text(w), showCheckmark: false, selectedColor: C.blue,
                    selected: (_water ?? s.waterBodies.first) == w, onSelected: (_) => setState(() => _water = w)),
            ]),
            const SizedBox(height: 14),
            TextFormField(controller: _desc, minLines: 3, maxLines: 6,
                decoration: const InputDecoration(labelText: 'Tell us about it', hintText: 'Who, what, when, and the safety lesson it holds', alignLabelWithHint: true),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Tell us a little about it' : null),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: _attach, icon: Icon(_file == null ? Icons.attach_file_rounded : Icons.check_circle_outline_rounded),
                label: Text(_file ?? 'Attach a photo, recording or document')),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('I have the right to share this, and everyone recorded or pictured has agreed.', style: TextStyle(fontSize: 14)),
            ),
            FilledButton.icon(onPressed: _send, icon: const Icon(Icons.upload_rounded), label: const Text('Send for review')),
          ]))),
      ]),
    );
  }
}

void mySubmissions(BuildContext context) {
  final s = AppScope.read(context);
  final mine = s.submissions.where((x) => x.by == s.session).toList();
  sheet(context, title: 'My submissions', icon: Icons.folder_open_outlined, builder: (ctx) => Column(children: [
    if (mine.isEmpty) const Text('Nothing yet. Choose a type of material to share your first story.', style: TextStyle(color: C.muted)),
    for (final x in mine)
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleIcon(types[x.type]!.icon, solid: false),
        title: Text(x.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        subtitle: Text('Sent ${x.date}', style: const TextStyle(color: C.muted)),
        trailing: StatusChip(x.status),
      ),
  ]));
}

// ---------------------------------------------------------------------------
// My account
// ---------------------------------------------------------------------------
class AccountScreen extends StatelessWidget {
  final bool asPage;
  const AccountScreen({super.key, this.asPage = false});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final u = s.me;
    if (u == null) return const SizedBox();
    return AppPage(
      showBack: asPage,
      background: const PageBg(Icons.person_outline_rounded),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 20, 16, 40), children: [
        Center(child: CircleAvatar(radius: 44, backgroundColor: C.blue, child: Text(u.initials, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white)))),
        const SizedBox(height: 14),
        PageTitle(u.name, sub: '${u.email}\n${u.isAdmin ? 'Admin' : 'Member'} since ${u.joined}${u.org.isNotEmpty ? ', ${u.org}' : ''}'),
        OrbRow([
          OrbItem(Icons.edit_outlined, 'Edit profile', 'Change your name or organisation.', () => _edit(context), primary: true),
          OrbItem(Icons.key_outlined, 'Password', 'Change your password.', () => _password(context)),
          OrbItem(Icons.folder_open_outlined, 'My submissions', "What you've sent and its review status.", () => mySubmissions(context)),
          OrbItem(Icons.info_outline_rounded, 'About', 'Who is behind the archive.', () => push(context, const AboutScreen())),
          OrbItem(Icons.logout_rounded, 'Sign out', 'Signs you out on this phone.', () => confirmSignOut(context)),
        ]),
      ]),
    );
  }

  void _edit(BuildContext context) {
    final s = AppScope.read(context);
    final u = s.me!;
    final n = TextEditingController(text: u.name), o = TextEditingController(text: u.org);
    showDialog(context: context, builder: (ctx) => AlertDialog(
      icon: const CircleIcon(Icons.edit_outlined, size: 52),
      title: const Text('Edit profile'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: n, decoration: const InputDecoration(labelText: 'Name')),
        const SizedBox(height: 12),
        TextField(controller: o, decoration: const InputDecoration(labelText: 'Organisation or community')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () {
          if (n.text.trim().isEmpty) return;
          u.name = n.text.trim(); u.org = o.text.trim(); s.log('updated their profile');
          Navigator.pop(ctx); toast(context, 'Profile saved');
        }, child: const Text('Save profile')),
      ],
    ));
  }

  void _password(BuildContext context) {
    final s = AppScope.read(context);
    final a = TextEditingController(), b = TextEditingController();
    String? err;
    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      icon: const CircleIcon(Icons.key_outlined, size: 52),
      title: const Text('Change password'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: a, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
        const SizedBox(height: 12),
        TextField(controller: b, obscureText: true, decoration: const InputDecoration(labelText: 'New password', helperText: 'At least 8 characters. Stored as a salted hash in the full build.')),
        if (err != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(err!, style: const TextStyle(color: C.danger))),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () {
          final u = s.me!;
          if (a.text != u.password) { set(() => err = 'Your current password is wrong.'); return; }
          if (b.text.length < 8) { set(() => err = 'Use at least 8 characters.'); return; }
          u.password = b.text; s.log('changed their password');
          Navigator.pop(ctx); toast(context, 'Password changed', Icons.key_outlined);
        }, child: const Text('Change password')),
      ],
    )));
  }
}
