#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://wx.gyegt614.top}"
TOKEN="${WX_TOKEN:?set WX_TOKEN first}"
OPENID="${OPENID:-oUPTI2yAIBpKK_YkxHttqSc7TYiw}"
CONTENT="${1:?usage: send.sh <content>}"

TS="$(date +%s)"
NONCE="$RANDOM"
SIG="$(printf '%s\n' "$TOKEN" "$TS" "$NONCE" | sort | tr -d '\n' | sha1sum | cut -d' ' -f1)"

curl -sS -X POST "$BASE/wx?signature=$SIG&timestamp=$TS&nonce=$NONCE" \
  -H 'Content-Type: text/xml' \
  --data-binary "<xml><ToUserName><![CDATA[gh_test]]></ToUserName><FromUserName><![CDATA[$OPENID]]></FromUserName><CreateTime>$TS</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[$CONTENT]]></Content><MsgId>1</MsgId></xml>"
echo
