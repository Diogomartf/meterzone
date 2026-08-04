#!/usr/bin/env bash
# Add Migadu email DNS records for meterzone.net on Cloudflare.
# Requires CLOUDFLARE_API_TOKEN or CF_API_TOKEN with Zone.DNS Edit for meterzone.net.
#
# Create a token: https://dash.cloudflare.com/profile/api-tokens
#   Use template "Edit zone DNS" → include zone meterzone.net
set -euo pipefail

ZONE_NAME="${ZONE_NAME:-meterzone.net}"
ZONE_ID="${ZONE_ID:-89db93f9f458cf09ed014402801466f4}"
TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "Error: set CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) with Zone.DNS Edit for ${ZONE_NAME}." >&2
  echo "Create one: https://dash.cloudflare.com/profile/api-tokens (template: Edit zone DNS)" >&2
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -sS -X "$method" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$data" \
      "https://api.cloudflare.com/client/v4${path}"
  else
    curl -sS -X "$method" \
      -H "Authorization: Bearer ${TOKEN}" \
      "https://api.cloudflare.com/client/v4${path}"
  fi
}

check_ok() {
  python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('success'):
    print('FAILED:', d.get('errors'), file=sys.stderr)
    sys.exit(1)
r = d.get('result')
if isinstance(r, dict):
    print('OK:', r.get('type'), r.get('name'), (r.get('content') or '')[:60])
elif isinstance(r, list):
    print('OK: list', len(r))
else:
    print('OK')
"
}

# Find records matching type + exact name. Optional content / priority filters.
find_records() {
  local type="$1"
  local name="$2"
  api GET "/zones/${ZONE_ID}/dns_records?type=${type}&name=${name}&per_page=100" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('result') or [] if d.get('success') else []))"
}

upsert_simple() {
  local type="$1"
  local name="$2"
  local content="$3"
  local priority="${4:-}"
  local proxied="${5:-false}"

  local payload
  if [[ "$type" == "MX" ]]; then
    payload=$(PRIORITY="$priority" NAME="$name" CONTENT="$content" PROXIED="$proxied" python3 -c '
import json, os
print(json.dumps({
  "type": "MX",
  "name": os.environ["NAME"],
  "content": os.environ["CONTENT"],
  "priority": int(os.environ["PRIORITY"]),
  "ttl": 1,
  "proxied": os.environ["PROXIED"] == "true",
}))
')
  else
    payload=$(TYPE="$type" NAME="$name" CONTENT="$content" PROXIED="$proxied" python3 -c '
import json, os
print(json.dumps({
  "type": os.environ["TYPE"],
  "name": os.environ["NAME"],
  "content": os.environ["CONTENT"],
  "ttl": 1,
  "proxied": os.environ["PROXIED"] == "true",
}))
')
  fi

  local existing
  existing=$(find_records "$type" "$name")
  local existing_id=""
  if [[ "$type" == "MX" ]]; then
    existing_id=$(EXISTING="$existing" CONTENT="$content" PRIORITY="$priority" python3 -c '
import json, os
for r in json.loads(os.environ["EXISTING"]):
    if r.get("content") == os.environ["CONTENT"] and int(r.get("priority") or -1) == int(os.environ["PRIORITY"]):
        print(r["id"]); break
')
  else
    existing_id=$(EXISTING="$existing" CONTENT="$content" python3 -c '
import json, os
want = os.environ["CONTENT"]
for r in json.loads(os.environ["EXISTING"]):
    # Cloudflare may wrap TXT in quotes
    c = (r.get("content") or "").strip("\"")
    if c == want or r.get("content") == want:
        print(r["id"]); break
')
  fi

  local response
  if [[ -n "$existing_id" ]]; then
    echo "Updating ${type} ${name}..."
    response=$(api PUT "/zones/${ZONE_ID}/dns_records/${existing_id}" "$payload")
  else
    echo "Creating ${type} ${name}..."
    response=$(api POST "/zones/${ZONE_ID}/dns_records" "$payload")
  fi
  echo "$response" | check_ok
}

upsert_srv() {
  local name="$1"   # e.g. _autodiscover._tcp
  local priority="$2"
  local weight="$3"
  local port="$4"
  local target="$5"

  local payload
  payload=$(NAME="$name" PRIORITY="$priority" WEIGHT="$weight" PORT="$port" TARGET="$target" python3 -c '
import json, os
print(json.dumps({
  "type": "SRV",
  "name": os.environ["NAME"],
  "ttl": 1,
  "data": {
    "priority": int(os.environ["PRIORITY"]),
    "weight": int(os.environ["WEIGHT"]),
    "port": int(os.environ["PORT"]),
    "target": os.environ["TARGET"],
  },
}))
')

  local fqdn="${name}.${ZONE_NAME}"
  local existing
  existing=$(find_records "SRV" "$fqdn")
  local existing_id
  existing_id=$(EXISTING="$existing" TARGET="$target" PORT="$port" python3 -c '
import json, os
want_t = os.environ["TARGET"].rstrip(".")
want_p = int(os.environ["PORT"])
for r in json.loads(os.environ["EXISTING"]):
    data = r.get("data") or {}
    t = (data.get("target") or r.get("content") or "").rstrip(".")
    if t == want_t and int(data.get("port") or -1) == want_p:
        print(r["id"]); break
')

  local response
  if [[ -n "$existing_id" ]]; then
    echo "Updating SRV ${name}..."
    response=$(api PUT "/zones/${ZONE_ID}/dns_records/${existing_id}" "$payload")
  else
    echo "Creating SRV ${name}..."
    response=$(api POST "/zones/${ZONE_ID}/dns_records" "$payload")
  fi
  echo "$response" | check_ok
}

delete_conflicting_mx() {
  # Remove root MX that are not Migadu (Cloudflare Email Routing etc.)
  local existing
  existing=$(find_records "MX" "$ZONE_NAME")
  EXISTING="$existing" python3 -c '
import json, os, sys
keep = {"aspmx1.migadu.com", "aspmx2.migadu.com"}
for r in json.loads(os.environ["EXISTING"]):
    content = (r.get("content") or "").rstrip(".").lower()
    if content not in keep:
        print(r["id"], r.get("content"), r.get("priority"))
' | while read -r id content priority; do
    [[ -z "${id:-}" ]] && continue
    echo "Deleting conflicting MX ${content} (pri ${priority})..."
    api DELETE "/zones/${ZONE_ID}/dns_records/${id}" | check_ok
  done
}

echo "Configuring Migadu DNS for ${ZONE_NAME} (zone ${ZONE_ID})..."

# Verify token can read DNS
api GET "/zones/${ZONE_ID}/dns_records?per_page=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('success'):
    print('Auth/DNS access failed:', d.get('errors'), file=sys.stderr)
    sys.exit(1)
print('DNS access OK')
"

delete_conflicting_mx

# --- Required ---
upsert_simple TXT "$ZONE_NAME" "hosted-email-verify=a7ispuol"
upsert_simple MX "$ZONE_NAME" "aspmx1.migadu.com" 10
upsert_simple MX "$ZONE_NAME" "aspmx2.migadu.com" 20

# DKIM CNAMEs (Cloudflare: no trailing dot on target)
upsert_simple CNAME "key1._domainkey.${ZONE_NAME}" "key1.meterzone.net._domainkey.migadu.com"
upsert_simple CNAME "key2._domainkey.${ZONE_NAME}" "key2.meterzone.net._domainkey.migadu.com"
upsert_simple CNAME "key3._domainkey.${ZONE_NAME}" "key3.meterzone.net._domainkey.migadu.com"

upsert_simple TXT "$ZONE_NAME" "v=spf1 include:spf.migadu.com -all"
upsert_simple TXT "_dmarc.${ZONE_NAME}" "v=DMARC1; p=quarantine;"

# --- Optional: subdomain addressing ---
upsert_simple MX "*.${ZONE_NAME}" "aspmx1.migadu.com" 10
upsert_simple MX "*.${ZONE_NAME}" "aspmx2.migadu.com" 20

# --- Optional: autoconfig / autodiscovery ---
upsert_simple CNAME "autoconfig.${ZONE_NAME}" "autoconfig.migadu.com"
upsert_srv "_autodiscover._tcp" 0 1 443 "autodiscover.migadu.com"
upsert_srv "_submissions._tcp" 0 1 465 "smtp.migadu.com"
upsert_srv "_imaps._tcp" 0 1 993 "imap.migadu.com"
upsert_srv "_pop3s._tcp" 0 1 995 "pop.migadu.com"

echo
echo "Done. Listing mail-related records:"
api GET "/zones/${ZONE_ID}/dns_records?per_page=100" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in sorted(d.get('result') or [], key=lambda x: (x['type'], x['name'])):
    t = r['type']
    if t in ('MX','SRV') or 'migadu' in (r.get('content') or '').lower() or 'domainkey' in r['name'] or r['name'].startswith('_dmarc') or 'spf' in (r.get('content') or '').lower() or 'hosted-email' in (r.get('content') or '') or 'autoconfig' in r['name'] or '_autodiscover' in r['name'] or '_imap' in r['name'] or '_pop' in r['name'] or '_submission' in r['name']:
        extra = ''
        if t == 'MX':
            extra = f\" pri={r.get('priority')}\"
        elif t == 'SRV':
            data = r.get('data') or {}
            extra = f\" {data.get('priority')}/{data.get('weight')} port={data.get('port')} -> {data.get('target')}\"
        print(f\"{t:6} {r['name']:40}{(r.get('content') or '')[:55]}{extra}\")
"
