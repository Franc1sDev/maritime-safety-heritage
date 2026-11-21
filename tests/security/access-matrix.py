"""Access test: calls every route in docs/API.md as a visitor, a Contributor, an admin and a Super Admin, and checks
that each role is let in or turned away exactly as the reference says (master plan, Sections 4.3 and 10.2).

  python tests/security/access-matrix.py [http://localhost:4000] [path to the demo server's log]

The local demo server must be running (cd backend && npm run demo). The log is read for the admins' sign-in codes.
Nothing is changed that matters: requests carry empty bodies and a made-up ID, so they stop at validation or “not found”.
A route passes when the server turns away (401 or 403) exactly the roles that may not call it."""
import json, os, re, sys, time, urllib.request

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000') + '/api/v1'
log = sys.argv[2] if len(sys.argv) > 2 else ''
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def call(method, path, token=None, body=None):
    headers = {'content-type': 'application/json', 'X-Client': 'app'}
    if token: headers['authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else (b'{}' if method in ('POST', 'PUT', 'PATCH') else None)
    req = urllib.request.Request(base + path, method=method, data=data, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=30); return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def contributor():
    s, b = call('POST', '/auth/demo', body={'name': 'access_check'})
    t = json.loads(b)['accessToken']
    call('POST', '/auth/profile', t, {'username': 'access_check', 'avatar': 'dhow', 'language': 'en', 'theme': 'auto', 'acceptTerms': True, 'ageConfirmed': True})
    return t

def team(email, password='admin1234'):
    s, b = call('POST', '/auth/admin/login', body={'email': email, 'password': password})
    if s != 200: raise SystemExit(f'Could not sign in {email}: {s} {b[:120]}')
    ticket = json.loads(b)['mfaToken']
    before = len(open(log, encoding='utf-8', errors='replace').read()) if log else 0
    call('POST', '/auth/admin/mfa/send', body={'mfaToken': ticket, 'channel': 'email'})
    code = None
    for _ in range(20):
        time.sleep(0.5)
        found = re.findall(r'code is (\d{6})', open(log, encoding='utf-8', errors='replace').read()[before:]) if log else []
        if found: code = found[-1]; break
    if not code: raise SystemExit('No sign-in code found in the server log. Give the log file as the second argument.')
    s, b = call('POST', '/auth/admin/mfa/verify', body={'mfaToken': ticket, 'code': code})
    if s != 200: raise SystemExit(f'Code refused for {email}: {s}')
    return json.loads(b)['accessToken']

tokens = {'Visitor': None, 'Contributor': contributor(), 'Admin': team('grace@demo.ke'), 'Super Admin': team('admin@demo.ke')}
allowed = {  # who the reference says may call a route marked this way
    'Anyone': {'Visitor', 'Contributor', 'Admin', 'Super Admin'}, 'Signed in': {'Contributor', 'Admin', 'Super Admin'},
    'Admin': {'Admin'}, 'Super Admin': {'Super Admin'}, 'Admin or Super Admin': {'Admin', 'Super Admin'}, 'Super Admin or Admin': {'Admin', 'Super Admin'},
    'Contributor': {'Contributor'}, 'Contributor or Admin': {'Contributor', 'Admin'},
}
# Public routes that check a secret of their own. With a made-up link or no refresh token, everyone must be turned away.
OWN_SECRET = {'Anyone with a valid signed link', 'Anyone with a valid refresh token'}
SKIP = {('POST', '/auth/logout'), ('POST', '/auth/sessions/end-all'), ('POST', '/me/delete')}  # these would end the sessions this test uses

rows = [[c.strip() for c in l.strip().strip('|').split('|')] for l in open(os.path.join(root, 'docs', 'API.md'), encoding='utf-8') if l.startswith('| ') and '`/' in l]
bad, checks = [], 0
for c in rows:
    method, path, marked = c[0], c[1].strip('`'), c[-1]
    if (method, path) in SKIP: continue
    if marked in OWN_SECRET:
        for role, token in tokens.items():
            status, _ = call(method, re.sub(r'\{[^}]+\}', '00000000-0000-4000-8000-000000000000', path), token)
            checks += 1
            if status not in (401, 403): bad.append((method, path, f'{role}: a made-up secret was not refused ({status})'))
        continue
    if marked not in allowed: bad.append((method, path, f'unknown marking “{marked}”')); continue
    url = re.sub(r'\{[^}]+\}', '00000000-0000-4000-8000-000000000000', path)
    for role, token in tokens.items():
        status, _ = call(method, url, token)
        turned_away = status in (401, 403)
        checks += 1
        if status >= 500: bad.append((method, path, f'{role}: server error {status}'))
        if turned_away == (role in allowed[marked]):
            bad.append((method, path, f'{role}: expected {"access" if role in allowed[marked] else "to be turned away"}, got {status}'))

# Second pass: nonsense input. Whatever is sent, the answer must be a clear refusal, never a server error (5xx).
JUNK_QUERY = '?cursor=zzz&limit=abc&from=notadate&to=13-13-13&q=%27%22%3B--&sort=zzz&tab=zzz&status=zzz&lat=x&lng=y&year=abc&to=xx&size=huge&open=1'
import base64
JUNK_QUERY_2 = ('?from=2026-13-45&to=2023-02-29&before=abc&actorId=nobody&incidentId=x&placeId=x&authorId=x&collectionId=x&year=99999&decade=abc&zoom=-3&bbox=a,b,c,d&chart=stories&period=week&limit=-1'
                '&cursor=' + base64.urlsafe_b64encode(b'["notadate","not-a-uuid",{"a":1}]').decode().rstrip('='))
JUNK_BODIES = [{'text': 123, 'title': ['a'], 'id': 'x', 'mediaIds': 'nope', 'type': 'zzz', 'vote': 7, 'reason': None, 'email': 'not-an-email', 'days': 'many', 'draft': 'maybe'},
               {'text': 'x' * 20000, 'tags': ['t'] * 300, 'title': 'x' * 5000}, []]
junk = 0
for c in rows:
    method, path = c[0], c[1].strip('`')
    if (method, path) in SKIP or path.startswith('/auth/'): continue   # the sign-in routes have their own lockout tests
    for made_up in ('00000000-0000-4000-8000-000000000000', 'not-an-id'):
        url = re.sub(r'\{[^}]+\}', made_up, path)
        for role in ('Contributor', 'Admin', 'Super Admin'):
            tries = [(url + JUNK_QUERY, None), (url + JUNK_QUERY_2, None)] if method == 'GET' else [(url, b) for b in JUNK_BODIES]
            for u, body in tries:
                status, _ = call(method, u, tokens[role], body)
                junk += 1
                if status >= 500: bad.append((method, path, f'{role}: server error {status} on nonsense input ({made_up[:10]}, {"query" if body is None else type(body).__name__})'))

print(f'{len(rows) - len(SKIP)} routes, {checks} access checks (4 roles each) and {junk} nonsense-input checks; {len(bad)} problems')
for b in bad: print('  ', *b)
sys.exit(1 if bad else 0)
