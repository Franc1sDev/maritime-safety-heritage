"""Writes docs/API.md from the server's own description of its routes, so the reference cannot drift from the code.

  1. Start the server with its API description on (the local demo has it on):  cd backend && npm run demo
  2. python scripts/api-reference.py [http://localhost:4000]

Who may call each route is read from the source (the @Public and @Roles markers)."""
import glob, json, os, re, sys, urllib.request

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4000'
spec = json.load(urllib.request.urlopen(base + '/api/docs-json'))

ROLE = {'admin': 'Admin', 'super_admin': 'Super Admin', 'contributor': 'Contributor'}
def who(marks, inherited, aliases={}):
    if '@Public()' in marks: return 'Anyone'
    for name, roles in aliases.items():  # a file's own short name for a set of roles, e.g. const Engage = () => Roles('contributor', 'admin')
        if f'@{name}()' in marks: marks = marks.replace(f'@{name}()', f'@Roles({roles})')
    m = re.search(r'@Roles\(([^)]*)\)', marks)
    if m: return ' or '.join(ROLE.get(r.strip(" '\""), r.strip(" '\"")) for r in m.group(1).split(','))
    return inherited

access = {}
for path in glob.glob(os.path.join(root, 'backend', 'src', '**', '*.ts'), recursive=True):
    lines = open(path, encoding='utf-8').read().split('\n')
    cls, inherited, pending = None, 'Signed in', ''
    aliases = dict(re.findall(r'const (\w+) = \(\) => Roles\(([^)]*)\)', '\n'.join(lines)))
    for i, line in enumerate(lines):
        c = re.search(r'export class (\w+)', line)
        if c:
            head = ' '.join(lines[max(0, i - 6):i + 1])
            head = head[head.rfind('@Controller'):] if '@Controller' in head else ''
            before = ' '.join(lines[max(0, i - 6):i + 1])
            cls = c.group(1) if '@Controller' in before else None
            marks = before[before.rfind('}') + 1:] if '}' in before else before
            inherited = who(marks, 'Signed in') if cls else 'Signed in'
            continue
        if not cls: continue
        if re.search(r'@(Get|Post|Put|Patch|Delete|Head|Options|All)\(', line): pending = line
        elif pending and '@' in line and not re.match(r'\s*(async\s+)?\w+\(', line): pending += ' ' + line
        m = re.match(r'\s*(?:async\s+)?(\w+)\(', line)
        if pending and m and not line.strip().startswith('@'):
            access[f'{cls}_{m.group(1)}'] = who(pending, inherited, aliases)
            pending = ''

# Public routes that check a secret of their own instead of a sign-in, and rules applied inside the service.
# tests/security/access-matrix.py confirms every line of the finished page against a running server.
access.update({'MediaController_file': 'Anyone with a valid signed link', 'AuthController_refresh': 'Anyone with a valid refresh token',
               'AuthController_profile': 'Contributor'})
groups, missing = {}, []
for p, ops in spec['paths'].items():
    for method, op in ops.items():
        a = access.get(op.get('operationId', ''))
        if a is None: missing.append(op.get('operationId')); a = '—'
        groups.setdefault((op.get('tags') or ['Other'])[0], []).append((p.replace('/api/v1', ''), method.upper(), op.get('summary', ''), a))

order = {'GET': 0, 'POST': 1, 'PUT': 2, 'PATCH': 3, 'DELETE': 4}
out = ['# API reference', '',
       'Every route of the **Remembering the Waters** API. This page is generated from the server itself by `scripts/api-reference.py`; do not edit it by hand.', '',
       f'- **Base address:** `/api/v1` on the archive\'s address (for example `https://<your domain>/api/v1`).',
       '- **Format:** JSON. Uploads use multipart form data, or the tus protocol for large files.',
       '- **Signing in:** send the access token as `Authorization: Bearer <token>`. Tokens last about 15 minutes and are renewed with `POST /auth/refresh`.',
       '- **Language:** send `X-Language: en` or `sw` (or `Accept-Language`) to get messages in that language.',
       '- **Errors:** `{ "statusCode", "code", "message", "details" }`. `code` is stable and safe to test for; `message` is in the reader\'s language.',
       '- **Lists:** long lists use a cursor: pass back `nextCursor` as `cursor` for the next page.',
       '- **Repeating a request safely:** send an `Idempotency-Key` header when creating a story, so a retry cannot create it twice.',
       '- **Live updates:** a Socket.IO connection on the same address carries notifications, message and analytics updates.',
       '- **Interactive version:** `/api/docs` on a development or test server (it is off in production unless `API_DOCS=true`).', '',
       f'{sum(len(v) for v in groups.values())} routes in {len(groups)} groups.', '',
       '**Who may call** — *Anyone*: no sign-in needed. *Signed in*: any signed-in person. *Admin*, *Super Admin*: that role only.', '']
for tag in sorted(groups):
    out += [f'## {tag}', '', '| Method | Path | What it does | Who may call |', '|---|---|---|---|']
    for p, m, s, a in sorted(groups[tag], key=lambda r: (r[0], order.get(r[1], 9))):
        out.append(f'| {m} | `{p}` | {s.replace("|", "/")} | {a} |')
    out.append('')
open(os.path.join(root, 'docs', 'API.md'), 'w', encoding='utf-8').write('\n'.join(out))
print(f'{sum(len(v) for v in groups.values())} routes written; access not found for: {missing or "none"}')
