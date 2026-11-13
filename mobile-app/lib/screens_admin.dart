import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'main.dart';
import 'screens_main.dart';
import 'state.dart';
import 'ui.dart';

OrbItem _dash(BuildContext context) =>
    OrbItem(Icons.insert_chart_outlined_rounded, 'Dashboard', 'Back to the admin dashboard.', () => Nav.goTab(context, 4));

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final pub = s.published;
    final maxV = s.visits.map((e) => e.value).fold(1, math.max);
    Widget kpi(IconData i, int n, String l) => Glass(padding: const EdgeInsets.all(14), child: Row(children: [
          CircleIcon(i, size: 42), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$n', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
            Text(l, style: const TextStyle(color: C.muted, fontSize: 12.5)),
          ])),
        ]));
    return AppPage(
      background: const PageBg(Icons.insert_chart_outlined_rounded),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Archive dashboard', sub: "What's happening in the archive today."),
        const SizedBox(height: 14),
        GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.9, children: [
          kpi(Icons.inventory_2_outlined, pub.length, 'Published items'),
          kpi(Icons.edit_outlined, s.records.length - pub.length, 'Drafts and unpublished'),
          kpi(Icons.inbox_outlined, s.pending.length, 'Waiting for review'),
          kpi(Icons.group_outlined, s.users.length, 'Registered users'),
        ]),
        OrbRow([
          OrbItem(Icons.inventory_2_outlined, 'Records', 'Edit, publish or unpublish items.', () => push(context, const RecordsAdminScreen())),
          OrbItem(Icons.upload_rounded, 'Upload', 'Add a new item and catalogue it.', () => push(context, const RecordFormScreen()), primary: true),
          OrbItem(Icons.inbox_outlined, 'Review', 'Approve or reject material sent in by the public.', () => push(context, const SubmissionsScreen()), badge: s.pending.length),
          OrbItem(Icons.group_outlined, 'Users', 'Create users, change roles, suspend accounts.', () => push(context, const UsersScreen())),
          OrbItem(Icons.mail_outline_rounded, 'Messages', 'Messages from the contact form.', () => push(context, const MessagesScreen()), badge: s.unread.length),
          OrbItem(Icons.monitor_heart_outlined, 'Reports', 'Usage, collection health and the activity log.', () => push(context, const ReportsScreen())),
        ], size: 64),
        Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [Icon(Icons.trending_up_rounded, color: C.sky), SizedBox(width: 8), Text('Visits per month', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white))]),
          const SizedBox(height: 14),
          SizedBox(height: 160, child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            for (final v in s.visits)
              Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text('${v.value}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                const SizedBox(height: 4),
                Container(height: 110 * v.value / maxV, margin: const EdgeInsets.symmetric(horizontal: 6),
                    decoration: BoxDecoration(borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [C.blue2, C.blue]))),
                const SizedBox(height: 4),
                Text(v.key, style: const TextStyle(fontSize: 11, color: C.muted)),
              ])),
          ])),
        ])),
        const SizedBox(height: 14),
        Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [Icon(Icons.history_rounded, color: C.sky), SizedBox(width: 8), Text('Recent activity', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white))]),
          const SizedBox(height: 6),
          for (final a in s.activity.take(5)) _ActivityTile(a),
        ])),
      ]),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  final Activity a;
  const _ActivityTile(this.a);
  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const CircleIcon(Icons.monitor_heart_outlined, size: 36, solid: false),
        title: Text('${a.who} ${a.what}', style: const TextStyle(fontSize: 14)),
        subtitle: Text(a.t, style: const TextStyle(color: C.muted, fontSize: 12)),
      );
}

String _csv(AppState s) => [
      ['id', 'title', 'type', 'water_body', 'county', 'year', 'status', 'views'],
      ...s.records.map((r) => [r.id, r.title, r.type, r.water, r.county, '${r.year}', r.status, '${r.views}']),
    ].map((row) => row.map((c) => '"${c.replaceAll('"', '""')}"').join(',')).join('\n');

void _export(BuildContext context) {
  final s = AppScope.read(context);
  Clipboard.setData(ClipboardData(text: _csv(s)));
  s.log('exported the records list');
  toast(context, 'Records list copied as CSV. The full build saves a file.', Icons.download_rounded);
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
class RecordsAdminScreen extends StatefulWidget {
  const RecordsAdminScreen({super.key});
  @override
  State<RecordsAdminScreen> createState() => _RecordsAdminScreenState();
}

class _RecordsAdminScreenState extends State<RecordsAdminScreen> {
  String _f = '', _status = '';

  void _filter() {
    final c = TextEditingController(text: _f);
    var st = _status;
    sheet(context, title: 'Filter records', icon: Icons.tune_rounded, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(controller: c, decoration: const InputDecoration(labelText: 'Title, ID or place', prefixIcon: Icon(Icons.search_rounded))),
          const SizedBox(height: 14),
          Wrap(spacing: 8, children: [
            for (final o in const ['', 'published', 'draft', 'unpublished'])
              ChoiceChip(label: Text(o.isEmpty ? 'All' : o[0].toUpperCase() + o.substring(1)), selected: st == o, showCheckmark: false, selectedColor: C.blue, onSelected: (_) => set(() => st = o)),
          ]),
          const SizedBox(height: 18),
          FilledButton.icon(onPressed: () { setState(() { _f = c.text.trim(); _status = st; }); Navigator.pop(ctx); }, icon: const Icon(Icons.check_rounded), label: const Text('Apply')),
        ])));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final list = s.records.where((r) => (_status.isEmpty || r.status == _status) && (_f.isEmpty || '${r.title} ${r.id} ${r.place}'.toLowerCase().contains(_f.toLowerCase()))).toList();
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.inventory_2_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        PageTitle('Records', sub: '${list.length} of ${s.records.length} items${_status.isNotEmpty ? ', $_status' : ''}${_f.isNotEmpty ? ', matching "$_f"' : ''}'),
        OrbRow([
          _dash(context),
          OrbItem(Icons.add_rounded, 'New item', 'Add and catalogue a new item.', () => push(context, const RecordFormScreen()), primary: true),
          OrbItem(Icons.tune_rounded, 'Filter', 'Find items by title, ID, place or status.', _filter),
          OrbItem(Icons.download_rounded, 'Export', 'Copies the records list as CSV.', () => _export(context)),
        ], size: 60),
        for (final r in list)
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Glass(padding: const EdgeInsets.fromLTRB(14, 12, 6, 12), child: Row(children: [
            CircleIcon(types[r.type]!.icon, size: 40, solid: false),
            const SizedBox(width: 12),
            Expanded(child: InkWell(onTap: () => push(context, RecordScreen(id: r.id)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Row(children: [StatusChip(r.status), const SizedBox(width: 8), Flexible(child: Fact(Icons.visibility_outlined, '${r.views}  ${r.id}'))]),
            ]))),
            PopupMenuButton<String>(
              tooltip: 'Actions',
              icon: const Icon(Icons.more_vert_rounded),
              onSelected: (v) {
                if (v == 'edit') { push(context, RecordFormScreen(rec: r)); return; }
                r.status = v == 'pub' ? 'published' : 'unpublished';
                s.log("${v == 'pub' ? 'published' : 'unpublished'} ${r.id} '${r.title}'");
                toast(context, v == 'pub' ? 'Published' : 'Unpublished. The public can no longer see it.', v == 'pub' ? Icons.check_rounded : Icons.visibility_off_outlined);
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: ListTile(leading: Icon(Icons.edit_outlined), title: Text('Edit'))),
                r.status == 'published'
                    ? const PopupMenuItem(value: 'unpub', child: ListTile(leading: Icon(Icons.visibility_off_outlined), title: Text('Unpublish')))
                    : const PopupMenuItem(value: 'pub', child: ListTile(leading: Icon(Icons.check_rounded), title: Text('Publish'))),
              ],
            ),
          ]))),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Upload / edit and catalogue
// ---------------------------------------------------------------------------
class RecordFormScreen extends StatefulWidget {
  final Rec? rec;
  final Submission? fromSub;
  const RecordFormScreen({super.key, this.rec, this.fromSub});
  @override
  State<RecordFormScreen> createState() => _RecordFormScreenState();
}

class _RecordFormScreenState extends State<RecordFormScreen> {
  final _form = GlobalKey<FormState>();
  late String _type, _water, _rights, _consent;
  late final TextEditingController _title, _summary, _year, _place, _county, _lat, _lng, _creator, _who, _lang, _tags;
  String? _file;

  static const _rightsList = ['CC BY-NC 4.0', 'Used with permission', 'Public record', '© Lender, used with permission'];
  static const _consentList = ['Signed consent form on file', 'Verbal consent recorded', 'Online consent given at submission', 'Permission letter on file', 'Not applicable (public record)'];

  @override
  void initState() {
    super.initState();
    final s = AppScope.read(context);
    final r = widget.rec, sub = widget.fromSub;
    _type = r?.type ?? sub?.type ?? 'oral';
    _water = r?.water ?? (sub != null && sub.water.isNotEmpty ? sub.water : s.waterBodies.first);
    _rights = _rightsList.contains(r?.rights) ? r!.rights : _rightsList.first;
    _consent = _consentList.contains(r?.consent) ? r!.consent : (sub != null ? _consentList[2] : _consentList.first);
    _title = TextEditingController(text: r?.title ?? sub?.title ?? '');
    _summary = TextEditingController(text: r?.summary ?? sub?.description ?? '');
    _year = TextEditingController(text: '${r?.year ?? sub?.year ?? ''}');
    _place = TextEditingController(text: r?.place ?? sub?.place ?? '');
    _county = TextEditingController(text: r?.county ?? '');
    _lat = TextEditingController(text: '${r?.lat ?? -1.29}');
    _lng = TextEditingController(text: '${r?.lng ?? 36.82}');
    _creator = TextEditingController(text: r?.creator ?? 'Remembering the Waters field team');
    _who = TextEditingController(text: r?.narrator ?? r?.photographer ?? '');
    _lang = TextEditingController(text: r?.language ?? 'English');
    _tags = TextEditingController(text: r?.tags.join(', ') ?? '');
    _file = sub?.file;
  }

  void _save(String status) {
    if (!_form.currentState!.validate()) return;
    final s = AppScope.read(context);
    final r = widget.rec;
    final tags = _tags.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
    if (r != null) {
      r..type = _type..title = _title.text.trim()..summary = _summary.text.trim()..year = int.tryParse(_year.text) ?? r.year..water = _water
        ..place = _place.text.trim()..county = _county.text.trim()..lat = double.tryParse(_lat.text) ?? r.lat..lng = double.tryParse(_lng.text) ?? r.lng
        ..creator = _creator.text.trim()..language = _lang.text.trim()..rights = _rights..consent = _consent..tags = tags..status = status;
      if (_type == 'photo') { r.photographer = _who.text.trim(); } else { r.narrator = _who.text.trim(); }
      s.log("edited ${r.id} '${r.title}'${status == 'published' ? ' and published it' : ''}");
      toast(context, 'Changes saved');
      Navigator.of(context).pop();
      return;
    }
    const fmt = {'oral': 'audio', 'photo': 'image', 'record': 'document', 'testimony': 'text'};
    final nr = Rec(
      id: s.nextRecordId(), type: _type, format: fmt[_type]!, title: _title.text.trim(), summary: _summary.text.trim(), water: _water,
      county: _county.text.trim(), place: _place.text.trim(), creator: _creator.text.trim(), language: _lang.text.trim(), rights: _rights,
      consent: _consent, status: status, added: AppState.today(), year: int.tryParse(_year.text) ?? DateTime.now().year, views: 0,
      lat: double.tryParse(_lat.text) ?? -1.29, lng: double.tryParse(_lng.text) ?? 36.82, tags: tags, file: _file,
      narrator: _type == 'photo' ? null : _who.text.trim(), photographer: _type == 'photo' ? _who.text.trim() : null,
    );
    if (nr.format == 'audio') { nr.duration = 120; nr.transcript = [const MapEntry(0, 'Transcript to be added by the cataloguer.')]; }
    if (nr.format == 'document') nr.pages = [nr.title.toUpperCase(), nr.summary];
    if (nr.format == 'text') nr.body = nr.summary;
    s.records.insert(0, nr);
    final sub = widget.fromSub;
    if (sub != null) { sub.status = 'approved'; sub.recordId = nr.id; s.log("approved submission '${sub.title}' as ${nr.id}"); }
    s.log("uploaded ${nr.id} '${nr.title}' as $status");
    toast(context, status == 'published' ? '${nr.id} published to the archive' : '${nr.id} saved as a draft');
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = widget.rec, sub = widget.fromSub;
    String? req(String? v) => (v ?? '').trim().isEmpty ? 'Required' : null;
    Widget gap() => const SizedBox(height: 12);
    Widget label(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(color: C.sky, fontWeight: FontWeight.w600)));
    return AppPage(
      showBack: true,
      background: PageBg(r == null ? Icons.upload_rounded : Icons.edit_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        PageTitle(r == null ? 'Upload and catalogue' : 'Edit ${r.id}',
            sub: sub != null ? 'Cataloguing submission ${sub.id} from ${s.userById(sub.by).name}.' : r == null ? 'Add a new item with its metadata.' : 'Every change is recorded in the activity log.'),
        OrbRow([
          _dash(context),
          OrbItem(Icons.inventory_2_outlined, 'Records', 'Back to the list of records.', () { Navigator.of(context).pop(); push(context, const RecordsAdminScreen()); }),
          if (r != null) OrbItem(Icons.visibility_outlined, 'View item', 'See the item as the public sees it.', () => push(context, RecordScreen(id: r.id))),
        ], size: 60),
        Glass(child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          label('Type of material'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final t in types.values)
              ChoiceChip(avatar: Icon(t.icon, size: 16), label: Text(t.label), selected: _type == t.key, showCheckmark: false, selectedColor: C.blue, onSelected: (_) => setState(() => _type = t.key)),
          ]),
          const SizedBox(height: 16),
          TextFormField(controller: _title, decoration: const InputDecoration(labelText: 'Title'), validator: req),
          gap(),
          TextFormField(enabled: false, initialValue: r?.id ?? s.nextRecordId(), decoration: const InputDecoration(labelText: 'Identifier', helperText: 'Assigned automatically')),
          gap(),
          TextFormField(controller: _summary, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Summary', alignLabelWithHint: true), validator: req),
          const SizedBox(height: 16),
          label('Water body'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final w in s.waterBodies)
              ChoiceChip(avatar: Icon(waterIcons[w], size: 16), label: Text(w), selected: _water == w, showCheckmark: false, selectedColor: C.blue, onSelected: (_) => setState(() => _water = w)),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: TextFormField(controller: _year, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Year'), validator: req)),
            const SizedBox(width: 10),
            Expanded(flex: 2, child: TextFormField(controller: _place, decoration: const InputDecoration(labelText: 'Place'))),
          ]),
          gap(),
          TextFormField(controller: _county, decoration: const InputDecoration(labelText: 'County')),
          gap(),
          Row(children: [
            Expanded(child: TextFormField(controller: _lat, keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true), decoration: const InputDecoration(labelText: 'Latitude'))),
            const SizedBox(width: 10),
            Expanded(child: TextFormField(controller: _lng, keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true), decoration: const InputDecoration(labelText: 'Longitude'))),
          ]),
          gap(),
          TextFormField(controller: _creator, decoration: const InputDecoration(labelText: 'Creator or collector')),
          gap(),
          TextFormField(controller: _who, decoration: const InputDecoration(labelText: 'Narrator or photographer', helperText: 'Write "anonymised" if the person asked not to be named')),
          gap(),
          TextFormField(controller: _lang, decoration: const InputDecoration(labelText: 'Language')),
          gap(),
          DropdownButtonFormField<String>(initialValue: _rights, decoration: const InputDecoration(labelText: 'Rights'), isExpanded: true,
              items: [for (final x in _rightsList) DropdownMenuItem(value: x, child: Text(x))], onChanged: (v) => setState(() => _rights = v!)),
          gap(),
          DropdownButtonFormField<String>(initialValue: _consent, decoration: const InputDecoration(labelText: 'Consent'), isExpanded: true,
              items: [for (final x in _consentList) DropdownMenuItem(value: x, child: Text(x))], onChanged: (v) => setState(() => _consent = v!)),
          gap(),
          TextFormField(controller: _tags, decoration: const InputDecoration(labelText: 'Subjects', hintText: 'ferry, life jackets', helperText: 'Separate with commas. Chosen from a controlled vocabulary in the full build.')),
          if (r == null) ...[
            gap(),
            OutlinedButton.icon(
              onPressed: () => setState(() => _file = _file ?? 'field_recording.m4a'),
              icon: Icon(_file == null ? Icons.upload_file_rounded : Icons.check_circle_outline_rounded),
              label: Text(_file == null ? 'Attach media (sample file in the prototype)' : (sub != null ? 'From submission: $_file' : _file!)),
            ),
          ],
          const SizedBox(height: 18),
          FilledButton.icon(onPressed: () => _save('published'), icon: const Icon(Icons.check_rounded), label: const Text('Save and publish')),
          const SizedBox(height: 10),
          OutlinedButton.icon(onPressed: () => _save('draft'), icon: const Icon(Icons.edit_outlined), label: const Text('Save as draft')),
        ]))),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------
class SubmissionsScreen extends StatefulWidget {
  const SubmissionsScreen({super.key});
  @override
  State<SubmissionsScreen> createState() => _SubmissionsScreenState();
}

class _SubmissionsScreenState extends State<SubmissionsScreen> {
  String _show = 'pending';

  void _reject(Submission x) {
    final msg = TextEditingController(text: "Thank you for your submission. We can't include it because…");
    showDialog(context: context, builder: (ctx) => AlertDialog(
      icon: const CircleIcon(Icons.block_rounded, size: 52),
      title: const Text('Reject this submission?'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('"${x.title}"', style: const TextStyle(color: C.muted)),
        const SizedBox(height: 12),
        TextField(controller: msg, minLines: 3, maxLines: 5, decoration: const InputDecoration(labelText: 'Message to the contributor')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(style: FilledButton.styleFrom(backgroundColor: C.danger), onPressed: () {
          final s = AppScope.read(context);
          x.status = 'rejected';
          s.log("rejected submission '${x.title}'");
          Navigator.pop(ctx);
          toast(context, 'Submission rejected. The contributor has been told.', Icons.block_rounded);
        }, child: const Text('Reject submission')),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final list = s.submissions.where((x) => x.status == _show).toList();
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.inbox_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Submissions', sub: 'Material sent in by the public. Approving opens the cataloguing form so the metadata is complete before publishing.'),
        OrbRow([
          _dash(context),
          OrbItem(Icons.inbox_outlined, 'Waiting', 'Submissions still to review.', () => setState(() => _show = 'pending'), on: _show == 'pending', badge: s.pending.length),
          OrbItem(Icons.check_circle_outline_rounded, 'Approved', 'Submissions already added to the archive.', () => setState(() => _show = 'approved'), on: _show == 'approved'),
          OrbItem(Icons.block_rounded, 'Rejected', 'Submissions that were turned down.', () => setState(() => _show = 'rejected'), on: _show == 'rejected'),
        ], size: 60),
        if (list.isEmpty)
          Glass(child: Column(children: [
            const Icon(Icons.check_circle_outline_rounded, size: 42, color: C.sky), const SizedBox(height: 8),
            const Text('Nothing here', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
            Text(_show == 'pending' ? 'Every submission has been reviewed.' : 'No submissions in this list yet.', style: const TextStyle(color: C.muted)),
          ])),
        for (final x in list)
          Padding(padding: const EdgeInsets.only(bottom: 12), child: Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [TypeTag(x.type), const SizedBox(width: 8), StatusChip(x.status), const Spacer(), Text(x.date, style: const TextStyle(color: C.muted, fontSize: 12))]),
            const SizedBox(height: 10),
            Text(x.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 6),
            Wrap(spacing: 12, runSpacing: 4, children: [
              Fact(Icons.person_outline_rounded, s.userById(x.by).name),
              if (x.place.isNotEmpty) Fact(Icons.place_outlined, x.place),
              if (x.year != null) Fact(Icons.calendar_today_outlined, '${x.year}'),
              Fact(waterIcons[x.water] ?? Icons.waves_rounded, x.water),
            ]),
            const SizedBox(height: 8),
            Text(x.description, style: const TextStyle(height: 1.4)),
            const SizedBox(height: 8),
            Wrap(spacing: 12, runSpacing: 4, children: [
              Fact(Icons.attach_file_rounded, x.file),
              Fact(x.consent ? Icons.verified_outlined : Icons.block_rounded, x.consent ? 'Consent confirmed by contributor' : 'No consent'),
            ]),
            const SizedBox(height: 12),
            if (x.status == 'pending')
              Row(children: [
                Expanded(child: FilledButton.icon(onPressed: () => push(context, RecordFormScreen(fromSub: x)), icon: const Icon(Icons.check_rounded), label: const Text('Approve and catalogue'))),
                const SizedBox(width: 8),
                OutlinedButton.icon(onPressed: () => _reject(x), icon: const Icon(Icons.block_rounded), label: const Text('Reject')),
              ])
            else if (x.recordId != null)
              OutlinedButton.icon(onPressed: () => push(context, RecordScreen(id: x.recordId!)), icon: const Icon(Icons.visibility_outlined), label: Text('View ${x.recordId}')),
          ]))),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
class UsersScreen extends StatelessWidget {
  const UsersScreen({super.key});

  void _create(BuildContext context) {
    final s = AppScope.read(context);
    final n = TextEditingController(), e = TextEditingController(), p = TextEditingController(text: 'Welcome-${math.Random().nextInt(9000) + 1000}');
    var role = 'user';
    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      icon: const CircleIcon(Icons.person_add_alt_rounded, size: 52),
      title: const Text('Create user'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: n, decoration: const InputDecoration(labelText: 'Name')),
        const SizedBox(height: 10),
        TextField(controller: e, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        const SizedBox(height: 12),
        SegmentedButton<String>(segments: const [
          ButtonSegment(value: 'user', icon: Icon(Icons.person_outline_rounded), label: Text('User')),
          ButtonSegment(value: 'admin', icon: Icon(Icons.manage_accounts_outlined), label: Text('Admin')),
        ], selected: {role}, onSelectionChanged: (v) => set(() => role = v.first)),
        const SizedBox(height: 12),
        TextField(controller: p, decoration: const InputDecoration(labelText: 'Temporary password')),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () {
          if (n.text.trim().isEmpty || !e.text.contains('@') || p.text.length < 8) return;
          s.users.add(User(id: 'U${DateTime.now().millisecondsSinceEpoch}', name: n.text.trim(), email: e.text.trim(), password: p.text,
              role: role, status: 'active', joined: AppState.today(), org: ''));
          s.log('created $role account ${e.text.trim()}');
          Navigator.pop(ctx);
          toast(context, 'User created', Icons.person_add_alt_rounded);
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
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Users and roles', sub: 'Users search, browse, play media and share material. Admins also catalogue, publish, review and manage users.'),
        OrbRow([
          _dash(context),
          OrbItem(Icons.person_add_alt_rounded, 'Create user', 'Add a user or admin with a temporary password.', () => _create(context), primary: true),
        ], size: 60),
        for (final u in s.users)
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Glass(padding: const EdgeInsets.fromLTRB(14, 12, 6, 12), child: Row(children: [
            CircleAvatar(backgroundColor: C.blue, child: Text(u.initials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(u.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              Text(u.email, style: const TextStyle(color: C.muted, fontSize: 12.5)),
              const SizedBox(height: 6),
              Row(children: [
                StatusChip(u.status), const SizedBox(width: 8),
                Icon(u.isAdmin ? Icons.manage_accounts_outlined : Icons.person_outline_rounded, size: 16, color: C.sky), const SizedBox(width: 4),
                Text(u.isAdmin ? 'Admin' : 'User', style: const TextStyle(color: C.sky, fontSize: 12.5)),
              ]),
            ])),
            if (u.id != s.session)
              PopupMenuButton<String>(
                tooltip: 'Actions for ${u.name}',
                icon: const Icon(Icons.more_vert_rounded),
                onSelected: (v) {
                  switch (v) {
                    case 'role':
                      u.role = u.isAdmin ? 'user' : 'admin';
                      s.log('changed ${u.email} role to ${u.role}');
                      toast(context, 'Role changed');
                    case 'susp':
                      u.status = u.status == 'active' ? 'suspended' : 'active';
                      s.log('${u.status == 'suspended' ? 'suspended' : 'reactivated'} account ${u.email}');
                      toast(context, u.status == 'suspended' ? 'Account suspended' : 'Account reactivated', u.status == 'suspended' ? Icons.block_rounded : Icons.check_circle_outline_rounded);
                    case 'reset':
                      final tmp = 'Tmp-${math.Random().nextInt(900000) + 100000}';
                      u.password = tmp;
                      s.log('reset password for ${u.email}');
                      showDialog(context: context, builder: (ctx) => AlertDialog(
                        icon: const CircleIcon(Icons.key_outlined, size: 52),
                        title: const Text('Password reset'),
                        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Temporary password for ${u.email}:'),
                          const SizedBox(height: 10),
                          Glass(child: SelectableText(tmp, style: const TextStyle(fontFamily: 'monospace', fontSize: 20, color: Colors.white))),
                          const SizedBox(height: 10),
                          const Text('In the full build the user gets a secure, expiring reset link by email instead.', style: TextStyle(color: C.muted, fontSize: 12.5)),
                        ]),
                        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done'))],
                      ));
                  }
                },
                itemBuilder: (_) => [
                  PopupMenuItem(value: 'role', child: ListTile(leading: const Icon(Icons.swap_horiz_rounded), title: Text(u.isAdmin ? 'Make user' : 'Make admin'))),
                  const PopupMenuItem(value: 'reset', child: ListTile(leading: Icon(Icons.key_outlined), title: Text('Reset password'))),
                  PopupMenuItem(value: 'susp', child: ListTile(leading: Icon(u.status == 'active' ? Icons.block_rounded : Icons.check_circle_outline_rounded),
                      title: Text(u.status == 'active' ? 'Suspend' : 'Reactivate'))),
                ],
              ),
          ]))),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.mail_outline_rounded),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Messages', sub: 'From the public contact form.'),
        OrbRow([
          _dash(context),
          if (s.unread.isNotEmpty)
            OrbItem(Icons.done_all_rounded, 'Mark all read', 'Marks every message as read.', () {
              for (final m in s.messages) { m.read = true; }
              s.save();
              toast(context, 'All messages marked as read');
            }),
        ], size: 60),
        if (s.messages.isEmpty) const Glass(child: Center(child: Text('No messages', style: TextStyle(color: C.muted)))),
        for (final m in s.messages)
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Glass(border: m.read ? null : C.blue2, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleIcon(m.read ? Icons.mail_outline_rounded : Icons.notifications_active_outlined, size: 36, solid: !m.read), const SizedBox(width: 10),
              Expanded(child: Text(m.subject, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
              Text(m.date, style: const TextStyle(color: C.muted, fontSize: 12)),
            ]),
            const SizedBox(height: 8),
            Text('${m.name}, ${m.email}', style: const TextStyle(color: C.muted, fontSize: 12.5)),
            const SizedBox(height: 6),
            Text(m.body, style: const TextStyle(height: 1.4)),
            const SizedBox(height: 10),
            Row(children: [
              if (!m.read) OutlinedButton.icon(onPressed: () { m.read = true; s.save(); }, icon: const Icon(Icons.check_rounded), label: const Text('Mark as read'))
              else const Fact(Icons.check_rounded, 'Read'),
              const SizedBox(width: 8),
              FilledButton.icon(onPressed: () { Clipboard.setData(ClipboardData(text: m.email)); toast(context, 'Email address copied. Replies open your mail app in the full build.', Icons.mail_outline_rounded); },
                  icon: const Icon(Icons.reply_rounded), label: const Text('Reply')),
            ]),
          ]))),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final pub = s.published;
    final byWater = [for (final w in s.waterBodies) MapEntry(w, pub.where((r) => r.water == w).fold<int>(0, (a, r) => a + r.views))];
    final mx = byWater.map((e) => e.value).fold(1, math.max);
    final av = s.records.where((r) => r.duration != null).toList();
    Widget bar(IconData i, String l, double f, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(children: [
          Icon(i, size: 18, color: C.sky), const SizedBox(width: 8),
          SizedBox(width: 118, child: Text(l, style: const TextStyle(fontSize: 13))),
          Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: f.clamp(0, 1), minHeight: 10, color: C.blue2, backgroundColor: Colors.white10))),
          SizedBox(width: 40, child: Text(v, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700))),
        ]));
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.monitor_heart_outlined),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 6, 16, 40), children: [
        const PageTitle('Reports and activity', sub: 'How the archive is used, and everything admins have done.'),
        OrbRow([_dash(context), OrbItem(Icons.download_rounded, 'Export', 'Copies the records list as CSV.', () => _export(context))], size: 60),
        Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Views by water body', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 6),
          for (final e in byWater) bar(waterIcons[e.key] ?? Icons.waves_rounded, e.key, e.value / mx, '${e.value}'),
        ])),
        const SizedBox(height: 14),
        Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Collection health', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
          const SizedBox(height: 6),
          bar(Icons.verified_outlined, 'Consent recorded', 1, '${s.records.length}'),
          bar(Icons.place_outlined, 'Placed on the map', s.records.where((r) => r.lat != 0).length / math.max(1, s.records.length), '${s.records.where((r) => r.lat != 0).length}'),
          bar(Icons.subtitles_outlined, 'Transcribed', av.where((r) => r.transcript != null).length / math.max(1, av.length), '${av.where((r) => r.transcript != null).length}'),
          const Text('Every audio and video item needs a transcript for search and accessibility.', style: TextStyle(color: C.muted, fontSize: 12.5)),
        ])),
        const SizedBox(height: 14),
        Glass(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Activity log', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
          for (final a in s.activity) _ActivityTile(a),
        ])),
      ]),
    );
  }
}
