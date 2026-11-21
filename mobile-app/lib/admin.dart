import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core.dart';
import 'pages.dart';
import 'share.dart';
import 'stories.dart';

const adminTabs = <(String, IconData, String)>[
  ('moderation', Icons.shield, 'Moderation'), ('reports', Icons.flag, 'Reports'), ('safety', Icons.warning_amber, 'Safety concerns'), ('approvals', Icons.how_to_vote, 'Approvals'), ('company', Icons.auto_stories, 'Company stories'),
  ('collections', Icons.collections_bookmark, 'Collections'), ('incidents', Icons.report_gmailerrorred, 'Incidents'), ('import', Icons.upload_file, 'Import'), ('resources', Icons.menu_book, 'Resources'),
  ('announcements', Icons.campaign, 'Announcements'), ('analytics', Icons.insights, 'Analytics'), ('audit', Icons.receipt_long, 'Audit log'),
];

/// The admin controls panel opens at half screen and can be dragged or tapped to expand to full screen.
void openAdminPanel(BuildContext context) => showModalBottomSheet<void>(context: context, isScrollControlled: true, useSafeArea: true, builder: (c) => DraggableScrollableSheet(
    expand: false, initialChildSize: .5, minChildSize: .3, maxChildSize: 1, snap: true, snapSizes: const [.5, 1],
    builder: (c, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(14, 0, 14, 20), children: [
      Row(children: [Expanded(child: Text(t('ADMINISTRATIVE CONTROLS'), style: TextStyle(fontWeight: FontWeight.w800, color: Theme.of(c).colorScheme.primary))), IconButton(icon: const Icon(Icons.open_in_full), tooltip: t('Full screen'), onPressed: () { Navigator.pop(c); Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminPage())); })]),
      GridView.count(crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: 1.25, children: [
        for (final (k, icon, label) in adminTabs) InkWell(borderRadius: BorderRadius.circular(14), onTap: () { Navigator.pop(c); Navigator.push(context, MaterialPageRoute(builder: (_) => AdminPage(tab: k))); },
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, color: Theme.of(c).colorScheme.primary), const SizedBox(height: 4), Text(t(label), textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))])),
      ]),
    ])));

class AdminPage extends StatelessWidget {
  final String tab;
  const AdminPage({super.key, this.tab = 'moderation'});
  @override
  Widget build(BuildContext context) {
    final i = adminTabs.indexWhere((x) => x.$1 == tab);
    return DefaultTabController(length: adminTabs.length, initialIndex: i < 0 ? 0 : i, child: Scaffold(
      appBar: AppBar(title: Text(t('Administrative controls')), bottom: TabBar(isScrollable: true, tabs: [for (final (_, icon, label) in adminTabs) Tab(icon: Icon(icon, size: 20), text: t(label))])),
      body: const TabBarView(children: [ModerationTab(), ReportsTab(), SafetyTab(), ApprovalsTab(), CompanyTab(), CollectionsTab(), IncidentsTab(), ImportTab(), ResourcesTab(), AnnouncementsTab(), AnalyticsTab(), AuditTab()]),
    ));
  }
}

// ---------- What an admin sees at the top of every story ----------
class AdminStoryBar extends StatelessWidget {
  final J story;
  final VoidCallback? onChanged;
  final bool full;
  const AdminStoryBar({super.key, required this.story, this.onChanged, this.full = false});
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    final m = asMap(story['moderation']), comments = asMap(story['comments']);
    final status = str(story['status']);
    final blocked = m['aiFlag'] == 'RED' && m['overridden'] != true && (status == 'pending_review' || status == 'blocked');
    Future<void> act(String path, J body, {String? ok}) async { await run(context, () => api.post('/admin/stories/${story['id']}/$path', body), ok: ok ?? t('Done.')); onChanged?.call(); }
    Future<void> withReason(String title, String path, String yes, {String? text, String label = 'Reason (shown to the Contributor)', bool danger = false, J extra = const {}}) async {
      final r = await confirm(context, title, text: text, yes: yes, reasonLabel: t(label), danger: danger);
      if (r != null && context.mounted) await act(path, {...extra, 'reason': r});
    }
    return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.only(bottom: 4), decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Theme.of(context).dividerTheme.color ?? Colors.grey))),
        child: Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, spacing: 4, children: [
          Text(str(story['code']), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)), FlagChip(m['aiFlag'] as String?),
          if (status != 'published') Pill(t(status.replaceAll('_', ' ')), color: Colors.grey),
          status == 'removed'
              ? IconButton(icon: const Icon(Icons.restore_from_trash), tooltip: t('Restore story'), onPressed: () => withReason(t('Restore this story?'), 'restore', t('Restore story'), label: 'Reason'))
              : IconButton(icon: const Icon(Icons.delete_outline), tooltip: t('Delete story'), onPressed: () => withReason(t('Delete this story?'), 'remove', t('Delete story'), text: t('The Contributor will see a notice with an “Ask Why” button.'), danger: true)),
          IconButton(icon: Icon(comments['locked'] == true ? Icons.lock : Icons.lock_open), tooltip: comments['locked'] == true ? t('Unlock comments') : t('Lock comments'),
              onPressed: () => comments['locked'] == true ? act('comments-lock', {'on': false}) : withReason(t('Lock comments and replies?'), 'comments-lock', t('Lock comments'), label: 'Reason (shown to Contributors)', extra: {'on': true})),
          IconButton(icon: Icon(comments['hidden'] == true ? Icons.visibility_off : Icons.visibility), tooltip: comments['hidden'] == true ? t('Show comments') : t('Hide comments'),
              onPressed: () => comments['hidden'] == true ? act('comments-hide', {'on': false}) : withReason(t('Hide all comments?'), 'comments-hide', t('Hide comments'), label: 'Reason (shown to Contributors)', extra: {'on': true})),
          if (blocked) TextButton(onPressed: () => withReason(t('Override the AI ban'), 'override', t('Send for approval'), text: '${t('Overrides are irreversible.')} ${t('They feed into the AI review guidance and may weaken it. Override only when you are certain.')}\n\n${str(asMap(m['aiExplanation'])['summary'])}', label: 'Justification (required)', danger: true), child: Text(t('Override AI ban'))),
          if (blocked) TextButton(onPressed: () => withReason(t('Keep this story blocked?'), 'keep-blocked', t('Keep blocked')), child: Text(t('Keep blocked'))),
          if (full && status == 'pending_review' && !blocked) TextButton(onPressed: () => act('release', {}), child: Text(t('Publish'))),
        ]));
  }
}

class ModerationTab extends StatefulWidget {
  const ModerationTab({super.key});
  @override
  State<ModerationTab> createState() => _ModerationTabState();
}

class _ModerationTabState extends State<ModerationTab> {
  String flag = '', filter = '', sub = 'stories';
  int gen = 0;
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(10, 8, 10, 0), child: Wrap(spacing: 6, children: [for (final (k, label) in [('stories', t('Stories')), ('comments', t('Held comments')), ('messages', t('Held messages'))]) ChoiceChip(label: Text(label), selected: sub == k, onSelected: (_) => setState(() => sub = k))])),
      if (sub == 'stories') Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Row(children: [
        Expanded(child: Choice<String>(t('AI flag'), flag, {'': t('All flags'), 'green': t('Green'), 'yellow': t('Yellow'), 'red': t('Red')}, (v) => setState(() { flag = v ?? ''; gen++; }))), const SizedBox(width: 8),
        Expanded(child: Choice<String>(t('Show'), filter, {'': t('All stories'), 'pending': t('Pending review'), 'blocked': t('AI-blocked, not overridden'), 'overridden': t('AI-blocked, overridden'), 'awaiting': t('Waiting for approval or validation'), 'removed': t('Removed')}, (v) => setState(() { filter = v ?? ''; gen++; }))),
      ])),
      Expanded(child: sub != 'stories'
          ? Loader<List<J>>(key: ValueKey('$sub$gen'), load: () async => asList(await api.get('/admin/held/$sub')), builder: (c, list, reload) => list.isEmpty ? EmptyState(sub == 'comments' ? t('No comments are waiting') : t('No messages are waiting'), icon: Icons.mode_comment_outlined) : ListView(padding: const EdgeInsets.all(10), children: [
              for (final x in list) Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [FlagChip(x['aiFlag'] as String?), const SizedBox(width: 6), Expanded(child: Text('${personName(asMap(x['author']))} · ${ago(x['createdAt'])}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)))]),
                Text(str(x['body'])), if (str(asMap(x['aiExplanation'])['summary']).isNotEmpty) Text('AI: ${asMap(x['aiExplanation'])['summary']}', style: const TextStyle(fontSize: 12)),
                Row(children: [
                  FilledButton(onPressed: () async { await run(context, () => api.post('/admin/held/$sub/${x['id']}', {'allow': true}), ok: t('Allowed.')); reload(); }, child: Text(t('Allow'))), const SizedBox(width: 8),
                  OutlinedButton(onPressed: () async { final r = await confirm(context, t('Keep this blocked?'), yes: t('Keep blocked'), reasonLabel: t('Reason (shown to the sender)')); if (r != null && context.mounted) { await run(context, () => api.post('/admin/held/$sub/${x['id']}', {'allow': false, 'reason': r}), ok: t('Blocked.')); reload(); } }, child: Text(t('Keep blocked'))),
                ]),
              ]))),
            ]))
          : Loader<J>(key: ValueKey('$flag$filter$gen'), load: () async => asMap(await api.get('/admin/moderation', {'flag': flag, 'filter': filter})), builder: (c, d, reload) {
              final items = asList(d['items']), counts = asMap(d['counts']);
              return ListView(padding: const EdgeInsets.all(10), children: [
                Wrap(spacing: 6, children: [Pill('${counts['green']} GREEN', color: C.green), Pill('${counts['yellow']} YELLOW', color: C.yellow), Pill('${counts['red']} RED', color: C.red), Text(t('{n} pending review', {'n': counts['pending']}), style: const TextStyle(fontSize: 12.5))]),
                if (items.isEmpty) EmptyState(t('Nothing here'), icon: Icons.shield),
                for (final s in items) Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  AdminStoryBar(story: s, full: true, onChanged: reload),
                  StoryRow(s),
                  if (str(s['text']).isNotEmpty) Text(str(s['text']), maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                  if (str(asMap(asMap(s['moderation'])['aiExplanation'])['summary']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Note('AI (${asMap(s['moderation'])['aiScore']}): ${asMap(asMap(s['moderation'])['aiExplanation'])['summary']}', color: C.flag(asMap(s['moderation'])['aiFlag'] as String?))),
                  if (asMap(s['author'])['role'] == 'contributor' && s['authorId'] != null) Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => accountAction(context, accountId: str(s['authorId'])), child: Text(t('Account actions')))),
                ]))),
              ]);
            })),
    ]);
  }
}

/// Dismiss, warn, drop the story, suspend for a set period, or propose permanent deletion (which needs approval).
Future<void> accountAction(BuildContext context, {String? accountId, J? report, VoidCallback? onDone}) {
  var action = report != null ? 'dismiss' : 'warn';
  var days = 7.0;
  final reason = TextEditingController();
  final api = AppScope.read(context).api;
  return sheet<void>(context, report != null ? t('Act on this report') : t('Account actions'), (c) => StatefulBuilder(builder: (c, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final (k, label) in [if (report != null) ('dismiss', t('Dismiss the report')), ('warn', t('Warn the account holder')), if (report?['targetType'] == 'story') ('drop', t('Drop the story')), ('suspend', t('Suspend for a set period')), ('delete', t('Delete the account permanently (needs approval)'))])
          RadioListTile<String>(dense: true, contentPadding: EdgeInsets.zero, value: k, groupValue: action, onChanged: (v) => set(() => action = v ?? action), title: Text(label)),
        if (action == 'suspend') Row(children: [Text('${t('Days')}: ${days.round()}'), Expanded(child: Slider(value: days, min: 1, max: 90, divisions: 89, onChanged: (v) => set(() => days = v)))]),
        Field(action == 'dismiss' ? t('Reason (internal)') : t('Reason (the account holder is told)'), reason, lines: 3),
        FilledButton(style: action == 'delete' ? FilledButton.styleFrom(backgroundColor: C.red) : null, onPressed: () async {
          if (reason.text.trim().length < 3) return;
          final body = {'action': action, 'reason': reason.text.trim(), if (action == 'suspend') 'days': days.round()};
          final r = await run(c, () => report != null ? api.post('/admin/reports/${report['targetType']}/${report['targetId']}/action', body) : api.post('/admin/accounts/$accountId/action', body), ok: t('Done.'));
          if (r != null && c.mounted) { Navigator.pop(c); onDone?.call(); }
        }, child: Text(t('Confirm'))),
      ])), tall: true);
}

class ReportsTab extends StatefulWidget {
  const ReportsTab({super.key});
  @override
  State<ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends State<ReportsTab> {
  String status = 'open';
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Column(children: [
      Padding(padding: const EdgeInsets.all(8), child: Wrap(spacing: 6, children: [for (final (k, label) in [('open', t('Open')), ('resolved', t('Resolved')), ('dismissed', t('Dismissed'))]) ChoiceChip(label: Text(label), selected: status == k, onSelected: (_) => setState(() => status = k))])),
      Expanded(child: Loader<List<J>>(key: ValueKey(status), load: () async => asList(await api.get('/admin/reports', {'status': status})), builder: (c, list, reload) => list.isEmpty ? EmptyState(t('No reports here'), icon: Icons.flag) : ListView(padding: const EdgeInsets.all(10), children: [
        for (final r in list) Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [Pill(t(r['targetType'] == 'user' ? 'Contributor' : r['targetType'] == 'story' ? 'Story' : 'Comment')), if (r['urgent'] == true) Pill(t('Urgent'), color: C.red), if (r['escalated'] == true) Pill(t('Escalated'), color: C.yellow), Text('${t('{n} reports', {'n': r['count']})} · ${ago(r['lastAt'])}', style: const TextStyle(fontSize: 12))]),
          Text(str(asMap(r['target'])['title'], str(asMap(r['target'])['username'], str(asMap(r['target'])['code']))), style: const TextStyle(fontWeight: FontWeight.w700)),
          if (str(asMap(r['target'])['excerpt']).isNotEmpty) Text(str(asMap(r['target'])['excerpt']), maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
          for (final x in asList(r['reports'])) Text('• ${personName(x['reporter'] == null ? null : asMap(x['reporter']))}: ${(x['reasons'] as List? ?? const []).map((e) => t('$e')).join(', ')}${str(x['description']).isEmpty ? '' : ' · “${x['description']}”'}', style: const TextStyle(fontSize: 12.5)),
          for (final n in asList(r['notes'])) Text('✎ ${str(n['adminName'], str(n['by']))}: ${str(n['note'], str(n['text']))}', style: const TextStyle(fontSize: 12)),
          Row(children: [
            if (status == 'open') FilledButton(onPressed: () => accountAction(context, report: r, onDone: reload), child: Text(t('Act on this report'))),
            TextButton(onPressed: () async { final n = await confirm(context, t('Internal note'), yes: t('Add note'), reasonLabel: t('Internal note')); if (n != null && context.mounted) { await run(context, () => api.post('/admin/reports/${r['targetType']}/${r['targetId']}/notes', {'note': n})); reload(); } }, child: Text(t('Add note'))),
          ]),
        ]))),
      ]))),
    ]);
  }
}

class SafetyTab extends StatelessWidget {
  const SafetyTab({super.key});
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Loader<List<J>>(load: () async => asList(await api.get('/admin/safety-concerns')), builder: (c, list, reload) => list.isEmpty ? EmptyState(t('No safety concerns'), icon: Icons.warning_amber) : ListView(padding: const EdgeInsets.all(10), children: [
      for (final x in list) Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Expanded(child: Text('${x['code']} · ${str(x['placeName'], t('No place given'))}', style: const TextStyle(fontWeight: FontWeight.w700))), if (x['overdue'] == true) Pill(t('Overdue'), color: C.red)]),
        Text(str(x['description'])), Text('${fmtDate(x['createdAt'], time: true)}${str(x['contact']).isEmpty ? '' : ' · ${x['contact']}'}', style: const TextStyle(fontSize: 12)),
        if (str(x['referral']).isNotEmpty) Note('${t('Referred to')}: ${x['referral']}'),
        for (final n in asList(x['notes'])) Text('✎ ${str(n['by'], str(n['adminName']))}: ${str(n['note'], str(n['text']))}', style: const TextStyle(fontSize: 12)),
        Choice<String>(t('Status'), str(x['status']), {'new': t('New'), 'acknowledged': t('Acknowledged'), 'referred': t('Referred'), 'closed': t('Closed')}, (v) async { await run(context, () => api.patch('/admin/safety-concerns/${x['id']}', {'status': v}), ok: t('Saved.')); reload(); }),
        Row(children: [
          TextButton(onPressed: () async { final n = await confirm(context, t('Internal note'), yes: t('Save'), reasonLabel: t('Internal note')); if (n != null && context.mounted) { await run(context, () => api.patch('/admin/safety-concerns/${x['id']}', {'note': n}), ok: t('Saved.')); reload(); } }, child: Text(t('Add note'))),
          TextButton(onPressed: () async { final n = await confirm(context, t('Record of referral'), yes: t('Save'), reasonLabel: t('Referred to (authority, date, reference)')); if (n != null && context.mounted) { await run(context, () => api.patch('/admin/safety-concerns/${x['id']}', {'referral': n, 'status': 'referred'}), ok: t('Saved.')); reload(); } }, child: Text(t('Referred to'))),
        ]),
      ]))),
    ]));
  }
}

class ApprovalsTab extends StatefulWidget {
  final bool superAdmin, waitingOnly;
  const ApprovalsTab({super.key, this.superAdmin = false, this.waitingOnly = false});
  @override
  State<ApprovalsTab> createState() => _ApprovalsTabState();
}

class _ApprovalsTabState extends State<ApprovalsTab> {
  String status = 'open';
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    Future<void> vote(J r, String v, Future<void> Function() reload) async {
      final why = await confirm(context, '${t(v == 'approve' || v == 'decide-yes' ? 'Approve' : v == 'changes' ? 'Request changes' : v == 'resubmit' ? 'Answer and restart voting' : 'Reject')}: ${r['title']}',
          text: r['type'] == 'override' && v == 'approve' ? '${t('Overrides are irreversible.')} ${t('They feed into the AI review guidance and may weaken it. Override only when you are certain.')}' : null, yes: t('Confirm'), reasonLabel: t('Written justification (required)'));
      if (why == null || !context.mounted) return;
      await run(context, () => v == 'resubmit' ? api.post('/admin/approvals/${r['id']}/resubmit', {'justification': why}) : v.startsWith('decide') ? api.post('/super/approvals/${r['id']}/decide', {'approve': v == 'decide-yes', 'justification': why}) : api.post('/admin/approvals/${r['id']}/vote', {'vote': v, 'justification': why}), ok: t('Recorded.'));
      await reload();
      if (context.mounted) AppScope.read(context).refresh();
    }
    return Column(children: [
      if (!widget.waitingOnly) Padding(padding: const EdgeInsets.all(8), child: Wrap(spacing: 6, children: [for (final (k, label) in [('open', t('Waiting')), ('approved', t('Approved')), ('rejected', t('Rejected'))]) ChoiceChip(label: Text(label), selected: status == k, onSelected: (_) => setState(() => status = k))])),
      Expanded(child: Loader<List<J>>(key: ValueKey(status), load: () async => asList(await api.get(widget.waitingOnly ? '/admin/approvals/waiting' : '/admin/approvals', widget.waitingOnly ? null : {'status': status})), builder: (c, list, reload) => list.isEmpty ? EmptyState(widget.waitingOnly ? t('Nothing is waiting for you.') : t('No approval requests here'), icon: Icons.how_to_vote) : ListView(padding: const EdgeInsets.all(10), children: [
        for (final r in list) Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [Pill(t(str(r['typeLabel']))), Text('${r['progress']} · ${t(str(r['status']).replaceAll('_', ' '))}', style: const TextStyle(fontSize: 12))]),
          Text(str(r['title']), style: const TextStyle(fontWeight: FontWeight.w700)), Text('${r['proposerName']}: ${r['justification']}', style: const TextStyle(fontSize: 13)),
          Text('${t('Decide by {date}', {'date': fmtDate(r['deadline'])})} · ${t(r['rule'] == 'unanimous' ? 'All admins must approve' : 'Two-thirds of admins must approve')}', style: const TextStyle(fontSize: 12)),
          for (final v in asList(r['votes'])) Text('• ${v['adminName']}: ${t(v['vote'] == 'approve' ? 'Approved' : v['vote'] == 'reject' ? 'Rejected' : 'Asked for changes')} · “${v['justification']}”', style: const TextStyle(fontSize: 12.5)),
          Wrap(spacing: 6, children: [
            if (!widget.superAdmin && r['status'] == 'pending' && r['mine'] != true && r['myVote'] == null) ...[
              FilledButton(onPressed: () => vote(r, 'approve', reload), child: Text(t('Approve'))), OutlinedButton(onPressed: () => vote(r, 'reject', reload), child: Text(t('Reject'))), TextButton(onPressed: () => vote(r, 'changes', reload), child: Text(t('Request changes'))),
            ],
            if (!widget.superAdmin && r['mine'] == true && r['status'] == 'changes_requested') FilledButton(onPressed: () => vote(r, 'resubmit', reload), child: Text(t('Answer and restart voting'))),
            if (r['mine'] == true && r['status'] == 'pending') Text(t('Your request. Waiting for the other admins.'), style: const TextStyle(fontSize: 12)),
            if (widget.superAdmin && r['status'] == 'overdue') ...[FilledButton(onPressed: () => vote(r, 'decide-yes', reload), child: Text(t('Approve'))), OutlinedButton(onPressed: () => vote(r, 'decide-no', reload), child: Text(t('Reject')))],
          ]),
        ]))),
      ]))),
    ]);
  }
}

class CompanyTab extends StatelessWidget {
  const CompanyTab({super.key});
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        Text(t('A company story is written by one admin and published under “Admin” with the platform logo once the other admins approve it. Testimonies and historical records are added the same way.')), const SizedBox(height: 12),
        FilledButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ShareStoryPage(company: true))), icon: const Icon(Icons.add), label: Text(t('Add a company story'))), const SizedBox(height: 8),
        OutlinedButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ShareStoryPage())), child: Text(t('Add a testimony or historical record'))),
      ]);
}

/// A simple form in a sheet: named text fields, then Save.
Future<J?> formSheet(BuildContext context, String title, List<(String key, String label, int lines)> fields, {J initial = const {}, String? save}) {
  final ctl = {for (final f in fields) f.$1: TextEditingController(text: str(initial[f.$1]))};
  return sheet<J>(context, title, (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final f in fields) Field(t(f.$2), ctl[f.$1]!, lines: f.$3),
        FilledButton(onPressed: () => Navigator.pop(c, {for (final e in ctl.entries) e.key: e.value.text.trim()}), child: Text(save ?? t('Save'))),
      ]), tall: true);
}

class CollectionsTab extends StatelessWidget {
  const CollectionsTab({super.key});
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Loader<List<J>>(load: () async => asList(await api.get('/collections')), builder: (c, list, reload) {
      Future<void> edit([J? x]) async {
        final full = x == null ? <String, dynamic>{} : asMap(await api.get('/collections/${x['id']}'));
        if (!context.mounted) return;
        final f = await formSheet(context, x == null ? t('New collection') : t('Edit collection'), [('title', 'Title', 1), ('description', 'Description', 4), ('codes', 'Stories in this collection', 3), ('justification', 'Note for the admins who approve it', 1)],
            initial: {...full, 'codes': asList(full['items']).map((i) => asMap(i['story'])['code']).join(', ')}, save: t('Submit for approval'));
        if (f == null || !context.mounted) return;
        final items = <J>[];
        for (final code in str(f['codes']).split(RegExp(r'[,\s]+')).where((e) => e.isNotEmpty)) { try { items.add({'storyId': asMap(await api.get('/stories/$code'))['id']}); } catch (_) {} }
        if (!context.mounted) return;
        final body = {'title': f['title'], 'description': f['description'], 'kind': str(full['kind'], 'collection'), 'items': items, 'submit': items.isNotEmpty, if (str(f['justification']).isNotEmpty) 'justification': f['justification']};
        await run(context, () => x == null ? api.post('/admin/collections', body) : api.patch('/admin/collections/${x['id']}', body), ok: t('Saved.'));
        reload();
      }
      return ListView(padding: const EdgeInsets.all(10), children: [
        Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: edit, icon: const Icon(Icons.add), label: Text(t('New collection')))),
        Text(t('Search by story ID or words'), style: const TextStyle(fontSize: 12)),
        for (final x in list) ListTile(title: Text(str(x['title']), style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${t(str(x['status']).replaceAll('_', ' '))} · ${t('{n} stories', {'n': x['stories']})}'), trailing: const Icon(Icons.edit), onTap: () => edit(x)),
      ]);
    });
  }
}

class IncidentsTab extends StatefulWidget {
  const IncidentsTab({super.key});
  @override
  State<IncidentsTab> createState() => _IncidentsTabState();
}

class _IncidentsTabState extends State<IncidentsTab> {
  String status = 'published';
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Column(children: [
      Padding(padding: const EdgeInsets.all(8), child: Wrap(spacing: 6, children: [for (final (k, label) in [('published', t('Published')), ('suggested', t('Suggested by contributors')), ('draft', t('Drafts'))]) ChoiceChip(label: Text(label), selected: status == k, onSelected: (_) => setState(() => status = k))])),
      Expanded(child: Loader<List<J>>(key: ValueKey(status), load: () async => asList(await api.get('/incidents', {'status': status})), builder: (c, list, reload) {
        Future<void> edit([J? x]) async {
          final full = x == null ? <String, dynamic>{} : asMap(await api.get('/incidents/${x['code'] ?? x['id']}'));
          if (!context.mounted) return;
          final f = await formSheet(context, x == null ? t('New incident record') : t('Edit incident record'), [('title', 'Name of the incident', 1), ('eventDate', 'Date', 1), ('placeName', 'Place', 1), ('waterBody', 'Water body', 1), ('vessel', 'Vessel', 1), ('incidentType', 'Type', 1), ('summary', 'Summary of what happened', 4), ('outcome', 'Outcome', 2), ('sources', 'Sources', 2)], initial: full);
          if (f == null || !context.mounted) return;
          final body = {for (final e in f.entries) if (str(e.value).isNotEmpty || const ['summary', 'outcome', 'sources'].contains(e.key)) e.key: e.value, 'status': 'published'};
          await run(context, () => x == null ? api.post('/admin/incidents', body) : api.patch('/admin/incidents/${full['id']}', body), ok: t('Saved.'));
          reload();
        }
        return ListView(padding: const EdgeInsets.all(10), children: [
          Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: edit, icon: const Icon(Icons.add), label: Text(t('New incident record')))),
          if (list.isEmpty) EmptyState(t('Nothing here'), icon: Icons.report_gmailerrorred),
          for (final x in list) ListTile(title: Text(str(x['title']), style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text([x['code'], fmtDate(x['eventDate']), x['placeName'], t('{n} linked stories', {'n': x['stories']})].where((e) => str(e).isNotEmpty).join(' · ')),
              trailing: status == 'suggested' ? IconButton(icon: const Icon(Icons.close), tooltip: t('Decline'), onPressed: () async { final ok = await confirm(context, t('Decline this suggested incident?'), yes: t('Decline')); if (ok != null && context.mounted) { await run(context, () => api.post('/admin/incidents/${x['id']}/decline')); reload(); } }) : const Icon(Icons.edit), onTap: () => edit(x)),
        ]);
      })),
    ]);
  }
}

class ImportTab extends StatelessWidget {
  const ImportTab({super.key});
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Loader<List<J>>(load: () async => asList(await api.get('/admin/import')), builder: (c, list, reload) => ListView(padding: const EdgeInsets.all(12), children: [
      Note(t('Import many items at once')),
      Text(t('Upload the filled spreadsheet (CSV or Excel). Every row is checked; nothing is created yet.'), style: const TextStyle(fontSize: 12.5)),
      OutlinedButton.icon(onPressed: () => launchUrl(Uri.parse('${api.base}/admin/import'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.open_in_new), label: Text(t('Import'))),
      const SizedBox(height: 8), Text(t('Earlier batches'), style: const TextStyle(fontWeight: FontWeight.w800)),
      if (list.isEmpty) Text(t('No batches yet.')),
      for (final b in list) ListTile(contentPadding: EdgeInsets.zero, title: Text(str(b['spreadsheetName'])), subtitle: Text('${fmtDate(b['createdAt'])} · ${t('{n} ready', {'n': b['ready']})} · ${t('{n} need attention', {'n': b['needAttention']})} · ${t(str(b['status']).replaceAll('_', ' '))}'),
          onTap: () => sheet(context, str(b['spreadsheetName']), (_) => Loader<J>(load: () async => asMap(await api.get('/admin/import/${b['id']}')), builder: (c, d, _) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final r in asList(d['rows'])) ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: Icon(r['ready'] == true ? Icons.check_circle : Icons.error, color: r['ready'] == true ? C.green : C.red), title: Text('${r['line']}. ${r['title']}'), subtitle: Text(r['ready'] == true ? t('Ready') : (r['problems'] as List? ?? const []).join(' '))),
                if (d['status'] == 'checked' && num0(d['ready']) > 0) FilledButton(onPressed: () async { await run(c, () => api.post('/admin/import/${b['id']}/submit', {})); if (c.mounted) Navigator.pop(c); reload(); }, child: Text(t('Submit {n} items for approval', {'n': d['ready']}))),
              ])), tall: true)),
    ]));
  }
}

class ResourcesTab extends StatelessWidget {
  const ResourcesTab({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    final api = app.api;
    return Loader<List<J>>(load: () async => asList(await api.get('/resources')), builder: (c, list, reload) {
      Future<void> edit([J? x]) async {
        final full = x == null ? <String, dynamic>{} : asMap(await api.get('/resources/${x['id']}'));
        if (!context.mounted) return;
        final f = await formSheet(context, x == null ? t('New resource') : t('Edit resource'), [('title', 'Title', 1), ('summary', 'Summary', 2), ('body', 'Text to read on screen', 8)], initial: full);
        if (f == null || !context.mounted) return;
        final body = {...f, 'type': str(full['type'], 'learning_summary'), 'audience': str(full['audience'], 'General public'), 'language': str(full['language'], 'en'), 'status': 'published'};
        await run(context, () => x == null ? api.post('/admin/resources', body) : api.patch('/admin/resources/${x['id']}', body), ok: t('Saved.'));
        reload();
      }
      return ListView(padding: const EdgeInsets.all(10), children: [
        Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: edit, icon: const Icon(Icons.add), label: Text(t('New resource')))),
        for (final r in list) ListTile(title: Text(str(r['title']), style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${t(str(r['typeLabel']))} · ${t('{n} views', {'n': r['views']})} · ${t('{n} downloads', {'n': r['downloads']})}'), onTap: () => edit(r),
            trailing: IconButton(icon: const Icon(Icons.delete_outline), tooltip: t('Remove'), onPressed: () async { final ok = await confirm(context, t('Remove “{title}”?', {'title': r['title']}), yes: t('Remove'), danger: true); if (ok != null && context.mounted) { await run(context, () => api.delete('/admin/resources/${r['id']}')); reload(); } })),
      ]);
    });
  }
}

class AnnouncementsTab extends StatelessWidget {
  const AnnouncementsTab({super.key});
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Loader<List<J>>(load: () async => asList(await api.get('/announcements')), builder: (c, list, reload) {
      Future<void> edit([J? a]) async {
        final f = await formSheet(context, a == null ? t('New announcement') : t('Edit announcement'), [('title', 'Title', 1), ('summary', 'Summary', 2), ('description', 'Full description', 6), ('date', 'Date', 1), ('label', 'What happens', 1)],
            initial: {...?a, 'date': asList(a?['dates']).isEmpty ? '' : asList(a!['dates']).first['date'], 'label': asList(a?['dates']).isEmpty ? '' : asList(a!['dates']).first['label']}, save: a == null ? t('Publish') : t('Save'));
        if (f == null || !context.mounted) return;
        final body = {'title': f['title'], 'summary': f['summary'], 'description': f['description'], 'dates': RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(str(f['date'])) ? [{'date': f['date'], if (str(f['label']).isNotEmpty) 'label': f['label']}] : <J>[], 'sendPush': false};
        await run(context, () => a == null ? api.post('/admin/announcements', body) : api.patch('/admin/announcements/${a['id']}', body), ok: t('Saved.'));
        reload();
      }
      return ListView(padding: const EdgeInsets.all(10), children: [
        Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: edit, icon: const Icon(Icons.add), label: Text(t('New announcement')))),
        for (final a in list) ListTile(title: Text('${a['title']}${a['edited'] == true ? ' · ${t('Edited')}' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${fmtDate(a['sortAt'])} · ${str(a['summary'])}'), onTap: () => edit(a),
            trailing: IconButton(icon: const Icon(Icons.delete_outline), tooltip: t('Delete'), onPressed: () async { final ok = await confirm(context, t('Delete “{title}”?', {'title': a['title']}), yes: t('Delete'), danger: true); if (ok != null && context.mounted) { await run(context, () => api.delete('/admin/announcements/${a['id']}')); reload(); } })),
      ]);
    });
  }
}

class AnalyticsTab extends StatefulWidget {
  const AnalyticsTab({super.key});
  @override
  State<AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<AnalyticsTab> {
  String period = 'day';
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return ListView(padding: const EdgeInsets.all(12), children: [
      Wrap(spacing: 6, children: [for (final (k, label) in [('day', 'Daily'), ('week', 'Weekly'), ('month', 'Monthly'), ('year', 'Annual')]) ChoiceChip(label: Text(t(label)), selected: period == k, onSelected: (_) => setState(() => period = k))]),
      Loader<J>(load: () async => asMap(await api.get('/admin/analytics/summary')), builder: (c, s, _) => GridView.count(crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: 1.5, children: [
        for (final (k, label) in [('publishedStories', 'Published stories'), ('testimonies', 'Testimonies'), ('historicalRecords', 'Historical records'), ('incidents', 'Incidents documented'), ('counties', 'Counties represented'), ('contributors', 'Contributors'), ('monthlyActiveUsers', 'Active users this month'), ('monthlyVisitors', 'Visitors this month'), ('openReports', 'Open reports'), ('safetyConcerns', 'Safety concerns'), ('citations', 'Citations'), ('storyDownloads', 'Story downloads')])
          Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text('${s[k] ?? 0}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Theme.of(c).colorScheme.primary)), Text(t(label), textAlign: TextAlign.center, style: const TextStyle(fontSize: 11))]),
      ])),
      Loader<List<J>>(key: ValueKey(period), load: () async { final charts = asList(await api.get('/admin/analytics/charts')); return [for (final ch in charts) asMap(await api.get('/admin/analytics/series', {'chart': ch['key'], 'period': period}))]; }, builder: (c, list, _) => Column(children: [
        for (final d in list) Section(t(str(d['title'])), [MiniChart((d['labels'] as List? ?? const []).map((e) => '$e').toList(), asList(d['series']), bars: period != 'day'), if (asList(d['series']).length > 1) Wrap(spacing: 8, children: [for (final s in asList(d['series'])) Text('● ${t(str(s['name']))}', style: const TextStyle(fontSize: 11.5))])]),
      ])),
      const PdfReports(),
    ]);
  }
}

class PdfReports extends StatefulWidget {
  const PdfReports({super.key});
  @override
  State<PdfReports> createState() => _PdfReportsState();
}

class _PdfReportsState extends State<PdfReports> {
  int gen = 0;
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    final now = DateTime.now();
    String iso(DateTime d) => d.toIso8601String().substring(0, 10);
    return Section(t('PDF reports'), [
      FilledButton.icon(icon: const Icon(Icons.picture_as_pdf), label: Text(t('Generate PDF report')), onPressed: () async {
        final range = await showDateRangePicker(context: context, firstDate: DateTime(2024), lastDate: now, initialDateRange: DateTimeRange(start: DateTime(now.year, now.month, 1), end: now));
        if (range == null || !context.mounted) return;
        await run(context, () => api.post('/admin/analytics/reports', {'from': iso(range.start), 'to': iso(range.end)}));
        setState(() => gen++);
      }),
      Text(t('Previous reports'), style: const TextStyle(fontWeight: FontWeight.w700)),
      Loader<List<J>>(key: ValueKey(gen), load: () async => asList(await api.get('/admin/analytics/reports')), builder: (c, list, reload) => list.isEmpty ? Text(t('No reports yet. A monthly report is generated automatically on the first day of each month.'), style: const TextStyle(fontSize: 12.5)) : Column(children: [
        for (final r in list) ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${r['title']}${r['automatic'] == true ? ' · ${t('Automatic')}' : ''}'), subtitle: Text('${fmtDate(r['periodFrom'])} – ${fmtDate(r['periodTo'])}'),
            trailing: r['status'] == 'ready' && r['url'] != null ? IconButton(icon: const Icon(Icons.download), tooltip: 'PDF', onPressed: () => launchUrl(Uri.parse(api.abs(str(r['url']))), mode: LaunchMode.externalApplication)) : r['status'] == 'failed' ? Text(t('Failed')) : IconButton(icon: const Icon(Icons.refresh), tooltip: t('Generating report…'), onPressed: reload)),
      ])),
    ]);
  }
}

class AuditTab extends StatelessWidget {
  const AuditTab({super.key});
  @override
  Widget build(BuildContext context) => Loader<J>(load: () async => asMap(await AppScope.read(context).api.get('/admin/audit-log')), builder: (c, d, _) => ListView(padding: const EdgeInsets.all(8), children: [
        for (final x in asList(d['items'])) ListTile(dense: true, title: Text(str(x['summary'], str(x['action']))), subtitle: Text('${x['actorName']} · ${fmtDate(x['createdAt'], time: true)} · ${x['action']}${str(x['reason']).isEmpty ? '' : ' · ${x['reason']}'}')),
      ]));
}

/// MY RESPONSIBILITIES (admins): approvals waiting for this admin, reminders and notifications.
class ResponsibilitiesPage extends StatelessWidget {
  const ResponsibilitiesPage({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(length: 3, child: Scaffold(
      appBar: AppBar(title: Text(t('My Responsibilities')), bottom: TabBar(tabs: [Tab(text: t('Approvals')), Tab(text: t('Reminders')), Tab(text: t('Notifications'))])),
      body: const TabBarView(children: [ApprovalsTab(waitingOnly: true), Reminders(), NotificationList()])));
}

/// The Super Admin areas: LIVE ANALYTICS, REPORTS (PDF) and MANAGE ADMINS. Super Admins do not moderate stories.
class SuperPage extends StatelessWidget {
  final String area;
  const SuperPage({super.key, this.area = 'analytics'});
  @override
  Widget build(BuildContext context) {
    const areas = ['analytics', 'reports', 'admins', 'approvals', 'audit'];
    final i = areas.indexOf(area);
    return DefaultTabController(length: 5, initialIndex: i < 0 ? 0 : i, child: Scaffold(
      appBar: AppBar(title: Text(t('Super Admin')), bottom: TabBar(isScrollable: true, tabs: [Tab(text: t('Live analytics')), Tab(text: t('Reports (PDF)')), Tab(text: t('Manage admins')), Tab(text: t('Overdue approvals')), Tab(text: t('Audit log'))])),
      body: const TabBarView(children: [AnalyticsTab(), SingleChildScrollView(padding: EdgeInsets.all(12), child: PdfReports()), ManageAdmins(), ApprovalsTab(superAdmin: true), AuditTab()]),
    ));
  }
}

class ManageAdmins extends StatelessWidget {
  const ManageAdmins({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    final api = app.api;
    return Loader<List<J>>(load: () async => asList(await api.get('/super/admins')), builder: (c, list, reload) {
      Future<void> go(Future<dynamic> Function() fn) async { await run(context, fn, ok: t('Done.')); reload(); }
      return ListView(padding: const EdgeInsets.all(10), children: [
        Align(alignment: Alignment.centerRight, child: FilledButton.icon(icon: const Icon(Icons.person_add), label: Text(t('Add an admin by invitation')), onPressed: () async {
          final f = await formSheet(context, t('Add an admin by invitation'), [('email', 'Work email', 1), ('fullName', 'Full name (optional)', 1)], save: t('Send invitation'));
          if (f != null && str(f['email']).contains('@')) await go(() => api.post('/super/admins/invite', {'email': f['email'], if (str(f['fullName']).isNotEmpty) 'fullName': f['fullName']}));
        })),
        for (final a in list) Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [Text('${a['name']}  ', style: const TextStyle(fontWeight: FontWeight.w700)), Pill(a['role'] == 'super_admin' ? t('Super Admin') : t('Admin')), if (a['status'] != 'active') Pill(t(a['invited'] == true ? 'Invited' : str(a['status'])), color: Colors.grey)]),
          Text([a['adminName'], a['adminId'], a['email'], a['phone']].where((e) => str(e).isNotEmpty).join(' · '), style: const TextStyle(fontSize: 12.5)),
          Text('${a['lastLoginAt'] != null ? t('Last signed in {when}', {'when': ago(a['lastLoginAt'])}) : t('Has not signed in yet')} · ${t('{n} actions in 30 days', {'n': a['actions30Days']})}', style: const TextStyle(fontSize: 12)),
          Wrap(spacing: 6, children: [
            if (a['status'] == 'pending') ...[FilledButton(onPressed: () => go(() => api.post('/super/admins/${a['id']}/decision', {'approve': true})), child: Text(t('Approve'))), OutlinedButton(onPressed: () => go(() => api.post('/super/admins/${a['id']}/decision', {'approve': false})), child: Text(t('Decline')))],
            if (a['status'] == 'active' && a['role'] == 'admin') TextButton(onPressed: () async { final ok = await confirm(context, t('Make {name} a Super Admin?', {'name': a['name']}), text: t('Super Admins manage admins and see all analytics and the full audit log. They no longer moderate stories.'), yes: t('Make Super Admin')); if (ok != null) await go(() => api.post('/super/admins/${a['id']}/promote')); }, child: Text(t('Make Super Admin'))),
            if (a['id'] != app.me?['id'] && a['status'] != 'pending' && a['status'] != 'removed') TextButton(onPressed: () async { final r = await confirm(context, t('Remove {name}?', {'name': a['name']}), text: t('They lose access immediately.'), yes: t('Remove'), reasonLabel: t('Reason'), danger: true); if (r != null) await go(() => api.post('/super/admins/${a['id']}/remove', {'reason': r})); }, child: Text(t('Remove'))),
          ]),
        ]))),
      ]);
    });
  }
}
