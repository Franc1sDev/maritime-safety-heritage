import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'api.dart';
import 'core.dart';
import 'pages.dart';
import 'stories.dart';

class _Slot {
  final String name, kind;
  /// The upload in progress, for a file added now; null for a file the story already had.
  final UploadTask? task;
  final J? _had;
  bool consentForm = false;
  _Slot(this.name, this.kind, {this.task, J? media}) : _had = media;
  double get pct => task?.pct ?? 1;
  String? get error => task?.state == 'failed' ? (task!.error ?? '') : null;
  J? get media => _had ?? task?.media;
}

String? _kindOf(String name) {
  final e = name.toLowerCase().split('.').last;
  if (const ['mp4', 'mov', 'webm', 'mkv', '3gp', 'm4v'].contains(e)) return 'video';
  if (const ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'amr'].contains(e)) return 'audio';
  if (const ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].contains(e)) return 'image';
  if (const ['pdf', 'doc', 'docx', 'odt', 'txt', 'rtf'].contains(e)) return 'document';
  return null;
}

/// The share-story screen: text and files (with in-app recording), story details and posting options, then AI review.
class ShareStoryPage extends StatefulWidget {
  final String? editId;
  final bool company;
  const ShareStoryPage({super.key, this.editId, this.company = false});
  @override
  State<ShareStoryPage> createState() => _ShareStoryPageState();
}

class _ShareStoryPageState extends State<ShareStoryPage> {
  final title = TextEditingController(), text = TextEditingController(), placeName = TextEditingController(), year = TextEditingController(), vessel = TextEditingController(), tags = TextEditingController(), toldBy = TextEditingController(),
      suggestTitle = TextEditingController(), suggestDetails = TextEditingController(), storyteller = TextEditingController();
  final source = {for (final k in ['institution', 'reference', 'originalDate', 'creator', 'rightsStatement', 'obtained']) k: TextEditingController()};
  final slots = <_Slot>[];
  late final Uploads _uploads;
  late final AppState _app;
  bool _handedOver = false;
  // The story is also kept on the phone while it is being written, so a dropped connection or a closed app never loses it.
  Timer? _autosave;
  String _kept = '';
  bool _sent = false;
  final _sendKey = Api.newKey();
  bool get _isNew => widget.editId == null && !widget.company;
  String language = I18n.code, category = '', postedAs = 'self', rights = 'All rights reserved', type = 'community', consentType = 'written';
  int? placeId;
  LatLng? pos;
  DateTime? eventDate;
  bool approx = false, consent = false, allowDownload = true, sensitive = false, validated = false, showMap = false, wasPublished = false, loading = false;
  String? incidentId, incidentTitle, draftId, busy;
  List<String> errors = [];
  J? review;
  DateTime? reviewStart;
  Timer? _poll;
  final recorder = AudioRecorder();
  bool recording = false;
  int recSeconds = 0;
  Timer? _recTimer;

  AppState get app => AppScope.read(context);
  J get limits => asMap(app.config['limits']);
  int max(String k) => k == 'image' ? num0(limits['images'] ?? 20) : k == 'document' ? num0(limits['documents'] ?? 4) : 1;
  int maxMb(String k) => num0(limits['${k}Mb'] ?? (k == 'video' ? 200 : k == 'audio' ? 100 : 25));
  int count(String k) => slots.where((s) => s.kind == k && s.error == null).length;
  bool get uploading => slots.any((s) => s.media == null && s.error == null);

  @override
  void initState() {
    super.initState();
    _app = AppScope.read(context);
    _uploads = _app.uploads..addListener(_onUploads);
    if (_isNew) {
      final d = _app.localDraft;
      if (d != null) _restoreLocal(d);
      _autosave = Timer.periodic(const Duration(seconds: 5), (_) => _keepLocal());
    }
    if (widget.company) postedAs = 'company';
    draftId = widget.editId;
    if (widget.editId != null) _loadExisting();
  }
  @override
  void dispose() {
    _autosave?.cancel();
    _keepLocal();
    _uploads.removeListener(_onUploads);
    // Leaving without sending: uploads nobody is waiting for are stopped.
    if (!_handedOver) { for (final s in slots) { if (s.task != null && s.task!.active) _uploads.cancel(s.task!); } }
    _poll?.cancel(); _recTimer?.cancel(); recorder.dispose(); super.dispose();
  }

  Future<void> _loadExisting() async {
    setState(() => loading = true);
    try {
      final s = asMap(await app.api.get('/stories/${widget.editId}'));
      final p = asMap(s['place']);
      title.text = str(s['title']); text.text = str(s['text']); placeName.text = str(p['name']); vessel.text = str(s['vessel']); tags.text = (s['tags'] as List? ?? const []).join(', '); toldBy.text = str(s['toldBy']);
      setState(() {
        wasPublished = s['status'] != 'draft'; language = str(s['language'], 'en'); category = str(s['category']); postedAs = str(s['postedAs'], 'self'); rights = str(s['rights'], rights); type = str(s['type'], 'community');
        placeId = p['id'] as int?; if (p['latitude'] != null) pos = LatLng((p['latitude'] as num).toDouble(), (p['longitude'] as num).toDouble());
        approx = s['dateApproximate'] == true; if (s['eventDate'] != null) { if (approx) { year.text = str(s['eventDate']).substring(0, 4); } else { eventDate = DateTime.tryParse(str(s['eventDate'])); } }
        consent = postedAs == 'told_by'; allowDownload = s['allowDownload'] != false; sensitive = s['sensitive'] == true;
        if (s['incident'] != null) { incidentId = str(asMap(s['incident'])['id']); incidentTitle = str(asMap(s['incident'])['title']); }
        for (final m in asList(s['media'])) { slots.add(_Slot(str(m['name']), str(m['kind']), media: m)); }
        loading = false;
      });
    } catch (e) { if (mounted) { toast(context, errText(e), error: true); Navigator.pop(context); } }
  }

  // ---- kept on this phone ----
  J _local(bool waiting) => {'title': title.text, 'text': text.text, 'placeName': placeName.text, 'vessel': vessel.text, 'tags': tags.text, 'toldBy': toldBy.text, 'language': language, 'category': category,
    'postedAs': postedAs, 'rights': rights, 'approx': approx, 'year': year.text, 'eventDate': eventDate?.toIso8601String(), 'allowDownload': allowDownload, 'sensitive': sensitive, 'waiting': waiting};
  void _restoreLocal(J d) {
    title.text = str(d['title']); text.text = str(d['text']); placeName.text = str(d['placeName']); vessel.text = str(d['vessel']); tags.text = str(d['tags']); toldBy.text = str(d['toldBy']); year.text = str(d['year']);
    language = str(d['language'], language); category = str(d['category']); rights = str(d['rights'], rights);
    if (const ['self', 'anonymous', 'told_by'].contains(d['postedAs'])) postedAs = str(d['postedAs']);
    approx = d['approx'] == true; eventDate = DateTime.tryParse(str(d['eventDate'])); allowDownload = d['allowDownload'] != false; sensitive = d['sensitive'] == true;
    _kept = jsonEncode(_local(d['waiting'] == true));
  }
  /// Keeps what has been written so far. Not used once the story is on the account (as a draft or sent).
  void _keepLocal({bool? waiting}) {
    if (!_isNew || _sent || draftId != null) return;
    if (title.text.trim().isEmpty && text.text.trim().isEmpty) return;
    final d = _local(waiting ?? (_app.localDraft?['waiting'] == true));
    final now = jsonEncode(d);
    if (now == _kept) return;
    _kept = now;
    _app.setLocalDraft(d);
  }
  /// Offline while saving or sending: the words are kept on the phone and offered again when the connection returns.
  String _offline(bool draft) {
    _keepLocal(waiting: !draft);
    if (draft) return t('You are offline. Your draft is saved on this device.');
    return '${t('You are offline. Your story will be sent when you are back online.')} ${slots.isEmpty ? '' : t('Files will need to be added again.')}'.trim();
  }
  void _onAccount() { if (_isNew) { _sent = true; _app.setLocalDraft(null); } }

  // ---- files ----
  Future<void> _add(String path, String name, int size) async {
    final kind = _kindOf(name);
    if (kind == null) { setState(() => errors = [t('“{name}”: this file type is not supported.', {'name': name})]); return; }
    if (count(kind) >= max(kind)) { setState(() => errors = [kind == 'image' ? t('You can add up to {n} images.', {'n': max(kind)}) : kind == 'document' ? t('You can add up to {n} documents.', {'n': max(kind)}) : kind == 'video' ? t('A story can have one video.') : t('A story can have one audio file.')]); return; }
    if (size > maxMb(kind) * 1048576) { setState(() => errors = ['“$name”: ${t('This file is too large. The maximum for {kind} is {max} MB.', {'kind': t(kind == 'video' ? 'a video' : kind == 'audio' ? 'an audio file' : kind == 'image' ? 'an image' : 'a document'), 'max': maxMb(kind)})}']); return; }
    // The upload belongs to the app, not to this form: it can be paused, waits for Wi-Fi if asked, and carries on while browsing.
    final slot = _Slot(name, kind, task: _uploads.add(LocalFile(path, name, size), 'story'));
    setState(() { slots.add(slot); errors = []; });
  }
  void _remove(_Slot sl) { if (sl.task != null) _uploads.cancel(sl.task!); setState(() => slots.remove(sl)); }
  void _onUploads() { if (mounted) setState(() {}); }

  /// SEND while files are still uploading: the story is kept as a draft on the account, and sent as soon as the files arrive.
  Future<void> _sendLater() async {
    setState(() => busy = 'send');
    final api = app.api;
    final wasPub = wasPublished;
    try {
      if (!wasPub) {
        final d = draftId != null ? asMap(await api.patch('/stories/$draftId', _payload(true))) : asMap(await api.post('/stories', _payload(true), _sendKey));
        draftId = str(d['id']);
        _onAccount();
      }
    } on ApiError catch (e) {
      if (mounted) setState(() { busy = null; errors = [e.status == 0 ? _offline(false) : '${e.message} ${str(asMap(e.details)['reason'])}'.trim()]; });
      return;
    }
    final id = draftId!;
    final mine = List<_Slot>.of(slots);
    final base = _payload(!wasPub);
    final name = title.text.trim().isEmpty ? t('Your story') : title.text.trim();
    J full() {
      final form = mine.where((s) => s.consentForm && s.media != null).toList();
      return {...base, 'mediaIds': mine.where((s) => s.media != null && !s.consentForm).map((s) => s.media!['id']).toList(), if (form.isNotEmpty) 'consentFormMediaId': form.first.media!['id']};
    }
    _handedOver = true;
    _uploads.sendWhenReady(PendingSend(name, mine.map((s) => s.task).whereType<UploadTask>().toList(), () async {
      var s = asMap(await api.patch('/stories/$id', full()));
      if (!wasPub) s = asMap(await api.post('/stories/$id/submit'));
      return str(s['message'], t('Your story was sent and is being checked.'));
    }));
    if (!mounted) return;
    toast(context, t('Your story will be sent when the files finish uploading. You can keep browsing.'));
    Navigator.pop(context);
  }

  Future<void> _pick(String kind, {bool camera = false}) async {
    try {
      final picker = ImagePicker();
      if (kind == 'image') {
        // Photos are made smaller on the phone before they are sent.
        final list = camera ? [await picker.pickImage(source: ImageSource.camera, maxWidth: 2560, imageQuality: 86)].whereType<XFile>().toList() : await picker.pickMultiImage(maxWidth: 2560, imageQuality: 86);
        for (final x in list) { await _add(x.path, x.name, await x.length()); }
      } else if (kind == 'video') {
        final x = await picker.pickVideo(source: camera ? ImageSource.camera : ImageSource.gallery, maxDuration: Duration(minutes: num0(limits['videoMinutes'] ?? 5)));
        if (x != null) await _add(x.path, x.name, await x.length());
      } else {
        final r = await FilePicker.platform.pickFiles(allowMultiple: kind == 'document', type: FileType.custom, allowedExtensions: kind == 'audio' ? const ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus'] : const ['pdf', 'doc', 'docx', 'odt', 'txt', 'rtf']);
        for (final f in r?.files ?? const <PlatformFile>[]) { if (f.path != null) await _add(f.path!, f.name, f.size); }
      }
    } catch (_) { if (mounted) toast(context, t('We could not use the microphone or camera. Check the permission in your browser.'), error: true); }
  }

  // Voice-first sharing: the recording becomes the story's audio and is transcribed after it is sent.
  Future<void> _record() async {
    if (recording) {
      _recTimer?.cancel();
      final path = await recorder.stop();
      setState(() => recording = false);
      if (path != null) { final f = File(path); await _add(path, 'voice-recording-${DateTime.now().millisecondsSinceEpoch}.m4a', await f.length()); }
      return;
    }
    if (count('audio') >= 1) { setState(() => errors = [t('A story can have one audio file.')]); return; }
    try {
      if (!await recorder.hasPermission()) throw Exception('permission');
      final dir = await getTemporaryDirectory();
      await recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000), path: '${dir.path}/rec-${DateTime.now().millisecondsSinceEpoch}.m4a');
      setState(() { recording = true; recSeconds = 0; });
      _recTimer = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => recSeconds++); });
    } catch (_) { if (mounted) toast(context, t('We could not use the microphone or camera. Check the permission in your browser.'), error: true); }
  }

  // ---- saving ----
  J _payload(bool draft) {
    final isAdmin = app.isAdmin;
    final ev = approx ? (RegExp(r'^\d{4}$').hasMatch(year.text.trim()) ? '${year.text.trim()}-01-01' : null) : eventDate?.toIso8601String().substring(0, 10);
    final consentSlot = slots.where((s) => s.consentForm && s.media != null).toList();
    return {
      'title': title.text.trim(), 'text': text.text, 'language': language, 'mediaIds': slots.where((s) => s.media != null && !s.consentForm).map((s) => s.media!['id']).toList(),
      'placeId': placeId, 'placeName': placeName.text.trim(), 'latitude': pos?.latitude, 'longitude': pos?.longitude, 'eventDate': ev, 'dateApproximate': approx, 'category': category, 'vessel': vessel.text.trim(),
      'tags': tags.text.split(RegExp(r'[,#\n]')).map((x) => x.trim()).where((x) => x.isNotEmpty).take(10).toList(), 'incidentId': incidentId, 'postedAs': postedAs, 'toldBy': postedAs == 'told_by' ? toldBy.text.trim() : '',
      if (postedAs == 'told_by') 'consentConfirmed': consent, if (consentSlot.isNotEmpty) 'consentFormMediaId': consentSlot.first.media!['id'],
      'rights': rights, 'allowDownload': allowDownload, 'sensitive': sensitive, 'draft': draft,
      if (incidentId == null && suggestTitle.text.trim().length >= 3) 'suggestIncident': {'title': suggestTitle.text.trim(), if (suggestDetails.text.trim().isNotEmpty) 'details': suggestDetails.text.trim()},
      if (isAdmin) 'type': type,
      if (isAdmin && type == 'record') 'source': {for (final e in source.entries) e.key: e.value.text.trim()},
      if (isAdmin && type == 'testimony') 'consent': {'storyteller': storyteller.text.trim(), 'consentType': consentType, 'validated': validated},
    };
  }

  Future<void> _save(bool draft) async {
    final errs = <String>[];
    if (!draft) {
      if (text.text.trim().isEmpty && !slots.any((s) => s.error == null)) errs.add(t('Add text or at least one file before sending.'));
      if (postedAs == 'told_by' && (toldBy.text.trim().isEmpty || !consent)) errs.add(t('Confirm that the person whose story this is has agreed to it being shared.'));
    }
    if (uploading && draft) errs.add(t('Wait for the files to finish uploading.'));
    setState(() => errors = errs);
    if (errs.isNotEmpty) return;
    if (uploading) { await _sendLater(); return; }
    setState(() => busy = draft ? 'draft' : 'send');
    try {
      J s;
      if (draftId != null) {
        s = asMap(await app.api.patch('/stories/$draftId', _payload(draft || !wasPublished)));
        if (!draft && !wasPublished) s = asMap(await app.api.post('/stories/$draftId/submit'));
      } else { s = asMap(await app.api.post('/stories', _payload(draft), _sendKey)); }
      draftId = str(s['id']);
      _onAccount();
      if (!mounted) return;
      if (draft) { toast(context, str(s['message'], t('Draft saved.'))); setState(() => busy = null); return; }
      final mod = asMap(s['moderation']);
      final checking = s['status'] == 'reviewing' || (wasPublished && mod['pendingEdit'] == true);
      setState(() { busy = null; reviewStart = DateTime.now(); review = {'id': s['id'], 'done': !checking, 'flag': checking ? null : mod['aiFlag'], 'message': s['message'] ?? (checking ? t('Checking your story… This takes up to 3 minutes.') : t('Submitted for approval.')), 'explanation': mod['aiExplanation'], 'status': s['status']}; });
      if (checking) _poll = Timer.periodic(const Duration(seconds: 3), (_) async { try { final r = asMap(await app.api.get('/stories/${s['id']}/review')); if (!mounted) return; setState(() => review = {...review!, ...r}); if (r['done'] == true) _poll?.cancel(); } catch (_) {} });
    } on ApiError catch (e) {
      if (mounted) setState(() { busy = null; errors = [e.status == 0 ? _offline(draft) : '${e.message} ${str(asMap(e.details)['reason'])}'.trim()]; });
    }
  }

  Future<void> _suggest() async {
    if (text.text.trim().length < 40) { toast(context, t('Write a little more first, then ask for suggestions.')); return; }
    final r = await run(context, () async => asMap(await app.api.post('/stories/suggest', {'text': text.text})));
    if (r == null || !mounted) return;
    setState(() { if (category.isEmpty) category = str(r['category']); if (tags.text.isEmpty) tags.text = (r['tags'] as List? ?? const []).join(', '); if (str(r['language']).isNotEmpty) language = str(r['language']); });
    toast(context, t('Suggestions added. Please check them.'));
  }

  Widget _fileRow(String kind, IconData icon, String label) => ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: Icon(icon), title: Text(label), subtitle: Text('${count(kind)} / ${max(kind)}'),
      trailing: Wrap(children: [
        if (kind == 'image' || kind == 'video') IconButton(icon: Icon(kind == 'image' ? Icons.photo_camera : Icons.videocam), tooltip: kind == 'image' ? t('Add a photo (optional)') : t('Record video'), onPressed: count(kind) >= max(kind) ? null : () => _pick(kind, camera: true)),
        if (kind == 'audio') IconButton(icon: Icon(recording ? Icons.stop_circle : Icons.mic, color: recording ? C.red : null), tooltip: recording ? t('Stop and keep') : t('Record audio'), onPressed: _record),
        IconButton(icon: const Icon(Icons.add_circle_outline), tooltip: t('Add'), onPressed: count(kind) >= max(kind) ? null : () => _pick(kind)),
      ]));

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = review;
    if (r != null) return _reviewView(r);
    final isAdmin = s.isAdmin;
    final cats = s.list('categories');
    return Scaffold(
      appBar: AppBar(title: Text(widget.editId != null ? t('Edit my story') : widget.company ? t('Add a company story') : t('Share my story'))),
      body: loading ? const Center(child: CircularProgressIndicator()) : ListView(padding: const EdgeInsets.all(16), children: [
        if (wasPublished) Note(t('Changes to a published story are checked before they show.')),
        if (isAdmin) ...[
          Choice<String>(t('Kind of item'), type, {'community': t('Community story'), 'testimony': t('Testimony collected by the project'), 'record': t('Historical record')}, (v) => setState(() => type = v ?? 'community')),
          Choice<String>(t('Publish as'), postedAs, {'self': str(s.me?['name']), 'company': t('Admin (company story, needs approval)'), 'told_by': t('As told by another person')}, (v) => setState(() => postedAs = v ?? 'self')),
        ],
        Field(t('Title (optional)'), title),
        Field(t('Your story (optional if you add a recording or files)'), text, lines: 7, hint: t('What happened? Where? What did you learn?')),
        Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: _suggest, child: Text(t('Suggest category and tags')))),
        Text(t('Tell it by voice or add files'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        if (recording) Note('${t('Recording')} · ${recSeconds ~/ 60}:${(recSeconds % 60).toString().padLeft(2, '0')}', color: C.red, child: Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: _record, child: Text(t('Stop and keep'))))),
        _fileRow('video', Icons.videocam_outlined, t('Video')), _fileRow('audio', Icons.graphic_eq, t('Audio')), _fileRow('document', Icons.description_outlined, t('Documents')), _fileRow('image', Icons.image_outlined, t('Images')),
        Text(t('Hidden location data is removed from photos automatically. Limits: video {v} MB and {m} minutes, audio {a} MB, images and documents {i} MB each.', {'v': maxMb('video'), 'm': limits['videoMinutes'] ?? 5, 'a': maxMb('audio'), 'i': maxMb('image')}), style: const TextStyle(fontSize: 12)),
        for (final sl in slots) ListTile(dense: true, contentPadding: EdgeInsets.zero,
            leading: Icon(sl.kind == 'image' ? Icons.image : sl.kind == 'video' ? Icons.videocam : sl.kind == 'audio' ? Icons.graphic_eq : Icons.description),
            title: Text(sl.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: sl.error != null ? Text(sl.error!, style: const TextStyle(color: C.red)) : sl.media == null ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [LinearProgressIndicator(value: sl.pct),
                    Text(sl.task?.state == 'paused' ? '${t('Paused')} · ${(sl.pct * 100).round()}%' : sl.task?.state == 'wifi' ? t('Waiting for Wi-Fi to upload.') : '${t('Uploading…')} ${(sl.pct * 100).round()}%')])
                : sl.kind == 'document' && postedAs == 'told_by' ? InkWell(onTap: () => setState(() { for (final x in slots) { x.consentForm = identical(x, sl) ? !sl.consentForm : false; } }), child: Text('${sl.consentForm ? '☑' : '☐'} ${t('This is the signed consent form (kept private)')}')) : Text(t('Ready')),
            trailing: Wrap(children: [
              if (sl.error != null) IconButton(icon: const Icon(Icons.refresh), tooltip: t('Retry'), onPressed: () => _uploads.resume(sl.task!)),
              if (sl.task != null && sl.task!.large && sl.task!.state == 'sending') IconButton(icon: const Icon(Icons.pause), tooltip: t('Pause'), onPressed: () => _uploads.pause(sl.task!)),
              if (sl.task?.state == 'wifi') TextButton(onPressed: _uploads.uploadNow, child: Text(t('Upload now'))),
              if (sl.task?.state == 'paused') IconButton(icon: const Icon(Icons.play_arrow), tooltip: t('Resume'), onPressed: () => _uploads.resume(sl.task!)),
              IconButton(icon: const Icon(Icons.close), tooltip: t('Remove {name}', {'name': sl.name}), onPressed: () => _remove(sl)),
            ])),
        const Divider(height: 28),
        Text(t('Story details'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), const SizedBox(height: 8),
        TextField(controller: placeName, onChanged: (_) => placeId = null, decoration: InputDecoration(labelText: t('Where it happened'), suffixIcon: IconButton(icon: const Icon(Icons.search), tooltip: t('Search'), onPressed: () async {
          final p = await pickFromSearch(context, t('Where it happened'), (q) async => asList(await s.api.get('/places', {'q': q})), (x) => ListTile(leading: const Icon(Icons.place), title: Text(str(x['name'])), subtitle: Text([x['county'], x['waterBody']].where((e) => str(e).isNotEmpty).join(' · '))), t('No match in the places list. Keep typing to use your own wording, or put a pin on the map.'));
          if (p != null) setState(() { placeId = p['id'] as int?; placeName.text = str(p['name']); if (p['latitude'] != null) pos = LatLng((p['latitude'] as num).toDouble(), (p['longitude'] as num).toDouble()); });
        }))),
        Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => setState(() => showMap = !showMap), child: Text(showMap ? t('Hide the map') : pos != null ? t('Move the pin on the map') : t('Put a pin on the map')))),
        if (showMap) SizedBox(height: 260, child: MapBox(markers: [if (pos != null) pin(pos!)], center: pos ?? const LatLng(-0.6, 37.6), zoom: pos != null ? 10 : 5.6, onTap: (p) => setState(() { pos = p; placeId = null; }))),
        const SizedBox(height: 8),
        if (approx) Field(t('Year, for example 1994'), year, type: TextInputType.number)
        else OutlinedButton.icon(icon: const Icon(Icons.event), label: Text('${t('When it happened')}: ${eventDate == null ? '—' : fmtDate(eventDate!.toIso8601String().substring(0, 10))}'), onPressed: () async { final d = await showDatePicker(context: context, initialDate: eventDate ?? DateTime.now(), firstDate: DateTime(1800), lastDate: DateTime.now()); if (d != null) setState(() => eventDate = d); }),
        CheckboxListTile(dense: true, contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: approx, onChanged: (v) => setState(() => approx = v == true), title: Text(t('I only know roughly when'))),
        Choice<String>(t('Category'), category.isEmpty ? null : category, {for (final c in cats) c: t(c)}, (v) => setState(() => category = v ?? '')),
        Field(t('Vessel name'), vessel), Field(t('Tags (separate with commas)'), tags, hint: t('ferry, life jackets')),
        Choice<String>(t('Language of the story'), language, {for (final l in asList(s.config['languages'])) str(l['code']): str(l['name'])}, (v) => setState(() => language = v ?? 'en')),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.report_gmailerrorred), title: Text(incidentTitle ?? t('Linked incident (optional)')), trailing: incidentId != null ? IconButton(icon: const Icon(Icons.close), tooltip: t('Remove'), onPressed: () => setState(() { incidentId = null; incidentTitle = null; })) : const Icon(Icons.search),
            onTap: () async {
              final i = await pickFromSearch(context, t('Linked incident'), (q) async => asList(await s.api.get('/incidents', {'q': q})), (x) => ListTile(title: Text(str(x['title'])), subtitle: Text(str(x['eventDate']).length >= 4 ? str(x['eventDate']).substring(0, 4) : '')), t('No incident record matches. You can suggest a new one below.'));
              if (i != null) setState(() { incidentId = str(i['id']); incidentTitle = str(i['title']); });
            }),
        if (incidentId == null) ExpansionTile(tilePadding: EdgeInsets.zero, title: Text(t('Suggest a new incident for the admins to add'), style: const TextStyle(fontSize: 14)), children: [Field(t('Name of the incident'), suggestTitle), Field(t('What you know about it'), suggestDetails, lines: 2)]),
        if (isAdmin && type == 'record') Section(t('Source of this historical record'), [for (final (k, label) in [('institution', 'Institution or archive'), ('reference', 'Archive reference'), ('originalDate', 'Original date'), ('creator', 'Creator or publisher'), ('rightsStatement', 'Rights statement'), ('obtained', 'How it was obtained')]) Field(t(label), source[k]!)]),
        if (isAdmin && type == 'testimony') Section(t('Consent record'), [
          Field(t('Storyteller'), storyteller), Choice<String>(t('Type of consent'), consentType, {'written': t('Written'), 'recorded': t('Recorded'), 'guardian': t('Parent or guardian')}, (v) => setState(() => consentType = v ?? 'written')),
          CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: validated, onChanged: (v) => setState(() => validated = v == true), title: Text(t('The storyteller has confirmed how their contribution is represented'))),
        ]),
        const Divider(height: 28),
        Text(t('Posting options'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        if (!isAdmin) for (final (k, label) in [('self', t('Myself ({name})', {'name': s.me?['username'] != null ? '@${s.me!['username']}' : s.me?['name']})), ('told_by', t('As told by another person')), ('anonymous', t('Anonymously'))])
          RadioListTile<String>(dense: true, contentPadding: EdgeInsets.zero, value: k, groupValue: postedAs, onChanged: (v) => setState(() => postedAs = v ?? 'self'), title: Text(label)),
        if (postedAs == 'told_by') Note(t('You can add a signed consent form as a document above and mark it as the consent form.'), child: Column(children: [
          const SizedBox(height: 8), Field(t('Whose story is this?'), toldBy),
          CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: consent, onChanged: (v) => setState(() => consent = v == true), title: Text(t('I confirm this person has agreed to their story being shared here. (For anyone under 18, a parent or guardian has agreed.)'))),
        ])),
        if (postedAs == 'anonymous') Note(t('Your name and picture will not be shown with this story. The admins can still see who posted it.')),
        Choice<String>(t('Usage rights'), rights, {for (final x in s.list('rights').isEmpty ? ['All rights reserved'] : s.list('rights')) x: x}, (v) => setState(() => rights = v ?? rights)),
        SwitchListTile(contentPadding: EdgeInsets.zero, value: allowDownload, onChanged: (v) => setState(() => allowDownload = v), title: Text(t('Allow others to download this story'))),
        SwitchListTile(contentPadding: EdgeInsets.zero, value: sensitive, onChanged: (v) => setState(() => sensitive = v), title: Text(t('This story describes loss of life or may be distressing'))),
        for (final e in errors) Note(e, color: C.red),
        const SizedBox(height: 8),
        Row(children: [
          if (!wasPublished) Expanded(child: OutlinedButton(onPressed: busy != null || uploading ? null : () => _save(true), child: Text(busy == 'draft' ? '…' : t('Save draft')))),
          if (!wasPublished) const SizedBox(width: 10),
          Expanded(child: FilledButton.icon(onPressed: busy != null || uploading ? null : () => _save(false), icon: const Icon(Icons.send), label: Text(busy == 'send' ? '…' : wasPublished ? t('Save changes') : postedAs == 'company' ? t('SUBMIT') : t('SEND')))),
        ]),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _reviewView(J r) {
    final done = r['done'] == true, flag = r['flag'] as String?, ex = asMap(r['explanation']);
    final pct = ((DateTime.now().difference(reviewStart ?? DateTime.now()).inSeconds / 180) + .08).clamp(0.0, .96);
    return Scaffold(appBar: AppBar(title: Text(t('Share my story'))), body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
      if (!done) ...[const CircularProgressIndicator(), const SizedBox(height: 14), Text(str(r['message']), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 10), LinearProgressIndicator(value: pct), const SizedBox(height: 10), Text(t('You can leave this page. We will tell you when it is done.'), textAlign: TextAlign.center)]
      else ...[
        if (flag == 'GREEN' && r['status'] == 'published') TweenAnimationBuilder<double>(tween: Tween(begin: .2, end: 1), duration: const Duration(milliseconds: 700), curve: Curves.elasticOut, builder: (_, v, __) => Transform.scale(scale: v, child: const Icon(Icons.check_circle, size: 90, color: C.green))),
        if (flag != null) Padding(padding: const EdgeInsets.all(8), child: FlagChip(flag)),
        Text(str(r['message']), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(height: 10),
        if (flag == 'YELLOW') Note('${t('Please avoid this next time')}: ${str(ex['summary'])}', color: C.yellow),
        if (flag == 'RED') Note('${t('Why it was blocked')}: ${str(ex['summary'])}\n${asList(ex['guidelines']).where((g) => num0(g['score']) >= 20).map((g) => '• ${t(str(g['key']))}: ${g['explanation']}').join('\n')}\n\n${t('Your story is now waiting for an admin to review it. You will be told the outcome.')}', color: C.red,
            child: Align(alignment: Alignment.centerLeft, child: OutlinedButton(onPressed: () => askWhy(context, str(r['id'])), child: Text(t('Ask Why'))))),
        if (flag == null && r['status'] != 'published') Text(t('Your story is waiting for the team. You will be told the outcome.'), textAlign: TextAlign.center),
      ],
      const SizedBox(height: 18),
      FilledButton(onPressed: () => Navigator.pop(context), child: Text(t('Back to the stories'))),
    ]))));
  }
}
