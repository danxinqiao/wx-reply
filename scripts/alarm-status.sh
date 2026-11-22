#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://wx.gyegt614.top}"
TOKEN="${WECHAT_TOKEN:?set WECHAT_TOKEN first}"

TS="$(date +%s)"
NONCE="$RANDOM"
SIG="$(printf '%s\n' "$TOKEN" "$TS" "$NONCE" | sort | tr -d '\n' | sha1sum | cut -d' ' -f1)"

curl -sS "$BASE/alarm-status?signature=$SIG&timestamp=$TS&nonce=$NONCE"
echo
