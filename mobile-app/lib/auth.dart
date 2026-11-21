import 'dart:async';
import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import 'api.dart';
import 'core.dart';
import 'pages.dart';

/// "Continue with Google" and "Continue with Apple": the only ways a Contributor signs in.
class ProviderButtons extends StatefulWidget {
  final VoidCallback? onDone;
  const ProviderButtons({super.key, this.onDone});
  @override
  State<ProviderButtons> createState() => _ProviderButtonsState();
}

class _ProviderButtonsState extends State<ProviderButtons> {
  static bool _googleReady = false;
  J? cfg;
  String? busy, error;
  J? held;
  final demo = TextEditingController();

  @override
  void initState() { super.initState(); AppScope.read(context).api.get('/auth/providers').then((c) { if (mounted) setState(() => cfg = asMap(c)); }).catchError((Object e) { if (mounted) setState(() => error = errText(e)); }); }

  Future<(String, String?)?> _googleToken() async {
    final g = GoogleSignIn.instance;
    if (!_googleReady) { await g.initialize(serverClientId: str(asMap(cfg!['google'])['clientId'])); _googleReady = true; }
    try {
      final account = await g.authenticate();
      final token = account.authentication.idToken;
      if (token == null) throw Exception('no token');
      return (token, account.displayName);
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      rethrow;
    }
  }

  Future<(String, String?)?> _appleToken() async {
    final a = asMap(cfg!['apple']);
    try {
      final c = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
        webAuthenticationOptions: Platform.isAndroid ? WebAuthenticationOptions(clientId: str(a['clientId']), redirectUri: Uri.parse(str(a['redirectUri']))) : null,
      );
      final token = c.identityToken;
      if (token == null) throw Exception('no token');
      final name = [c.givenName, c.familyName].whereType<String>().where((x) => x.trim().isNotEmpty).join(' ');
      return (token, name.isEmpty ? null : name);
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) return null;
      rethrow;
    }
  }

  Future<void> _finish(J s) async {
    final app = AppScope.read(context);
    await app.useSession(s);
    if (!mounted) return;
    widget.onDone?.call();
    if (app.me?['profileComplete'] != true && app.role == 'contributor') {
      Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => const ProfileSetupPage()));
    } else {
      toast(context, str(s['message'], t('Welcome back, {name}.', {'name': app.me?['name']})));
    }
  }

  Future<void> _run(String provider, Future<J?> Function() go) async {
    setState(() { busy = provider; error = null; });
    try {
      final s = await go();
      if (s != null) { await _finish(s); return; }
      if (mounted) setState(() => error = t('Sign-in was cancelled. Please try again.'));
    } on ApiError catch (e) {
      if (!mounted) return;
      final d = asMap(e.details);
      if (e.code == 'account_suspended') { setState(() => held = {'kind': 'suspended', 'message': e.message, ...d}); }
      else if (e.code == 'account_deleted_restore') { setState(() => held = {'kind': 'deleted', 'message': e.message, ...d}); }
      else { setState(() => error = e.message); }
    } catch (_) {
      if (mounted) setState(() => error = t('Sign-in did not complete. Please try again.'));
    } finally { if (mounted) setState(() => busy = null); }
  }

  Future<J?> _oauth(String provider, Future<(String, String?)?> Function() token) async {
    final got = await token();
    if (got == null) return null;
    return asMap(await AppScope.read(context).api.request('POST', '/auth/oauth/$provider', body: {'idToken': got.$1, if (got.$2 != null) 'name': got.$2}));
  }

  @override
  Widget build(BuildContext context) {
    final api = AppScope.read(context).api;
    final h = held;
    if (h != null && h['kind'] == 'suspended') {
      final ask = TextEditingController();
      return Note('${h['message']}\n${h['until'] != null ? '${t('Until')}: ${fmtDate(h['until'])}\n' : ''}${str(h['reason']).isEmpty ? '' : '${t('Reason')}: ${h['reason']}'}', color: C.yellow, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SizedBox(height: 8), Field(t('Your question'), ask, lines: 3),
        Row(children: [
          FilledButton(onPressed: () async { if (ask.text.trim().length < 3) return; await run(context, () => api.post('/auth/suspension/ask-why', {'token': h['askWhyToken'], 'description': ask.text.trim()}), ok: t('Sent. The admins will reply in your INBOX.')); }, child: Text(t('Ask Why'))),
          TextButton(onPressed: () => setState(() => held = null), child: Text(t('Back'))),
        ]),
      ]));
    }
    if (h != null) {
      return Note(str(h['message']), color: C.yellow, child: Row(children: [
        FilledButton(onPressed: () => _run('restore', () async => asMap(await api.post('/auth/restore', {'token': h['restoreToken']}))), child: Text(t('Restore my account'))),
        TextButton(onPressed: () => setState(() => held = null), child: Text(t('Not now'))),
      ]));
    }
    final c = cfg;
    if (c == null) return error != null ? Text(error!, style: const TextStyle(color: C.red)) : const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
    final google = c['google'] != null && Platform.isAndroid, apple = c['apple'] != null;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (google) OutlinedButton.icon(onPressed: busy != null ? null : () => _run('google', () => _oauth('google', _googleToken)), icon: const Icon(Icons.g_mobiledata, size: 28), label: Text(busy == 'google' ? '…' : t('Continue with Google'))),
      if (google && apple) const SizedBox(height: 10),
      if (apple) FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white), onPressed: busy != null ? null : () => _run('apple', () => _oauth('apple', _appleToken)), icon: const Icon(Icons.apple), label: Text(busy == 'apple' ? '…' : t('Continue with Apple'))),
      if (!google && !apple && c['demo'] != true) Note(t('Sign-in is not set up on this server yet.'), color: C.yellow),
      if (c['demo'] == true) Padding(padding: const EdgeInsets.only(top: 12), child: Note('${t('Test sign-in')} · ${t('This server is in test mode. Google and Apple sign-in appear here once their keys are added.')}', child: Row(children: [
        Expanded(child: TextField(controller: demo, decoration: InputDecoration(hintText: t('Any name, for example Amina')))), const SizedBox(width: 8),
        FilledButton(onPressed: busy != null ? null : () => _run('demo', () async => asMap(await api.post('/auth/demo', {'name': demo.text.trim().isEmpty ? 'Demo Contributor' : demo.text.trim()}))), child: Text(t('Continue'))),
      ]))),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: C.red))),
    ]);
  }
}

class SignInPage extends StatelessWidget {
  const SignInPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(t('Sign in'))), body: ListView(padding: const EdgeInsets.all(20), children: [
        Icon(Icons.support, size: 64, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 8),
        Text(t('Share your story, react, comment and follow. Reading the archive never needs an account.'), textAlign: TextAlign.center), const SizedBox(height: 18),
        ProviderButtons(onDone: () => Navigator.pop(context)), const SizedBox(height: 14),
        TextButton(onPressed: () => Navigator.pop(context), child: Text(t('Back to the stories'))),
        Wrap(alignment: WrapAlignment.center, children: [
          TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LegalPage('terms'))), child: Text(t('Terms of use'))),
          TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LegalPage('privacy'))), child: Text(t('Privacy policy'))),
          TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LegalPage('rules'))), child: Text(t('Rules'))),
        ]),
        const Divider(),
        Text(t('Project team'), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          TextButton(onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const AdminSignInPage())), child: Text(t('Admin sign-in'))),
          TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminRegisterPage())), child: Text(t('Admin registration'))),
        ]),
      ]));
}

/// First sign-in: username and picture (or the Google/Apple name and photo), language, theme, and acceptance of the rules.
class ProfileSetupPage extends StatefulWidget {
  final bool editing;
  const ProfileSetupPage({super.key, this.editing = false});
  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  late bool useProvider;
  final username = TextEditingController();
  String avatar = 'wave', language = 'en', theme = 'auto';
  String? photoId, state, error;
  bool ok = false, terms = false, age = false, busy = false;
  Timer? _t;

  @override
  void initState() {
    super.initState();
    final me = AppScope.read(context).me ?? {};
    useProvider = me['useProviderIdentity'] == true;
    username.text = str(me['username']);
    final a = str(me['avatar']);
    if (a.startsWith('avatar:')) avatar = a.substring(7);
    language = str(me['language'], I18n.code); theme = str(me['theme'], 'auto');
    ok = username.text.isNotEmpty;
  }
  @override
  void dispose() { _t?.cancel(); super.dispose(); }

  void _check(String v) {
    _t?.cancel();
    setState(() { ok = false; state = null; });
    if (v.trim().isEmpty) return;
    if (v.trim() == str(AppScope.read(context).me?['username'])) { setState(() => ok = true); return; }
    _t = Timer(const Duration(milliseconds: 280), () async {
      try { final r = asMap(await AppScope.read(context).api.get('/auth/username-available', {'username': v.trim()})); if (mounted) setState(() { ok = r['available'] == true; state = str(r['message']); }); } catch (_) {}
    });
  }

  Future<void> _photo() async {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (x == null || !mounted) return;
    final m = await run(context, () async => AppScope.read(context).api.uploadFile(LocalFile(x.path, x.name, await x.length()), 'avatar'));
    if (m != null && mounted) setState(() => photoId = str(m['id']));
  }

  Future<void> _save() async {
    final app = AppScope.read(context);
    setState(() { busy = true; error = null; });
    try {
      final r = asMap(await app.api.post('/auth/profile', {
        'useProviderIdentity': useProvider, if (!useProvider) 'username': username.text.trim(), if (!useProvider && photoId == null) 'avatar': avatar, if (!useProvider && photoId != null) 'photoMediaId': photoId,
        'language': language, 'theme': theme, if (!widget.editing) 'acceptTerms': terms, if (!widget.editing) 'ageConfirmed': age,
      }));
      app.me = asMap(r['user']);
      await app.setLanguage(language);
      if (!mounted) return;
      toast(context, str(r['message'], t('Saved.')));
      Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (e) { if (mounted) setState(() => error = errText(e)); } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final me = app.me ?? {};
    final cs = Theme.of(context).colorScheme;
    final ready = (useProvider || (ok && username.text.trim().length >= 3)) && (widget.editing || (terms && age));
    return PopScope(canPop: widget.editing, child: Scaffold(appBar: AppBar(automaticallyImplyLeading: widget.editing, title: Text(widget.editing ? t('Change my profile') : t('Set up your profile'))), body: ListView(padding: const EdgeInsets.all(18), children: [
      if (!widget.editing) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(t('Choose how you appear on your stories and comments.'))),
      RadioListTile<bool>(contentPadding: EdgeInsets.zero, value: false, groupValue: useProvider, onChanged: (v) => setState(() => useProvider = false), title: Text(t('Create a username and choose a picture'))),
      RadioListTile<bool>(contentPadding: EdgeInsets.zero, value: true, groupValue: useProvider, onChanged: (v) => setState(() => useProvider = true), title: Text('${t('Keep my {provider} name and photo', {'provider': me['provider'] == 'apple' ? 'Apple' : 'Google'})}${str(me['providerName']).isEmpty ? '' : ' (${me['providerName']})'}')),
      if (!useProvider) ...[
        TextField(controller: username, onChanged: _check, maxLength: 30, autocorrect: false, decoration: InputDecoration(labelText: t('Username'), helperText: state ?? t('3 to 30 letters, numbers or underscores'), helperStyle: TextStyle(color: state == null ? null : ok ? C.green : C.red, fontWeight: FontWeight.w600), suffixIcon: ok ? const Icon(Icons.check_circle, color: C.green) : null)),
        Text(t('Picture'), style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final a in app.list('avatars').isEmpty ? avatarIcons.keys.where((k) => k != 'anonymous') : app.list('avatars')) Semantics(button: true, selected: photoId == null && avatar == a, label: a, child: InkWell(customBorder: const CircleBorder(), onTap: () => setState(() { avatar = a; photoId = null; }),
              child: Container(width: 52, height: 52, decoration: BoxDecoration(shape: BoxShape.circle, color: photoId == null && avatar == a ? cs.primary : cs.primary.withValues(alpha: .12)), child: Icon(avatarIcons[a] ?? Icons.waves, color: photoId == null && avatar == a ? Colors.white : cs.primary)))),
        ]),
        TextButton.icon(onPressed: _photo, icon: Icon(photoId != null ? Icons.check_circle : Icons.add_a_photo), label: Text(t('Or use a photo of your face'))),
      ] else ListTile(contentPadding: EdgeInsets.zero, leading: Avatar({'avatar': str(me['providerPicture'], 'avatar:wave')}), title: Text(str(me['providerName']))),
      const SizedBox(height: 8),
      Choice<String>(t('Language'), language, I18n.launch, (v) { setState(() => language = v ?? 'en'); app.setLanguage(language); }),
      Choice<String>(t('Theme'), theme, {'auto': t('Auto (follow my device)'), 'light': t('Light'), 'dark': t('Dark')}, (v) => setState(() => theme = v ?? 'auto')),
      if (!widget.editing) ...[
        CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: age, onChanged: (v) => setState(() => age = v == true), title: Text(t('I am {n} or older.', {'n': app.config['minAge'] ?? 18}))),
        CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: terms, onChanged: (v) => setState(() => terms = v == true), title: Text('${t('I accept the')} ${t('Rules')}, ${t('the')} ${t('Privacy policy')} ${t('and the')} ${t('Terms of use')}.')),
        Wrap(children: [for (final (k, label) in [('rules', t('Rules')), ('privacy', t('Privacy policy')), ('terms', t('Terms of use'))]) TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalPage(k))), child: Text(label))]),
      ],
      if (error != null) Text(error!, style: const TextStyle(color: C.red)),
      const SizedBox(height: 10),
      FilledButton(onPressed: ready && !busy ? _save : null, child: Text(widget.editing ? t('Save') : t('Open the archive'))),
      if (!widget.editing) TextButton(onPressed: () async { await app.signOut(); if (context.mounted) Navigator.of(context).popUntil((r) => r.isFirst); }, child: Text(t('Sign out'))),
    ])));
  }
}

class AdminSignInPage extends StatefulWidget {
  const AdminSignInPage({super.key});
  @override
  State<AdminSignInPage> createState() => _AdminSignInPageState();
}

class _AdminSignInPageState extends State<AdminSignInPage> {
  final email = TextEditingController(), password = TextEditingController(), code = TextEditingController();
  J? mfa;
  String channel = 'email';
  String? error, info;
  bool busy = false, forgot = false;

  Future<void> _go(Future<void> Function() fn) async {
    setState(() { busy = true; error = null; });
    try { await fn(); } catch (e) { if (mounted) setState(() => error = errText(e)); } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    final m = mfa;
    final methods = (m?['methods'] as List? ?? const []).map((e) => '$e').toList();
    return Scaffold(appBar: AppBar(title: Text(t('Admin sign-in'))), body: ListView(padding: const EdgeInsets.all(20), children: [
      if (forgot) ...[
        Field(t('Work email'), email, type: TextInputType.emailAddress),
        if (info != null) Note(info!, color: C.green),
        FilledButton(onPressed: busy ? null : () => _go(() async { final r = asMap(await app.api.post('/auth/admin/forgot-password', {'email': email.text.trim()})); setState(() => info = str(r['message'], t('If that email belongs to an admin, a link to choose a new password is on its way.'))); }), child: Text(t('Send the link'))),
        TextButton(onPressed: () => setState(() { forgot = false; info = null; }), child: Text(t('Back'))),
      ] else if (m == null) ...[
        Field(t('Work email'), email, type: TextInputType.emailAddress), Field(t('Password'), password, obscure: true),
        FilledButton(onPressed: busy ? null : () => _go(() async {
          final r = asMap(await app.api.post('/auth/admin/login', {'email': email.text.trim(), 'password': password.text}));
          final ms = (r['methods'] as List? ?? const []).map((e) => '$e').toList();
          if (ms.contains('authenticator')) { setState(() { mfa = r; channel = 'authenticator'; }); }
          else { await app.api.post('/auth/admin/mfa/send', {'mfaToken': r['mfaToken'], 'channel': 'email'}); setState(() { mfa = r; channel = 'email'; info = t('We sent a code to your email.'); }); }
        }), child: Text(t('Continue'))),
        TextButton(onPressed: () => setState(() => forgot = true), child: Text(t('Forgot password?'))),
        TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminRegisterPage())), child: Text(t('Admin registration'))),
      ] else ...[
        Text(channel == 'authenticator' ? t('Enter the 6-digit code from your authenticator app.') : (info ?? t('Enter the 6-digit code we sent you.'))), const SizedBox(height: 12),
        Field(t('Sign-in code'), code, type: TextInputType.number),
        FilledButton(onPressed: busy ? null : () => _go(() async {
          final s = asMap(await app.api.post('/auth/admin/mfa/verify', {'mfaToken': m['mfaToken'], 'code': code.text.trim()}));
          await app.useSession(s);
          if (context.mounted) { toast(context, t('Welcome back, {name}.', {'name': app.me?['name']})); Navigator.of(context).popUntil((r) => r.isFirst); }
        }), child: Text(t('Sign in'))),
        TextButton(onPressed: busy ? null : () => _go(() async { await app.api.post('/auth/admin/mfa/send', {'mfaToken': m['mfaToken'], 'channel': 'email'}); setState(() { channel = 'email'; info = t('We sent a code to your email.'); }); }), child: Text(channel == 'email' ? t('Send the email again') : t('Email me a code instead'))),
        if (methods.contains('sms')) TextButton(onPressed: busy ? null : () => _go(() async { await app.api.post('/auth/admin/mfa/send', {'mfaToken': m['mfaToken'], 'channel': 'sms'}); setState(() { channel = 'sms'; info = t('We sent a code to your phone.'); }); }), child: Text(t('Text me a code'))),
        TextButton(onPressed: () => setState(() { mfa = null; code.clear(); }), child: Text(t('Back'))),
      ],
      if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: C.red))),
    ]));
  }
}

class AdminRegisterPage extends StatefulWidget {
  final String? invite;
  const AdminRegisterPage({super.key, this.invite});
  @override
  State<AdminRegisterPage> createState() => _AdminRegisterPageState();
}

class _AdminRegisterPageState extends State<AdminRegisterPage> {
  final f = {for (final k in ['fullName', 'email', 'phone', 'staffNumber', 'idNumber', 'password', 'again']) k: TextEditingController()};
  String? error, done;
  bool busy = false;
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(t('Admin registration'))), body: ListView(padding: const EdgeInsets.all(20), children: done != null
      ? [Note('${t('Registration received')}\n$done', color: C.green), FilledButton(onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const AdminSignInPage())), child: Text(t('Admin sign-in')))]
      : [
          Text(widget.invite != null ? t('You were invited to join the admin team. Complete your details below.') : t('For members of the project team. A Super Admin approves each registration before the account can be used.')), const SizedBox(height: 12),
          Field(t('Full name'), f['fullName']!), Field(t('Work email'), f['email']!, type: TextInputType.emailAddress), Field(t('Phone number'), f['phone']!, type: TextInputType.phone, hint: '+254 7xx xxx xxx'),
          Field(t('Staff number'), f['staffNumber']!), Field(t('ID or passport number (kept encrypted)'), f['idNumber']!),
          Field(t('Password'), f['password']!, obscure: true), Text(t('Use 8 to 128 characters, with at least one letter and one number.'), style: const TextStyle(fontSize: 12)), const SizedBox(height: 8),
          Field(t('Password again'), f['again']!, obscure: true),
          if (error != null) Text(error!, style: const TextStyle(color: C.red)),
          FilledButton(onPressed: busy ? null : () async {
            if (f['password']!.text != f['again']!.text) { setState(() => error = t('The two passwords do not match.')); return; }
            setState(() { busy = true; error = null; });
            try {
              final r = asMap(await AppScope.read(context).api.post('/auth/admin/register', {'fullName': f['fullName']!.text.trim(), 'email': f['email']!.text.trim(), 'phone': f['phone']!.text.trim(), 'staffNumber': f['staffNumber']!.text.trim(),
                if (f['idNumber']!.text.trim().isNotEmpty) 'idNumber': f['idNumber']!.text.trim(), 'password': f['password']!.text, if (widget.invite != null) 'inviteToken': widget.invite}));
              setState(() => done = str(r['message']));
            } catch (e) { setState(() => error = errText(e)); } finally { setState(() => busy = false); }
          }, child: Text(t('Register'))),
        ]));
}
