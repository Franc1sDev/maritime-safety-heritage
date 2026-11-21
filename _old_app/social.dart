import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:material_ui/material_ui.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import 'api.dart';
import 'motion.dart';
import 'ui.dart';

/// "Continue with Google" and "Continue with Apple", for people who visit now and then and would rather not keep
/// another password. Shown only when the archive has them set up (the server says so at /auth/providers).
///
/// - Google: Android. (iOS also needs the iOS client id in Info.plist, added when the app is signed for the App Store.)
/// - Apple: iPhone (native) and Android (Apple's web sign-in, which returns to the app through the server).
class QuickSignIn extends StatefulWidget {
  /// Runs after a successful sign-in; [created] is true for a brand-new account.
  final void Function(bool created, String provider) onDone;
  const QuickSignIn({super.key, required this.onDone});
  @override
  State<QuickSignIn> createState() => _QuickSignInState();
}

class _QuickSignInState extends State<QuickSignIn> {
  static bool _googleReady = false;
  Map<String, dynamic>? _cfg;
  String? _busy, _err;

  @override
  void initState() {
    super.initState();
    AppScope.read(context).providers().then((c) { if (mounted) setState(() => _cfg = c); }).catchError((_) {});
  }

  Map<String, dynamic>? get _google => Platform.isAndroid ? (_cfg?['google'] as Map<String, dynamic>?) : null;
  Map<String, dynamic>? get _apple => (Platform.isAndroid || Platform.isIOS) ? (_cfg?['apple'] as Map<String, dynamic>?) : null;

  Future<void> _run(String provider, Future<(String, String?)?> Function() getToken) async {
    final s = AppScope.read(context);
    setState(() { _busy = provider; _err = null; });
    try {
      final got = await getToken();
      if (got == null) { if (mounted) setState(() => _busy = null); return; } // cancelled
      final created = await s.signInWith(provider, got.$1, name: got.$2);
      if (mounted) widget.onDone(created, provider);
    } catch (e) {
      if (mounted) setState(() { _busy = null; _err = e is ApiError ? errText(e) : 'Sign-in did not go through. Try again, or use your email and password.'; });
    }
  }

  Future<(String, String?)?> _googleToken() async {
    final g = GoogleSignIn.instance;
    if (!_googleReady) {
      await g.initialize(serverClientId: _google!['clientId'] as String);
      _googleReady = true;
    }
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
    final a = _apple!;
    try {
      final c = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
        webAuthenticationOptions: Platform.isAndroid
            ? WebAuthenticationOptions(clientId: a['clientId'] as String, redirectUri: Uri.parse(a['redirectUri'] as String))
            : null,
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

  @override
  Widget build(BuildContext context) {
    final g = _google, a = _apple;
    if (g == null && a == null) return const SizedBox.shrink();
    return AnimatedSize(
      duration: const Duration(milliseconds: 350),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.auto_awesome_rounded, size: 16, color: C.sky),
          SizedBox(width: 6),
          Text('Quickest: no password needed', style: TextStyle(color: C.sky, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 10),
        if (g != null)
          CoachTarget(
            text: 'Just visiting? One tap here, and no new password to remember.',
            priority: 8,
            child: _ProviderButton(
              busy: _busy == 'google',
              onPressed: _busy != null ? null : () => _run('google', _googleToken),
              background: Colors.white,
              foreground: const Color(0xFF1F1F1F),
              logo: const _GoogleG(),
              label: 'Continue with Google',
            ),
          ),
        if (g != null && a != null) const SizedBox(height: 10),
        if (a != null)
          _ProviderButton(
            busy: _busy == 'apple',
            onPressed: _busy != null ? null : () => _run('apple', _appleToken),
            background: Colors.black,
            foreground: Colors.white,
            logo: const Icon(Icons.apple, color: Colors.white, size: 22),
            label: 'Continue with Apple',
            border: Colors.white24,
          ),
        if (_err != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_err!, textAlign: TextAlign.center, style: const TextStyle(color: C.danger))),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: Divider(color: C.line)),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 10), child: Text('or use your email', style: TextStyle(color: C.muted, fontSize: 12.5))),
          Expanded(child: Divider(color: C.line)),
        ]),
        const SizedBox(height: 16),
      ]),
    );
  }
}

class _ProviderButton extends StatelessWidget {
  final bool busy;
  final VoidCallback? onPressed;
  final Color background, foreground;
  final Color? border;
  final Widget logo;
  final String label;
  const _ProviderButton({required this.busy, required this.onPressed, required this.background, required this.foreground, required this.logo, required this.label, this.border});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 50,
        child: ElevatedButton(
          onPressed: onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: background, foregroundColor: foreground, disabledBackgroundColor: background.withValues(alpha: .7),
            shape: StadiumBorder(side: BorderSide(color: border ?? Colors.transparent)), elevation: 2,
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            busy ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: foreground)) : logo,
            const SizedBox(width: 12),
            Text(busy ? 'Signing in' : label, style: TextStyle(color: foreground, fontWeight: FontWeight.w600, fontSize: 15.5)),
          ]),
        ),
      );
}

/// Google's four-colour "G", drawn so the app needs no image file.
class _GoogleG extends StatelessWidget {
  const _GoogleG();
  @override
  Widget build(BuildContext context) => const SizedBox(width: 20, height: 20, child: CustomPaint(painter: _GPainter()));
}

class _GPainter extends CustomPainter {
  const _GPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, stroke = w * .2;
    final r = Rect.fromLTWH(stroke / 2, stroke / 2, w - stroke, w - stroke);
    Paint p(Color c) => Paint()..color = c..style = PaintingStyle.stroke..strokeWidth = stroke;
    const deg = 3.1415926535 / 180;
    canvas.drawArc(r, -40 * deg, -100 * deg, false, p(const Color(0xFFEA4335))); // red, top
    canvas.drawArc(r, -140 * deg, -90 * deg, false, p(const Color(0xFFFBBC05))); // yellow, left
    canvas.drawArc(r, -230 * deg, -95 * deg, false, p(const Color(0xFF34A853))); // green, bottom
    canvas.drawArc(r, -325 * deg, -35 * deg, false, p(const Color(0xFF4285F4))); // blue, right
    canvas.drawLine(Offset(w / 2, w / 2), Offset(w - stroke / 2, w / 2), p(const Color(0xFF4285F4)));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
