import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import 'admin.dart';
import 'api.dart';
import 'auth.dart';
import 'core.dart';
import 'pages.dart';
import 'share.dart';

const storyTabs = <(String, IconData, String)>[
  ('trending', Icons.trending_up, 'Trending'), ('following', Icons.group_add, 'Following'), ('location', Icons.place, 'Location'), ('contributors', Icons.groups, 'Contributors'), ('favorites', Icons.star, 'Favorites'),
  ('incidents', Icons.report_gmailerrorred, 'Incidents'), ('map', Icons.map, 'Map'), ('timeline', Icons.timeline, 'Timeline'), ('collections', Icons.collections_bookmark, 'Collections'),
];

/// Asks a visitor to sign in before an action that needs an account. Returns true when signed in.
bool need(BuildContext context) {
  final s = AppScope.read(context);
  if (s.signedIn) return true;
  sheet(context, t('Sign in to continue'), (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(t('You need an account to post, react, comment, message, add favorites, follow or report. Reading the archive is always free.')),
        const SizedBox(height: 14), ProviderButtons(onDone: () => Navigator.pop(c)),
      ]));
  return false;
}

/// A simple map (OpenStreetMap tiles) used for "Where It Happened", Map Explore and picking a place.
class MapBox extends StatelessWidget {
  final List<Marker> markers;
  final LatLng center;
  final double zoom;
  final void Function(LatLng)? onTap;
  const MapBox({super.key, required this.markers, this.center = const LatLng(-0.6, 37.6), this.zoom = 5.6, this.onTap});
  @override
  Widget build(BuildContext context) => ClipRRect(borderRadius: BorderRadius.circular(14), child: FlutterMap(
        options: MapOptions(initialCenter: center, initialZoom: zoom, onTap: onTap == null ? null : (_, p) => onTap!(p)),
        children: [
          TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'ke.rememberingthewaters.maritime_heritage'),
          MarkerLayer(markers: markers),
        ],
      ));
}

Marker pin(LatLng p, {Color color = C.blue, String? label, VoidCallback? onTap, int count = 1}) => Marker(point: p, width: 44, height: 44,
    child: Semantics(label: label, button: onTap != null, child: GestureDetector(onTap: onTap, child: count > 1
        ? Container(decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)), alignment: Alignment.center, child: Text('$count', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)))
        : Icon(Icons.location_on, color: color, size: 40))));

// ---------- The STORIES screen ----------
class StoriesScreen extends StatefulWidget {
  final String? openCode;
  const StoriesScreen({super.key, this.openCode});
  @override
  State<StoriesScreen> createState() => StoriesScreenState();
}

class StoriesScreenState extends State<StoriesScreen> {
  String tab = 'trending';
  J filters = {};
  String? filterLabel;
  List<J> items = [];
  String? cursor;
  bool loading = true, more = true;
  Object? error;
  int index = 0;
  final page = PageController();
  int _gen = 0;

  @override
  void initState() { super.initState(); load(first: widget.openCode); }
  @override
  void dispose() { page.dispose(); super.dispose(); }

  bool get listTab => const ['incidents', 'map', 'timeline', 'collections'].contains(tab) && filters.isEmpty;
  bool get needsPick => (tab == 'location' && filters['placeId'] == null) || (tab == 'contributors' && filters['authorId'] == null);

  void open(String newTab, {J? f, String? label}) {
    final s = AppScope.read(context);
    if ((newTab == 'following' || newTab == 'favorites') && !s.signedIn) { need(context); return; }
    setState(() { tab = newTab; filters = f ?? {}; filterLabel = label; });
    load();
  }

  /// Opens one story (from a link, a list or a notification) at the top of the feed.
  void openStory(String code) { setState(() { tab = 'trending'; filters = {}; filterLabel = null; }); load(first: code); }

  Future<void> load({String? first}) async {
    final gen = ++_gen;
    setState(() { items = []; cursor = null; more = true; loading = true; error = null; index = 0; });
    if (page.hasClients) page.jumpToPage(0);
    if (listTab || needsPick) { setState(() => loading = false); return; }
    final api = AppScope.read(context).api;
    try {
      J? top;
      if (first != null) { try { top = asMap(await api.get('/stories/$first')); } catch (_) {} }
      final r = await _fetch(null);
      if (gen != _gen || !mounted) return;
      final list = asList(r['items']);
      setState(() { items = [if (top != null) top, ...list.where((x) => x['id'] != top?['id'])]; cursor = r['nextCursor'] as String?; more = cursor != null; loading = false; });
      if (items.isNotEmpty) AppScope.read(context).startGuide();
    } catch (e) { if (gen == _gen && mounted) setState(() { error = e; loading = false; }); }
  }

  Future<J> _fetch(String? c) async {
    final feedTab = tab == 'following' || tab == 'favorites' ? tab : tab == 'timeline' ? 'timeline' : (filters['q'] != null || tab != 'trending') ? 'recent' : 'trending';
    return asMap(await AppScope.read(context).api.get('/stories', {'tab': feedTab, ...filters, 'cursor': c, 'limit': 6}));
  }

  Future<void> _more() async {
    if (!more || cursor == null) return;
    more = false;
    try { final r = await _fetch(cursor); if (!mounted) return; setState(() { items.addAll(asList(r['items'])); cursor = r['nextCursor'] as String?; more = cursor != null; }); } catch (_) { more = true; }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final cs = Theme.of(context).colorScheme;
    return Stack(children: [_screen(s, cs), if (s.guideStep != null) Positioned.fill(child: GuideOverlay(step: s.guideStep!))]);
  }

  Widget _screen(AppState s, ColorScheme cs) {
    return Column(children: [
      SizedBox(height: 46, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 10), children: [
        Center(child: Padding(padding: const EdgeInsets.only(right: 8), child: Text(t('Stories by'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)))),
        for (final (k, icon, label) in storyTabs) Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(
            avatar: Icon(icon, size: 17, color: tab == k ? Colors.white : cs.primary), label: Text(t(label)), selected: tab == k && filters['q'] == null, showCheckmark: false,
            selectedColor: cs.primary, labelStyle: TextStyle(color: tab == k && filters['q'] == null ? Colors.white : cs.onSurface, fontWeight: FontWeight.w600, fontSize: 13),
            onSelected: (_) => open(k))),
        IconButton(icon: const Icon(Icons.search), tooltip: t('Search the archive'), onPressed: _search),
      ])),
      if (tab == 'location' || tab == 'contributors') Padding(padding: const EdgeInsets.fromLTRB(14, 4, 14, 4), child: OutlinedButton.icon(
          icon: Icon(tab == 'location' ? Icons.place : Icons.person_search), label: Text(filterLabel ?? (tab == 'location' ? t('Type or choose a location') : t('Type or choose a Contributor'))),
          onPressed: () => tab == 'location' ? _pickPlace() : _pickContributor())),
      if (filterLabel != null && tab != 'location' && tab != 'contributors') Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Row(children: [
        Expanded(child: Text(filterLabel!, style: const TextStyle(fontWeight: FontWeight.w700))), TextButton(onPressed: () => open(filters['q'] != null ? 'trending' : tab), child: Text(t('Clear'))),
      ])),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Row(children: [
        OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 36), visualDensity: VisualDensity.compact), icon: const Icon(Icons.rule, size: 17), label: Text(t('Rules')),
            onPressed: () => sheet(context, t('Rules and netiquette'), (_) => const RulesText(), tall: true)),
        const Spacer(),
        if (items.length > 1) Text('${index + 1} / ${items.length}${more ? '+' : ''}', style: const TextStyle(fontSize: 12)),
        const Spacer(),
        if (!s.isSuper) FloatingActionButton.small(heroTag: 'share', elevation: 1, backgroundColor: cs.primary, foregroundColor: Colors.white, tooltip: t('Share my story'),
            onPressed: () { if (need(context)) Navigator.push(context, MaterialPageRoute(builder: (_) => const ShareStoryPage())).then((_) => load()); }, child: const Icon(Icons.add)),
      ])),
      Expanded(child: _body(s)),
    ]);
  }

  Widget _body(AppState s) {
    if (listTab) {
      return switch (tab) { 'incidents' => IncidentList(onStories: (id, title) => open('incidents', f: {'incidentId': id}, label: title)), 'map' => MapExplore(onStory: openStory),
        'timeline' => TimelineList(onPick: (f, label) => open('timeline', f: f, label: label)), _ => CollectionList(onOpen: (id, title) => open('collections', f: {'collectionId': id}, label: title)) };
    }
    if (needsPick) return EmptyState(tab == 'location' ? t('Choose a location to see its stories') : t('Choose a Contributor to see their stories'), icon: tab == 'location' ? Icons.place : Icons.groups);
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return EmptyState(errText(error!), icon: Icons.wifi_off, action: OutlinedButton(onPressed: load, child: Text(t('Retry'))));
    if (items.isEmpty) {
      return switch (tab) {
        'following' => EmptyState(t('You are not following anyone yet'), icon: Icons.group_add, text: t('Follow contributors to see their stories here.'), action: FilledButton(onPressed: () => open('contributors'), child: Text(t('Find Contributors')))),
        'favorites' => EmptyState(t('No favorites yet'), icon: Icons.star_border, text: t('Select ☆ on a story to save it here.')),
        'location' => EmptyState(t('No stories for this location.'), icon: Icons.place),
        'contributors' => EmptyState(t('No Contributor with this username has posted a story, or their stories may have been deleted.'), icon: Icons.groups),
        _ => EmptyState(filters['q'] != null ? t('Nothing matches your search') : t('No stories here yet'), text: t('Be the first to share one.')),
      };
    }
    // Stories are full-screen; swiping up moves to the next story.
    _preload(s);
    // allowImplicitScrolling keeps the next story built and ready, so swiping feels instant.
    return PageView.builder(controller: page, scrollDirection: Axis.vertical, itemCount: items.length, allowImplicitScrolling: true,
        onPageChanged: (i) { setState(() => index = i); if (i >= items.length - 2) _more(); },
        itemBuilder: (c, i) => StoryView(key: ValueKey(items[i]['id']), story: items[i], active: i == index, onChanged: (n) => items[i] = n, onReload: load));
  }

  /// Pre-loading: the pictures of the next two stories are fetched in the background (not in low-data mode).
  int _preloaded = -1;
  void _preload(AppState s) {
    if (s.lowData || _preloaded == index) return;
    _preloaded = index;
    for (final next in items.skip(index + 1).take(2)) {
      for (final m in asList(next['media'])) {
        final urls = asMap(m['urls']);
        final u = m['kind'] == 'image' ? (urls['medium'] ?? urls['full']) : urls['poster'];
        if (u != null) precacheImage(NetworkImage(s.api.abs(str(u))), context, onError: (e, st) {});
      }
    }
  }

  Future<void> _search() async {
    final ctl = TextEditingController(text: str(filters['q']));
    final q = await showDialog<String>(context: context, builder: (c) => AlertDialog(title: Text(t('Search the archive')),
        content: TextField(controller: ctl, autofocus: true, textInputAction: TextInputAction.search, onSubmitted: (v) => Navigator.pop(c, v)),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: Text(t('Cancel'))), FilledButton(onPressed: () => Navigator.pop(c, ctl.text), child: Text(t('Search')))]));
    if (q != null && q.trim().isNotEmpty) open('trending', f: {'q': q.trim()}, label: t('Results for “{q}”', {'q': q.trim()}));
  }

  Future<void> _pickPlace() async {
    final p = await pickFromSearch(context, t('Location'), (q) async => asList(await AppScope.read(context).api.get('/places', {'q': q, 'withStories': true})).where((x) => num0(x['stories']) > 0).toList(),
        (x) => ListTile(leading: const Icon(Icons.place), title: Text(str(x['name'])), subtitle: Text('${[x['county'], x['waterBody']].where((e) => str(e).isNotEmpty).join(' · ')} · ${t('{n} stories', {'n': x['stories']})}')), t('No stories for this location.'));
    if (p != null) open('location', f: {'placeId': p['id']}, label: str(p['name']));
  }

  Future<void> _pickContributor() async {
    final p = await pickFromSearch(context, t('Contributor'), (q) async => asList(await AppScope.read(context).api.get('/contributors', {'q': q})),
        (x) => ListTile(leading: Avatar(asMap(x['person'])), title: Text('@${asMap(x['person'])['username']}'), subtitle: Text(t('{n} stories', {'n': x['stories']}))), t('No Contributor with this username has posted a story, or their stories may have been deleted.'));
    if (p != null) open('contributors', f: {'authorId': asMap(p['person'])['id']}, label: '@${asMap(p['person'])['username']}');
  }
}

/// A search sheet with matches that update while typing.
Future<J?> pickFromSearch(BuildContext context, String title, Future<List<J>> Function(String) load, Widget Function(J) row, String none) {
  return sheet<J>(context, title, (c) => _SearchPick(load: load, row: row, none: none), tall: true);
}

class _SearchPick extends StatefulWidget {
  final Future<List<J>> Function(String) load;
  final Widget Function(J) row;
  final String none;
  const _SearchPick({required this.load, required this.row, required this.none});
  @override
  State<_SearchPick> createState() => _SearchPickState();
}

class _SearchPickState extends State<_SearchPick> {
  List<J>? items;
  Timer? _t;
  @override
  void initState() { super.initState(); _go(''); }
  @override
  void dispose() { _t?.cancel(); super.dispose(); }
  void _go(String q) { _t?.cancel(); _t = Timer(const Duration(milliseconds: 220), () async { try { final r = await widget.load(q.trim()); if (mounted) setState(() => items = r); } catch (_) { if (mounted) setState(() => items = []); } }); }
  @override
  Widget build(BuildContext context) => Column(children: [
        TextField(autofocus: true, onChanged: _go, decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: t('Search'))),
        const SizedBox(height: 8),
        if (items == null) const Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())
        else if (items!.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text(widget.none, textAlign: TextAlign.center))
        else for (final x in items!) InkWell(onTap: () => Navigator.pop(context, x), child: widget.row(x)),
      ]);
}

// ---------- One story, full screen, with the engagement icons along the side ----------
class StoryView extends StatefulWidget {
  final J story;
  final bool active;
  final ValueChanged<J>? onChanged;
  final VoidCallback? onReload;
  const StoryView({super.key, required this.story, required this.active, this.onChanged, this.onReload});
  @override
  State<StoryView> createState() => _StoryViewState();
}

class _StoryViewState extends State<StoryView> {
  late J s = widget.story;
  late bool revealed = s['sensitive'] != true;
  bool expanded = false, speaking = false, viewed = false;
  String? translated, translatedFrom;
  final tts = FlutterTts();

  J get counts => asMap(s['counts']);
  J get viewer => asMap(s['viewer']);
  J get place => asMap(s['place']);
  List<J> get media => asList(s['media']);
  Api get api => AppScope.read(context).api;

  @override
  void initState() { super.initState(); tts.setCompletionHandler(() { if (mounted) setState(() => speaking = false); }); WidgetsBinding.instance.addPostFrameCallback((_) => _view()); }
  @override
  void didUpdateWidget(covariant StoryView old) { super.didUpdateWidget(old); if (widget.active && !old.active) _view(); if (!widget.active && speaking) { tts.stop(); speaking = false; } }
  @override
  void dispose() { tts.stop(); super.dispose(); }

  void _view() { if (!widget.active || viewed || !revealed || s['status'] != 'published') return; viewed = true; api.post('/stories/${s['id']}/view').catchError((_) => null); }
  void _set(J patch) { setState(() => s = {...s, ...patch}); widget.onChanged?.call(s); }

  // Optimistic: the reaction shows at once and is confirmed in the background.
  Future<void> _react(String type) async {
    if (!need(context)) return;
    final before = s;
    final cur = viewer['reaction'] as String?;
    final next = cur == type ? null : type;
    const key = {'heart': 'hearts', 'heartbreak': 'heartbreaks', 'laugh': 'laughs'};
    final c = {...counts};
    if (cur != null) c[key[cur]!] = num0(c[key[cur]]) - 1;
    if (next != null) c[key[next]!] = num0(c[key[next]]) + 1;
    _set({'counts': c, 'viewer': {...viewer, 'reaction': next}});
    HapticFeedback.lightImpact();
    try {
      // Offline: the reaction is kept on the phone and sent when the connection returns.
      final sent = await AppScope.read(context).outbox.send(t('Reaction'), 'PUT', '/stories/${s['id']}/reaction', {'type': type});
      if (!mounted) return;
      if (sent == null) { toast(context, t('Waiting to send')); return; }
      final r = asMap(sent);
      _set({'counts': {...counts, ...asMap(r['counts'])}, 'viewer': {...viewer, 'reaction': r['reaction']}});
    } catch (e) { if (mounted) { setState(() => s = before); toast(context, errText(e), error: true); } }
  }

  Future<void> _favourite() async {
    if (!need(context)) return;
    final on = viewer['favourited'] != true;
    _set({'viewer': {...viewer, 'favourited': on}});
    HapticFeedback.mediumImpact();
    try {
      final sent = await AppScope.read(context).outbox.send(t('Favorite'), 'PUT', '/stories/${s['id']}/favourite');
      if (!mounted) return;
      toast(context, sent == null ? t('Waiting to send') : str(asMap(sent)['message'], on ? t('Added to Favorites.') : t('Removed from Favorites.')));
    }
    catch (e) { if (mounted) { _set({'viewer': {...viewer, 'favourited': !on}}); toast(context, errText(e), error: true); } }
  }

  void _log(String kind, [String? target]) => api.post('/stories/${s['id']}/share', {'kind': kind, if (target != null) 'target': target}).catchError((_) => null);

  void _share() => sheet(context, t('Share this story'), (c) => Column(children: [
        ListTile(leading: const Icon(Icons.ios_share), title: Text(t('Share')), onTap: () { Navigator.pop(c); Share.share('${str(s['title'], t('A story from Remembering the Waters'))}\n${s['permalink']}'); _log('share', 'device'); }),
        ListTile(leading: const Icon(Icons.link), title: Text(t('Copy Link')), onTap: () { Navigator.pop(c); Clipboard.setData(ClipboardData(text: str(s['permalink']))); toast(context, t('Link copied.')); _log('copy_link'); }),
        ListTile(leading: const Icon(Icons.format_quote), title: Text(t('Cite this story')), onTap: () { Navigator.pop(c); _cite(); }),
        if (s['allowDownload'] == true) ListTile(leading: const Icon(Icons.download), title: Text(t('Download')), subtitle: const Text('ZIP'), onTap: () { Navigator.pop(c); _download(); }),
      ]));

  void _cite() => sheet(context, t('Cite this story'), (c) => Loader<J>(load: () async => asMap(await api.get('/stories/${s['id']}/cite')), builder: (c, d, _) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final k in const ['apa', 'mla', 'chicago', 'harvard']) Section(k.toUpperCase(), [SelectableText(str(d[k]))], trailing: TextButton(onPressed: () { Clipboard.setData(ClipboardData(text: str(d[k]))); toast(context, t('Citation copied.')); _log('cite'); }, child: Text(t('Copy')))),
        Text('${t('Permanent link')}: ${d['permalink']}', style: const TextStyle(fontSize: 12.5)),
      ])), tall: true);

  Future<void> _download() async {
    toast(context, t('Preparing your download…'));
    try {
      final r = asMap(await api.post('/stories/${s['id']}/download'));
      for (var i = 0; i < 80; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1500));
        final st = asMap(await api.get('/stories/downloads/${r['exportId']}'));
        if (st['status'] == 'ready') { if (mounted) toast(context, t('Your download is ready.')); await launchUrl(Uri.parse(api.abs(str(st['url']))), mode: LaunchMode.externalApplication); return; }
        if (st['status'] == 'failed') throw ApiError(500, t('Something went wrong. Please try again.'));
      }
    } catch (e) { if (mounted) toast(context, errText(e), error: true); }
  }

  Future<void> _translate() async {
    if (translated != null) { setState(() => translated = null); return; }
    try { final r = asMap(await api.get('/stories/${s['id']}/translate', {'to': I18n.code})); setState(() { translated = str(r['text']); translatedFrom = str(r['fromName']); }); }
    catch (_) { if (mounted) toast(context, t('Translation is not available right now.'), error: true); }
  }

  Future<void> _listen() async {
    if (speaking) { await tts.stop(); setState(() => speaking = false); return; }
    final text = [s['title'], translated ?? s['text'], ...media.map((m) => m['transcript'])].where((e) => str(e).isNotEmpty).join('. ');
    if (text.isEmpty) { toast(context, t('This device cannot read aloud.')); return; }
    final lang = translated != null ? I18n.code : str(s['language'], 'en');
    try { await tts.setLanguage(lang == 'sw' ? 'sw-KE' : lang == 'en' ? 'en-GB' : lang); } catch (_) {}
    await tts.speak(text.length > 3800 ? text.substring(0, 3800) : text);
    setState(() => speaking = true);
  }

  void _map() {
    final p = LatLng((place['latitude'] as num).toDouble(), (place['longitude'] as num).toDouble());
    sheet(context, t('Where It Happened'), (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SizedBox(height: MediaQuery.of(c).size.height * .5, child: MapBox(markers: [pin(p, label: str(place['name']))], center: p, zoom: 11)),
          Padding(padding: const EdgeInsets.only(top: 8), child: Text([place['name'], place['county'], place['waterBody']].where((e) => str(e).isNotEmpty).join(' · '))),
        ]), tall: true);
  }

  Widget _act(IconData icon, String label, VoidCallback onTap, {bool on = false, int? n}) {
    final cs = Theme.of(context).colorScheme;
    return Semantics(button: true, toggled: on, label: n == null ? label : '$label: $n', excludeSemantics: true, child: InkResponse(onTap: onTap, radius: 30, child: Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Column(mainAxisSize: MainAxisSize.min, children: [
      AnimatedContainer(duration: const Duration(milliseconds: 180), width: 40, height: 40, decoration: BoxDecoration(shape: BoxShape.circle, color: on ? cs.primary : Colors.transparent),
          child: Icon(icon, size: 22, color: on ? Colors.white : cs.onSurface)),
      Text(n == null ? '' : compact(n), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, height: 1)),
    ]))));
  }

  Widget _group(List<Widget> children) => Container(margin: const EdgeInsets.only(bottom: 6), padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 2),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(26), border: Border.all(color: Theme.of(context).dividerTheme.color ?? Colors.grey)), child: Column(mainAxisSize: MainAxisSize.min, children: children));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final cs = Theme.of(context).colorScheme;
    final author = s['author'] == null ? null : asMap(s['author']);
    final text = translated ?? str(s['text']);
    final long = text.length > 600 && !expanded;
    final hasPlace = place['latitude'] != null && place['longitude'] != null;
    final when = s['eventDate'] == null ? '' : (s['dateApproximate'] == true ? t('around {year}', {'year': str(s['eventDate']).substring(0, 4)}) : fmtDate(s['eventDate']));
    final source = s['source'] == null ? null : asMap(s['source']);
    final correction = s['correction'] == null ? null : asMap(s['correction']);
    final incident = s['incident'] == null ? null : asMap(s['incident']);
    final content = !revealed
        ? Note(str(app.config['sensitiveNotice'], t('This story describes loss of life and may be distressing.')), color: C.yellow, child: Padding(padding: const EdgeInsets.only(top: 8), child: FilledButton(onPressed: () { setState(() => revealed = true); _view(); }, child: Text(t('View story')))))
        : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (str(s['title']).isNotEmpty) Semantics(header: true, child: Text(str(s['title']), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800))),
            if (source != null && (str(source['institution']).isNotEmpty || str(source['reference']).isNotEmpty)) Note('${t('Source')}: ${[source['institution'], source['reference'], source['original_date'], source['creator']].where((e) => str(e).isNotEmpty).join(' · ')}${str(source['rights_statement']).isEmpty ? '' : '\n${source['rights_statement']}'}'),
            if (translated != null) Note(t('Machine-translated from {language}', {'language': translatedFrom}), child: Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => setState(() => translated = null), child: Text(t('Show original'))))),
            if (text.isNotEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(long ? '${text.substring(0, 600)}…' : text, style: const TextStyle(fontSize: 15.5, height: 1.5))),
            if (long) Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => setState(() => expanded = true), child: Text(t('Read the whole story')))),
            if (correction != null) Note('${t('Safety note from the admins')}: ${correction['note']}', color: C.yellow, child: str(correction['link']).isEmpty ? null : Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => launchUrl(Uri.parse(str(correction['link'])), mode: LaunchMode.externalApplication), child: Text(t('Official guidance'))))),
            for (var i = 0; i < media.length; i++) MediaTile(media[i], active: widget.active && i == 0),
            Padding(padding: const EdgeInsets.only(top: 8), child: Text([if (str(s['category']).isNotEmpty) t(str(s['category'])), s['vessel'], ...(s['tags'] as List? ?? const []).map((x) => '#$x')].where((e) => str(e).isNotEmpty).join(' · '), style: const TextStyle(fontSize: 12.5))),
            Text('${s['code']} · ${t('Rights')}: ${s['rights']}', style: const TextStyle(fontSize: 12)),
            if (s['sensitive'] == true && str(app.config['supportInfo']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Note(str(app.config['supportInfo']))),
            const SizedBox(height: 30),
            Center(child: Text(t('Scroll past the end for the next story'), style: TextStyle(fontSize: 12, color: cs.onSurface.withValues(alpha: .6)))),
            const SizedBox(height: 20),
          ]);
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(14, 8, 6, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (app.isAdmin && s['moderation'] != null) AdminStoryBar(story: s, onChanged: widget.onReload),
        InkWell(onTap: author?['username'] != null && author?['role'] != 'admin' ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => ContributorPage(str(author!['username'])))) : null, child: Row(children: [
          Avatar(author), const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Flexible(child: Text(personName(author), style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)), if (author?['badge'] != null) Padding(padding: const EdgeInsets.only(left: 6), child: Pill(str(author!['badge'])))]),
            if (str(s['toldBy']).isNotEmpty) Text(t('as told by {name}', {'name': s['toldBy']}), style: const TextStyle(fontSize: 12.5)),
            Text([place['name'], s['publishedAt'] != null ? ago(s['publishedAt']) : t('Not published'), if (when.isNotEmpty) t('Happened: {when}', {'when': when}), if (s['edited'] == true) t('Edited')].where((e) => str(e).isNotEmpty).join(' · '), style: const TextStyle(fontSize: 12)),
          ])),
        ])),
        const SizedBox(height: 8),
        Wrap(children: [
          Pill(t(str(s['typeLabel'])), color: s['type'] == 'record' ? const Color(0xFF7A5C00) : null),
          if (s['consentLabel'] != null) Pill(t(str(s['consentLabel'])), color: C.green),
          if (incident != null) GestureDetector(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => IncidentPage(str(incident['code'])))), child: Pill(str(incident['title']))),
        ]),
        content,
      ]))),
      SizedBox(width: 58, child: SingleChildScrollView(padding: const EdgeInsets.only(top: 6, right: 6, bottom: 20), child: Column(children: [
        if (hasPlace) _group([_act(Icons.place_outlined, t('Where It Happened'), _map)]),
        _group([
          _act(viewer['reaction'] == 'heart' ? Icons.favorite : Icons.favorite_border, t('Heart'), () => _react('heart'), on: viewer['reaction'] == 'heart', n: num0(counts['hearts'])),
          _act(Icons.heart_broken_outlined, t('Heartbreak'), () => _react('heartbreak'), on: viewer['reaction'] == 'heartbreak', n: num0(counts['heartbreaks'])),
          _act(Icons.sentiment_very_satisfied, t('Laugh'), () => _react('laugh'), on: viewer['reaction'] == 'laugh', n: num0(counts['laughs'])),
        ]),
        _act(Icons.mode_comment_outlined, t('Comments'), () => sheet(context, t('Comments'), (_) => CommentsSheet(story: s, onCount: (n) => _set({'counts': {...counts, 'comments': n}})), tall: true), n: num0(counts['comments'])),
        _group([_act(Icons.ios_share, t('Share'), _share)]),
        _group([_act(viewer['favourited'] == true ? Icons.star : Icons.star_border, viewer['favourited'] == true ? t('Remove from Favorites') : t('Add to Favorites'), _favourite, on: viewer['favourited'] == true)]),
        _group([
          if (str(s['language']) != I18n.code && (str(s['text']).isNotEmpty || media.any((m) => m['transcript'] != null))) _act(Icons.translate, t('Translate'), _translate, on: translated != null),
          _act(speaking ? Icons.stop_circle_outlined : Icons.volume_up_outlined, speaking ? t('Stop') : t('Listen'), _listen, on: speaking),
        ]),
        _group([
          _act(Icons.flag_outlined, t('Report'), () { if (need(context)) sheet(context, t('Report'), (_) => ReportForm(targetType: 'story', targetId: str(s['id']), author: author), tall: true); }),
          _act(Icons.warning_amber, t('Safety concern'), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SafetyConcernPage()))),
        ]),
      ]))),
    ]);
  }
}

/// A picture, video, recording or document inside a story. In low-data mode pictures and video load only when selected.
class MediaTile extends StatefulWidget {
  final J m;
  final bool active;
  const MediaTile(this.m, {super.key, this.active = false});
  @override
  State<MediaTile> createState() => _MediaTileState();
}

class _MediaTileState extends State<MediaTile> {
  VideoPlayerController? c;
  bool load = false, failed = false;
  J get urls => asMap(widget.m['urls']);
  String get kind => str(widget.m['kind']);
  /// The approximate size of what would load, shown before it loads (low-data mode).
  String _size(String which) {
    final n = num0(asMap(widget.m['sizes'])[which] ?? (which == 'web' ? widget.m['sizeBytes'] : 0));
    if (n <= 0) return '';
    return ' · ${(n / 1048576).toStringAsFixed(n > 10485760 ? 0 : 1)} MB';
  }

  @override
  void didChangeDependencies() { super.didChangeDependencies(); if (!load && !AppScope.of(context).lowData) { load = true; if (kind == 'video' && widget.active) _start(muted: true); } }
  @override
  void didUpdateWidget(covariant MediaTile old) { super.didUpdateWidget(old); if (!widget.active) c?.pause(); }
  @override
  void dispose() { c?.dispose(); super.dispose(); }

  Future<void> _start({bool muted = false}) async {
    final api = AppScope.read(context).api;
    final u = kind == 'video' ? (urls['hls'] ?? urls['web'] ?? urls['original']) : (urls['web'] ?? urls['original']);
    if (u == null || c != null) return;
    final ctl = VideoPlayerController.networkUrl(Uri.parse(api.abs(str(u))));
    c = ctl;
    try { await ctl.initialize(); if (muted) await ctl.setVolume(0); await ctl.play(); ctl.addListener(() { if (mounted) setState(() {}); }); if (mounted) setState(() {}); }
    catch (_) { if (mounted) setState(() => failed = true); }
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    final cs = Theme.of(context).colorScheme;
    final m = widget.m;
    Widget body;
    if (str(m['processing']) == 'processing' || str(m['processing']) == 'pending') {
      body = Note(t('This file is still being prepared.'));
    } else if (kind == 'image') {
      final u = urls['medium'] ?? urls['full'] ?? urls['thumb'];
      body = !load || u == null ? _placeholder(Icons.image, '${t('Tap to load the picture')}${_size('medium')}')
          : ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(api.abs(str(u)), fit: BoxFit.contain, semanticLabel: str(m['altText'], t('Picture in this story')),
              loadingBuilder: (c, w, p) => p == null ? w : const SizedBox(height: 180, child: Center(child: CircularProgressIndicator())), errorBuilder: (_, __, ___) => _placeholder(Icons.broken_image, t('Retry'))));
    } else if (kind == 'video' || kind == 'audio') {
      final v = c;
      if (failed) { body = _placeholder(Icons.error_outline, t('Retry')); }
      else if (v == null || !v.value.isInitialized) { body = _placeholder(kind == 'video' ? Icons.play_circle : Icons.graphic_eq, v == null ? '${kind == 'video' ? t('Tap to load the video') : t('Tap to load the audio')}${_size('web')}' : '…'); }
      else {
        body = Column(children: [
          if (kind == 'video') ClipRRect(borderRadius: BorderRadius.circular(12), child: AspectRatio(aspectRatio: v.value.aspectRatio == 0 ? 16 / 9 : v.value.aspectRatio, child: VideoPlayer(v))),
          Row(children: [
            IconButton(icon: Icon(v.value.isPlaying ? Icons.pause_circle : Icons.play_circle, size: 34, color: cs.primary), tooltip: v.value.isPlaying ? t('Stop') : t('Listen'), onPressed: () => v.value.isPlaying ? v.pause() : v.play()),
            Expanded(child: VideoProgressIndicator(v, allowScrubbing: true, colors: VideoProgressColors(playedColor: cs.primary))),
            if (kind == 'video') IconButton(icon: Icon(v.value.volume == 0 ? Icons.volume_off : Icons.volume_up), tooltip: t('Sound'), onPressed: () => v.setVolume(v.value.volume == 0 ? 1 : 0)),
          ]),
        ]);
      }
    } else {
      body = ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.description), title: Text(str(m['name'])), subtitle: Text(t('Opens in a secure viewer')),
          onTap: () { final u = urls['original'] ?? urls['web']; if (u != null) launchUrl(Uri.parse(api.abs(str(u))), mode: LaunchMode.inAppBrowserView); });
    }
    return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      body,
      if (str(m['transcript']).isNotEmpty) ExpansionTile(tilePadding: EdgeInsets.zero, title: Text(t('Transcript'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)), children: [Align(alignment: Alignment.centerLeft, child: Text(str(m['transcript'])))]),
    ]));
  }

  Widget _placeholder(IconData icon, String label) => InkWell(onTap: () { setState(() { load = true; failed = false; }); if (kind != 'image') { c?.dispose(); c = null; _start(); } },
      child: Container(height: 150, decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: .1), borderRadius: BorderRadius.circular(12)), alignment: Alignment.center,
          child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 40, color: Theme.of(context).colorScheme.primary), Text(label)])));
}

// ---------- Comments ----------
class CommentsSheet extends StatefulWidget {
  final J story;
  final ValueChanged<int> onCount;
  const CommentsSheet({super.key, required this.story, required this.onCount});
  @override
  State<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<CommentsSheet> {
  String sort = 'top';
  J? data;
  J? replyTo;
  final ctl = TextEditingController();
  bool busy = false;
  // Comments the reader has asked to see in their own language: id -> (text, original language).
  final Map<String, (String, String)> shown = {};
  Future<void> _translate(J c) async {
    final id = str(c['id']);
    if (shown.containsKey(id)) { setState(() => shown.remove(id)); return; }
    try { final r = asMap(await AppScope.read(context).api.get('/comments/$id/translate', {'to': I18n.code})); if (mounted) setState(() => shown[id] = (str(r['text']), str(r['fromName']))); }
    catch (e) { if (mounted) toast(context, errText(e), error: true); }
  }
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try { final d = asMap(await AppScope.read(context).api.get('/stories/${widget.story['id']}/comments', {'sort': sort})); if (mounted) { setState(() => data = d); widget.onCount(num0(d['count'])); } }
    catch (e) { if (mounted) toast(context, errText(e), error: true); }
  }
  Future<void> _send() async {
    if (!need(context) || ctl.text.trim().isEmpty) return;
    setState(() => busy = true);
    try {
      // Offline: the comment is kept on the phone and sent when the connection returns.
      final r = await AppScope.read(context).outbox.send(t('Comment'), 'POST', '/stories/${widget.story['id']}/comments', {'text': ctl.text.trim(), if (replyTo != null) 'parentId': replyTo!['id']});
      if (!mounted) return;
      if (r == null) { toast(context, t('Waiting to send')); } else if (asMap(r)['message'] is String) { toast(context, str(asMap(r)['message'])); }
      ctl.clear(); replyTo = null;
      if (r != null) await _load();
    } catch (e) { if (mounted) toast(context, errText(e), error: true); }
    if (mounted) setState(() => busy = false);
  }
  Widget _one(J c, {bool reply = false}) {
    final a = asMap(c['author']);
    final app = AppScope.read(context);
    return Padding(padding: EdgeInsets.only(left: reply ? 34 : 0, bottom: 10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Avatar(a, size: 30), const SizedBox(width: 8),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${personName(a)}${a['badge'] != null ? ' · ${a['badge']}' : ''} · ${ago(c['createdAt'])}${c['status'] != 'published' ? ' · ${t('Held for review')}' : ''}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        if (str(c['text']).isNotEmpty) Text(shown[str(c['id'])]?.$1 ?? str(c['text'])),
        if (shown.containsKey(str(c['id']))) Text(t('Machine-translated from {language}', {'language': shown[str(c['id'])]!.$2}), style: TextStyle(fontSize: 11.5, color: Theme.of(context).hintColor)),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
          TextButton.icon(style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero), icon: Icon(c['myReaction'] != null ? Icons.favorite : Icons.favorite_border, size: 15), label: Text('${c['reactions']}'),
              onPressed: () async { if (!need(context)) return; await run(context, () => app.api.put('/comments/${c['id']}/reaction', {'type': 'heart'})); _load(); }),
          if (data?['locked'] != true) TextButton(style: TextButton.styleFrom(visualDensity: VisualDensity.compact), onPressed: () { if (need(context)) setState(() { replyTo = c; if (a['username'] != null) ctl.text = '@${a['username']} '; }); }, child: Text(t('Reply'))),
          if (str(c['text']).isNotEmpty && str(c['language']) != I18n.code && c['status'] == 'published') TextButton(style: TextButton.styleFrom(visualDensity: VisualDensity.compact), onPressed: () => _translate(c), child: Text(shown.containsKey(str(c['id'])) ? t('Show original') : t('Translate'))),
          if (c['own'] == true || app.isAdmin) TextButton(style: TextButton.styleFrom(visualDensity: VisualDensity.compact), onPressed: () async { final ok = await confirm(context, t('Delete this comment?'), yes: t('Delete'), danger: true); if (ok != null && mounted) { await run(context, () => app.api.delete('/comments/${c['id']}')); _load(); } }, child: Text(t('Delete')))
          else TextButton(style: TextButton.styleFrom(visualDensity: VisualDensity.compact), onPressed: () { if (need(context)) sheet(context, t('Report'), (_) => ReportForm(targetType: 'comment', targetId: str(c['id']), author: a), tall: true); }, child: Text(t('Report'))),
        ]),
      ])),
    ]));
  }
  @override
  Widget build(BuildContext context) {
    final d = data;
    final signedIn = AppScope.of(context).signedIn;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Wrap(spacing: 6, children: [for (final (k, label) in [('top', t('Most reactions')), ('recent', t('Most recent')), ('oldest', t('Oldest'))]) ChoiceChip(label: Text(label), selected: sort == k, onSelected: (_) { setState(() => sort = k); _load(); })]),
      const SizedBox(height: 8),
      if (d == null) const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
      else ...[
        if (d['hidden'] == true) Note('${t('Comments have been hidden by an admin.')} ${str(d['hiddenReason'])} (${t('{n} comments', {'n': d['count']})})', color: C.yellow),
        if (d['locked'] == true) Note('${t('Comments and replies have been locked by an admin.')} ${str(d['lockedReason'])}', color: C.yellow),
        if (asList(d['items']).isEmpty && d['hidden'] != true) EmptyState(t('No comments yet'), icon: Icons.mode_comment_outlined, text: t('Be the first to say something kind.')),
        for (final c in asList(d['items'])) ...[_one(c), for (final r in asList(c['replies'])) _one(r, reply: true)],
        if (d['locked'] != true) ...[
          if (replyTo != null) Row(children: [Expanded(child: Text(t('Replying to {name}', {'name': personName(asMap(replyTo!['author']))}), style: const TextStyle(fontSize: 12.5))), TextButton(onPressed: () => setState(() { replyTo = null; ctl.clear(); }), child: Text(t('Cancel')))]),
          Row(children: [
            Expanded(child: TextField(controller: ctl, minLines: 1, maxLines: 4, readOnly: !signedIn, onTap: signedIn ? null : () => need(context), decoration: InputDecoration(hintText: signedIn ? t('Write a comment… use @ to tag someone') : t('Sign in to comment')))),
            IconButton.filled(onPressed: busy ? null : _send, icon: const Icon(Icons.send), tooltip: t('Send')),
          ]),
        ],
      ],
    ]);
  }
}

// ---------- Guided hints on first use ----------
/// Four short hints over the STORIES page: how to browse, react, comment and share a first story.
/// Shown once per device, and again on request from Settings.
class GuideOverlay extends StatelessWidget {
  final int step;
  const GuideOverlay({super.key, required this.step});
  // (icon, title, text, where the card sits, which way the arrow points: up or right)
  static const steps = <(IconData, String, String, Alignment, bool)>[
    (Icons.swipe_up_outlined, 'Browse the stories', 'Choose how to browse at the top: trending, by place, by incident and more. Swipe up to move to the next story.', Alignment(0, -0.55), true),
    (Icons.favorite_border, 'React to a story', 'A heart, a heartbreak or a laugh tells the storyteller how their story reached you.', Alignment(-1, -0.1), false),
    (Icons.mode_comment_outlined, 'Join the conversation', 'Open the comments to read what others have said, and add a comment or a reply of your own.', Alignment(-1, 0.25), false),
    (Icons.add_circle_outline, 'Share your first story', 'Tap the plus to tell your own story in words, photos, audio or video.', Alignment(1, -0.7), true),
  ];
  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    final cs = Theme.of(context).colorScheme;
    final (icon, title, body, where, up) = steps[step.clamp(0, steps.length - 1)];
    final last = step >= steps.length - 1;
    final arrow = Icon(up ? Icons.arrow_upward : Icons.arrow_forward, color: Colors.white, size: 34);
    final card = ConstrainedBox(constraints: const BoxConstraints(maxWidth: 320), child: Material(color: cs.surface, elevation: 6, borderRadius: BorderRadius.circular(18), child: Padding(padding: const EdgeInsets.fromLTRB(16, 14, 12, 8),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(t('Hint {n} of {total}', {'n': step + 1, 'total': steps.length}), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cs.onSurfaceVariant)),
        const SizedBox(height: 4),
        Row(children: [Icon(icon, color: cs.primary, size: 22), const SizedBox(width: 8), Expanded(child: Text(t(title), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: cs.primary)))]),
        const SizedBox(height: 6),
        Text(t(body)),
        const SizedBox(height: 6),
        Row(children: [
          TextButton(onPressed: app.endGuide, child: Text(t('Skip the hints'))), const Spacer(),
          FilledButton(onPressed: () => app.nextGuide(steps.length), child: Text(last ? t('Got it') : t('Next'))),
        ]),
      ]))));
    return Semantics(container: true, liveRegion: true, label: t(title), child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: () {}, child: ColoredBox(color: const Color(0x9E071426),
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(12, 12, 6, 12), child: Align(alignment: where,
        child: AnimatedSwitcher(duration: Duration(milliseconds: app.reducedMotion ? 1 : 260), child: KeyedSubtree(key: ValueKey(step), child: up
          ? Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: where.x > 0 ? CrossAxisAlignment.end : CrossAxisAlignment.center, children: [Padding(padding: const EdgeInsets.only(right: 8, bottom: 6), child: arrow), card])
          : Row(mainAxisSize: MainAxisSize.min, children: [Flexible(child: card), const SizedBox(width: 6), arrow, const SizedBox(width: 56)])))))))));
  }
}

// ---------- Report a story, comment or Contributor ----------
class ReportForm extends StatefulWidget {
  final String targetType, targetId;
  final J? author;
  const ReportForm({super.key, required this.targetType, required this.targetId, this.author});
  @override
  State<ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<ReportForm> {
  late bool user = widget.targetType == 'user';
  final reasons = <String>{};
  final ctl = TextEditingController();
  String? error;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final a = widget.author;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (widget.targetType != 'user' && a?['id'] != null && a?['role'] != 'admin') Wrap(spacing: 6, children: [
        ChoiceChip(label: Text(widget.targetType == 'story' ? t('This story') : t('This comment')), selected: !user, onSelected: (_) => setState(() => user = false)),
        ChoiceChip(label: Text('${t('The Contributor')} ${a?['username'] != null ? '@${a!['username']}' : ''}'), selected: user, onSelected: (_) => setState(() => user = true)),
      ]),
      Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(t('Why are you reporting this? Pick one or more.'), style: const TextStyle(fontWeight: FontWeight.w700))),
      for (final r in asList(app.config['reportReasons'])) CheckboxListTile(dense: true, contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: reasons.contains(r['key']), title: Text(str(r['label'])),
          onChanged: (v) => setState(() => v == true ? reasons.add(str(r['key'])) : reasons.remove(r['key']))),
      Field(t('Describe the issue (optional)'), ctl, lines: 3),
      if (error != null) Text(error!, style: const TextStyle(color: C.red)),
      FilledButton(onPressed: () async {
        if (reasons.isEmpty && ctl.text.trim().isEmpty) { setState(() => error = t('Pick at least one reason or describe the issue.')); return; }
        final r = await run(context, () => app.api.post('/reports', user && a?['id'] != null ? {'targetType': 'user', 'targetId': a!['id'], 'reasons': reasons.toList(), 'description': ctl.text.trim()} : {'targetType': widget.targetType, 'targetId': widget.targetId, 'reasons': reasons.toList(), 'description': ctl.text.trim()}));
        if (r != null && context.mounted) Navigator.pop(context);
      }, child: Text(t('Send report'))),
    ]);
  }
}

// ---------- Tabs that show lists: incidents, map, timeline, collections ----------
class IncidentList extends StatefulWidget {
  final void Function(String id, String title) onStories;
  const IncidentList({super.key, required this.onStories});
  @override
  State<IncidentList> createState() => _IncidentListState();
}

class _IncidentListState extends State<IncidentList> {
  String q = '';
  int gen = 0;
  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(14, 6, 14, 0), child: TextField(decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: '${t('Name')}, ${t('Year')}, ${t('Water body')}'), onSubmitted: (v) => setState(() { q = v.trim(); gen++; }))),
        Expanded(child: Loader<List<J>>(key: ValueKey(gen), load: () async { final year = int.tryParse(q); return asList(await AppScope.read(context).api.get('/incidents', year != null && q.length == 4 ? {'year': year} : {'q': q})); },
            builder: (c, list, _) => list.isEmpty ? EmptyState(t('No incident records match'), icon: Icons.report_gmailerrorred) : ListView(padding: const EdgeInsets.all(8), children: [
              for (final i in list) ListTile(leading: const Icon(Icons.report_gmailerrorred, color: C.red), title: Text(str(i['title']), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text([fmtDate(i['eventDate']), i['placeName'], i['waterBody'], t('{n} linked stories', {'n': i['stories']})].where((e) => str(e).isNotEmpty).join(' · ')),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => IncidentPage(str(i['code']), onStories: widget.onStories)))),
            ]))),
      ]);
}

class MapExplore extends StatelessWidget {
  final void Function(String code) onStory;
  const MapExplore({super.key, required this.onStory});
  @override
  Widget build(BuildContext context) => Loader<J>(load: () async => asMap(await AppScope.read(context).api.get('/map', {'bbox': '33,-5.5,42.5,5.5', 'zoom': 12, 'incidents': true})), builder: (c, d, _) => Padding(padding: const EdgeInsets.all(10), child: Column(children: [
        Expanded(child: MapBox(markers: [
          for (final s in asList(d['stories'])) if (s['latitude'] != null) pin(LatLng((s['latitude'] as num).toDouble(), (s['longitude'] as num).toDouble()), count: num0(s['count']), label: str(s['title'], str(s['code'])),
              onTap: () { if (s['code'] != null) { onStory(str(s['code'])); } else { toast(context, t('{n} stories here', {'n': s['count']})); } }),
          for (final i in asList(d['incidents'])) if (i['latitude'] != null) pin(LatLng((i['latitude'] as num).toDouble(), (i['longitude'] as num).toDouble()), color: C.red, label: str(i['title']), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => IncidentPage(str(i['code']))))),
        ])),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text(t('Blue: stories. Red: incident records. Select a marker to open it.'), style: const TextStyle(fontSize: 12))),
      ])));
}

class TimelineList extends StatelessWidget {
  final void Function(J filter, String label) onPick;
  const TimelineList({super.key, required this.onPick});
  @override
  Widget build(BuildContext context) => Loader<List<J>>(load: () async => asList(await AppScope.read(context).api.get('/timeline')), builder: (c, list, _) => list.isEmpty ? EmptyState(t('No dated stories yet'), icon: Icons.timeline) : ListView(padding: const EdgeInsets.all(14), children: [
        Text(t('Browse stories by the decade and year in which the events happened.')),
        for (final d in list) Padding(padding: const EdgeInsets.only(top: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          InkWell(onTap: () => onPick({'decade': d['decade']}, t('Stories from the {decade}s', {'decade': d['decade']})), child: Text('${d['decade']}s  ·  ${t('{n} stories', {'n': d['stories']})}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary))),
          Wrap(spacing: 6, children: [for (final y in asList(d['years'])) ActionChip(label: Text('${y['year']} · ${y['stories']}'), onPressed: () => onPick({'year': y['year']}, t('Stories from {year}', {'year': y['year']})))]),
          for (final i in asList(d['incidents'])) ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: const Icon(Icons.circle, size: 10, color: C.red), title: Text(str(i['title'])), subtitle: Text(fmtDate(i['eventDate'])), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => IncidentPage(str(i['code']))))),
        ])),
      ]));
}

class CollectionList extends StatelessWidget {
  final void Function(String id, String title) onOpen;
  const CollectionList({super.key, required this.onOpen});
  @override
  Widget build(BuildContext context) => Loader<List<J>>(load: () async => asList(await AppScope.read(context).api.get('/collections')), builder: (c, list, _) => list.isEmpty ? EmptyState(t('No collections yet'), icon: Icons.collections_bookmark) : ListView(padding: const EdgeInsets.all(12), children: [
        for (final x in list) Section(str(x['title']), [
          Pill(x['kind'] == 'exhibition' ? t('Online exhibition') : t('Collection')),
          Text(str(x['description']), maxLines: 4, overflow: TextOverflow.ellipsis),
          Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => onOpen(str(x['id']), str(x['title'])), child: Text(t('{n} stories', {'n': x['stories']})))),
        ]),
      ]));
}
