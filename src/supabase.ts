import { fetchWithTimeout } from './http';
import type { Env } from './types';

export const TASK_TITLE = '创建已完成';
export const TASK_CONTENT = 'dsh创建完成，回复203查看链接';

export async function pushTaskCreated(env: Env, openid: string): Promise<void> {
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
        title: TASK_TITLE,
        content: TASK_CONTENT,
      }),
    },
    3000,
  );

  if (!response.ok) {
    throw new Error(`supabase push http ${response.status}`);
  }
}
