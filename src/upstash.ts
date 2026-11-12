import { fetchWithTimeout, SHORT_TIMEOUT_MS } from './http';
import type { Env } from './types';

export const OPENID_KEY = 'wx_push_openid';
export const TASK_KEY = 'wx:harness:task';

interface UpstashResponse {
  result?: unknown;
  error?: string;
}

async function command(env: Env, value: (string | number)[]): Promise<unknown> {
  const base = env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
  const response = await fetchWithTimeout(
    base,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    },
    SHORT_TIMEOUT_MS,
  );

  const data = (await response.json().catch(() => ({}))) as UpstashResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error || `upstash http ${response.status}`);
  }
  return data.result;
}

export async function getKey(env: Env, key: string): Promise<string | null> {
  const result = await command(env, ['GET', key]);
  return typeof result === 'string' ? result : null;
}

export async function setKey(env: Env, key: string, value: string): Promise<void> {
  await command(env, ['SET', key, value]);
}
