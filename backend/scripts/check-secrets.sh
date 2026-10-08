#!/bin/sh
# Scans files for secrets. With --staged, scans only what is about to be committed.
PATTERNS='sk-or-v1-[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|(SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|USDA_API_KEY|CRON_SECRET)=[A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
if [ "$1" = "--staged" ]; then
  files=$(git diff --cached --name-only --diff-filter=ACM)
else
  files=$(git ls-files . 2>/dev/null)
fi
found=0
for f in $files; do
  case "$f" in *.env.example|*check-secrets.sh|*/.env.example) continue ;; esac
  [ -f "$f" ] || continue
  if grep -EnI "$PATTERNS" "$f" >/dev/null 2>&1; then
    echo "Possible secret in $f:"; grep -EnI "$PATTERNS" "$f" | cut -c1-120
    found=1
  fi
  case "$f" in *.env|*/.env) echo "Refusing to commit $f"; found=1 ;; esac
done
[ $found -eq 0 ] && echo "check-secrets: clean"
exit $found
