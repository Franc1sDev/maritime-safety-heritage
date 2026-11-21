#!/bin/sh
# Rebuilds the Word copy of the master plan checklist from docs/MASTER-PLAN-CHECKLIST.md, with the progress count refreshed.
set -e
cd "$(dirname "$0")/.."
MD=docs/MASTER-PLAN-CHECKLIST.md
DONE=$(grep -c -E '^\s*- \[x\]' "$MD" || true)
PART=$(grep -c -E '^\s*- \[~\]' "$MD" || true)
ALL=$(grep -c -E '^\s*- \[[ x~]\]' "$MD")
sed -i -E "s/^\*\*Progress: .*\*\*$/**Progress: $DONE of $ALL items ticked, $PART partly done**/" "$MD"
# Word shows ☒ for done and ☐ for not done; partly done items are marked ◪.
sed -E 's/^(\s*)- \[~\] /\1- [ ] ◪ PARTLY: /' "$MD" | pandoc -f gfm -t docx --metadata title="Master Plan Checklist" -o "Maritime Heritage Project - Master Plan Checklist.docx"
echo "$DONE of $ALL ticked, $PART partly done"
