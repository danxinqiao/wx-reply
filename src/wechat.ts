/** sha1(sorted([token, timestamp, nonce]).join('')) === signature（微信官方验签算法） */
export async function verifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string,
): Promise<boolean> {
  const raw = [token, timestamp, nonce].sort().join('');
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature.toLowerCase();
}

/** 从明文 XML 里取一个字段，兼容 CDATA。 */
export function xmlField(xml: string, tag: string): string | null {
  const pattern = new RegExp(
    `<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
  );
  const match = xml.match(pattern);
  if (!match) return null;
  return (match[1] ?? match[2] ?? '').trim();
}

/** 被动回复文本消息（明文模式）。fromUser=用户 openid，toUser=公众号原始 id。 */
export function textReply(
  toUser: string,
  fromUser: string,
  content: string,
): string {
  return [
    '<xml>',
    `<ToUserName><![CDATA[${toUser}]]></ToUserName>`,
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    '<MsgType><![CDATA[text]]></MsgType>',
    `<Content><![CDATA[${content}]]></Content>`,
    '</xml>',
  ].join('');
}
