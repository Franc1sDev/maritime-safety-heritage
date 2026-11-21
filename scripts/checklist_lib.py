"""Ticks items in docs/MASTER-PLAN-CHECKLIST.md. Used by the small scripts that record progress after each piece of work.

    from checklist_lib import Checklist
    c = Checklist()
    c.mark('2.5 API Design', 'x')                                  # every item under that heading
    c.mark('2.2 Technology Stack', '~', only=['**Database**'], note='PostGIS is optional')
    c.save()
"""
import os, re, sys

PATH = os.path.join(os.path.dirname(__file__), '..', 'docs', 'MASTER-PLAN-CHECKLIST.md')
ITEM = re.compile(r'^(\s*)- \[([ x~])\] (.*)$')
HEAD = re.compile(r'^(#{2,6}) (.*)$')


class Checklist:
    def __init__(self):
        self.lines = open(PATH, encoding='utf-8').read().split('\n')
        self.changed = 0

    def _range(self, section):
        start = level = None
        for i, l in enumerate(self.lines):
            m = HEAD.match(l)
            if not m:
                continue
            if start is None and re.sub(r'\s+', ' ', m.group(2)).startswith(section):
                start, level = i, len(m.group(1))
            elif start is not None and len(m.group(1)) <= level:
                return start, i
        if start is None:
            sys.exit(f'Section not found: {section}')
        return start, len(self.lines)

    def mark(self, section, status, only=None, skip=None, note=None):
        a, b = self._range(section)
        hits = 0
        wanted = list(only or [])
        for i in range(a, b):
            m = ITEM.match(self.lines[i])
            if not m:
                continue
            text = m.group(3).split(' — *')[0]
            if only is not None:
                match = [o for o in only if text.startswith(o)]
                if not match:
                    continue
                for o in match:
                    if o in wanted:
                        wanted.remove(o)
            if skip and any(text.startswith(s) for s in skip):
                continue
            label = {'x': 'Note', '~': 'Left', ' ': 'Note'}[status]
            self.lines[i] = f'{m.group(1)}- [{status}] {text}' + (f' — *{label}: {note}*' if note else '')
            hits += 1
        if wanted:
            sys.exit(f'Not found under "{section}": {wanted}')
        if not hits:
            sys.exit(f'Nothing matched under "{section}"')
        self.changed += hits

    def save(self):
        open(PATH, 'w', encoding='utf-8').write('\n'.join(self.lines))
        done = sum(1 for l in self.lines if re.match(r'^\s*- \[x\]', l))
        part = sum(1 for l in self.lines if re.match(r'^\s*- \[~\]', l))
        total = sum(1 for l in self.lines if ITEM.match(l))
        print(f'{self.changed} items updated. Now {done} of {total} ticked, {part} partly done.')
