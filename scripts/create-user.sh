#!/usr/bin/env bash
# Create a panel user (there is no public sign-up). Uses GoTrue's admin API with the service role
# key. The user then logs in by requesting the magic link (visible in Mailpit).
#
# Usage: ./scripts/create-user.sh you@example.com
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="deploy/.env"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE not found. Run ./scripts/install.sh first."; exit 1; }
[ -n "${1:-}" ] || { echo "Usage: $0 you@example.com"; exit 1; }

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
EMAIL="$1"

echo "==> Creating user $EMAIL on $SUPABASE_PUBLIC_URL …"
code=$(curl -s -o /tmp/af_create_user.out -w "%{http_code}" \
  -X POST "$SUPABASE_PUBLIC_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"email_confirm\":true}")

if [ "$code" = "200" ] || [ "$code" = "201" ]; then
  echo "✓ User created. Open $SITE_URL, request the magic link and open it from Mailpit:"
  echo "  ${PUBLIC_SCHEME}://${PUBLIC_HOST}:${MAIL_UI_PORT}"
else
  echo "✗ Could not create it (HTTP $code):"; cat /tmp/af_create_user.out; echo; exit 1
fi
