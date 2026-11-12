import type { IncomingMessage } from './types';

export async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySignature(
  token: string,
  signature: string | null,
  timestamp: string | null,
  nonce: string | null,
): Promise<boolean> {
  if (!signature || !timestamp || !nonce) return false;
  const expected = await sha1Hex([token, timestamp, nonce].sort().join(''));
  return timingSafeEqual(expected, signature.toLowerCase());
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export function parseMessage(xml: string): IncomingMessage {
  return {
    toUser: extractTag(xml, 'ToUserName'),
    fromUser: extractTag(xml, 'FromUserName'),
    msgType: extractTag(xml, 'MsgType').toLowerCase(),
    content: extractTag(xml, 'Content'),
    event: extractTag(xml, 'Event').toLowerCase(),
  };
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`);
  const match = re.exec(xml);
  if (!match) return '';
  return (match[1] ?? match[2] ?? '').trim();
}

export function buildTextReply(toUser: string, fromUser: string, content: string): string {
  return [
    '<xml>',
    `<ToUserName><![CDATA[${cdata(toUser)}]]></ToUserName>`,
    `<FromUserName><![CDATA[${cdata(fromUser)}]]></FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    '<MsgType><![CDATA[text]]></MsgType>',
    `<Content><![CDATA[${cdata(content)}]]></Content>`,
    '</xml>',
  ].join('');
}

function cdata(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>');
}
