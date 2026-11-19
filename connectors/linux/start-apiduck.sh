#!/usr/bin/env bash
set -euo pipefail
base_url="https://apiduh.netlify.app"

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI was not found. Install it from Anthropic first, then run this launcher." >&2
  exit 1
fi

if [[ -z "${API_DUCK_CUSTOMER_KEY:-}" ]]; then
  read -r -s -p "Customer API key (sk-gw-...) — input hidden: " API_DUCK_CUSTOMER_KEY
  printf '\n'
fi
if [[ ! "$API_DUCK_CUSTOMER_KEY" =~ ^sk-gw-[a-f0-9]{64}$ ]]; then
  unset API_DUCK_CUSTOMER_KEY
  echo "Invalid customer key format. Use the key issued by the ApiDuck administrator." >&2
  exit 1
fi

export ANTHROPIC_BASE_URL="$base_url"
export ANTHROPIC_AUTH_TOKEN="$API_DUCK_CUSTOMER_KEY"
unset API_DUCK_CUSTOMER_KEY
echo "Launching Claude Code through $base_url. The customer key is not saved by this script."
exec claude "$@"
