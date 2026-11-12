#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://wx.gyegt614.top}"
TOKEN="${WX_TOKEN:?set WX_TOKEN first}"
ECHOSTR="${1:-hello}"

TS="$(date +%s)"
NONCE="$RANDOM"
SIG="$(printf '%s\n' "$TOKEN" "$TS" "$NONCE" | sort | tr -d '\n' | sha1sum | cut -d' ' -f1)"

curl -sS -i "$BASE/wx?signature=$SIG&timestamp=$TS&nonce=$NONCE&echostr=$ECHOSTR"
