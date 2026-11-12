import { textReply, verifySignature, xmlField } from './wechat';
import type { Env, WxContext } from './types';

const HINT = '回复 101 看涨 · 102 看跌 · 103 看平';
const NOT_OPEN = '该指令暂未开放';

/** 转发到 Pages /api/wx/callback（业务层），返回 reply 文案或 null。 */
async function callBusiness(
  env: Env,
  body: Record<string, string>,
): Promise<string | null> {
  const response = await fetch(env.PAGES_WX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Token': env.CRON_SECRET,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) {
    console.error(`[wx-reply] business ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return null;
  }

  const data = (await response.json()) as { reply?: string | null };
  return data.reply ?? null;
}

function replyXml(ctx: WxContext, reply: string): Response {
  return new Response(textReply(ctx.openid, ctx.account, reply), {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

function success(): Response {
  return new Response('success', { status: 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.replace(/\/+$/, '') !== '/wx') {
      return new Response('Not Found', { status: 404 });
    }

    const signature = url.searchParams.get('signature');
    const timestamp = url.searchParams.get('timestamp');
    const nonce = url.searchParams.get('nonce');

    // GET：微信后台「服务器配置」保存时的验证
    if (request.method === 'GET') {
      const echostr = url.searchParams.get('echostr');
      if (!signature || !timestamp || !nonce || !echostr) {
        return new Response('signature mismatch', { status: 403 });
      }
      const ok = await verifySignature(env.WX_TOKEN, timestamp, nonce, signature);
      if (!ok) {
        console.error('[wx-reply] get signature mismatch');
        return new Response('signature mismatch', { status: 403 });
      }
      console.log('[wx-reply] url verified');
      return new Response(echostr, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // POST：微信推送的用户消息
    if (!signature || !timestamp || !nonce) {
      return new Response('missing signature', { status: 403 });
    }
    const ok = await verifySignature(env.WX_TOKEN, timestamp, nonce, signature);
    if (!ok) {
      console.error('[wx-reply] post signature mismatch');
      return new Response('signature mismatch', { status: 403 });
    }

    const xml = await request.text();
    const msgType = xmlField(xml, 'MsgType');
    const openid = xmlField(xml, 'FromUserName') ?? '';
    const account = xmlField(xml, 'ToUserName') ?? '';

    // 事件：subscribe 抓 openid，其余忽略
    if (msgType === 'event') {
      if (xmlField(xml, 'Event') === 'subscribe' && openid) {
        console.log(`[wx-reply] subscribe from ${openid}`);
        const reply = await callBusiness(env, { type: 'subscribe', openid });
        return reply ? replyXml({ openid, account, content: '' }, reply) : success();
      }
      return success();
    }

    // 非文本消息：忽略
    if (msgType !== 'text') {
      return success();
    }

    const content = xmlField(xml, 'Content') ?? '';
    const ctx: WxContext = { openid, account, content };

    // 无匹配前缀：提示语
    if (!/^(10|20|30)/.test(content)) {
      return replyXml(ctx, HINT);
    }

    try {
      if (content.startsWith('10')) {
        const reply = await callBusiness(env, { type: 'text', openid, content });
        return reply ? replyXml(ctx, reply) : success();
      }

      if (content.startsWith('20')) {
        if (!env.RESERVED_20_URL) {
          return replyXml(ctx, NOT_OPEN);
        }
        const reply = await callBusiness(
          { ...env, PAGES_WX_URL: env.RESERVED_20_URL },
          { type: 'text', openid, content },
        );
        return reply ? replyXml(ctx, reply) : success();
      }

      if (!env.RESERVED_30_URL) {
        return replyXml(ctx, NOT_OPEN);
      }
      const reply = await callBusiness(
        { ...env, PAGES_WX_URL: env.RESERVED_30_URL },
        { type: 'text', openid, content },
      );
      return reply ? replyXml(ctx, reply) : success();
    } catch (error) {
      console.error('[wx-reply] failed:', error);
      return success();
    }
  },
};
