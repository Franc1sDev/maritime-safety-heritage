import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

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
            OrbItem(Icons.insert_chart_outlined_rounded, 'Dashboard', 'Usage, collection health and recent activity.', () => Nav.goTab(context, 4), primary: true),
            OrbItem(Icons.inbox_outlined, 'Review', 'Approve or decline material sent in by the public.', () => push(context, const SubmissionsScreen()), badge: s.pending),
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
  var seq = 0;
  List<Rec>? res;
  String? err;
  Timer? debounce;
  sheet(context, title: 'Quick search', icon: Icons.search_rounded, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
    void run(String v) {
      q = v;
      debounce?.cancel();
      if (v.trim().isEmpty) { set(() { res = null; err = null; }); return; }
      debounce = Timer(const Duration(milliseconds: 300), () async {
        final my = ++seq;
        try {
          final p = PageOf.fromJson(await s.api.get('/records', {'q': v.trim(), 'pageSize': 8}), Rec.fromJson);
          if (my == seq && ctx.mounted) set(() { res = p.items; err = null; });
        } catch (e) {
          if (my == seq && ctx.mounted) set(() => err = errText(e));
        }
      });
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(autofocus: true, onChanged: run, textInputAction: TextInputAction.search,
          decoration: const InputDecoration(hintText: 'Try life jackets, ferry, Lake Turkana', prefixIcon: Icon(Icons.search_rounded))),
      const SizedBox(height: 10),
      if (err != null) Padding(padding: const EdgeInsets.all(12), child: Text(err!, style: const TextStyle(color: C.danger))),
      if (res != null && res!.isEmpty) Padding(padding: const EdgeInsets.all(12), child: Text('Nothing matches "$q". Try fewer words.', style: const TextStyle(color: C.muted))),
      for (final r in res ?? const <Rec>[])
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleIcon(types[r.type]!.icon, solid: false),
          title: Text(r.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          subtitle: Text('${r.placeText}, ${r.yearText}', style: const TextStyle(color: C.muted)),
          trailing: const Icon(Icons.chevron_right_rounded, color: C.muted),
          onTap: () { Navigator.pop(ctx); push(context, RecordScreen(id: r.identifier)); },
        ),
    ]);
  }));
}

// ---------------------------------------------------------------------------
// Browse & search, with pages loaded as you scroll
// ---------------------------------------------------------------------------
class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});
  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  final _q = TextEditingController();
  String? _type;
  int? _water, _decade;
  String _sort = '';
  final _items = <Rec>[];
  int _total = 0, _page = 0, _pages = 1, _seq = 0;
  bool _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _type = Nav.browseType.value;
    Nav.browseType.addListener(_fromNav);
    _reload();
  }

  void _fromNav() { _type = Nav.browseType.value; _reload(); }

  @override
  void dispose() {
    Nav.browseType.removeListener(_fromNav);
    super.dispose();
  }

  Future<void> _reload() async {
    _items.clear(); _page = 0; _pages = 1; _total = 0; _error = null;
    await _more();
  }

  Future<void> _more() async {
    if (_page >= _pages) return;
    final my = ++_seq;
    setState(() => _loading = true);
    try {
      final s = AppScope.read(context);
      final p = PageOf.fromJson(await s.api.get('/records', {
        'q': _q.text.trim(), 'type': _type, 'waterBodyId': _water, 'yearFrom': _decade, 'yearTo': _decade == null ? null : _decade! + 9,
        'sort': _sort, 'page': _page + 1, 'pageSize': 12,
      }), Rec.fromJson);
      if (my != _seq || !mounted) return;
      setState(() { _items.addAll(p.items); _page = p.page; _pages = p.pages; _total = p.total; _loading = false; });
    } catch (e) {
      if (my == _seq && mounted) setState(() { _error = e; _loading = false; });
    }
  }

  Future<void> _filters() async {
    final s = AppScope.read(context);
    List<int> decades = [];
    try {
      final f = await s.api.get('/records/facets') as Map<String, dynamic>;
      decades = (f['decades'] as List).map((d) => (d['value'] as num).toInt()).toList();
    } catch (_) {}
    if (!mounted) return;
    int? w = _water, d = _decade;
    var so = _sort;
    sheet(context, title: 'Filters', icon: Icons.tune_rounded, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Water body', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ChoiceChip(label: const Text('Any'), selected: w == null, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => set(() => w = null)),
            for (final x in s.waterBodies)
              ChoiceChip(label: Text(x.name), avatar: Icon(waterIcons[x.name] ?? Icons.waves_rounded, size: 16), selected: w == x.id, showCheckmark: false,
                  selectedColor: C.blue, onSelected: (_) => set(() => w = x.id)),
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
            for (final o in const [['', 'Best match'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['popular', 'Most viewed'], ['title', 'A to Z']])
              ChoiceChip(label: Text(o[1]), selected: so == o[0], selectedColor: C.blue, showCheckmark: false, onSelected: (_) => set(() => so = o[0])),
          ]),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(child: FilledButton.icon(onPressed: () { _water = w; _decade = d; _sort = so; Navigator.pop(ctx); _reload(); },
                icon: const Icon(Icons.check_rounded), label: const Text('Show results'))),
            const SizedBox(width: 10),
            OutlinedButton(onPressed: () { _water = null; _decade = null; _sort = ''; Navigator.pop(ctx); _reload(); }, child: const Text('Clear')),
          ]),
        ])));
  }

  @override
  Widget build(BuildContext context) {
    final nf = (_water != null ? 1 : 0) + (_decade != null ? 1 : 0) + (_sort.isNotEmpty ? 1 : 0);
    return AppPage(
      background: const PageBg(Icons.search_rounded),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: NotificationListener<ScrollNotification>(
          onNotification: (n) {
            if (n.metrics.pixels > n.metrics.maxScrollExtent - 400 && !_loading && _error == null) _more();
            return false;
          },
          child: CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: [
            SliverPadding(padding: const EdgeInsets.fromLTRB(16, 6, 16, 0), sliver: SliverList.list(children: [
              PageTitle(_type == null ? 'Browse the archive' : types[_type]!.plural),
              const SizedBox(height: 12),
              TextField(
                controller: _q,
                onSubmitted: (_) => _reload(),
                onChanged: (_) => setState(() {}),
                textInputAction: TextInputAction.search,
                style: const TextStyle(color: C.abyss),
                decoration: InputDecoration(
                  hintText: 'Search stories, places, years, transcripts',
                  filled: true, fillColor: Colors.white,
                  prefixIcon: const Icon(Icons.search_rounded, color: C.blue),
                  suffixIcon: _q.text.isEmpty ? null : IconButton(onPressed: () { _q.clear(); _reload(); }, icon: const Icon(Icons.close_rounded, color: C.abyss), tooltip: 'Clear search'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide.none),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: const BorderSide(color: C.blue, width: 2)),
                ),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Orb(OrbItem(Icons.layers_outlined, 'Everything', 'Show all types of material.', () { _type = null; _reload(); }, on: _type == null), size: 58),
                  for (final t in types.values)
                    Orb(OrbItem(t.icon, t.plural, 'Show only ${t.plural.toLowerCase()}.', () { _type = t.key; _reload(); }, on: _type == t.key), size: 58),
                  Orb(OrbItem(Icons.tune_rounded, nf > 0 ? 'Filters ($nf)' : 'Filters', 'Narrow by water body or decade, or change the order.', _filters), size: 58),
                  Builder(builder: (ctx) => Orb(OrbItem(Icons.more_horiz_rounded, 'See more', 'Opens every other option in the side menu.', () => Scaffold.of(ctx).openDrawer(), ghost: true), size: 58)),
                ]),
              ),
              if (_page > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text('$_total item${_total == 1 ? '' : 's'}${_q.text.trim().isNotEmpty ? ' matching "${_q.text.trim()}"' : ''}',
                      textAlign: TextAlign.center, style: const TextStyle(color: C.muted)),
                ),
            ])),
            if (_error != null && _items.isEmpty) SliverToBoxAdapter(child: ErrorPanel(_error!, _reload)),
            if (_page > 0 && _items.isEmpty && _error == null)
              SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(16), child: Glass(child: Column(children: [
                const Icon(Icons.waves_rounded, size: 44, color: C.sky),
                const SizedBox(height: 8),
                const Text('Nothing matches yet', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
                const Text('Try fewer words or remove a filter.', style: TextStyle(color: C.muted)),
                const SizedBox(height: 12),
                FilledButton(onPressed: () { _q.clear(); _type = null; _water = null; _decade = null; _sort = ''; _reload(); }, child: const Text('Clear search and filters')),
              ])))),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              sliver: SliverList.separated(itemCount: _items.length, separatorBuilder: (_, _) => const SizedBox(height: 14), itemBuilder: (_, i) => RecCard(_items[i])),
            ),
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.only(bottom: 30),
              child: _loading ? const Center(child: LoadingView())
                  : _error != null && _items.isNotEmpty ? Center(child: TextButton.icon(onPressed: _more, icon: const Icon(Icons.refresh_rounded), label: const Text('Load more')))
                  : const SizedBox(),
            )),
          ]),
        ),
      ),
    );
  }
}

class RecCard extends StatelessWidget {
  final Rec r;
  const RecCard(this.r, {super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final img = r.image;
    return Material(
      color: const Color(0xFF081A34).withValues(alpha: .85),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: BorderSide(color: C.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => push(context, RecordScreen(id: r.identifier)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (!s.lowBw)
            AspectRatio(aspectRatio: 16 / 8, child: img != null
                ? Image.network(s.api.abs(img.url), fit: BoxFit.cover, errorBuilder: (_, _, _) => SeaArt(r, label: false))
                : SeaArt(r, label: false))
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
                MarkedText(r.snippet ?? r.summary, maxLines: 3, style: const TextStyle(color: C.muted, fontSize: 13.5, height: 1.35)),
                const SizedBox(height: 8),
                Wrap(spacing: 12, runSpacing: 4, children: [
                  Fact(Icons.place_outlined, r.placeText),
                  Fact(Icons.calendar_today_outlined, r.yearText),
                  if (r.durationSeconds != null) Fact(Icons.schedule_rounded, fmtTime(r.durationSeconds!)),
                  if (r.status != 'published') StatusChip(r.status),
                ]),
              ])),
            ]),
          ),
        ]),
      ),
    );
  }
}

Future<void> openExternal(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) toast(context, "This file couldn't be opened on this phone.", Icons.error_outline_rounded);
}

// ---------------------------------------------------------------------------
// Record (archive item) with real playback and a transcript that follows along
// ---------------------------------------------------------------------------
class RecordScreen extends StatelessWidget {
  final String id;
  const RecordScreen({super.key, required this.id});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.read(context);
    return Loaded<Rec>(
      load: () async => Rec.fromJson(await s.api.get('/records/${Uri.encodeComponent(id)}') as Map<String, dynamic>),
      builder: (context, r, reload) => _RecordView(r, reload),
    );
  }
}

class _RecordView extends StatefulWidget {
  final Rec r;
  final Future<void> Function() reload;
  const _RecordView(this.r, this.reload);
  @override
  State<_RecordView> createState() => _RecordViewState();
}

class _RecordViewState extends State<_RecordView> {
  VideoPlayerController? _ctrl;
  MediaFile? _av;
  bool _failed = false;
  int _cur = -1;
  late final List<GlobalKey> _keys = List.generate(widget.r.transcript.length, (_) => GlobalKey());

  @override
  void initState() {
    super.initState();
    final r = widget.r;
    _av = r.media.where((m) => m.isVideo).firstOrNull ?? r.media.where((m) => m.isAudio).firstOrNull;
    if (_av != null) {
      final s = AppScope.read(context);
      _ctrl = VideoPlayerController.networkUrl(Uri.parse(s.api.abs(_av!.url)))
        ..addListener(_tick)
        ..initialize().then((_) { if (mounted) setState(() {}); }).catchError((Object _) { if (mounted) setState(() => _failed = true); });
    }
  }

  void _tick() {
    final c = _ctrl;
    if (c == null || !mounted) return;
    final t = c.value.position.inMilliseconds / 1000;
    var cur = -1;
    for (var i = 0; i < widget.r.transcript.length; i++) { if (t >= widget.r.transcript[i].start) cur = i; }
    if (cur != _cur && cur >= 0 && c.value.isPlaying) {
      final ctx = _keys[cur].currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), alignment: .4);
    }
    setState(() => _cur = cur);
  }

  @override
  void dispose() {
    _ctrl?.removeListener(_tick);
    _ctrl?.dispose();
    super.dispose();
  }

  bool get _playing => _ctrl?.value.isPlaying ?? false;

  void _toggle() {
    final c = _ctrl;
    if (c == null || !c.value.isInitialized) { toast(context, _failed ? "The recording couldn't load. Pull down to reload." : 'Loading the recording...', Icons.hourglass_empty_rounded); return; }
    if (c.value.isPlaying) { c.pause(); } else {
      if (c.value.position >= c.value.duration) c.seekTo(Duration.zero);
      c.play();
    }
  }

  void _seek(int seconds) {
    final c = _ctrl;
    if (c == null || !c.value.isInitialized) return;
    c.seekTo(Duration(seconds: seconds));
    if (!c.value.isPlaying) c.play();
  }

  Widget _playBtn(double size) => Semantics(
        button: true,
        label: _playing ? 'Pause' : 'Play',
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: _toggle,
          child: Container(width: size, height: size, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
              child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: C.abyss, size: size * .5)),
        ),
      );

  Widget _progress(Color color) {
    final c = _ctrl;
    final ready = c != null && c.value.isInitialized;
    final pos = ready ? c.value.position.inMilliseconds / 1000 : 0.0;
    final dur = ready ? c.value.duration.inMilliseconds / 1000 : (widget.r.durationSeconds ?? 0).toDouble();
    return Row(children: [
      Expanded(child: SliderTheme(
        data: SliderTheme.of(context).copyWith(trackHeight: 4, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7), overlayShape: SliderComponentShape.noOverlay),
        child: Slider(value: dur <= 0 ? 0 : pos.clamp(0, dur).toDouble(), max: dur <= 0 ? 1 : dur, activeColor: color, inactiveColor: color.withValues(alpha: .3),
            onChanged: ready ? (v) => c.seekTo(Duration(milliseconds: (v * 1000).round())) : null),
      )),
      const SizedBox(width: 10),
      Text('${fmtTime(pos)} / ${fmtTime(dur)}', style: const TextStyle(color: Colors.white70, fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
    ]);
  }

  Widget _media(Rec r) {
    final s = AppScope.of(context);
    final c = _ctrl;
    if (_av != null && _av!.isVideo) {
      final ready = c != null && c.value.isInitialized;
      return ClipRRect(borderRadius: BorderRadius.circular(22), child: AspectRatio(aspectRatio: ready ? c.value.aspectRatio : 16 / 9, child: Stack(fit: StackFit.expand, children: [
        if (ready) VideoPlayer(c) else (r.image != null ? Image.network(s.api.abs(r.image!.url), fit: BoxFit.cover) : SeaArt(r, label: false)),
        if (!ready) Center(child: _failed ? const Icon(Icons.wifi_off_rounded, color: Colors.white70, size: 40) : const CircularProgressIndicator(color: Colors.white)),
        if (_cur >= 0 && _playing)
          Positioned(left: 20, right: 20, bottom: 58, child: Center(child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.black.withValues(alpha: .72), borderRadius: BorderRadius.circular(10)),
            child: Text(r.transcript[_cur].text, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 13)),
          ))),
        Positioned(left: 0, right: 0, bottom: 0, child: Container(
          padding: const EdgeInsets.fromLTRB(10, 16, 14, 8),
          decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black87])),
          child: Row(children: [_playBtn(40), const SizedBox(width: 6), Expanded(child: _progress(Colors.white))]),
        )),
      ])));
    }
    if (_av != null && _av!.isAudio) {
      return Glass(child: Row(children: [
        _playBtn(56),
        const SizedBox(width: 10),
        Expanded(child: _failed ? const Text("The recording couldn't load. Pull down to reload.", style: TextStyle(color: C.muted)) : _progress(C.sky)),
      ]));
    }
    final img = r.image;
    final parts = <Widget>[];
    if (img != null && !s.lowBw) {
      parts.add(ClipRRect(borderRadius: BorderRadius.circular(22), child: Stack(children: [
        Image.network(s.api.abs(img.url), fit: BoxFit.cover, width: double.infinity,
            loadingBuilder: (_, child, p) => p == null ? child : const AspectRatio(aspectRatio: 16 / 9, child: Center(child: CircularProgressIndicator())),
            errorBuilder: (_, _, _) => AspectRatio(aspectRatio: 16 / 9, child: SeaArt(r))),
        Positioned(right: 12, bottom: 10, child: _Watermark(r.identifier)),
      ])));
    } else if ((r.format == 'audio' || r.format == 'video') ) {
      parts.add(Glass(child: Row(children: [
        const Icon(Icons.schedule_rounded, color: C.sky), const SizedBox(width: 10),
        Expanded(child: Text('The ${r.format == 'audio' ? 'recording' : 'video'} for this item is still being prepared.${r.transcript.isNotEmpty ? ' The transcript is below.' : ''}')),
      ])));
    }
    if (r.format == 'document' && (r.body ?? '').isNotEmpty) {
      final pages = r.body!.split(RegExp(r'\n+'));
      parts.add(Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: const Color(0xFFEEF3FB), borderRadius: BorderRadius.circular(8)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (var i = 0; i < pages.length; i++)
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(pages[i], textAlign: i == 0 ? TextAlign.center : TextAlign.left,
                style: TextStyle(fontFamily: 'monospace', color: const Color(0xFF12233D), fontWeight: i == 0 ? FontWeight.w700 : FontWeight.w400, height: 1.4))),
        ]),
      ));
    }
    if (r.format == 'text' && (r.body ?? '').isNotEmpty) {
      parts.add(Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.format_quote_rounded, color: C.blue2, size: 34),
        Text(r.body!, style: const TextStyle(color: Colors.white, fontSize: 17, height: 1.6)),
      ])));
    }
    final others = r.media.where((m) => m != img && !m.isAudio && !m.isVideo).toList();
    if (others.isNotEmpty) {
      parts.add(Wrap(spacing: 8, runSpacing: 8, children: [
        for (final m in others) OutlinedButton.icon(onPressed: () => openExternal(context, s.api.abs(m.url)), icon: Icon(m.icon), label: Text('Open ${m.name} (${fmtSize(m.size)})')),
      ]));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final p in parts) Padding(padding: const EdgeInsets.only(bottom: 12), child: p)]);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = widget.r;
    final canPlay = _av != null;
    return AppPage(
      showBack: true,
      background: PageBg(types[r.type]!.icon),
      body: RefreshIndicator(
        onRefresh: widget.reload,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
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
                Fact(Icons.tag_rounded, r.identifier), Fact(Icons.place_outlined, r.placeText), Fact(Icons.calendar_today_outlined, r.yearText),
                if (r.durationSeconds != null) Fact(Icons.schedule_rounded, fmtTime(r.durationSeconds!)),
                Fact(Icons.visibility_outlined, '${r.views} views'),
              ]),
            ])),
          ]),
          const SizedBox(height: 14),
          Text(r.summary, style: const TextStyle(color: C.muted, fontSize: 15, height: 1.5)),
          const SizedBox(height: 16),
          _media(r),
          if (r.transcript.isNotEmpty)
            Glass(padding: const EdgeInsets.all(8), child: Column(children: [
              for (var i = 0; i < r.transcript.length; i++)
                InkWell(
                  key: _keys[i],
                  borderRadius: BorderRadius.circular(12),
                  onTap: canPlay ? () => _seek(r.transcript[i].start) : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), color: i == _cur ? C.blue.withValues(alpha: .25) : Colors.transparent),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      SizedBox(width: 46, child: Text(fmtTime(r.transcript[i].start), style: const TextStyle(color: C.sky, fontSize: 12.5))),
                      Expanded(child: Text(r.transcript[i].text, style: const TextStyle(height: 1.4))),
                    ]),
                  ),
                ),
            ])),
          OrbRow([
            if (canPlay) OrbItem(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, _playing ? 'Pause' : 'Play',
                _playing ? 'Pauses the recording.' : 'Plays the recording. The transcript follows along.', _toggle, primary: true),
            OrbItem(Icons.info_outline_rounded, 'Details', 'The full catalogue record: people, language, consent and rights.', () => _details(context, r), primary: !canPlay),
            if (r.hasLocation) OrbItem(Icons.place_outlined, 'Location', 'Where this happened, on the map.', () => _location(context, r)),
            OrbItem(Icons.format_quote_rounded, 'Cite', 'A ready-made citation for your work.', () => _cite(context, r)),
            if (s.isAdmin) OrbItem(Icons.edit_outlined, 'Edit', "Change this item's catalogue record and files.", () async {
              await push(context, RecordFormScreen(id: r.id));
              widget.reload();
            }),
          ], size: 64),
          if (r.related.isNotEmpty) ...[
            Text('Related items', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            for (final x in r.related) Padding(padding: const EdgeInsets.only(bottom: 14), child: RecCard(x)),
          ],
        ]),
      ),
    );
  }

  void _details(BuildContext context, Rec r) {
    final rows = <(IconData, String, String?)>[
      (Icons.tag_rounded, 'Identifier', r.identifier), (types[r.type]!.icon, 'Type', types[r.type]!.label), (formats[r.format]?.$1 ?? Icons.notes_rounded, 'Format', formats[r.format]?.$2),
      (Icons.calendar_today_outlined, 'Date', r.yearText), (Icons.place_outlined, 'Place', [r.place, if (r.county.isNotEmpty) '${r.county} County'].where((x) => x.isNotEmpty).join(', ')),
      (Icons.waves_rounded, 'Water body', r.waterName), (Icons.person_outline_rounded, 'Narrator', r.narrator), (Icons.mic_none_rounded, 'Interviewer', r.interviewer),
      (Icons.photo_camera_outlined, 'Photographer', r.photographer), (Icons.groups_outlined, 'Creator', r.creator), (Icons.translate_rounded, 'Language', r.language),
      (Icons.schedule_rounded, 'Duration', r.durationSeconds == null ? null : fmtTime(r.durationSeconds!)), (Icons.verified_outlined, 'Consent', r.consent),
      (Icons.shield_outlined, 'Rights', r.rights), (Icons.history_rounded, 'Published', fmtDate(r.publishedAt)),
    ].where((x) => (x.$3 ?? '').isNotEmpty).toList();
    sheet(context, title: 'Catalogue record', icon: Icons.info_outline_rounded, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (final x in rows)
        Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(x.$1, size: 20, color: C.sky), const SizedBox(width: 12),
          SizedBox(width: 100, child: Text(x.$2, style: const TextStyle(color: C.muted))),
          Expanded(child: Text(x.$3!)),
        ])),
      if (r.subjects.isNotEmpty) ...[
        const SizedBox(height: 14),
        const Text('Subjects', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [for (final t in r.subjects) Chip(avatar: const Icon(Icons.sell_outlined, size: 15), label: Text(t.label))]),
      ],
      const SizedBox(height: 14),
      Text('© Remembering the Waters and contributors.${(r.rights ?? '').isNotEmpty ? ' Shared under ${r.rights}.' : ''} Please credit the archive and ${r.identifier} when reusing.',
          style: const TextStyle(color: C.muted, fontSize: 12.5)),
    ]));
  }

  void _location(BuildContext context, Rec r) {
    sheet(context, title: r.place.isEmpty ? 'Location' : r.place, icon: Icons.place_outlined, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text([if (r.county.isNotEmpty) '${r.county} County', r.waterName].where((x) => x.isNotEmpty).join(', '), style: const TextStyle(color: C.muted)),
      const SizedBox(height: 12),
      ClipRRect(borderRadius: BorderRadius.circular(18), child: SizedBox(height: 260, child: ArchiveMap(recs: [r], center: LatLng(r.lat!, r.lng!), zoom: 8, interactive: false))),
      const SizedBox(height: 14),
      OutlinedButton.icon(onPressed: () { Navigator.pop(ctx); Nav.goTab(context, 2); }, icon: const Icon(Icons.map_outlined), label: const Text('Open the full map')),
    ]));
  }

  void _cite(BuildContext context, Rec r) {
    final c = r.citation ?? '${r.title}. ${r.identifier}. Maritime Safety Heritage Archive.';
    sheet(context, title: 'Cite this item', icon: Icons.format_quote_rounded, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Glass(child: SelectableText(c, style: const TextStyle(height: 1.5))),
      const SizedBox(height: 14),
      FilledButton.icon(onPressed: () { Clipboard.setData(ClipboardData(text: c)); Navigator.pop(ctx); toast(context, 'Citation copied', Icons.copy_rounded); },
          icon: const Icon(Icons.copy_rounded), label: const Text('Copy citation')),
    ]));
  }
}

class _Watermark extends StatelessWidget {
  final String id;
  const _Watermark(this.id);
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.support_rounded, size: 14, color: Colors.white70), const SizedBox(width: 5),
        Text('Remembering the Waters, $id', style: const TextStyle(color: Colors.white70, fontSize: 11, shadows: [Shadow(blurRadius: 4)])),
      ]);
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
            for (final r in recs.where((r) => r.hasLocation))
              Marker(
                point: LatLng(r.lat!, r.lng!),
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
          Fact(Icons.place_outlined, '${r.placeText}, ${r.yearText}'),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: () { Navigator.pop(ctx); push(context, RecordScreen(id: r.identifier)); }, icon: const Icon(Icons.open_in_new_rounded), label: const Text('Open this item')),
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
  List<Rec>? _all;
  Object? _error;

  @override
  void didUpdateWidget(MapScreen old) {
    super.didUpdateWidget(old);
    if (widget.active && _all == null) _load();
  }

  @override
  void initState() {
    super.initState();
    if (widget.active) _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final list = (await AppScope.read(context).api.get('/records/map') as List).whereType<Map<String, dynamic>>().map(Rec.fromJson).toList();
      if (mounted) setState(() => _all = list);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recs = (_all ?? const <Rec>[]).where((r) => _type == null || r.type == _type).toList();
    Widget orb(OrbItem o) => Orb(o, size: 52);
    return AppPage(
      background: const ColoredBox(color: C.abyss),
      body: Stack(children: [
        Positioned.fill(child: ArchiveMap(recs: recs, center: const LatLng(0.1, 37.9), controller: _ctrl)),
        if (_error != null) Positioned(left: 0, right: 0, top: 20, child: ErrorPanel(_error!, _load)),
        if (_all == null && _error == null) const Positioned(left: 0, right: 0, top: 40, child: Center(child: CircularProgressIndicator())),
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
            subtitle: Text('${r.placeText}, ${r.yearText}', style: const TextStyle(color: C.muted)),
            onTap: () { Navigator.pop(ctx); _ctrl.move(LatLng(r.lat!, r.lng!), 9); },
          ),
      ]));
}

// ---------------------------------------------------------------------------
// Choosing files on the phone
// ---------------------------------------------------------------------------
const _allowedExt = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'mp4', 'mov', 'webm', '3gp', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tif', 'tiff', 'pdf', 'txt'];

Future<List<LocalFile>> pickFiles(BuildContext context, {bool multiple = true}) async {
  final choice = await showModalBottomSheet<int>(context: context, builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 28),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Add a file', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 10),
          for (final o in const [(Icons.photo_camera_outlined, 'Take a photo'), (Icons.videocam_outlined, 'Record a video'),
              (Icons.photo_library_outlined, 'Photos and videos on this phone'), (Icons.folder_open_outlined, 'Audio recordings, PDFs and other files')])
            ListTile(leading: CircleIcon(o.$1, solid: false), title: Text(o.$2), onTap: () => Navigator.pop(ctx, [Icons.photo_camera_outlined, Icons.videocam_outlined, Icons.photo_library_outlined, Icons.folder_open_outlined].indexOf(o.$1))),
        ]),
      ));
  if (choice == null) return [];
  try {
    final picker = ImagePicker();
    Future<LocalFile> fromX(XFile x) async => LocalFile(x.path, x.name, await x.length());
    switch (choice) {
      case 0:
        final x = await picker.pickImage(source: ImageSource.camera, imageQuality: 92);
        return x == null ? [] : [await fromX(x)];
      case 1:
        final x = await picker.pickVideo(source: ImageSource.camera);
        return x == null ? [] : [await fromX(x)];
      case 2:
        final xs = multiple ? await picker.pickMultipleMedia() : [?await picker.pickMedia()];
        return [for (final x in xs) await fromX(x)];
      default:
        final r = await FilePicker.platform.pickFiles(allowMultiple: multiple, type: FileType.custom, allowedExtensions: _allowedExt);
        return [for (final f in r?.files ?? const <PlatformFile>[]) if (f.path != null) LocalFile(f.path!, f.name, f.size)];
    }
  } catch (_) {
    if (context.mounted) toast(context, "Couldn't open that. Check the app's permissions in your phone settings.", Icons.error_outline_rounded);
    return [];
  }
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
  int? _water;
  final _files = <LocalFile>[];
  bool _consent = false, _busy = false;
  double? _progress;

  static const _descs = {
    'oral': 'A recorded memory: audio or video.',
    'photo': 'A photograph from a family or community collection.',
    'record': 'A document, licence, notice or report.',
    'testimony': 'Your own written account.',
  };

  Future<void> _attach() async {
    final picked = await pickFiles(context);
    if (!mounted || picked.isEmpty) return;
    setState(() {
      _files.addAll(picked);
      if (_files.length > 5) { _files.removeRange(5, _files.length); toast(context, 'Up to 5 files can be sent at once.', Icons.info_outline_rounded); }
    });
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    if (!_consent) { toast(context, 'Please confirm you have the right to share this.', Icons.info_outline_rounded); return; }
    final s = AppScope.read(context);
    setState(() { _busy = true; _progress = _files.isEmpty ? null : 0; });
    try {
      final res = await s.api.upload('/submissions', {
        'type': _type!, 'title': _title.text.trim(), 'description': _desc.text.trim(), 'consentConfirmed': 'true',
        if (_year.text.trim().isNotEmpty) 'year': _year.text.trim(),
        if (_place.text.trim().isNotEmpty) 'place': _place.text.trim(),
        if (_water != null) 'waterBodyId': '$_water',
      }, _files, onProgress: (p) { if (mounted) setState(() => _progress = p); }) as Map<String, dynamic>;
      if (!mounted) return;
      toast(context, 'Sent as ${res['reference']}. The research team will review it.');
      setState(() { _type = null; _title.clear(); _year.clear(); _place.clear(); _desc.clear(); _files.clear(); _water = null; _consent = false; _busy = false; _progress = null; });
    } catch (e) {
      if (mounted) { setState(() { _busy = false; _progress = null; }); toast(context, errText(e), Icons.error_outline_rounded); }
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPage(
      background: const PageBg(Icons.volunteer_activism_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Share a story', sub: 'The research team checks consent and catalogues every submission before it appears in the archive.'),
        OrbRow([
          for (final t in types.values) OrbItem(t.icon, t.label, _descs[t.key]!, () => setState(() => _type = t.key), on: _type == t.key),
          OrbItem(Icons.folder_open_outlined, 'My submissions', "What you've sent and its review status.", () => mySubmissions(context)),
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
            TextFormField(controller: _title, maxLength: 300, decoration: const InputDecoration(labelText: 'Title', hintText: "My grandfather's fishing boat at Mbita", counterText: ''),
                validator: (v) => (v ?? '').trim().length < 3 ? 'Give it a title' : null),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextFormField(controller: _year, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Year (approx.)'),
                  validator: (v) { if ((v ?? '').trim().isEmpty) return null; final y = int.tryParse(v!.trim()); return y == null || y < 1800 || y > DateTime.now().year ? 'Check the year' : null; })),
              const SizedBox(width: 10),
              Expanded(flex: 2, child: TextFormField(controller: _place, decoration: const InputDecoration(labelText: 'Place'))),
            ]),
            const SizedBox(height: 14),
            const Text('Water body', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              ChoiceChip(avatar: const Icon(Icons.help_outline_rounded, size: 16), label: const Text('Not sure'), showCheckmark: false, selectedColor: C.blue,
                  selected: _water == null, onSelected: (_) => setState(() => _water = null)),
              for (final w in s.waterBodies)
                ChoiceChip(avatar: Icon(waterIcons[w.name] ?? Icons.waves_rounded, size: 16), label: Text(w.name), showCheckmark: false, selectedColor: C.blue,
                    selected: _water == w.id, onSelected: (_) => setState(() => _water = w.id)),
            ]),
            const SizedBox(height: 14),
            TextFormField(controller: _desc, minLines: 3, maxLines: 8,
                decoration: const InputDecoration(labelText: 'Tell us about it', hintText: 'Who, what, when, and the safety lesson it holds', alignLabelWithHint: true),
                validator: (v) => (v ?? '').trim().length < 10 ? 'Tell us a little about it (a sentence or more)' : null),
            const SizedBox(height: 12),
            for (final f in _files)
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.attach_file_rounded, color: C.sky), title: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(fmtSize(f.size), style: const TextStyle(color: C.muted)),
                  trailing: IconButton(tooltip: 'Remove', icon: const Icon(Icons.close_rounded), onPressed: _busy ? null : () => setState(() => _files.remove(f)))),
            if (_files.length < 5)
              OutlinedButton.icon(onPressed: _busy ? null : _attach, icon: const Icon(Icons.add_a_photo_outlined),
                  label: Text(_files.isEmpty ? 'Add a photo, recording or document' : 'Add another file')),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _consent,
              onChanged: _busy ? null : (v) => setState(() => _consent = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('I have the right to share this, and everyone recorded or pictured has agreed.', style: TextStyle(fontSize: 14)),
            ),
            if (_busy && _progress != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Column(children: [
              LinearProgressIndicator(value: _progress, minHeight: 6, borderRadius: BorderRadius.circular(3)),
              const SizedBox(height: 4),
              Text('Uploading ${(_progress! * 100).round()}%', style: const TextStyle(color: C.muted, fontSize: 12.5)),
            ])),
            FilledButton.icon(onPressed: _busy ? null : _send, icon: const Icon(Icons.upload_rounded), label: Text(_busy ? 'Sending' : 'Send for review')),
          ]))),
      ]),
    );
  }
}

void mySubmissions(BuildContext context) {
  final s = AppScope.read(context);
  sheet(context, title: 'My submissions', icon: Icons.folder_open_outlined, builder: (ctx) => Loaded<PageOf<Submission>>(
        load: () async => PageOf.fromJson(await s.api.get('/submissions/mine', {'pageSize': 50}), Submission.fromJson),
        builder: (ctx, p, _) => Column(children: [
          if (p.items.isEmpty) const Text('Nothing yet. Choose a type of material to share your first story.', style: TextStyle(color: C.muted)),
          for (final x in p.items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleIcon(types[x.type]!.icon, solid: false),
              title: Text(x.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              subtitle: Text('${x.reference}, sent ${fmtDate(x.createdAt)}${x.reviewNote.isNotEmpty ? '\nNote from the team: ${x.reviewNote}' : ''}', style: const TextStyle(color: C.muted)),
              trailing: StatusChip(x.status),
            ),
        ]),
      ));
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
        PageTitle(u.name, sub: '${u.email}\n${u.isAdmin ? 'Admin' : 'Member'} since ${fmtDate(u.createdAt)}${u.organisation.isNotEmpty ? ', ${u.organisation}' : ''}'),
        OrbRow([
          OrbItem(Icons.edit_outlined, 'Edit profile', 'Change your name or organisation.', () => _edit(context), primary: true),
          OrbItem(Icons.key_outlined, 'Password', "Change your password. You'll sign in again everywhere.", () => _password(context)),
          OrbItem(Icons.folder_open_outlined, 'My submissions', "What you've sent and its review status.", () => mySubmissions(context)),
          OrbItem(Icons.shield_outlined, 'Sign out everywhere', 'Ends your sessions on every device, including this one.', () => confirmSignOut(context, everywhere: true)),
          OrbItem(Icons.logout_rounded, 'Sign out', 'Signs you out on this phone.', () => confirmSignOut(context)),
        ]),
      ]),
    );
  }

  void _edit(BuildContext context) {
    final s = AppScope.read(context);
    final u = s.me!;
    final n = TextEditingController(text: u.name), o = TextEditingController(text: u.organisation);
    String? err;
    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      icon: const CircleIcon(Icons.edit_outlined, size: 52),
      title: const Text('Edit profile'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: n, decoration: InputDecoration(labelText: 'Name', errorText: err)),
        const SizedBox(height: 12),
        TextField(controller: o, decoration: const InputDecoration(labelText: 'Organisation or community')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          if (n.text.trim().length < 2) { set(() => err = 'Enter your name'); return; }
          try {
            s.setMe(await s.api.patch('/auth/me', {'name': n.text.trim(), 'organisation': o.text.trim()}) as Map<String, dynamic>);
            if (ctx.mounted) Navigator.pop(ctx);
            if (context.mounted) toast(context, 'Profile saved');
          } catch (e) { set(() => err = errText(e)); }
        }, child: const Text('Save profile')),
      ],
    )));
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
        TextField(controller: b, obscureText: true, decoration: const InputDecoration(labelText: 'New password', helperText: '8+ characters with a letter and a number', helperMaxLines: 2)),
        if (err != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(err!, style: const TextStyle(color: C.danger))),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          try {
            await s.api.post('/auth/change-password', {'currentPassword': a.text, 'newPassword': b.text});
            if (ctx.mounted) Navigator.pop(ctx);
            if (context.mounted) {
              toast(context, 'Password changed. Sign in with your new password.', Icons.key_outlined);
              Navigator.of(context).popUntil((r) => r.isFirst);
            }
            Nav.tab.value = 0;
            await s.forgetSession();
          } catch (e) { set(() => err = errText(e)); }
        }, child: const Text('Change password')),
      ],
    )));
  }
}
