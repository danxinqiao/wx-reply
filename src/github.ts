import { fetchWithTimeout, SHORT_TIMEOUT_MS } from './http';
import type { Env } from './types';

export async function dispatchWorkflow(env: Env): Promise<number> {
  const workflow = encodeURIComponent(env.WORKFLOW_ID);
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN_FLOW}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'wx-reply',
      },
      body: JSON.stringify({ ref: env.GITHUB_REF || 'main' }),
    },
    SHORT_TIMEOUT_MS,
  );

  return response.status;
}
