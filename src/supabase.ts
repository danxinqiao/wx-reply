import { fetchWithTimeout } from './http';
import type { Env } from './types';

export interface TaskMessage {
  title: string;
  content: string;
}

export async function pushTaskCreated(env: Env, openid: string, message: TaskMessage): Promise<void> {
  const base = env.WX_PUSH_URL.replace(/\/+$/, '');
  const response = await fetchWithTimeout(
    `${base}/task-created`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: env.WX_PUSH_TOKEN,
      },
      body: JSON.stringify({
        openid,
        title: message.title,
        content: message.content,
      }),
    },
    3000,
  );

  if (!response.ok) {
    throw new Error(`supabase push http ${response.status}`);
  }
}
