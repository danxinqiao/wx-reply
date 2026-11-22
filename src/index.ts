import { handle20 } from './commands20';
import { loadConfig } from './config';
import { DEFAULT_TIMEOUT_MS, errorMessage, fetchWithTimeout, json, text, xml } from './http';
import { classify } from './route';
import { TaskScheduler } from './scheduler';
import {
  signNow,
  signedHeaders,
  verifySignature as verifyRequestSignature,
} from './sign';
import type { Env, IncomingMessage, TaskSchedulerStub } from './types';
import { buildTextReply, parseMessage, verifySignature } from './wechat';

export { TaskScheduler };

const HINT = '回复 101 看涨；102 看跌；103 看平；201 dsh';

const CONFIG_FALLBACKS = {
  WECHAT_TOKEN: '',
  CRON_SECRET: '',
  PAGES_WX_URL: '',
  RESERVED_30_URL: '',
  GITHUB_TOKEN_FLOW: '',
  GITHUB_REPO: '',
  WORKFLOW_ID: '',
  GITHUB_REF: 'main',
  WX_PUSH_URL: '',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
};

export default {
  async fetch(request: Request, rawEnv: Env, ctx: ExecutionContext): Promise<Response> {
    const env = await loadConfig(rawEnv, CONFIG_FALLBACKS);
    const url = new URL(request.url);

    if (url.pathname === '/sign') {
      if (!isSignAuthorized(request, env.CRON_SECRET)) {
        return json({ error: 'unauthorized' }, 401);
      }
      return json(signNow(env.CRON_SECRET));
    }

    if (url.pathname === '/verify') {
      if (!env.CRON_SECRET) {
        return json({ valid: false, reason: 'not_configured' }, 500);
      }
      if (!isSignAuthorized(request, env.CRON_SECRET)) {
        return json({ error: 'unauthorized' }, 401);
      }
      const pair = await readSignaturePair(request, url);
      return json(verifyRequestSignature(pair.timestamp, pair.signature, env.CRON_SECRET));
    }

    if (url.pathname !== '/wx' && url.pathname !== '/alarm-status') {
      return json({ error: 'not found' }, 404);
    }

    const signature = url.searchParams.get('signature');
    const timestamp = url.searchParams.get('timestamp');
    const nonce = url.searchParams.get('nonce');

    if (!(await verifySignature(env.WECHAT_TOKEN, signature, timestamp, nonce))) {
      return json({ error: 'signature mismatch' }, 403);
    }

    if (request.method === 'GET') {
      if (url.pathname === '/alarm-status') {
        const stub = env.TASK_SCHEDULER.get(
          env.TASK_SCHEDULER.idFromName('dsh-task'),
        ) as unknown as TaskSchedulerStub;
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
        ...signedHeaders(token),
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

function isSignAuthorized(request: Request, secret: string): boolean {
  if (!secret) return false;
  const token = request.headers.get('X-Cron-Token') ?? request.headers.get('Authorization') ?? '';
  return token === secret;
}

async function readSignaturePair(
  request: Request,
  url: URL,
): Promise<{ timestamp: string; signature: string }> {
  let timestamp = url.searchParams.get('timestamp') ?? '';
  let signature = url.searchParams.get('signature') ?? '';
  if ((!timestamp || !signature) && request.method !== 'GET') {
    try {
      const body = (await request.json()) as { timestamp?: unknown; signature?: unknown };
      if (!timestamp && typeof body.timestamp === 'string') timestamp = body.timestamp;
      if (!signature && typeof body.signature === 'string') signature = body.signature;
    } catch {
      // ignore a malformed or empty body
    }
  }
  return { timestamp, signature };
}
