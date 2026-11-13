import 'package:material_ui/material_ui.dart';

import 'main.dart';
import 'state.dart';
import 'ui.dart';

/// Video background, or the wave icon when Light mode is on.
class WelcomeBackground extends StatelessWidget {
  const WelcomeBackground({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    if (!s.lowBw) return const SeaVideoBg();
    return Stack(fit: StackFit.expand, children: [
      const PageBg(Icons.waves_rounded),
      Positioned(left: 16, bottom: 16, right: 16, child: SafeArea(top: false, child: Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: () { s.toggleLowBw(); toast(context, 'Light mode off: video on', Icons.play_arrow_rounded); },
          icon: const Icon(Icons.play_arrow_rounded),
          label: const Text('Light mode is on. Show video'),
        ),
      ))),
    ]);
  }
}

/// Signed-out landing page.
class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return AppPage(
      background: const WelcomeBackground(),
      body: LayoutBuilder(builder: (context, box) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 60),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight - 80),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text("Kenya's memory of the water, kept for everyone", textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w800, color: Colors.white, height: 1.1, letterSpacing: -.8,
                    shadows: const [Shadow(color: Colors.black54, blurRadius: 24)])),
            const SizedBox(height: 14),
            const Text('Oral histories, photographs, records and testimonies from the coast, the lakes and the rivers, so their safety lessons are never lost.',
                textAlign: TextAlign.center, style: TextStyle(color: Color(0xFFD6E4FB), fontSize: 15.5, height: 1.45)),
            const SizedBox(height: 16),
            OrbRow([
              OrbItem(Icons.login_rounded, 'Sign in', 'Sign in with your own account to explore the archive.', () => push(context, const SignInScreen()), primary: true),
              OrbItem(Icons.person_add_alt_rounded, 'Create account', 'Open a free account in under a minute.', () => push(context, const SignInScreen(create: true))),
              OrbItem(Icons.anchor_rounded, 'About', 'Who is behind the archive and why it matters.', () => push(context, const AboutScreen())),
            ]),
          ]),
        ),
      )),
    );
  }
}

class SignInScreen extends StatefulWidget {
  final bool create;
  const SignInScreen({super.key, this.create = false});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  late bool _create = widget.create;
  final _email = TextEditingController(), _pw = TextEditingController(), _name = TextEditingController(), _org = TextEditingController();
  final _form = GlobalKey<FormState>();
  String? _err;
  bool _hide = true;

  void _done() {
    final s = AppScope.read(context);
    toast(context, 'Welcome, ${s.me!.first}', Icons.support_rounded);
    Nav.tab.value = 0;
    Navigator.of(context).popUntil((r) => r.isFirst);
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    final s = AppScope.read(context);
    final e = _create ? s.register(_name.text, _email.text, _pw.text, _org.text) : s.signIn(_email.text, _pw.text);
    if (e != null) { setState(() => _err = e); return; }
    _done();
  }

  void _demo(String email) {
    final s = AppScope.read(context);
    final u = s.users.firstWhere((x) => x.email == email);
    final e = s.signIn(u.email, u.password);
    if (e != null) { setState(() => _err = e); return; }
    _done();
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.support_rounded),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 40), children: [
        const PageTitle('Welcome aboard', sub: 'Everyone signs in with their own account, on the website or the app.'),
        const SizedBox(height: 18),
        Glass(child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SegmentedButton<bool>(
            segments: const [ButtonSegment(value: false, label: Text('Sign in')), ButtonSegment(value: true, label: Text('Create account'))],
            selected: {_create},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() { _create = v.first; _err = null; }),
          ),
          const SizedBox(height: 18),
          if (_create) ...[
            TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline_rounded)),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your name' : null),
            const SizedBox(height: 14),
          ],
          TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded)),
              validator: (v) => (v ?? '').contains('@') ? null : 'Enter a valid email'),
          const SizedBox(height: 14),
          TextFormField(controller: _pw, obscureText: _hide,
              decoration: InputDecoration(labelText: 'Password', prefixIcon: const Icon(Icons.key_outlined),
                  helperText: _create ? 'At least 8 characters' : null,
                  suffixIcon: IconButton(onPressed: () => setState(() => _hide = !_hide), icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined), tooltip: _hide ? 'Show password' : 'Hide password')),
              validator: (v) => _create && (v ?? '').length < 8 ? 'Use at least 8 characters' : (v ?? '').isEmpty ? 'Enter your password' : null),
          if (_create) ...[
            const SizedBox(height: 14),
            TextFormField(controller: _org, decoration: const InputDecoration(labelText: 'Organisation or community (optional)', prefixIcon: Icon(Icons.groups_outlined))),
          ],
          if (_err != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err!, style: const TextStyle(color: C.danger))),
          const SizedBox(height: 18),
          FilledButton.icon(onPressed: _submit, icon: Icon(_create ? Icons.person_add_alt_rounded : Icons.login_rounded), label: Text(_create ? 'Create account' : 'Sign in')),
          if (!_create)
            TextButton(onPressed: () => showDialog(context: context, builder: (_) => AlertDialog(
              icon: const Icon(Icons.key_outlined, color: C.sky),
              title: const Text('Reset your password'),
              content: const Text('In the full build a one-time reset link is emailed to you. In the prototype, an admin can reset it from Users and roles.'),
              actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
            )), child: const Text('Forgot your password?', style: TextStyle(color: C.sky))),
        ]))),
        const SizedBox(height: 24),
        const Center(child: Text('Prototype demo accounts', style: TextStyle(color: C.muted))),
        OrbRow([
          OrbItem(Icons.person_outline_rounded, 'Researcher', 'Signs in as Peter, a normal user.', () => _demo('researcher@demo.ke')),
          OrbItem(Icons.manage_accounts_outlined, 'Admin', 'Signs in as Grace, a research team admin.', () => _demo('admin@demo.ke')),
        ]),
      ]),
    );
  }
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});
  @override
  Widget build(BuildContext context) {
    void info(IconData i, String t, String d) => showDialog(context: context, builder: (_) => AlertDialog(
          icon: CircleIcon(i, size: 52), title: Text(t), content: Text(d),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))]));
    const steps = [
      ['Discovery and design', 'Month 12', 'Requirements, metadata and this prototype'],
      ['Build', 'Months 13 to 14', 'Website, app, search and map on a test site'],
      ['Content and testing', 'Months 14 to 15', 'Materials catalogued, then tested and secured'],
      ['Launch and handover', 'Month 16', 'Public launch, training and full ownership'],
    ];
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.anchor_rounded),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), children: [
        const PageTitle('Remembering the Waters',
            sub: "Kenya's first national digital archive of maritime and inland-water safety heritage, gathered so its lessons stay with communities, researchers, educators and policymakers."),
        OrbRow([
          OrbItem(Icons.public_rounded, 'Open access', 'Free for everyone with an account.', () => info(Icons.public_rounded, 'Open access', 'Free to everyone with an account, on the web and on the Android and iOS app.')),
          OrbItem(Icons.verified_outlined, 'Respectful', 'Consent and rights on every item.', () => info(Icons.verified_outlined, 'Respectful by design', 'Every item carries its consent and rights. Narrators can stay anonymous.')),
          OrbItem(Icons.inventory_2_outlined, 'Catalogued', 'Standard metadata for preservation.', () => info(Icons.inventory_2_outlined, 'Properly catalogued', 'Standard metadata for every item: identifier, date, place, creator, language, rights and subjects, for long-term preservation.')),
          OrbItem(Icons.wifi_off_rounded, 'Low data', 'Light mode saves mobile data.', () => info(Icons.wifi_off_rounded, 'Works on slow connections', 'Light mode hides video to save data. Find it under See more.')),
        ]),
        Text('How the archive is being built', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        for (var i = 0; i < steps.length; i++)
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Glass(child: Row(children: [
            CircleAvatar(radius: 22, backgroundColor: C.blue, child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(steps[i][0], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15.5)),
              Text(steps[i][1], style: const TextStyle(color: C.sky, fontSize: 12.5)),
              Text(steps[i][2], style: const TextStyle(color: C.muted)),
            ])),
          ]))),
        const SizedBox(height: 10),
        const Center(child: Text('Developer: Francis Mutuku, contactfrancismutuku@gmail.com', textAlign: TextAlign.center, style: TextStyle(color: C.muted, fontSize: 12.5))),
      ]),
    );
  }
}

class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});
  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name, _email;
  final _subject = TextEditingController(), _body = TextEditingController(), _subjectFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    final u = AppScope.read(context).me;
    _name = TextEditingController(text: u?.name ?? '');
    _email = TextEditingController(text: u?.email ?? '');
  }

  @override
  Widget build(BuildContext context) {
    String? req(String? v) => (v ?? '').trim().isEmpty ? 'Required' : null;
    return AppPage(
      showBack: true,
      background: const PageBg(Icons.mail_outline_rounded),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), children: [
        const PageTitle('Talk to the research team', sub: "Questions about the archive, reusing material, or a story you'd like recorded."),
        OrbRow([
          OrbItem(Icons.edit_outlined, 'Write', 'Fill in the form below. The team replies by email.', () => _subjectFocus.requestFocus(), primary: true),
          OrbItem(Icons.call_outlined, 'Call', 'Phone details are added in the full build.', () => toast(context, 'Phone details are added in the full build', Icons.call_outlined)),
          OrbItem(Icons.shield_outlined, 'Reusing material', 'Most items can be reused with credit.', () => showDialog(context: context, builder: (_) => AlertDialog(
              icon: const CircleIcon(Icons.shield_outlined, size: 52), title: const Text('Reusing material'),
              content: const Text('Each item shows its licence in its catalogue record. Most are shared under CC BY-NC 4.0: you can reuse them for non-commercial work if you credit the archive and the item number.'),
              actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))]))),
        ], seeMore: true),
        Glass(child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Your name'), validator: req),
          const SizedBox(height: 12),
          TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress, validator: req),
          const SizedBox(height: 12),
          TextFormField(controller: _subject, focusNode: _subjectFocus, decoration: const InputDecoration(labelText: 'Subject'), validator: req),
          const SizedBox(height: 12),
          TextFormField(controller: _body, decoration: const InputDecoration(labelText: 'Message', alignLabelWithHint: true), minLines: 4, maxLines: 8, validator: req),
          const SizedBox(height: 16),
          FilledButton.icon(
            icon: const Icon(Icons.send_rounded),
            label: const Text('Send message'),
            onPressed: () {
              if (!_form.currentState!.validate()) return;
              final s = AppScope.read(context);
              s.messages.insert(0, Message(id: 'M${DateTime.now().millisecondsSinceEpoch}', name: _name.text, email: _email.text,
                  date: AppState.today(), subject: _subject.text, body: _body.text));
              s.save();
              toast(context, 'Message sent. The team usually replies within 3 working days.', Icons.mail_outline_rounded);
              Navigator.of(context).pop();
            },
          ),
        ]))),
      ]),
    );
  }
}
