import { handle20 } from './commands20';
import { DEFAULT_TIMEOUT_MS, errorMessage, fetchWithTimeout, json, text, xml } from './http';
import { classify } from './route';
import { TaskScheduler } from './scheduler';
import type { Env, IncomingMessage } from './types';
import { buildTextReply, parseMessage, verifySignature } from './wechat';

export { TaskScheduler };

const HINT = '回复 101 看涨；102 看跌；103 看平；201 dsh';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/wx' && url.pathname !== '/alarm-status') {
      return json({ error: 'not found' }, 404);
    }

    const signature = url.searchParams.get('signature');
    const timestamp = url.searchParams.get('timestamp');
    const nonce = url.searchParams.get('nonce');

    if (!(await verifySignature(env.WX_TOKEN, signature, timestamp, nonce))) {
      return json({ error: 'signature mismatch' }, 403);
    }

    if (request.method === 'GET') {
      if (url.pathname === '/alarm-status') {
        const stub = env.TASK_SCHEDULER.get(env.TASK_SCHEDULER.idFromName('dsh-task'));
        const info = await stub.getAlarmInfo();
        return json({ ...info, now: Date.now() });
      }
      const echostr = url.searchParams.get('echostr');
      if (!echostr) return json({ error: 'missing echostr' }, 403);
      return text(echostr);
    }

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const message = parseMessage(await request.text());

    if (message.msgType === 'event') {
      if (message.event === 'subscribe') {
        await forward(env, { type: 'subscribe', openid: message.fromUser }).catch((error) => {
          console.error('[wx] subscribe forward failed', errorMessage(error));
        });
      }
      return text('success');
    }

    if (message.msgType !== 'text') return text('success');

    const route = classify(message.content);

    if (route.kind === 'pages') {
      try {
        const data = await forward(env, {
          type: 'text',
          openid: message.fromUser,
          content: message.content,
        });
        return replyOrSuccess(message, data.reply);
      } catch (error) {
        console.error('[wx] pages forward failed', errorMessage(error));
        return text('success');
      }
    }

    if (route.kind === 'local20') {
      const reply = await handle20({
        env,
        fromUser: message.fromUser,
        content: message.content,
        ctx,
      });
      return xml(buildTextReply(message.fromUser, message.toUser, reply));
    }

    if (route.kind === 'reserved30') {
      if (!env.RESERVED_30_URL) {
        return xml(buildTextReply(message.fromUser, message.toUser, '该指令暂未开放'));
      }
      try {
        const data = await forwardTo(env.RESERVED_30_URL, env.CRON_SECRET, {
          type: 'text',
          openid: message.fromUser,
          content: message.content,
        });
        return replyOrSuccess(message, data.reply);
      } catch (error) {
        console.error('[wx] reserved30 forward failed', errorMessage(error));
        return text('success');
      }
    }

    return xml(buildTextReply(message.fromUser, message.toUser, HINT));
  },
} satisfies ExportedHandler<Env>;

interface ForwardReply {
  reply?: string | null;
}

function forward(env: Env, payload: unknown): Promise<ForwardReply> {
  return forwardTo(env.PAGES_WX_URL, env.CRON_SECRET, payload);
}

async function forwardTo(target: string, token: string, payload: unknown): Promise<ForwardReply> {
  const response = await fetchWithTimeout(
    target,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Token': token,
      },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) throw new Error(`http ${response.status}`);
  return (await response.json().catch(() => ({}))) as ForwardReply;
}

function replyOrSuccess(message: IncomingMessage, reply: string | null | undefined): Response {
  if (!reply) return text('success');
  return xml(buildTextReply(message.fromUser, message.toUser, reply));
}
