import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'main.dart';
import 'screens_main.dart';
import 'state.dart';
import 'ui.dart';

OrbItem _dash(BuildContext context) =>
    OrbItem(Icons.insert_chart_outlined_rounded, 'Dashboard', 'Back to the admin dashboard.', () => Nav.goTab(context, 4));

Widget _title(IconData i, String t) => Row(children: [Icon(i, color: C.sky), const SizedBox(width: 8), Expanded(child: Text(t, style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white)))]);

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String _monthLabel(String ym) { final m = int.tryParse(ym.split('-').last) ?? 1; return _months[(m - 1).clamp(0, 11)]; }

Widget _bars(List<MapEntry<String, int>> rows) {
  final maxV = rows.map((e) => e.value).fold(1, math.max);
  return SizedBox(height: 160, child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
    for (final v in rows)
      Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
        Text('${v.value}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
        const SizedBox(height: 4),
        Container(height: math.max(2, 110 * v.value / maxV), margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: const BoxDecoration(borderRadius: BorderRadius.vertical(top: Radius.circular(6)),
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [C.blue2, C.blue]))),
        const SizedBox(height: 4),
        Text(_monthLabel(v.key).substring(0, 1), style: const TextStyle(fontSize: 10, color: C.muted)),
      ])),
  ]));
}

class _ActivityTile extends StatelessWidget {
  final Activity a;
  const _ActivityTile(this.a);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleIcon(a.action.startsWith('login.') ? Icons.lock_outline_rounded : a.action.startsWith('login') ? Icons.login_rounded : Icons.monitor_heart_outlined, size: 32, solid: false),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(fmtDateTime(a.at), style: const TextStyle(color: C.muted, fontSize: 11.5)),
            Text.rich(TextSpan(children: [
              TextSpan(text: '${a.who} ', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              TextSpan(text: a.summary.isEmpty ? a.action : a.summary),
              if (a.ip.isNotEmpty) TextSpan(text: '  (${a.ip})', style: const TextStyle(color: C.muted, fontSize: 12)),
            ])),
          ])),
        ]),
      );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    Widget kpi(IconData i, Object n, String l) => Glass(padding: const EdgeInsets.all(14), child: Row(children: [
          CircleIcon(i, size: 42), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('$n', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
            Text(l, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: C.muted, fontSize: 12)),
          ])),
        ]));
    return AppPage(
      background: const PageBg(Icons.insert_chart_outlined_rounded),
      body: Loaded<Map<String, dynamic>>(
        load: () async => await s.api.get('/reports/summary') as Map<String, dynamic>,
        builder: (context, d, reload) {
          final t = d['totals'] as Map<String, dynamic>;
          final views = (d['viewsByMonth'] as List).map((e) => MapEntry('${e['month']}', (e['count'] as num).toInt())).toList();
          final recent = (d['recentActivity'] as List).whereType<Map<String, dynamic>>().map(Activity.fromJson).toList();
          return RefreshIndicator(
            onRefresh: () async { await reload(); await s.refreshCounts(); },
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
              const PageTitle('Archive dashboard', sub: "What's happening in the archive today."),
              const SizedBox(height: 14),
              GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.75, children: [
                kpi(Icons.inventory_2_outlined, t['published'], 'Published items'),
                kpi(Icons.edit_outlined, (t['records'] as num) - (t['published'] as num), 'Drafts and unpublished'),
                kpi(Icons.inbox_outlined, t['pendingSubmissions'], 'Waiting for review'),
                kpi(Icons.group_outlined, t['users'], 'Accounts (${t['activeUsers30d']} active this month)'),
              ]),
              OrbRow([
                OrbItem(Icons.inventory_2_outlined, 'Records', 'Edit, publish or unpublish items.', () => push(context, const RecordsAdminScreen())),
                OrbItem(Icons.upload_rounded, 'Upload', 'Add a new item and catalogue it.', () => push(context, const RecordFormScreen()), primary: true),
                OrbItem(Icons.inbox_outlined, 'Review', 'Approve or decline material sent in by the public.', () async { await push(context, const SubmissionsScreen()); reload(); }, badge: (t['pendingSubmissions'] as num).toInt()),
                OrbItem(Icons.group_outlined, 'Users', 'Create accounts, change roles, suspend accounts.', () => push(context, const UsersScreen())),
                OrbItem(Icons.mail_outline_rounded, 'Messages', 'Messages from the contact form.', () async { await push(context, const MessagesScreen()); reload(); }, badge: (t['unreadMessages'] as num).toInt()),
                OrbItem(Icons.monitor_heart_outlined, 'Reports', 'Usage, collection health and the audit log.', () => push(context, const ReportsScreen())),
              ], size: 64),
              Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _title(Icons.trending_up_rounded, 'Item views per month'),
                const SizedBox(height: 14),
                _bars(views),
              ])),
              const SizedBox(height: 14),
              Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _title(Icons.history_rounded, 'Recent activity'),
                const SizedBox(height: 6),
                if (recent.isEmpty) const Text('Nothing recorded yet.', style: TextStyle(color: C.muted)),
                for (final a in recent.take(6)) _ActivityTile(a),
              ])),
            ]),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Records list
// ---------------------------------------------------------------------------
class RecordsAdminScreen extends StatefulWidget {
  const RecordsAdminScreen({super.key});
  @override
  State<RecordsAdminScreen> createState() => _RecordsAdminScreenState();
}

class _RecordsAdminScreenState extends State<RecordsAdminScreen> {
  final _q = TextEditingController();
  String _status = '';
  Key _key = UniqueKey();

  void _refresh() => setState(() => _key = UniqueKey());

  Future<void> _setStatus(Rec r, String what) async {
    final s = AppScope.read(context);
    try {
      await s.api.post('/records/${r.id}/$what');
      if (!mounted) return;
      toast(context, what == 'publish' ? '${r.identifier} published' : '${r.identifier} unpublished', what == 'publish' ? Icons.check_circle_outline_rounded : Icons.visibility_off_outlined);
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errText(e), Icons.error_outline_rounded);
    }
  }

  void _actions(Rec r) => showModalBottomSheet(context: context, builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(r.title, style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: Colors.white)),
          Text('${r.identifier}, ${r.status}', style: const TextStyle(color: C.muted)),
          const SizedBox(height: 10),
          ListTile(leading: const Icon(Icons.visibility_outlined), title: const Text('View'), onTap: () { Navigator.pop(ctx); push(context, RecordScreen(id: r.identifier)); }),
          ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('Edit'), onTap: () async { Navigator.pop(ctx); await push(context, RecordFormScreen(id: r.id)); _refresh(); }),
          if (r.status == 'published')
            ListTile(leading: const Icon(Icons.visibility_off_outlined), title: const Text('Unpublish'), onTap: () { Navigator.pop(ctx); _setStatus(r, 'unpublish'); })
          else
            ListTile(leading: const Icon(Icons.check_circle_outline_rounded), title: const Text('Publish'), onTap: () { Navigator.pop(ctx); _setStatus(r, 'publish'); }),
        ]),
      ));

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.inventory_2_outlined),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 0), child: Column(children: [
          const PageTitle('Records'),
          OrbRow([
            _dash(context),
            OrbItem(Icons.add_rounded, 'New item', 'Add and catalogue a new item.', () async { await push(context, const RecordFormScreen()); _refresh(); }, primary: true),
            OrbItem(Icons.delete_outline_rounded, 'Deleted', 'Items that were deleted and can be restored.', _deleted),
          ], size: 56),
          TextField(controller: _q, textInputAction: TextInputAction.search, onSubmitted: (_) => _refresh(),
              decoration: InputDecoration(hintText: 'Words in the title, summary or transcript', prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward_rounded), tooltip: 'Search', onPressed: _refresh))),
          const SizedBox(height: 10),
          SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
            for (final st in const ['', 'published', 'draft', 'unpublished'])
              Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(st.isEmpty ? 'All' : st[0].toUpperCase() + st.substring(1)), selected: _status == st,
                  selectedColor: C.blue, showCheckmark: false, onSelected: (_) { _status = st; _refresh(); })),
          ])),
        ])),
        Expanded(child: _PagedList<Rec>(
          key: _key,
          load: (page) async => PageOf.fromJson(await s.api.get('/records', {'q': _q.text.trim(), 'status': _status, 'page': page, 'pageSize': 20, 'sort': _q.text.trim().isEmpty ? 'added' : 'relevance'}), Rec.fromJson),
          empty: 'No items match.',
          item: (r) => ListTile(
            leading: CircleIcon(types[r.type]!.icon, solid: false),
            title: Text(r.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            subtitle: Text('${r.identifier}, ${r.views} views', style: const TextStyle(color: C.muted)),
            trailing: StatusChip(r.status),
            onTap: () => _actions(r),
          ),
        )),
      ]),
    );
  }

  Future<void> _deleted() async {
    final s = AppScope.read(context);
    await sheet(context, title: 'Deleted items', icon: Icons.delete_outline_rounded, builder: (ctx) => Loaded<List<Rec>>(
          load: () async => (await s.api.get('/records/deleted') as List).whereType<Map<String, dynamic>>().map(Rec.fromJson).toList(),
          builder: (ctx, list, reload) => Column(children: [
            if (list.isEmpty) const Text('Nothing has been deleted.', style: TextStyle(color: C.muted)),
            for (final r in list)
              ListTile(contentPadding: EdgeInsets.zero, leading: CircleIcon(types[r.type]!.icon, solid: false),
                  title: Text(r.title, style: const TextStyle(color: Colors.white)), subtitle: Text(r.identifier, style: const TextStyle(color: C.muted)),
                  trailing: TextButton(onPressed: () async {
                    try { await s.api.post('/records/${r.id}/restore'); await reload(); if (ctx.mounted) toast(ctx, 'Restored as unpublished'); } catch (e) { if (ctx.mounted) toast(ctx, errText(e)); }
                  }, child: const Text('Restore'))),
          ]),
        ));
    _refresh();
  }
}

/// A list that loads more pages as you scroll.
class _PagedList<T> extends StatefulWidget {
  final Future<PageOf<T>> Function(int page) load;
  final Widget Function(T item) item;
  final String empty;
  const _PagedList({super.key, required this.load, required this.item, required this.empty});
  @override
  State<_PagedList<T>> createState() => _PagedListState<T>();
}

class _PagedListState<T> extends State<_PagedList<T>> {
  final _items = <T>[];
  int _page = 0, _pages = 1;
  bool _loading = false;
  Object? _error;

  @override
  void initState() { super.initState(); _more(); }

  Future<void> _more() async {
    if (_loading || _page >= _pages) return;
    setState(() { _loading = true; _error = null; });
    try {
      final p = await widget.load(_page + 1);
      if (!mounted) return;
      setState(() { _items.addAll(p.items); _page = p.page; _pages = p.pages; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  Future<void> _reload() async { setState(() { _items.clear(); _page = 0; _pages = 1; }); await _more(); }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _items.isEmpty) return ErrorPanel(_error!, _reload);
    return RefreshIndicator(
      onRefresh: _reload,
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) { if (n.metrics.pixels > n.metrics.maxScrollExtent - 300) _more(); return false; },
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 40),
          itemCount: _items.length + 1,
          itemBuilder: (_, i) {
            if (i < _items.length) return widget.item(_items[i]);
            if (_loading) return const Center(child: LoadingView());
            if (_error != null) return Center(child: TextButton.icon(onPressed: _more, icon: const Icon(Icons.refresh_rounded), label: const Text('Load more')));
            if (_items.isEmpty) return Padding(padding: const EdgeInsets.all(24), child: Text(widget.empty, textAlign: TextAlign.center, style: const TextStyle(color: C.muted)));
            return const SizedBox(height: 20);
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Catalogue form: new item, or edit with files
// ---------------------------------------------------------------------------
class RecordFormScreen extends StatefulWidget {
  final String? id;
  const RecordFormScreen({super.key, this.id});
  @override
  State<RecordFormScreen> createState() => _RecordFormScreenState();
}

class _RecordFormScreenState extends State<RecordFormScreen> {
  static const _rights = ['CC BY-NC 4.0', 'CC BY 4.0', 'Used with permission', 'Public record', '© Lender, used with permission'];
  static const _consents = ['Signed consent form on file', 'Verbal consent recorded', 'Online consent given at submission', 'Permission letter on file', 'Not applicable (public record)'];
  final _form = GlobalKey<FormState>();
  final c = <String, TextEditingController>{
    for (final k in ['title', 'summary', 'body', 'year', 'place', 'county', 'lat', 'lng', 'creator', 'narrator', 'interviewer', 'photographer', 'language', 'rights', 'consent', 'duration', 'subjects', 'transcript'])
      k: TextEditingController(),
  };
  String _type = 'oral', _format = 'audio';
  int? _water;
  bool _approx = false, _busy = false, _loading = false;
  Rec? _r;
  Object? _error;
  double? _progress;
  final _newFiles = <LocalFile>[];

  @override
  void initState() {
    super.initState();
    if (widget.id != null) { _load(); } else { c['creator']!.text = 'Remembering the Waters field team'; c['language']!.text = 'English'; }
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final s = AppScope.read(context);
      final r = Rec.fromJson(await s.api.get('/records/${widget.id}') as Map<String, dynamic>);
      if (!mounted) return;
      _r = r;
      _type = r.type; _format = r.format; _water = r.water?.id; _approx = r.yearApproximate;
      c['title']!.text = r.title; c['summary']!.text = r.summary; c['body']!.text = r.body ?? '';
      c['year']!.text = r.year?.toString() ?? ''; c['place']!.text = r.place; c['county']!.text = r.county;
      c['lat']!.text = r.lat?.toString() ?? ''; c['lng']!.text = r.lng?.toString() ?? '';
      for (final k in ['creator', 'narrator', 'interviewer', 'photographer', 'language', 'rights', 'consent']) {
        c[k]!.text = switch (k) { 'creator' => r.creator, 'narrator' => r.narrator, 'interviewer' => r.interviewer, 'photographer' => r.photographer,
          'language' => r.language, 'rights' => r.rights, _ => r.consent } ?? '';
      }
      c['duration']!.text = r.durationSeconds == null ? '' : fmtTime(r.durationSeconds!);
      c['subjects']!.text = r.subjects.map((x) => x.label).join(', ');
      c['transcript']!.text = r.transcript.map((t) => '${fmtTime(t.start)}  ${t.text}').join('\n');
      setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  List<Map<String, Object>> _transcript() {
    final out = <Map<String, Object>>[];
    final lines = c['transcript']!.text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i].trim();
      if (line.isEmpty) continue;
      final m = RegExp(r'^(\d{1,2}(?::\d{1,2}){0,2})\s+(.+)$').firstMatch(line);
      final t = m == null ? null : parseTime(m.group(1)!);
      if (m == null || t == null) throw ApiError(400, 'Transcript line ${i + 1} needs a start time first, like "1:05  What was said".');
      out.add({'startSeconds': t, 'text': m.group(2)!.trim()});
    }
    out.sort((a, b) => (a['startSeconds'] as int).compareTo(b['startSeconds'] as int));
    return out;
  }

  Map<String, Object?> _data() {
    double? dbl(String k) => c[k]!.text.trim().isEmpty ? null : double.tryParse(c[k]!.text.trim());
    final lat = dbl('lat'), lng = dbl('lng');
    if ((lat == null) != (lng == null)) throw ApiError(400, 'Fill in both latitude and longitude, or leave both empty.');
    final dur = c['duration']!.text.trim();
    final secs = dur.isEmpty ? null : parseTime(dur);
    if (dur.isNotEmpty && secs == null) throw ApiError(400, 'Write the duration as minutes:seconds, like 12:30.');
    return {
      'type': _type, 'format': _format, 'title': c['title']!.text.trim(), 'summary': c['summary']!.text.trim(),
      'body': c['body']!.text.trim().isEmpty ? null : c['body']!.text.trim(), 'year': int.tryParse(c['year']!.text.trim()), 'yearApproximate': _approx,
      'waterBodyId': _water, 'place': c['place']!.text.trim(), 'county': c['county']!.text.trim(), 'latitude': lat, 'longitude': lng,
      for (final k in ['creator', 'narrator', 'interviewer', 'photographer', 'language', 'rights', 'consent']) k: c[k]!.text.trim(),
      'durationSeconds': secs,
      'subjects': c['subjects']!.text.split(',').map((x) => x.trim()).where((x) => x.length >= 2).toList(),
      'transcript': _transcript(),
    };
  }

  Future<void> _save({bool publish = false}) async {
    if (!_form.currentState!.validate()) return;
    final s = AppScope.read(context);
    setState(() => _busy = true);
    try {
      final data = _data();
      final saved = Rec.fromJson((_r == null ? await s.api.post('/records', data) : await s.api.patch('/records/${_r!.id}', data)) as Map<String, dynamic>);
      for (final f in List.of(_newFiles)) {
        setState(() => _progress = 0);
        await s.api.upload('/records/${saved.id}/media', {'role': 'original'}, [f], fileField: 'file', onProgress: (p) { if (mounted) setState(() => _progress = p); });
        _newFiles.remove(f);
      }
      if (publish) await s.api.post('/records/${saved.id}/publish');
      if (!mounted) return;
      toast(context, publish ? '${saved.identifier} published' : _r == null ? '${saved.identifier} saved as a draft' : 'Changes saved');
      if (_r == null) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => RecordFormScreen(id: saved.id)));
      } else {
        setState(() { _busy = false; _progress = null; });
        _load();
      }
    } catch (e) {
      if (mounted) { setState(() { _busy = false; _progress = null; }); toast(context, errText(e), Icons.error_outline_rounded); }
    }
  }

  Future<void> _status(String what) async {
    final s = AppScope.read(context);
    try {
      await s.api.post('/records/${_r!.id}/$what');
      if (!mounted) return;
      toast(context, what == 'publish' ? 'Published' : 'Unpublished');
      _load();
    } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  Future<void> _delete() async {
    if (!await confirm(context, title: 'Delete this item?', body: '"${_r!.title}" goes offline and moves to Deleted items, where it can be restored.', action: 'Delete', icon: Icons.delete_outline_rounded, danger: true)) return;
    if (!mounted) return;
    try {
      await AppScope.read(context).api.delete('/records/${_r!.id}');
      if (!mounted) return;
      toast(context, '${_r!.identifier} deleted', Icons.delete_outline_rounded);
      Navigator.of(context).pop();
    } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  Future<void> _uploadNow() async {
    final files = await pickFiles(context, multiple: false);
    if (files.isEmpty || !mounted) return;
    final s = AppScope.read(context);
    setState(() { _busy = true; _progress = 0; });
    try {
      await s.api.upload('/records/${_r!.id}/media', {'role': 'original'}, files, fileField: 'file', onProgress: (p) { if (mounted) setState(() => _progress = p); });
      if (!mounted) return;
      toast(context, '${files.first.name} added');
      setState(() { _busy = false; _progress = null; });
      _load();
    } catch (e) {
      if (mounted) { setState(() { _busy = false; _progress = null; }); toast(context, errText(e), Icons.error_outline_rounded); }
    }
  }

  Future<void> _deleteFile(MediaFile m) async {
    if (!await confirm(context, title: 'Delete this file?', body: 'The stored file "${m.name}" is removed permanently. The catalogue record stays.', action: 'Delete file', icon: Icons.delete_outline_rounded, danger: true)) return;
    if (!mounted) return;
    try {
      await AppScope.read(context).api.delete('/media/${m.id}');
      if (!mounted) return;
      toast(context, 'File deleted', Icons.delete_outline_rounded);
      _load();
    } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  Widget _field(String k, String label, {String? hint, int lines = 1, TextInputType? kb, String? helper, String? Function(String?)? validator}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(controller: c[k], minLines: lines, maxLines: lines == 1 ? 1 : lines + 6, keyboardType: kb, validator: validator,
            style: k == 'transcript' ? const TextStyle(fontFamily: 'monospace', fontSize: 13) : null,
            decoration: InputDecoration(labelText: label, hintText: hint, helperText: helper, helperMaxLines: 3, alignLabelWithHint: lines > 1)),
      );

  Widget _suggest(String k, List<String> options) => Wrap(spacing: 6, runSpacing: 6, children: [
        for (final o in options) ActionChip(label: Text(o, style: const TextStyle(fontSize: 12)), onPressed: () => setState(() => c[k]!.text = o)),
      ]);

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = _r;
    Widget body;
    if (_loading && r == null) {
      body = const Center(child: LoadingView());
    } else if (_error != null && r == null) {
      body = ErrorPanel(_error!, _load);
    } else {
      body = ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 60), children: [
        PageTitle(r == null ? 'Upload and catalogue' : 'Edit ${r.identifier}', sub: r == null ? 'Add a new item with its catalogue record.' : 'Every change is recorded in the audit log.'),
        if (r != null) ...[
          Center(child: StatusChip(r.status)),
          OrbRow([
            OrbItem(Icons.visibility_outlined, 'View', 'See the item as users see it.', () => push(context, RecordScreen(id: r.identifier))),
            r.status == 'published'
                ? OrbItem(Icons.visibility_off_outlined, 'Unpublish', 'Takes the item offline for users.', () => _status('unpublish'))
                : OrbItem(Icons.check_circle_outline_rounded, 'Publish', 'Makes the item visible to signed-in users.', () => _status('publish'), primary: true),
            OrbItem(Icons.delete_outline_rounded, 'Delete', 'Removes the item. It can be restored from Records.', _delete),
          ], size: 56),
          Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _title(Icons.folder_open_outlined, 'Files'),
            const SizedBox(height: 6),
            if (r.media.isEmpty) const Text('No files yet.', style: TextStyle(color: C.muted)),
            for (final m in r.media)
              ListTile(contentPadding: EdgeInsets.zero, leading: Icon(m.icon, color: C.sky), title: Text(m.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${m.mime}, ${fmtSize(m.size)}, ${m.role}', style: const TextStyle(color: C.muted, fontSize: 12)),
                  onTap: () => openExternal(context, s.api.abs(m.url)),
                  trailing: IconButton(tooltip: 'Delete file', icon: const Icon(Icons.delete_outline_rounded, color: C.danger), onPressed: _busy ? null : () => _deleteFile(m))),
            if (_busy && _progress != null) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: LinearProgressIndicator(value: _progress, minHeight: 6, borderRadius: BorderRadius.circular(3))),
            const SizedBox(height: 6),
            OutlinedButton.icon(onPressed: _busy ? null : _uploadNow, icon: const Icon(Icons.upload_file_rounded), label: const Text('Add a file')),
          ])),
          const SizedBox(height: 14),
        ],
        Glass(child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Type of material', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final t in types.values) ChoiceChip(avatar: Icon(t.icon, size: 16), label: Text(t.label), selected: _type == t.key, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => setState(() => _type = t.key)),
          ]),
          const SizedBox(height: 14),
          const Text('Format', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final f in formats.entries) ChoiceChip(avatar: Icon(f.value.$1, size: 16), label: Text(f.value.$2), selected: _format == f.key, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => setState(() => _format = f.key)),
          ]),
          const SizedBox(height: 16),
          _field('title', 'Title', validator: (v) => (v ?? '').trim().length < 3 ? 'Give the item a title' : null),
          _field('summary', 'Summary', lines: 3, helper: 'Two or three sentences shown in search results. Needed before publishing.'),
          _field('body', 'Full text', lines: 3, helper: 'For a testimony, the full account. For a document, its transcribed pages.'),
          const Text('Water body', style: TextStyle(color: C.sky, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ChoiceChip(label: const Text('Not set'), selected: _water == null, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => setState(() => _water = null)),
            for (final w in s.waterBodies) ChoiceChip(avatar: Icon(waterIcons[w.name] ?? Icons.waves_rounded, size: 16), label: Text(w.name), selected: _water == w.id, selectedColor: C.blue, showCheckmark: false, onSelected: (_) => setState(() => _water = w.id)),
          ]),
          const SizedBox(height: 14),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _field('year', 'Year', kb: TextInputType.number, validator: (v) { if ((v ?? '').trim().isEmpty) return null; final y = int.tryParse(v!.trim()); return y == null || y < 1800 || y > 2200 ? 'Check the year' : null; })),
            const SizedBox(width: 10),
            Expanded(child: CheckboxListTile(contentPadding: EdgeInsets.zero, value: _approx, onChanged: (v) => setState(() => _approx = v ?? false), title: const Text('Approximate', style: TextStyle(fontSize: 14)), controlAffinity: ListTileControlAffinity.leading)),
          ]),
          _field('place', 'Place'),
          _field('county', 'County'),
          Row(children: [
            Expanded(child: _field('lat', 'Latitude', kb: const TextInputType.numberWithOptions(decimal: true, signed: true))),
            const SizedBox(width: 10),
            Expanded(child: _field('lng', 'Longitude', kb: const TextInputType.numberWithOptions(decimal: true, signed: true))),
          ]),
          _field('creator', 'Creator or collector'),
          _field('narrator', 'Narrator', helper: 'Write "(anonymised)" if the person asked not to be named.'),
          _field('interviewer', 'Interviewer'),
          _field('photographer', 'Photographer'),
          _field('language', 'Language'),
          _field('rights', 'Rights'),
          _suggest('rights', _rights),
          const SizedBox(height: 12),
          _field('consent', 'Consent'),
          _suggest('consent', _consents),
          const SizedBox(height: 12),
          _field('duration', 'Duration (minutes:seconds)', hint: '12:30'),
          _field('subjects', 'Subjects', hint: 'ferry, life jackets', helper: 'Separate with commas. New subjects are added to the list.'),
          _field('transcript', 'Transcript', lines: 4, hint: '0:00  First words of the recording', helper: 'One line per passage: start time, two spaces, then the words.'),
          if (r == null) ...[
            for (final f in _newFiles)
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.attach_file_rounded, color: C.sky), title: Text(f.name), subtitle: Text(fmtSize(f.size)),
                  trailing: IconButton(icon: const Icon(Icons.close_rounded), tooltip: 'Remove', onPressed: () => setState(() => _newFiles.remove(f)))),
            OutlinedButton.icon(onPressed: _busy ? null : () async { final f = await pickFiles(context, multiple: false); if (mounted) setState(() => _newFiles.addAll(f)); },
                icon: const Icon(Icons.attach_file_rounded), label: const Text('Add a media file (optional)')),
            if (_busy && _progress != null) Padding(padding: const EdgeInsets.only(top: 10), child: LinearProgressIndicator(value: _progress, minHeight: 6, borderRadius: BorderRadius.circular(3))),
            const SizedBox(height: 12),
          ],
          FilledButton.icon(onPressed: _busy ? null : () => _save(), icon: const Icon(Icons.check_rounded), label: Text(_busy ? 'Saving' : r == null ? 'Save as draft' : 'Save changes')),
          if (r == null || r.status != 'published') ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(onPressed: _busy ? null : () => _save(publish: true), icon: const Icon(Icons.public_rounded), label: const Text('Save and publish')),
          ],
        ]))),
      ]);
    }
    return AppPage(showBack: true, background: const PageBg(Icons.edit_note_rounded), body: body);
  }
}

// ---------------------------------------------------------------------------
// Submissions review
// ---------------------------------------------------------------------------
class SubmissionsScreen extends StatefulWidget {
  const SubmissionsScreen({super.key});
  @override
  State<SubmissionsScreen> createState() => _SubmissionsScreenState();
}

class _SubmissionsScreenState extends State<SubmissionsScreen> {
  String _show = 'pending';
  Key _key = UniqueKey();
  void _refresh() { setState(() => _key = UniqueKey()); AppScope.read(context).refreshCounts(); }

  Future<void> _approve(Submission x) async {
    final note = await askText(context, title: 'Approve this submission?', icon: Icons.check_rounded, label: 'Message to the contributor (optional)', lines: 3, action: 'Approve');
    if (note == null || !mounted) return;
    final s = AppScope.read(context);
    try {
      final r = await s.api.post('/submissions/${x.id}/approve', {if (note.isNotEmpty) 'reviewNote': note}) as Map<String, dynamic>;
      if (!mounted) return;
      toast(context, 'Draft ${r['recordIdentifier']} created. Complete it, then publish.');
      await push(context, RecordFormScreen(id: r['recordId'] as String));
      _refresh();
    } catch (e) { if (mounted) { toast(context, errText(e), Icons.error_outline_rounded); _refresh(); } }
  }

  Future<void> _reject(Submission x) async {
    final note = await askText(context, title: 'Decline this submission?', icon: Icons.block_rounded, label: 'Message to the contributor', lines: 3, action: 'Decline',
        initial: "Thank you for your submission. We can't include it because ", check: (v) => v.length < 5 ? 'Tell the contributor why' : null);
    if (note == null || !mounted) return;
    try {
      await AppScope.read(context).api.post('/submissions/${x.id}/reject', {'reviewNote': note});
      if (!mounted) return;
      toast(context, 'Declined. The contributor has been told.', Icons.block_rounded);
      _refresh();
    } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.inbox_outlined),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 6), child: Column(children: [
          const PageTitle('Submissions', sub: 'Approving creates a draft item for you to catalogue before publishing.'),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'pending', label: Text('Waiting')), ButtonSegment(value: 'approved', label: Text('Approved')), ButtonSegment(value: 'rejected', label: Text('Declined'))],
            selected: {_show}, showSelectedIcon: false,
            onSelectionChanged: (v) { _show = v.first; _refresh(); },
          ),
        ])),
        Expanded(child: _PagedList<Submission>(
          key: _key,
          load: (page) async => PageOf.fromJson(await s.api.get('/submissions', {'status': _show, 'page': page, 'pageSize': 10}), Submission.fromJson),
          empty: _show == 'pending' ? 'Every submission has been reviewed.' : 'No submissions in this list yet.',
          item: (x) => Padding(padding: const EdgeInsets.fromLTRB(8, 0, 8, 12), child: Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [TypeTag(x.type), const SizedBox(width: 8), StatusChip(x.status), const Spacer(), Text(x.reference, style: const TextStyle(color: C.muted, fontSize: 12))]),
            const SizedBox(height: 10),
            Text(x.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 6),
            Wrap(spacing: 12, runSpacing: 4, children: [
              Fact(Icons.person_outline_rounded, '${x.byName ?? ''} ${x.byEmail != null ? '(${x.byEmail})' : ''}'),
              Fact(Icons.event_outlined, fmtDate(x.createdAt)),
              if (x.place.isNotEmpty) Fact(Icons.place_outlined, x.place),
              if (x.year != null) Fact(Icons.calendar_today_outlined, '${x.year}'),
              if (x.waterName.isNotEmpty) Fact(waterIcons[x.waterName] ?? Icons.waves_rounded, x.waterName),
            ]),
            const SizedBox(height: 8),
            Text(x.description),
            const SizedBox(height: 8),
            const Fact(Icons.verified_outlined, 'Consent confirmed by contributor'),
            for (final f in x.files)
              ListTile(contentPadding: EdgeInsets.zero, dense: true, leading: Icon(f.icon, color: C.sky), title: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${f.mime}, ${fmtSize(f.size)}', style: const TextStyle(color: C.muted)), trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                  onTap: () => openExternal(context, s.api.abs(f.url))),
            if (x.reviewNote.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Note: ${x.reviewNote}', style: const TextStyle(color: C.muted))),
            const SizedBox(height: 10),
            if (x.status == 'pending')
              Row(children: [
                Expanded(child: FilledButton.icon(onPressed: () => _approve(x), icon: const Icon(Icons.check_rounded), label: const Text('Approve'))),
                const SizedBox(width: 10),
                Expanded(child: OutlinedButton.icon(onPressed: () => _reject(x), icon: const Icon(Icons.block_rounded), label: const Text('Decline'))),
              ])
            else if (x.recordId != null)
              OutlinedButton.icon(onPressed: () => push(context, RecordFormScreen(id: x.recordId)), icon: const Icon(Icons.edit_outlined), label: const Text('Open the catalogue record')),
          ]))),
        )),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});
  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final _q = TextEditingController();
  Key _key = UniqueKey();
  void _refresh() => setState(() => _key = UniqueKey());

  void _showPassword(String email, String pw) => showDialog(context: context, builder: (ctx) => AlertDialog(
        icon: const CircleIcon(Icons.key_outlined, size: 52),
        title: const Text('One-time password'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Give this to $email privately. It is shown only once.'),
          const SizedBox(height: 12),
          SelectableText(pw, style: const TextStyle(fontFamily: 'monospace', fontSize: 20, color: Colors.white)),
        ]),
        actions: [
          TextButton(onPressed: () { Clipboard.setData(ClipboardData(text: pw)); toast(ctx, 'Copied', Icons.copy_rounded); }, child: const Text('Copy')),
          FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
        ],
      ));

  Future<void> _patch(AppUser u, Map<String, Object> change, String done) async {
    try {
      await AppScope.read(context).api.patch('/users/${u.id}', change);
      if (!mounted) return;
      toast(context, done);
      _refresh();
    } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  void _actions(AppUser u) {
    final self = u.id == AppScope.read(context).me?.id;
    showModalBottomSheet(context: context, builder: (ctx) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(u.name, style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: Colors.white)),
            Text('${u.email}, ${u.role}, ${u.status}', style: const TextStyle(color: C.muted)),
            const SizedBox(height: 10),
            if (!self) ListTile(leading: const Icon(Icons.manage_accounts_outlined), title: Text(u.isAdmin ? 'Make a normal user' : 'Make an admin'),
                onTap: () { Navigator.pop(ctx); _patch(u, {'role': u.isAdmin ? 'user' : 'admin'}, 'Role changed. Their sessions were ended so it takes effect now.'); }),
            if (!self) ListTile(leading: Icon(u.status == 'active' ? Icons.block_rounded : Icons.check_circle_outline_rounded), title: Text(u.status == 'active' ? 'Suspend' : 'Reactivate'),
                onTap: () { Navigator.pop(ctx); _patch(u, {'status': u.status == 'active' ? 'suspended' : 'active'}, u.status == 'active' ? 'Account suspended and signed out' : 'Account reactivated'); }),
            ListTile(leading: const Icon(Icons.key_outlined), title: const Text('Reset password'), onTap: () async {
              Navigator.pop(ctx);
              if (!await confirm(context, title: 'Reset password?', body: '${u.name} gets a one-time password and is signed out everywhere.', action: 'Reset password', icon: Icons.key_outlined)) return;
              if (!mounted) return;
              try {
                final r = await AppScope.read(context).api.post('/users/${u.id}/reset-password') as Map<String, dynamic>;
                if (mounted) _showPassword(u.email, '${r['temporaryPassword']}');
              } catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
            }),
          ]),
        ));
  }

  void _create() {
    final name = TextEditingController(), email = TextEditingController(), org = TextEditingController();
    var role = 'user';
    String? err;
    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
          icon: const CircleIcon(Icons.person_add_alt_rounded, size: 52),
          title: const Text('Create user'),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 10),
            TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 10),
            TextField(controller: org, decoration: const InputDecoration(labelText: 'Organisation (optional)')),
            const SizedBox(height: 12),
            SegmentedButton<String>(segments: const [ButtonSegment(value: 'user', label: Text('User')), ButtonSegment(value: 'admin', label: Text('Admin'))],
                selected: {role}, showSelectedIcon: false, onSelectionChanged: (v) => set(() => role = v.first)),
            if (err != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(err!, style: const TextStyle(color: C.danger))),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () async {
              try {
                final r = await AppScope.read(context).api.post('/users', {'name': name.text.trim(), 'email': email.text.trim(), 'role': role, if (org.text.trim().isNotEmpty) 'organisation': org.text.trim()}) as Map<String, dynamic>;
                if (ctx.mounted) Navigator.pop(ctx);
                _refresh();
                _showPassword(email.text.trim(), '${r['temporaryPassword']}');
              } catch (e) { set(() => err = errText(e)); }
            }, child: const Text('Create user')),
          ],
        )));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.group_outlined),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 6), child: Column(children: [
          const PageTitle('Users and roles'),
          OrbRow([_dash(context), OrbItem(Icons.person_add_alt_rounded, 'Create user', 'Add a user or admin with a one-time password.', _create, primary: true)], size: 56),
          TextField(controller: _q, textInputAction: TextInputAction.search, onSubmitted: (_) => _refresh(),
              decoration: InputDecoration(hintText: 'Name, email or organisation', prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward_rounded), tooltip: 'Find', onPressed: _refresh))),
        ])),
        Expanded(child: _PagedList<AppUser>(
          key: _key,
          load: (page) async => PageOf.fromJson(await s.api.get('/users', {'q': _q.text.trim(), 'page': page, 'pageSize': 25}), AppUser.fromJson),
          empty: 'No accounts match.',
          item: (u) => ListTile(
            leading: CircleAvatar(backgroundColor: C.blue, child: Text(u.initials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
            title: Text(u.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            subtitle: Text('${u.email}\n${u.isAdmin ? 'Admin' : 'User'}, last sign-in ${u.lastLoginAt == null ? 'never' : fmtDate(u.lastLoginAt)}', style: const TextStyle(color: C.muted)),
            isThreeLine: true,
            trailing: StatusChip(u.status),
            onTap: () => _actions(u),
          ),
        )),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  bool _unreadOnly = false;
  Key _key = UniqueKey();
  void _refresh() { setState(() => _key = UniqueKey()); AppScope.read(context).refreshCounts(); }

  Future<void> _mark(Message m, bool read) async {
    try { await AppScope.read(context).api.patch('/messages/${m.id}', {'read': read}); _refresh(); }
    catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  Future<void> _delete(Message m) async {
    if (!await confirm(context, title: 'Delete this message?', body: 'It is removed permanently.', action: 'Delete', icon: Icons.delete_outline_rounded, danger: true)) return;
    if (!mounted) return;
    try { await AppScope.read(context).api.delete('/messages/${m.id}'); _refresh(); }
    catch (e) { if (mounted) toast(context, errText(e), Icons.error_outline_rounded); }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.mail_outline_rounded),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 6), child: Column(children: [
          const PageTitle('Messages', sub: 'From the contact form.'),
          const SizedBox(height: 10),
          SegmentedButton<bool>(segments: const [ButtonSegment(value: false, label: Text('All')), ButtonSegment(value: true, label: Text('Unread'))],
              selected: {_unreadOnly}, showSelectedIcon: false, onSelectionChanged: (v) { _unreadOnly = v.first; _refresh(); }),
        ])),
        Expanded(child: _PagedList<Message>(
          key: _key,
          load: (page) async => PageOf.fromJson(await s.api.get('/messages', {'filter': _unreadOnly ? 'unread' : '', 'page': page, 'pageSize': 20}), Message.fromJson),
          empty: 'No messages.',
          item: (m) => Padding(padding: const EdgeInsets.fromLTRB(8, 0, 8, 12), child: Glass(border: m.read ? null : C.blue2, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Icon(m.read ? Icons.mail_outline_rounded : Icons.notifications_active_outlined, color: C.sky), const SizedBox(width: 8),
              Expanded(child: Text(m.subject, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)))]),
            const SizedBox(height: 4),
            Text('${m.name}, ${m.email}\n${fmtDateTime(m.createdAt)}', style: const TextStyle(color: C.muted, fontSize: 12.5)),
            const SizedBox(height: 8),
            Text(m.body),
            const SizedBox(height: 8),
            Wrap(spacing: 4, children: [
              TextButton.icon(onPressed: () => _mark(m, !m.read), icon: Icon(m.read ? Icons.mark_email_unread_outlined : Icons.done_rounded), label: Text(m.read ? 'Mark unread' : 'Mark read')),
              TextButton.icon(onPressed: () => launchUrl(Uri(scheme: 'mailto', path: m.email, queryParameters: {'subject': 'Re: ${m.subject}'})), icon: const Icon(Icons.reply_rounded), label: const Text('Reply')),
              TextButton.icon(onPressed: () => _delete(m), icon: const Icon(Icons.delete_outline_rounded), label: const Text('Delete')),
            ]),
          ]))),
        )),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Reports and the audit log
// ---------------------------------------------------------------------------
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _action = '';
  Key _key = UniqueKey();

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    const filters = [['', 'Everything'], ['login', 'Sign-ins'], ['record', 'Records'], ['submission', 'Submissions'], ['user', 'Users'], ['media', 'Files'], ['password', 'Passwords']];
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.monitor_heart_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
        const PageTitle('Reports and activity', sub: 'How the archive is used, and everything that happens in it. CSV exports are on the website.'),
        const SizedBox(height: 10),
        Loaded<Map<String, dynamic>>(
          load: () async => await s.api.get('/reports/summary') as Map<String, dynamic>,
          builder: (context, d, _) {
            final t = d['totals'] as Map<String, dynamic>;
            final water = (d['byWaterBody'] as List).whereType<Map<String, dynamic>>().toList();
            final maxW = water.map((w) => (w['count'] as num).toInt()).fold(1, math.max);
            final top = (d['topRecords'] as List).whereType<Map<String, dynamic>>().toList();
            final subs = (d['submissionsByMonth'] as List).map((e) => MapEntry('${e['month']}', (e['count'] as num).toInt())).toList();
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Glass(child: Wrap(spacing: 20, runSpacing: 10, alignment: WrapAlignment.spaceAround, children: [
                for (final k in [('Item views', t['totalViews']), ('Active users this month', t['activeUsers30d']), ('Media stored', fmtSize((t['storageBytes'] as num).toInt()))])
                  Column(children: [Text('${k.$2}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)), Text(k.$1, style: const TextStyle(color: C.muted, fontSize: 12))]),
              ])),
              const SizedBox(height: 14),
              Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _title(Icons.waves_rounded, 'Published items by water body'),
                const SizedBox(height: 10),
                for (final w in water)
                  Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                    Icon(waterIcons[w['water_body']] ?? Icons.waves_rounded, size: 18, color: C.sky), const SizedBox(width: 8),
                    SizedBox(width: 120, child: Text('${w['water_body']}', style: const TextStyle(fontSize: 13))),
                    Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: (w['count'] as num) / maxW, minHeight: 8, backgroundColor: C.line))),
                    const SizedBox(width: 8),
                    Text('${w['count']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ])),
              ])),
              const SizedBox(height: 14),
              Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _title(Icons.trending_up_rounded, 'Most viewed'),
                for (final r in top)
                  ListTile(contentPadding: EdgeInsets.zero, leading: CircleIcon(types[r['type']]?.icon ?? Icons.description_outlined, size: 34, solid: false),
                      title: Text('${r['title']}'), subtitle: Text('${r['identifier']}, ${r['views']} views', style: const TextStyle(color: C.muted)),
                      onTap: () => push(context, RecordScreen(id: '${r['identifier']}'))),
              ])),
              const SizedBox(height: 14),
              Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_title(Icons.volunteer_activism_outlined, 'Submissions per month'), const SizedBox(height: 12), _bars(subs)])),
            ]);
          },
        ),
        const SizedBox(height: 14),
        Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _title(Icons.history_rounded, 'Audit log'),
          const SizedBox(height: 10),
          SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
            for (final f in filters) Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(label: Text(f[1]), selected: _action == f[0], selectedColor: C.blue, showCheckmark: false,
                onSelected: (_) => setState(() { _action = f[0]; _key = UniqueKey(); }))),
          ])),
          const SizedBox(height: 8),
          _AuditLog(key: _key, action: _action),
        ])),
      ]),
    );
  }
}

class _AuditLog extends StatefulWidget {
  final String action;
  const _AuditLog({super.key, required this.action});
  @override
  State<_AuditLog> createState() => _AuditLogState();
}

class _AuditLogState extends State<_AuditLog> {
  final _items = <Activity>[];
  int _page = 0, _pages = 1;
  bool _loading = false;
  Object? _error;

  @override
  void initState() { super.initState(); _more(); }

  Future<void> _more() async {
    if (_loading || _page >= _pages) return;
    setState(() { _loading = true; _error = null; });
    try {
      final p = PageOf.fromJson(await AppScope.read(context).api.get('/reports/activity', {'action': widget.action, 'page': _page + 1, 'pageSize': 25}), Activity.fromJson);
      if (mounted) setState(() { _items.addAll(p.items); _page = p.page; _pages = p.pages; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final a in _items) _ActivityTile(a),
        if (_loading) const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
        if (_error != null) Text(errText(_error!), style: const TextStyle(color: C.danger)),
        if (!_loading && _items.isEmpty && _error == null) const Text('Nothing recorded yet.', style: TextStyle(color: C.muted)),
        if (!_loading && _page < _pages) TextButton.icon(onPressed: _more, icon: const Icon(Icons.expand_more_rounded), label: const Text('Show more')),
      ]);
}
