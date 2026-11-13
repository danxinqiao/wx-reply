import { errorMessage } from './http';
import { dispatchWorkflow } from './github';
import { pushTaskCreated } from './supabase';
import { getKey, setKey, OPENID_KEY, TASK_KEY } from './upstash';
import type { Env } from './types';

export interface Handler20Input {
  env: Env;
  fromUser: string;
  content: string;
  ctx: ExecutionContext;
}

export async function handle20(input: Handler20Input): Promise<string> {
  const { env, fromUser, content, ctx } = input;

  const admin = await getKey(env, OPENID_KEY).catch(() => null);
  if (!admin || admin.trim() !== fromUser) return '无权限';

  const trimmed = content.trim();
  const command = trimmed.split(/\s+/, 1)[0];
  const argument = trimmed.slice(command.length).trim();

  switch (command) {
    case '201':
      return run201(env);
    case '202':
      return run202(env, admin.trim(), argument, ctx);
    case '203':
      return run203(env);
    default:
      return '未知指令';
  }
}

async function run201(env: Env): Promise<string> {
  if (!env.GITHUB_REPO || !env.WORKFLOW_ID) return '未配置 GitHub 参数';

  try {
    const status = await dispatchWorkflow(env);
    return status === 204 ? '已触发工作流 ✓' : `触发失败：http ${status}`;
  } catch (error) {
    console.error('[20xxx] github dispatch failed', errorMessage(error));
    return `触发失败：${errorMessage(error)}`;
  }
}

async function run202(
  env: Env,
  openid: string,
  argument: string,
  ctx: ExecutionContext,
): Promise<string> {
  if (!isHttpUrl(argument)) return '用法：202 <url>';

  try {
    await setKey(env, TASK_KEY, argument);
  } catch (error) {
    console.error('[20xxx] upstash set failed', errorMessage(error));
    return '保存失败';
  }

  ctx.waitUntil(
    pushTaskCreated(
      env,
      openid,
      { title: '创建已完成', content: 'dsh创建完成，回复203查看链接' },
    ).catch((error) => {
      console.error('[20xxx] supabase push failed', errorMessage(error));
    }),
  );

  ctx.waitUntil(
    scheduleReminder(env, openid).catch((error) => {
      console.error('[20xxx] schedule reminder failed', errorMessage(error));
    }),
  );

  return '已保存 ✓';
}

async function scheduleReminder(env: Env, openid: string): Promise<void> {
  const id = env.TASK_SCHEDULER.idFromName('dsh-task');
  const stub = env.TASK_SCHEDULER.get(id);
  await stub.schedule(openid);
}

async function run203(env: Env): Promise<string> {
  try {
    const value = await getKey(env, TASK_KEY);
    return value ? value : '暂无记录';
  } catch (error) {
    console.error('[20xxx] upstash get failed', errorMessage(error));
    return '读取失败';
  }
}

function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
