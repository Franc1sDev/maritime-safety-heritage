import 'dart:async';

import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'auth.dart';
import 'core.dart';
import 'share.dart';
import 'stories.dart';

Scaffold page(String title, Widget body, {List<Widget>? actions, Widget? fab}) => Scaffold(appBar: AppBar(title: Text(title), actions: actions), body: SafeArea(child: body), floatingActionButton: fab);

// ---------- Rules, legal, about ----------
/// The short welcome after a first profile is set up.
class WelcomeText extends StatelessWidget {
  const WelcomeText({super.key});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Text(t('Thank you for joining. Before you share or comment, here is how the archive works.')), const SizedBox(height: 10),
    const RulesText(), const SizedBox(height: 10),
    Text(t('You can read these rules again at any time from the Rules button.'), style: const TextStyle(fontSize: 12.5)), const SizedBox(height: 8),
    FilledButton(onPressed: () => Navigator.pop(context), child: Text(t('Start exploring'))),
  ]);
}

class RulesText extends StatelessWidget {
  const RulesText({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final (i, r) in s.list('rules').indexed) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('${i + 1}. $r')),
      const SizedBox(height: 6), Text(t('How stories are checked'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
      Text(str(s.config['moderationNote'])), const SizedBox(height: 6),
      Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [const FlagChip('GREEN'), Text(t('posted')), const FlagChip('YELLOW'), Text(t('posted with a warning')), const FlagChip('RED'), Text(t('blocked and reviewed by admins'))]),
      const SizedBox(height: 10), Text(t('Stories about loss'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
      Text(t('Many stories here remember people who died on the water. Write about them with care, and mark your story as sensitive if it may be distressing.')),
    ]);
  }
}

class LegalPage extends StatelessWidget {
  final String kind;
  const LegalPage(this.kind, {super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.read(context);
    if (kind == 'rules') return page(t('Rules and netiquette'), const SingleChildScrollView(padding: EdgeInsets.all(18), child: RulesText()));
    // The full policies are kept in one place, on the website, so the wording is always the same.
    return page(kind == 'privacy' ? t('Privacy policy') : t('Terms of use'), Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(kind == 'privacy' ? t('This policy explains what personal data the archive collects, why, how it is protected and what your rights are. It follows Kenya’s Data Protection Act, 2019.') : t('Anyone may read, listen to, search and cite the archive free of charge. To post, react, comment, message, follow or report you need an account, which you create by signing in with Google or Apple.')),
      const SizedBox(height: 14),
      FilledButton.icon(onPressed: () => launchUrl(Uri.parse('${s.api.base}/$kind'), mode: LaunchMode.inAppBrowserView), icon: const Icon(Icons.open_in_new), label: Text(kind == 'privacy' ? t('Privacy policy') : t('Terms of use'))),
    ])));
  }
}

class AboutPage extends StatelessWidget {
  final int tab;
  final String? resource;
  const AboutPage({super.key, this.tab = 0, this.resource});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    if (resource != null) return ResourcePage(resource!);
    return DefaultTabController(length: 4, initialIndex: tab, child: Scaffold(
      appBar: AppBar(title: Text(t('About & Resources')), bottom: TabBar(isScrollable: true, tabs: [Tab(text: t('About')), Tab(text: t('Learning resources')), Tab(text: t('Report a safety concern')), Tab(text: t('Suggest an improvement'))])),
      body: TabBarView(children: [
        ListView(padding: const EdgeInsets.all(18), children: [
          Text(t('Remembering the Waters is Kenya’s first national archive dedicated to maritime and inland-water safety heritage. It documents past ferry and boat disasters, everyday safety experiences and community knowledge from the coast, the lakes and the rivers, so that lives lost and lessons learned are not forgotten.')),
          const SizedBox(height: 12), Text(t('What this platform is for'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(t('People who live and work near Kenya’s waters share their stories, testimonies, photographs and recordings here. Researchers, students, safety agencies, policymakers and the public can read, listen to, search and cite them, free of charge and without an account.')),
          const SizedBox(height: 12), Text(t('Acknowledgements'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(t('The archive is run by the project team with the support of its funders and partner organisations, and it exists because of the people who have trusted it with their stories.')),
          const SizedBox(height: 12),
          Wrap(children: [for (final (k, label) in [('privacy', t('Privacy policy')), ('terms', t('Terms of use')), ('rules', t('Rules and netiquette'))]) TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalPage(k))), child: Text(label))]),
          if (s.signedIn && !s.isSuper) OutlinedButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InboxPage(toAdmins: true))), icon: const Icon(Icons.mail_outline), label: Text(t('Message the admins'))),

          const SizedBox(height: 12),
          Text('© ${DateTime.now().year} Remembering the Waters. ${t('Each story belongs to its storyteller and is shared under the rights shown with it.')}', style: const TextStyle(fontSize: 12)),
        ]),
        const ResourceList(),
        const SingleChildScrollView(padding: EdgeInsets.all(18), child: SafetyConcernForm()),
        const SingleChildScrollView(padding: EdgeInsets.all(18), child: FeedbackForm()),
      ]),
    ));
  }
}

class ResourceList extends StatelessWidget {
  const ResourceList({super.key});
  @override
  Widget build(BuildContext context) => Loader<List<J>>(load: () async => asList(await AppScope.read(context).api.get('/resources')), builder: (c, list, _) => list.isEmpty ? EmptyState(t('No resources match'), icon: Icons.menu_book) : ListView(padding: const EdgeInsets.all(10), children: [
        for (final r in list) ListTile(leading: const Icon(Icons.menu_book), title: Text(str(r['title']), style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${t(str(r['typeLabel']))} · ${t(str(r['audience']))}\n${str(r['summary'])}', maxLines: 3, overflow: TextOverflow.ellipsis), isThreeLine: true,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ResourcePage(str(r['slug']))))),
      ]));
}

class ResourcePage extends StatelessWidget {
  final String slug;
  const ResourcePage(this.slug, {super.key});
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return page(t('Learning resources'), Loader<J>(load: () async => asMap(await api.get('/resources/$slug')), builder: (c, r, _) => ListView(padding: const EdgeInsets.all(18), children: [
      Wrap(children: [Pill(t(str(r['typeLabel'])))]),
      Text(str(r['title']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      Text('${t(str(r['audience']))} · ${t('Published {date}', {'date': fmtDate(r['publishedAt'])})}', style: const TextStyle(fontSize: 12.5)), const SizedBox(height: 8),
      if (str(r['summary']).isNotEmpty) Text(str(r['summary']), style: const TextStyle(fontWeight: FontWeight.w700)),
      if (str(r['body']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(str(r['body']), style: const TextStyle(height: 1.5))),
      if (r['exhibition'] != null) ...[
        const SizedBox(height: 10), Text(str(asMap(r['exhibition'])['title']), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        for (final it in asList(asMap(r['exhibition'])['items'])) StoryRow(asMap(it['story']), note: str(it['note'])),
      ],
      const SizedBox(height: 12),
      Wrap(spacing: 8, children: [
        if (r['hasFile'] == true) FilledButton.icon(onPressed: () async { final d = await run(context, () async => asMap(await api.post('/resources/${r['id']}/download'))); if (d != null) launchUrl(Uri.parse(api.abs(str(d['url']))), mode: LaunchMode.externalApplication); }, icon: const Icon(Icons.download), label: Text(t('Download'))),
        OutlinedButton.icon(onPressed: () => Share.share('${r['title']}\n${r['permalink']}'), icon: const Icon(Icons.ios_share), label: Text(t('Share'))),
        OutlinedButton.icon(onPressed: () { Clipboard.setData(ClipboardData(text: str(r['citation']))); toast(context, t('Citation copied.')); }, icon: const Icon(Icons.format_quote), label: Text(t('Copy citation'))),
      ]),
      const SizedBox(height: 10), Note('${t('Suggested citation')}: ${r['citation']}'),
    ])));
  }
}

/// A compact line for a story in lists; selecting it opens the story.
class StoryRow extends StatelessWidget {
  final J s;
  final String note;
  const StoryRow(this.s, {super.key, this.note = ''});
  @override
  Widget build(BuildContext context) => ListTile(contentPadding: EdgeInsets.zero, title: Text(str(s['title'], str(s['code'])), style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${t(str(s['typeLabel']))} · ${personName(s['author'] == null ? null : asMap(s['author']))}${note.isEmpty ? '' : '\n$note'}'),
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => page(str(s['code']), Loader<J>(load: () async => asMap(await AppScope.read(context).api.get('/stories/${s['code']}')), builder: (c, d, reload) => StoryView(story: d, active: true, onReload: reload))))));
}

class SafetyConcernPage extends StatelessWidget {
  const SafetyConcernPage({super.key});
  @override
  Widget build(BuildContext context) => page(t('Report a safety concern'), const SingleChildScrollView(padding: EdgeInsets.all(18), child: SafetyConcernForm()));
}

/// Open to everyone, including visitors. Not an emergency service.
class SafetyConcernForm extends StatefulWidget {
  const SafetyConcernForm({super.key});
  @override
  State<SafetyConcernForm> createState() => _SafetyConcernFormState();
}

class _SafetyConcernFormState extends State<SafetyConcernForm> {
  final what = TextEditingController(), where = TextEditingController(), contact = TextEditingController();
  LatLng? pos;
  String? photoId, photoName;
  bool share = true, map = false, busy = false;
  J? done;
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final d = done;
    if (d != null) return Note('${d['message']}\n${t('Reference')}: ${d['code']}\n\n${d['notice']}', color: C.green);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Note('${t('This is not an emergency service.')} ${str(s.config['safetyNotice'])} ${s.list('emergencyNumbers').join(' · ')}', color: C.red),
      Text(t('Tell the project team about a current safety risk on the water, for example an overloaded boat or missing life jackets.')), const SizedBox(height: 10),
      Field(t('What is the risk?'), what, lines: 4), Field(t('Place'), where, hint: t('Landing site, crossing, beach or town')),
      TextButton.icon(onPressed: () => setState(() => map = !map), icon: const Icon(Icons.place), label: Text(map ? t('Hide the map') : pos != null ? t('Move the pin on the map') : t('Put a pin on the map'))),
      if (map) SizedBox(height: 260, child: MapBox(markers: [if (pos != null) pin(pos!)], onTap: (p) => setState(() => pos = p))),
      TextButton.icon(onPressed: () async {
        final x = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2000, imageQuality: 85);
        if (x == null || !context.mounted) return;
        final m = await run(context, () async => s.api.uploadFile(LocalFile(x.path, x.name, await x.length()), 'concern'));
        if (m != null) setState(() { photoId = str(m['id']); photoName = str(m['name']); });
      }, icon: const Icon(Icons.add_a_photo), label: Text(photoName ?? t('Add a photo (optional)'))),
      if (!s.signedIn) Field(t('How can we reach you? (optional)'), contact, hint: t('Phone or email')),
      if (s.signedIn) CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: share, onChanged: (v) => setState(() => share = v == true), title: Text(t('The team may contact me about this in my INBOX'))),
      FilledButton(onPressed: busy ? null : () async {
        if (what.text.trim().length < 5) { toast(context, t('Describe the risk in a few words.'), error: true); return; }
        setState(() => busy = true);
        final r = await run(context, () async => asMap(await s.api.post('/safety-concerns', {'description': what.text.trim(), if (where.text.trim().isNotEmpty) 'placeName': where.text.trim(), if (pos != null) 'latitude': pos!.latitude, if (pos != null) 'longitude': pos!.longitude,
          if (photoId != null) 'photoMediaId': photoId, if (contact.text.trim().isNotEmpty) 'contact': contact.text.trim(), if (s.signedIn) 'shareIdentity': share})));
        if (mounted) setState(() { busy = false; done = r; });
      }, child: Text(t('Send to the project team'))),
    ]);
  }
}

class FeedbackForm extends StatefulWidget {
  const FeedbackForm({super.key});
  @override
  State<FeedbackForm> createState() => _FeedbackFormState();
}

class _FeedbackFormState extends State<FeedbackForm> {
  final ctl = TextEditingController();
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(t('Tell us what would make the archive easier or more useful. This form is about the archive itself.')), const SizedBox(height: 10),
        Field(t('How could the archive be better?'), ctl, lines: 4),
        FilledButton(onPressed: () async { if (ctl.text.trim().length < 3) return; final r = await run(context, () => AppScope.read(context).api.post('/feedback', {'text': ctl.text.trim()}), ok: t('Thank you. Your suggestion was sent.')); if (r != null) ctl.clear(); }, child: Text(t('Send feedback'))),
      ]);
}

// ---------- Incident and Contributor pages ----------
class IncidentPage extends StatelessWidget {
  final String code;
  final void Function(String id, String title)? onStories;
  const IncidentPage(this.code, {super.key, this.onStories});
  @override
  Widget build(BuildContext context) => page(t('Incident record'), Loader<J>(load: () async => asMap(await AppScope.read(context).api.get('/incidents/$code')), builder: (c, i, _) => ListView(padding: const EdgeInsets.all(18), children: [
        Text('${t('Incident record')} · ${i['code']}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        Text(str(i['title']), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)), const SizedBox(height: 8),
        for (final (k, v) in [(t('Date'), i['eventDate'] == null ? '' : (i['dateApproximate'] == true ? t('around {year}', {'year': str(i['eventDate']).substring(0, 4)}) : fmtDate(i['eventDate']))), (t('Place'), str(i['placeName'])), (t('Water body'), str(i['waterBody'])), (t('Vessel'), str(i['vessel'])), (t('Type'), str(i['incidentType']).isEmpty ? '' : t(str(i['incidentType'])))])
          if (v.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text.rich(TextSpan(children: [TextSpan(text: '$k: ', style: const TextStyle(fontWeight: FontWeight.w700)), TextSpan(text: v)]))),
        if (str(i['summary']).isNotEmpty) ...[const SizedBox(height: 8), Text(t('What happened'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), Text(str(i['summary']), style: const TextStyle(height: 1.5))],
        if (str(i['outcome']).isNotEmpty) ...[const SizedBox(height: 8), Text(t('Outcome'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), Text(str(i['outcome']))],
        if (i['latitude'] != null) Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: SizedBox(height: 220, child: MapBox(markers: [pin(LatLng((i['latitude'] as num).toDouble(), (i['longitude'] as num).toDouble()), color: C.red, label: str(i['title']))], center: LatLng((i['latitude'] as num).toDouble(), (i['longitude'] as num).toDouble()), zoom: 9))),
        Text('${t('Stories, testimonies and records linked to this incident')} (${asList(i['linked']).length})', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        if (asList(i['linked']).isEmpty) Text(t('Nothing is linked yet. If you remember this, share your story and link it to this incident.')),
        for (final s in asList(i['linked'])) StoryRow(s),
        if (str(i['sources']).isNotEmpty) ...[const SizedBox(height: 8), Text(t('Sources'), style: const TextStyle(fontWeight: FontWeight.w800)), Text(str(i['sources']), style: const TextStyle(fontSize: 13))],
        const SizedBox(height: 10),
        OutlinedButton.icon(onPressed: () => Share.share('${i['title']}\n${i['permalink']}'), icon: const Icon(Icons.ios_share), label: Text(t('Share'))),
      ])));
}

class ContributorPage extends StatefulWidget {
  final String username;
  const ContributorPage(this.username, {super.key});
  @override
  State<ContributorPage> createState() => _ContributorPageState();
}

class _ContributorPageState extends State<ContributorPage> {
  int gen = 0;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return page('@${widget.username}', Loader<J>(key: ValueKey(gen), load: () async => asMap(await app.api.get('/contributors/${widget.username}')), builder: (c, p, reload) {
      final v = asMap(p['viewer']);
      Future<void> toggle(String what, bool on) async { if (!need(context)) return; await run(context, () => app.api.put('/people/${p['id']}/$what', {'on': on}), ok: t('Saved.')); await reload(); }
      return ListView(padding: const EdgeInsets.all(18), children: [
        Row(children: [Avatar(p, size: 72), const SizedBox(width: 14), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('@${p['username']}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          Text('${t('{n} stories', {'n': p['stories']})} · ${t('{n} followers', {'n': p['followers']})} · ${t('{n} following', {'n': p['following']})}', style: const TextStyle(fontSize: 12.5)),
        ]))]),
        const SizedBox(height: 14),
        Loader<List<J>>(key: ValueKey('s$gen'), load: () async => asList(asMap(await app.api.get('/stories', {'tab': 'recent', 'authorId': p['id'], 'limit': 20}))['items']), builder: (c, list, _) => Column(children: [for (final s in list) StoryRow(s)])),
        const SizedBox(height: 8),
        if (v['own'] != true && !app.isSuper) Wrap(spacing: 8, runSpacing: 6, children: [
          FilledButton.icon(onPressed: () => toggle('follow', v['following'] != true), icon: Icon(v['following'] == true ? Icons.check : Icons.person_add), label: Text(v['following'] == true ? t('Following') : t('Follow'))),
          OutlinedButton.icon(onPressed: () { if (need(context)) Navigator.push(context, MaterialPageRoute(builder: (_) => InboxPage(toUser: p))); }, icon: const Icon(Icons.mail_outline), label: Text(t('Message'))),
          PopupMenuButton<String>(tooltip: '⋯', onSelected: (k) async {
            if (k == 'mute') await toggle('mute', v['muted'] != true);
            if (k == 'report' && need(context)) sheet(context, t('Report'), (_) => ReportForm(targetType: 'user', targetId: str(p['id'])), tall: true);
            if (k == 'block') {
              if (v['blocked'] == true) { await toggle('block', false); return; }
              if (!need(context)) return;
              final ok = await confirm(context, t('Block {name}?', {'name': '@${p['username']}'}), text: t('They will not be able to message you or interact with your stories, and you will not see theirs. You can unblock them in Settings.'), yes: t('Block'), danger: true);
              if (ok != null) await toggle('block', true);
            }
          }, itemBuilder: (_) => [
            PopupMenuItem(value: 'mute', child: Text(v['muted'] == true ? t('Unmute') : t('Mute'))),
            PopupMenuItem(value: 'block', child: Text(v['blocked'] == true ? t('Unblock') : t('Block'))),
            PopupMenuItem(value: 'report', child: Text(t('Report'))),
          ]),
        ]),
      ]);
    }));
  }
}

// ---------- INBOX ----------
class InboxPage extends StatefulWidget {
  final String? open;
  final bool toAdmins;
  final J? toUser;
  const InboxPage({super.key, this.open, this.toAdmins = false, this.toUser});
  @override
  State<InboxPage> createState() => _InboxPageState();
}

class _InboxPageState extends State<InboxPage> {
  int gen = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.open != null) _thread(id: widget.open);
      if (widget.toAdmins) _thread(toAdmins: true);
      if (widget.toUser != null) _thread(toUser: widget.toUser);
    });
  }
  void _thread({String? id, J? conv, bool toAdmins = false, J? toUser}) => Navigator.push(context, MaterialPageRoute(builder: (_) => ThreadPage(id: id, conv: conv, toAdmins: toAdmins, toUser: toUser))).then((_) { if (mounted) setState(() => gen++); AppScope.read(context).refresh(); });

  Widget _bubble(J c, {bool request = false}) {
    final w = c['with'] == null ? null : asMap(c['with']);
    final name = c['kind'] == 'issue' ? str(c['topic']) : personName(w);
    final unread = num0(c['unread']);
    final cs = Theme.of(context).colorScheme;
    return Semantics(button: true, label: '$name${unread > 0 ? ', ${t('{n} unread', {'n': unread})}' : ''}${request ? ', ${t('message request')}' : ''}', excludeSemantics: true, child: InkWell(customBorder: const CircleBorder(), onTap: () => _thread(id: str(c['id']), conv: c),
        child: Stack(clipBehavior: Clip.none, children: [
          Container(width: 92, height: 92, padding: const EdgeInsets.all(8), decoration: BoxDecoration(shape: BoxShape.circle, color: cs.primary.withValues(alpha: .12), border: Border.all(color: cs.primary, width: 2)), alignment: Alignment.center,
              child: Text(name, textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: cs.primary))),
          if (unread > 0) Positioned(right: 0, top: 0, child: CircleAvatar(radius: 12, backgroundColor: C.red, child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)))),
        ])));
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return page(t('Inbox'), Loader<J>(key: ValueKey(gen), load: () async => asMap(await app.api.get('/inbox')), builder: (c, d, _) {
      final convs = asList(d['conversations']), reqs = asList(d['requests']);
      return ListView(padding: const EdgeInsets.all(16), children: [
        if (convs.isEmpty && reqs.isEmpty) EmptyState(t('No messages yet'), icon: Icons.mail_outline, text: t('Messages from admins and other Contributors appear here.')),
        Wrap(spacing: 12, runSpacing: 12, children: [for (final x in convs) _bubble(x)]),
        if (reqs.isNotEmpty) ...[Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text('${t('Requests')} · ${t('from people you do not follow')}', style: const TextStyle(fontWeight: FontWeight.w700))), Wrap(spacing: 12, runSpacing: 12, children: [for (final x in reqs) _bubble(x, request: true)])],
      ]);
    }), fab: app.isSuper ? null : FloatingActionButton.extended(onPressed: () => _thread(toAdmins: true), icon: const Icon(Icons.edit), label: Text(t('Message the admins'))));
  }
}

class ThreadPage extends StatefulWidget {
  final String? id;
  final J? conv, toUser;
  final bool toAdmins;
  const ThreadPage({super.key, this.id, this.conv, this.toAdmins = false, this.toUser});
  @override
  State<ThreadPage> createState() => _ThreadPageState();
}

class _ThreadPageState extends State<ThreadPage> {
  late String? id = widget.id;
  J? data;
  final ctl = TextEditingController(), topic = TextEditingController();
  final files = <J>[];
  bool busy = false;
  Timer? _poll;
  @override
  void initState() { super.initState(); _load(); _poll = Timer.periodic(const Duration(seconds: 12), (_) => _load()); }
  @override
  void dispose() { _poll?.cancel(); super.dispose(); }
  Future<void> _load() async {
    if (id == null) return;
    final api = AppScope.read(context).api;
    try { final d = asMap(await api.get('/inbox/$id')); if (!mounted) return; final n = asList(d['items']).length; if (n != asList(data?['items']).length) api.post('/inbox/$id/read').catchError((_) => null); setState(() => data = d); } catch (_) {}
  }
  Future<void> _send() async {
    if (ctl.text.trim().isEmpty && files.isEmpty) return;
    setState(() => busy = true);
    try {
      // Offline: the message is kept on the phone, shown as “Waiting to send”, and sent when the connection returns.
      final sent = await AppScope.read(context).outbox.send(t('Message'), 'POST', '/inbox', {
        if (id != null) 'conversationId': id, if (id == null && widget.toUser != null) 'toUserId': widget.toUser!['id'], if (id == null && widget.toAdmins) 'toAdmins': true, if (id == null && widget.toAdmins && topic.text.trim().isNotEmpty) 'topic': topic.text.trim(),
        if (ctl.text.trim().isNotEmpty) 'text': ctl.text.trim(), if (files.isNotEmpty) 'mediaIds': files.map((f) => f['id']).toList()});
      if (!mounted) return;
      if (sent == null) { toast(context, t('Waiting to send')); ctl.clear(); files.clear(); }
      else { final r = asMap(sent); ctl.clear(); files.clear(); id ??= str(r['conversationId']); await _load(); }
    } catch (e) { if (mounted) toast(context, errText(e), error: true); }
    if (mounted) setState(() => busy = false);
  }
  Future<void> _attach() async {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2560, imageQuality: 86);
    if (x == null || !mounted) return;
    final m = await run(context, () async => AppScope.read(context).api.uploadFile(LocalFile(x.path, x.name, await x.length()), 'message'));
    if (m != null && mounted) setState(() => files.add(m));
  }
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final cs = Theme.of(context).colorScheme;
    final w = widget.conv?['with'] == null ? widget.toUser : asMap(widget.conv!['with']);
    final title = widget.conv?['kind'] == 'issue' ? str(widget.conv!['topic']) : w != null ? personName(w) : widget.toAdmins ? t('New message to the admins') : str(asMap(data?['conversation'])['topic'], t('Conversation'));
    final isRequest = asMap(data?['conversation'])['isRequest'] == true;
    return page(title, Column(children: [
      Expanded(child: ListView(reverse: true, padding: const EdgeInsets.all(12), children: [
        for (final q in app.outbox.items.reversed.where((q) => q['path'] == '/inbox' && id != null && asMap(q['body'])['conversationId'] == id)) Align(alignment: Alignment.centerRight, child: Container(
            margin: const EdgeInsets.symmetric(vertical: 3), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .8),
            decoration: BoxDecoration(color: cs.primary.withValues(alpha: .55), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(asMap(q['body'])['text']), style: const TextStyle(color: Colors.white)),
              Text(t('Waiting to send'), style: const TextStyle(fontSize: 10.5, color: Colors.white70)),
            ]))),
        for (final m in asList(data?['items']).reversed) Align(alignment: m['system'] == true ? Alignment.center : m['mine'] == true ? Alignment.centerRight : Alignment.centerLeft, child: Container(
            margin: const EdgeInsets.symmetric(vertical: 3), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .8),
            decoration: BoxDecoration(color: m['system'] == true ? Colors.transparent : m['mine'] == true ? cs.primary : cs.primary.withValues(alpha: .12), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (m['mine'] != true && m['system'] != true && m['sender'] != null) Text('${personName(asMap(m['sender']))}${asMap(m['sender'])['badge'] != null ? ' · ${asMap(m['sender'])['badge']}' : ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
              if (str(m['text']).isNotEmpty) Text(str(m['text']), style: TextStyle(color: m['mine'] == true && m['system'] != true ? Colors.white : null, fontSize: m['system'] == true ? 12.5 : null)),
              for (final f in asList(m['files'])) f['kind'] == 'image' && asMap(f['urls'])['medium'] != null
                  ? Padding(padding: const EdgeInsets.only(top: 4), child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(app.api.abs(str(asMap(f['urls'])['medium'])), width: 200, semanticLabel: str(f['name']))))
                  : TextButton.icon(onPressed: () { final u = asMap(f['urls'])['original'] ?? asMap(f['urls'])['web']; if (u != null) launchUrl(Uri.parse(app.api.abs(str(u))), mode: LaunchMode.externalApplication); }, icon: const Icon(Icons.attach_file, size: 16), label: Text(str(f['name']))),
              if (m['system'] != true) Text('${ago(m['createdAt'])}${m['mine'] == true ? ' · ${m['seen'] == true ? t('Seen') : t('Sent')}' : ''}', style: TextStyle(fontSize: 10.5, color: m['mine'] == true ? Colors.white70 : null)),
            ]))),
      ])),
      if (isRequest) Padding(padding: const EdgeInsets.all(12), child: Note(t('This person is not someone you follow. Accept to reply, or decline to remove the request.'), child: Wrap(spacing: 8, children: [
        FilledButton(onPressed: () async { await run(context, () => app.api.post('/inbox/$id/accept')); _load(); }, child: Text(t('Accept'))),
        OutlinedButton(onPressed: () async { await run(context, () => app.api.post('/inbox/$id/decline')); if (context.mounted) Navigator.pop(context); }, child: Text(t('Decline'))),
      ])))
      else Padding(padding: const EdgeInsets.fromLTRB(8, 4, 8, 8), child: Column(children: [
        if (id == null && widget.toAdmins) Field(t('What is it about? (optional)'), topic),
        if (files.isNotEmpty) Wrap(spacing: 6, children: [for (final f in files) InputChip(label: Text(str(f['name'])), onDeleted: () => setState(() => files.remove(f)))]),
        Row(children: [
          IconButton(onPressed: _attach, icon: const Icon(Icons.attach_file), tooltip: t('Attach files')),
          Expanded(child: TextField(controller: ctl, minLines: 1, maxLines: 4, decoration: InputDecoration(hintText: t('Write a message')))),
          IconButton.filled(onPressed: busy ? null : _send, icon: const Icon(Icons.send), tooltip: t('Send')),
        ]),
      ])),
    ]), actions: [
      if (id != null && w?['id'] != null && w?['role'] != 'admin') IconButton(icon: const Icon(Icons.block), tooltip: t('Block'), onPressed: () async {
        final ok = await confirm(context, t('Block {name}?', {'name': personName(w)}), text: t('They will not be able to message you or interact with your stories, and you will not see theirs. You can unblock them in Settings.'), yes: t('Block'), danger: true);
        if (ok != null && context.mounted) { await run(context, () => app.api.put('/people/${w!['id']}/block', {'on': true}), ok: t('Blocked.')); if (context.mounted) Navigator.pop(context); }
      }),
    ]);
  }
}

// ---------- ANNOUNCEMENTS ----------
class AnnouncementsPage extends StatelessWidget {
  const AnnouncementsPage({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    return page(t('Announcements'), Loader<List<J>>(load: () async => asList(await app.api.get('/announcements')), builder: (c, list, _) => list.isEmpty ? EmptyState(t('No announcements yet'), icon: Icons.campaign) : ListView(padding: const EdgeInsets.all(10), children: [
      for (final a in list) Card(child: ExpansionTile(
          leading: a['unread'] == true ? const Icon(Icons.circle, size: 12, color: C.blue) : null,
          title: Text('${a['title']}${a['edited'] == true ? '  · ${t('Edited')}' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${fmtDate(a['sortAt'])}\n${str(a['summary'])}'),
          onExpansionChanged: (open) { if (open && a['unread'] == true && app.signedIn) app.api.post('/announcements/${a['id']}/read').then((_) => app.refresh()).catchError((_) => null); },
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14), expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: [Text(str(a['description'])), for (final d in asList(a['dates'])) ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: const Icon(Icons.event), title: Text('${fmtDate(d['date'])}${d['endDate'] != null ? ' – ${fmtDate(d['endDate'])}' : ''}'), subtitle: str(d['label']).isEmpty ? null : Text(str(d['label'])))])),
    ])));
  }
}

// ---------- MY PROFILE ----------
const storyStatus = {'draft': 'Draft', 'reviewing': 'Being checked', 'pending_review': 'Waiting for admin review', 'published': 'Published', 'blocked': 'Blocked', 'removed': 'Removed by an admin', 'awaiting_approval': 'Waiting for approval', 'awaiting_validation': 'Waiting for validation', 'deleted': 'Deleted'};

class ProfilePage extends StatelessWidget {
  final String? section;
  const ProfilePage({super.key, this.section});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final me = app.me;
    if (me == null) return page(t('My Profile'), EmptyState(t('Sign in to see your profile'), icon: Icons.person));
    final team = app.role != 'contributor';
    void go(String title, Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => page(title, w)));
    final tiles = <(IconData, String, VoidCallback)>[
      if (!team) (Icons.edit, t('Change my profile'), () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileSetupPage(editing: true)))),
      if (!app.isSuper) (Icons.auto_stories, t('My Stories'), () => go(t('My Stories'), const MyStories(drafts: false))),
      if (!app.isSuper) (Icons.edit_note, t('Drafts'), () => go(t('Drafts'), const MyStories(drafts: true))),
      if (!team) (Icons.event, t('Reminders'), () => go(t('Reminders'), const Reminders())),
      (Icons.notifications, t('Notifications'), () => go(t('Notifications'), const NotificationList())),
      (Icons.settings, t('Settings'), () => go(t('Settings'), const SettingsView())),
      if (team) (Icons.shield, t('Sign-in and security'), () => go(t('Sign-in and security'), const SecurityView())),
      (Icons.download, t('Download my data'), () => go(t('Download my data'), const MyData())),
      (Icons.feedback, t('Send feedback'), () => go(t('Send feedback'), const SingleChildScrollView(padding: EdgeInsets.all(18), child: FeedbackForm()))),
      (Icons.delete_forever, t('Delete account'), () => go(t('Delete account'), const DeleteAccount())),
    ];
    return page(t('My Profile'), ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [Avatar(me, size: 72), const SizedBox(width: 14), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(team ? str(me['name']) : '@${me['username'] ?? ''}', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        Text(team ? [asMap(me['admin'])['adminId'], me['email']].where((e) => str(e).isNotEmpty).join(' · ') : '${t('{n} stories', {'n': me['storyCount']})} · ${t('{n} followers', {'n': me['followers']})} · ${t('{n} following', {'n': me['following']})}', style: const TextStyle(fontSize: 12.5)),
      ]))]),
      if (team) Padding(padding: const EdgeInsets.only(top: 10), child: Note(t('Your admin name, Admin ID and profile image cannot be changed. You can change your verification email, password and second sign-in step under “Sign-in and security”.'))),
      if (num0(me['warnings']) > 0) Note(t('Your account has {n} warning(s) from the admins.', {'n': me['warnings']}), color: C.yellow),
      const SizedBox(height: 8),
      for (final (icon, label, onTap) in tiles) ListTile(leading: Icon(icon), title: Text(label), trailing: const Icon(Icons.chevron_right), onTap: onTap),
      const Divider(),
      ListTile(leading: const Icon(Icons.logout), title: Text(t('Sign out')), onTap: () async { await app.signOut(); if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst); }),
    ]));
  }
}

/// A story written on this phone and not yet sent (for example because the phone was offline).
class LocalDraftCard extends StatelessWidget {
  const LocalDraftCard({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final d = app.localDraft;
    if (d == null) return const SizedBox.shrink();
    final name = str(d['title']).isNotEmpty ? str(d['title']) : (str(d['text']).length > 60 ? str(d['text']).substring(0, 60) : str(d['text']));
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
      Text(d['waiting'] == true ? t('Waiting to send') : t('Saved on this device'), style: const TextStyle(fontSize: 12.5)),
      Row(children: [
        FilledButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ShareStoryPage())), child: Text(t('Continue'))), const SizedBox(width: 8),
        TextButton(onPressed: () => app.setLocalDraft(null), child: Text(t('Discard'))),
      ]),
    ])));
  }
}

/// Reactions, comments and messages made offline that have not been sent yet.
class WaitingList extends StatelessWidget {
  const WaitingList({super.key});
  @override
  Widget build(BuildContext context) {
    final box = AppScope.read(context).outbox;
    return ListenableBuilder(listenable: box, builder: (context, _) {
      final items = box.items;
      if (items.isEmpty) return const SizedBox.shrink();
      return Note('${t('Waiting to send')}: ${items.map((q) => str(q['label'])).join(', ')}');
    });
  }
}

class MyStories extends StatefulWidget {
  final bool drafts;
  const MyStories({super.key, required this.drafts});
  @override
  State<MyStories> createState() => _MyStoriesState();
}

class _MyStoriesState extends State<MyStories> {
  int gen = 0;
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    void edit(String? id) => Navigator.push(context, MaterialPageRoute(builder: (_) => ShareStoryPage(editId: id))).then((_) { if (mounted) setState(() => gen++); });
    return Loader<List<J>>(key: ValueKey(gen), load: () async => asList(await api.get('/me/stories', widget.drafts ? {'status': 'draft'} : null)).where((s) => (s['status'] == 'draft') == widget.drafts).toList(), builder: (c, list, reload) => ListView(padding: const EdgeInsets.all(12), children: [
      Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: () => edit(null), icon: const Icon(Icons.add), label: Text(t('Add a new story')))),
      if (widget.drafts) const LocalDraftCard(),
      if (widget.drafts) const WaitingList(),
      if (list.isEmpty) EmptyState(widget.drafts ? t('No drafts') : t('You have not shared a story yet'), icon: widget.drafts ? Icons.edit_note : Icons.waves, text: widget.drafts ? t('Unfinished stories you save appear here.') : null),
      for (final s in list) Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(str(s['title']).isNotEmpty ? str(s['title']) : (str(s['text']).length > 60 ? str(s['text']).substring(0, 60) : str(s['text'], t('Untitled draft'))), style: const TextStyle(fontWeight: FontWeight.w700))),
          if (const ['published', 'pending_review', 'draft'].contains(s['status'])) IconButton(icon: const Icon(Icons.edit), tooltip: widget.drafts ? t('Continue') : t('Edit story'), onPressed: () => edit(str(s['id']))),
          IconButton(icon: const Icon(Icons.delete_outline), tooltip: widget.drafts ? t('Delete draft') : t('Delete story'), onPressed: () async {
            final ok = await confirm(context, t('Delete this story? This cannot be undone.'), text: t('It is removed at once and erased permanently after 30 days.'), yes: t('Delete'), danger: true);
            if (ok != null && context.mounted) { await run(context, () => api.delete('/stories/${s['id']}'), ok: t('Story deleted.')); reload(); }
          }),
        ]),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [Text('${s['code']} · ${t(storyStatus[s['status']] ?? str(s['status']))} · ${fmtDate(s['publishedAt'] ?? s['createdAt'])}', style: const TextStyle(fontSize: 12)), if (asMap(s['moderation'])['aiFlag'] != null) FlagChip(str(asMap(s['moderation'])['aiFlag']))]),
        if (!widget.drafts) Padding(padding: const EdgeInsets.only(top: 6), child: Wrap(spacing: 12, children: [
          for (final (icon, k, label) in [(Icons.visibility, 'views', 'Views'), (Icons.favorite, 'hearts', 'Hearts'), (Icons.heart_broken, 'heartbreaks', 'Heartbreaks'), (Icons.sentiment_very_satisfied, 'laughs', 'Laughs'), (Icons.mode_comment, 'comments', 'Comments'), (Icons.ios_share, 'shares', 'Shares'), (Icons.star, 'favourites', 'Favorites'), (Icons.download, 'downloads', 'Downloads')])
            Semantics(label: '${t(label)}: ${num0(asMap(s['counts'])[k])}', excludeSemantics: true, child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 14), Text(' ${compact(num0(asMap(s['counts'])[k]))}', style: const TextStyle(fontSize: 12))])),
        ])),
        if (const ['removed', 'blocked'].contains(s['status']) || (s['status'] == 'pending_review' && asMap(s['moderation'])['aiFlag'] == 'RED')) Padding(padding: const EdgeInsets.only(top: 8), child: Note(
            '${s['status'] == 'removed' ? t('An admin removed this story.') : t('This story was blocked.')} ${str(asMap(s['moderation'])['removedReason'])} ${str(asMap(asMap(s['moderation'])['aiExplanation'])['summary'])}', color: C.red,
            child: Align(alignment: Alignment.centerLeft, child: OutlinedButton(onPressed: () => askWhy(context, str(s['id'])), child: Text(t('Ask Why')))))),
      ]))),
    ]));
  }
}

/// "Ask Why": the Contributor asks the admins about a removed or blocked story. The conversation continues in INBOX.
Future<void> askWhy(BuildContext context, String storyId) {
  final subject = TextEditingController(), q = TextEditingController();
  return sheet<void>(context, t('Ask Why'), (c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(t('Your question goes to the admins. Their reply arrives in your INBOX.')), const SizedBox(height: 10),
        Field(t('Subject (optional)'), subject), Field(t('Your question'), q, lines: 4),
        FilledButton(onPressed: () async {
          if (q.text.trim().length < 3) return;
          final r = await run(c, () => AppScope.read(c).api.post('/stories/$storyId/ask-why', {if (subject.text.trim().isNotEmpty) 'subject': subject.text.trim(), 'description': q.text.trim()}), ok: t('Sent. The admins will reply in your INBOX.'));
          if (r != null && c.mounted) Navigator.pop(c);
        }, child: Text(t('Send'))),
      ]));
}

class Reminders extends StatefulWidget {
  const Reminders({super.key});
  @override
  State<Reminders> createState() => _RemindersState();
}

class _RemindersState extends State<Reminders> {
  int gen = 0;
  Future<void> _edit([J? r]) async {
    final subject = TextEditingController(text: str(r?['subject'])), details = TextEditingController(text: str(r?['description']));
    var due = DateTime.tryParse(str(r?['dueAt']))?.toLocal() ?? DateTime.now().add(const Duration(days: 1));
    final api = AppScope.read(context).api;
    await sheet<void>(context, r == null ? t('New reminder') : t('Edit reminder'), (c) => StatefulBuilder(builder: (c, set) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Field(t('Subject'), subject), Field(t('Details (optional)'), details, lines: 3),
          OutlinedButton.icon(icon: const Icon(Icons.event), label: Text('${t('When')}: ${fmtDate(due.toIso8601String(), time: true)}'), onPressed: () async {
            final d = await showDatePicker(context: c, initialDate: due, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 3650)));
            if (d == null || !c.mounted) return;
            final tm = await showTimePicker(context: c, initialTime: TimeOfDay.fromDateTime(due));
            set(() => due = DateTime(d.year, d.month, d.day, tm?.hour ?? due.hour, tm?.minute ?? due.minute));
          }),
          const SizedBox(height: 10),
          FilledButton(onPressed: () async {
            if (subject.text.trim().isEmpty) return;
            final body = {'subject': subject.text.trim(), if (details.text.trim().isNotEmpty) 'description': details.text.trim(), 'dueAt': due.toUtc().toIso8601String()};
            final ok = await run(c, () => r == null ? api.post('/me/reminders', body) : api.patch('/me/reminders/${r['id']}', body), ok: t('Reminder saved.'));
            if (ok != null && c.mounted) Navigator.pop(c);
          }, child: Text(t('Save'))),
        ])));
    if (mounted) setState(() => gen++);
  }
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return Loader<List<J>>(key: ValueKey(gen), load: () async => asList(await api.get('/me/reminders')), builder: (c, list, reload) => ListView(padding: const EdgeInsets.all(12), children: [
      Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: _edit, icon: const Icon(Icons.add), label: Text(t('New reminder')))),
      if (list.isEmpty) EmptyState(t('No reminders'), icon: Icons.event),
      for (final r in list) CheckboxListTile(controlAffinity: ListTileControlAffinity.leading, value: r['doneAt'] != null, onChanged: (v) async { await run(context, () => api.put('/me/reminders/${r['id']}/done', {'on': v == true})); reload(); },
          title: Text(str(r['subject']), style: TextStyle(fontWeight: FontWeight.w700, decoration: r['doneAt'] != null ? TextDecoration.lineThrough : null)), subtitle: Text('${fmtDate(r['dueAt'], time: true)}${str(r['description']).isEmpty ? '' : '\n${r['description']}'}'),
          secondary: PopupMenuButton<String>(onSelected: (k) async { if (k == 'edit') { _edit(r); } else { await run(context, () => api.delete('/me/reminders/${r['id']}')); reload(); } }, itemBuilder: (_) => [PopupMenuItem(value: 'edit', child: Text(t('Edit'))), PopupMenuItem(value: 'delete', child: Text(t('Delete')))])),
    ]));
  }
}

class NotificationList extends StatelessWidget {
  const NotificationList({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    return Loader<J>(load: () async => asMap(await app.api.get('/me/notifications')), builder: (c, d, reload) {
      final items = asList(d['items']);
      return ListView(padding: const EdgeInsets.all(8), children: [
        if (items.any((n) => n['readAt'] == null)) Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () async { await run(context, () => app.api.post('/me/notifications/read')); app.refresh(); reload(); }, child: Text(t('Mark all as read')))),
        if (items.isEmpty) EmptyState(t('Nothing new'), icon: Icons.notifications_none),
        for (final n in items) ListTile(leading: Icon(n['readAt'] == null ? Icons.circle : Icons.circle_outlined, size: 12, color: C.blue), title: Text(str(n['title']), style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('${str(n['body'])}\n${ago(n['createdAt'])}${n['priority'] == true && n['doneAt'] == null ? ' · ${t('Needs your action')}' : ''}'), isThreeLine: true,
            onTap: () { app.api.post('/me/notifications/${n['id']}/read').then((_) => app.refresh()).catchError((_) => null); reload(); }),
      ]);
    });
  }
}

class SettingsView extends StatelessWidget {
  const SettingsView({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final s = app.settings;
    final notif = asMap(s['notifications']), quiet = asMap(s['quietHours']);
    Future<void> set(J patch) async { try { await app.saveSettings(patch); } catch (e) { if (context.mounted) toast(context, errText(e), error: true); } }
    Widget sw(String label, String key) => SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(label), value: s[key] == true, onChanged: (v) => set({key: v}));
    Future<void> pickTime(String which) async {
      final parts = str(quiet[which], which == 'from' ? '22:00' : '07:00').split(':');
      final tm = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 22, minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0));
      if (tm != null) await set({'quietHours': {...quiet, which: '${tm.hour.toString().padLeft(2, '0')}:${tm.minute.toString().padLeft(2, '0')}'}});
    }
    return ListView(padding: const EdgeInsets.all(14), children: [
      Section(t('Appearance'), [
        Choice<String>(t('Theme'), app.theme, {'auto': t('Auto (follow my device)'), 'light': t('Light'), 'dark': t('Dark')}, (v) => set({'theme': v})),
        Choice<String>(t('Text size'), str(s['textSize'], 'medium'), {'small': t('Small'), 'medium': t('Medium'), 'large': t('Large'), 'xlarge': t('Extra large')}, (v) => set({'textSize': v})),
        Choice<String>(t('Language'), I18n.code, I18n.launch, (v) => set({'language': v})),
        sw(t('High contrast'), 'highContrast'), sw(t('Reduce motion (fewer animations)'), 'reducedMotion'),
      ]),
      if (app.isTeam) Section(t('App lock'), [
        SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(t('Unlock with fingerprint or face')),
          subtitle: Text(t('Asks for your fingerprint, face or screen lock when the app opens, and after a minute away.')), value: app.bioLock,
          onChanged: (v) async { final ok = await app.setBioLock(v, t('Confirm it is you')); if (!ok && context.mounted) toast(context, t('Set up a fingerprint, face or screen lock on this phone first.'), error: true); }),
      ]),
      Section(t('Hints'), [
        Text(t('A short guide to browsing, reacting, commenting and sharing a story.')),
        Align(alignment: Alignment.centerLeft, child: OutlinedButton(onPressed: () { app.startGuide(again: true); Navigator.of(context).popUntil((r) => r.isFirst); }, child: Text(t('Show the hints again')))),
      ]),
      Section(t('Data and connection'), [sw(t('Low-data mode: pictures and video load only when I select them'), 'lowData'), sw(t('Upload only on Wi-Fi (apps)'), 'wifiOnly'), sw(t('Read receipts in messages'), 'readReceipts')]),
      Section(t('Notifications'), [
        for (final (k, label) in [('engagement', t('Reactions, comments, mentions and follows')), ('messages', t('Messages')), ('announcements', t('Announcements')), ('reminders', t('Reminders'))]) Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          Wrap(spacing: 6, children: [for (final (ch, name) in [('inApp', t('In the app')), ('push', t('Push')), ('email', t('Email'))]) FilterChip(label: Text(name), selected: asMap(notif[k])[ch] == true, onSelected: (v) => set({'notifications': {...notif, k: {...asMap(notif[k]), ch: v}}}))]),
          const SizedBox(height: 6),
        ]),
        Row(children: [Expanded(child: OutlinedButton(onPressed: () => pickTime('from'), child: Text('${t('Quiet hours from')} ${str(quiet['from'])}'))), const SizedBox(width: 8), Expanded(child: OutlinedButton(onPressed: () => pickTime('to'), child: Text('${t('Quiet hours to')} ${str(quiet['to'])}')))]),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text(t('During quiet hours nothing is pushed to your devices; it waits in the app.'), style: const TextStyle(fontSize: 12))),
      ]),
      if (!app.isSuper) Section(t('Blocked and muted users'), [
        Loader<List<J>>(load: () async => asList(await app.api.get('/me/blocked')), builder: (c, list, reload) => list.isEmpty ? Text(t('You have not blocked or muted anyone.')) : Column(children: [
          for (final b in list) ListTile(contentPadding: EdgeInsets.zero, leading: Avatar(asMap(b['person']), size: 32), title: Text(personName(asMap(b['person']))), subtitle: Text(b['kind'] == 'mute' ? t('Muted') : t('Blocked')),
              trailing: TextButton(onPressed: () async { await run(context, () => app.api.put('/people/${asMap(b['person'])['id']}/${b['kind'] == 'mute' ? 'mute' : 'block'}', {'on': false})); reload(); }, child: Text(b['kind'] == 'mute' ? t('Unmute') : t('Unblock')))),
        ])),
      ]),
    ]);
  }
}

class SecurityView extends StatefulWidget {
  const SecurityView({super.key});
  @override
  State<SecurityView> createState() => _SecurityViewState();
}

class _SecurityViewState extends State<SecurityView> {
  final cur = TextEditingController(), nw = TextEditingController(), again = TextEditingController(), email = TextEditingController(), emailPw = TextEditingController(), code = TextEditingController(), totp = TextEditingController();
  bool emailSent = false;
  J? setup;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final has = asMap(app.me?['admin'])['mfaAuthenticator'] == true;
    return ListView(padding: const EdgeInsets.all(14), children: [
      Section(t('Second sign-in step'), [
        Text('${t('A code by email is always available.')} ${has ? t('Your authenticator app is set up.') : t('An authenticator app is quicker and works without a connection.')}'), const SizedBox(height: 8),
        if (has) ...[Field(t('Your password'), totp, obscure: true), OutlinedButton(onPressed: () async { final r = await run(context, () => app.api.post('/auth/admin/mfa/authenticator/remove', {'password': totp.text})); if (r != null) { totp.clear(); app.reloadMe(); } }, child: Text(t('Remove the authenticator app')))]
        else if (setup == null) FilledButton(onPressed: () async { final r = await run(context, () async => asMap(await app.api.post('/auth/admin/mfa/authenticator'))); if (r != null) setState(() => setup = r); }, child: Text(t('Set up an authenticator app')))
        else ...[
          Text(t('Add this key to your authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit code it shows.')),
          SelectableText(str(setup!['secret']), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          Row(children: [TextButton(onPressed: () { Clipboard.setData(ClipboardData(text: str(setup!['secret']))); toast(context, t('Copied.')); }, child: Text(t('Copy'))), TextButton(onPressed: () => launchUrl(Uri.parse(str(setup!['otpauthUrl']))), child: Text(t('Open in my authenticator app')))]),
          Field(t('6-digit code'), totp, type: TextInputType.number),
          FilledButton(onPressed: () async { final r = await run(context, () => app.api.post('/auth/admin/mfa/authenticator/confirm', {'code': totp.text.trim()})); if (r != null) { setState(() => setup = null); totp.clear(); app.reloadMe(); } }, child: Text(t('Confirm'))),
        ],
      ]),
      Section(t('Change password'), [
        Field(t('Current password'), cur, obscure: true), Field(t('New password'), nw, obscure: true), Field(t('New password again'), again, obscure: true),
        FilledButton(onPressed: () async { if (nw.text != again.text) { toast(context, t('The two passwords do not match.'), error: true); return; } final r = await run(context, () => app.api.patch('/auth/admin/password', {'currentPassword': cur.text, 'newPassword': nw.text}), ok: t('Password changed.')); if (r != null) { cur.clear(); nw.clear(); again.clear(); } }, child: Text(t('Change password'))),
      ]),
      Section(t('Change verification email'), [
        Text('${t('Current')}: ${app.me?['email']}'), const SizedBox(height: 8),
        if (!emailSent) ...[Field(t('New email'), email, type: TextInputType.emailAddress), Field(t('Your password'), emailPw, obscure: true),
          FilledButton(onPressed: () async { final r = await run(context, () => app.api.post('/auth/admin/email', {'email': email.text.trim(), 'password': emailPw.text}), ok: t('We sent a code to the new address.')); if (r != null) setState(() => emailSent = true); }, child: Text(t('Send a code to the new address')))]
        else ...[Field(t('Code from the new address'), code, type: TextInputType.number),
          FilledButton(onPressed: () async { final r = await run(context, () => app.api.post('/auth/admin/email/confirm', {'code': code.text.trim()})); if (r != null) { setState(() => emailSent = false); app.reloadMe(); } }, child: Text(t('Confirm')))],
      ]),
      Section(t('Where I am signed in'), [
        Loader<List<J>>(load: () async => asList(await app.api.get('/auth/sessions')), builder: (c, list, reload) => Column(children: [
          for (final s in list) ListTile(contentPadding: EdgeInsets.zero, dense: true, title: Text(str(s['userAgent'], t('Unknown device')), maxLines: 1, overflow: TextOverflow.ellipsis), subtitle: Text('${s['ip']} · ${fmtDate(s['createdAt'])}${s['current'] == true ? ' · ${t('this device')}' : ''}'),
              trailing: s['current'] == true ? null : TextButton(onPressed: () async { await run(context, () => app.api.delete('/auth/sessions/${s['id']}')); reload(); }, child: Text(t('Sign out')))),
          OutlinedButton(onPressed: () async { await run(context, () => app.api.post('/auth/sessions/end-all'), ok: t('Signed out everywhere else.')); reload(); }, child: Text(t('Sign out everywhere else'))),
        ])),
      ]),
    ]);
  }
}

class MyData extends StatefulWidget {
  const MyData({super.key});
  @override
  State<MyData> createState() => _MyDataState();
}

class _MyDataState extends State<MyData> {
  int gen = 0;
  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text(t('Get a ZIP file with all your stories, comments and profile data.')), const SizedBox(height: 10),
      FilledButton.icon(onPressed: () async { await run(context, () => api.post('/me/export')); setState(() => gen++); }, icon: const Icon(Icons.download), label: Text(t('Prepare my data'))),
      Loader<List<J>>(key: ValueKey(gen), load: () async => asList(await api.get('/me/exports')), builder: (c, list, reload) => Column(children: [
        for (final e in list) ListTile(contentPadding: EdgeInsets.zero, title: Text(fmtDate(e['createdAt'], time: true)),
            trailing: e['status'] == 'ready' && e['url'] != null ? FilledButton(onPressed: () => launchUrl(Uri.parse(api.abs(str(e['url']))), mode: LaunchMode.externalApplication), child: Text(t('Download'))) : e['status'] == 'preparing' ? TextButton(onPressed: reload, child: Text(t('Preparing…'))) : Text(t(e['status'] == 'expired' ? 'Expired' : 'Failed'))),
      ])),
    ]);
  }
}

class DeleteAccount extends StatefulWidget {
  const DeleteAccount({super.key});
  @override
  State<DeleteAccount> createState() => _DeleteAccountState();
}

class _DeleteAccountState extends State<DeleteAccount> {
  String? reason;
  final other = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return ListView(padding: const EdgeInsets.all(16), children: [
      Note(t('Your account and content will be removed at once and permanently erased after 30 days. To restore it, sign in again within 30 days.'), color: C.yellow),
      Text(t('Why are you leaving? Pick one.'), style: const TextStyle(fontWeight: FontWeight.w700)),
      for (final r in asList(app.config['deletionReasons'])) RadioListTile<String>(contentPadding: EdgeInsets.zero, dense: true, value: str(r['key']), groupValue: reason, onChanged: (v) => setState(() => reason = v), title: Text(str(r['label']))),
      Field(t('Or tell us in your own words (optional)'), other, lines: 2),
      FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: C.red), icon: const Icon(Icons.delete_forever), label: Text(t('DELETE ACCOUNT')), onPressed: reason == null && other.text.trim().isEmpty ? null : () async {
        final ok = await confirm(context, t('Delete your account?'), text: t('Your account is removed at once and permanently erased after 30 days.'), yes: t('Delete my account'), danger: true);
        if (ok == null || !context.mounted) return;
        final r = await run(context, () => app.api.post('/me/delete', {if (reason != null) 'reason': reason, if (other.text.trim().isNotEmpty) 'otherReason': other.text.trim()}), ok: t('Your account was deleted.'));
        if (r != null) { await app.signOut(); if (context.mounted) Navigator.of(context).popUntil((x) => x.isFirst); }
      }),
    ]);
  }
}
