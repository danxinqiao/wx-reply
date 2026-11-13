import { DurableObject } from 'cloudflare:workers';
import { errorMessage } from './http';
import { pushTaskCreated, type TaskMessage } from './supabase';
import type { Env } from './types';

// 提醒延时由 Flagship 的 dsh_countdown 控制，单位：秒，必须小于 18000（5h）。
// flag 未配置或读取失败时：默认提前 15 分钟提醒 → 17100 秒（4h45m）。
const DEFAULT_COUNTDOWN_SECONDS = 17_100;
// 提醒文案按“总时长 5 小时 - dsh_countdown”计算剩余分钟，向下取整。
const TOTAL_SECONDS = 5 * 60 * 60;

const FLAG_KEY = 'dsh_countdown';

/** Worker 侧读 flag（读失败时回退默认值）。 */
export async function readCountdownSeconds(env: Env): Promise<number> {
  try {
    return await env.TEST_FLAGS.getNumberValue(FLAG_KEY, DEFAULT_COUNTDOWN_SECONDS);
  } catch (error) {
    console.error('[scheduler] flagship read failed, using default', errorMessage(error));
    return DEFAULT_COUNTDOWN_SECONDS;
  }
}

export function buildReminderMessage(countdownSeconds: number): TaskMessage {
  const remainingMinutes = Math.max(0, Math.floor((TOTAL_SECONDS - countdownSeconds) / 60));
  return {
    title: 'dsh剩余时间提醒',
    content: `还剩余${remainingMinutes}分钟`,
  };
}

interface StoredTask {
  openid: string;
  scheduledAt: number;
  countdown: number;
}

export class TaskScheduler extends DurableObject<Env> {
  async schedule(openid: string, countdown: number): Promise<void> {
    const scheduledAt = Date.now();
    await this.ctx.storage.put('task', { openid, scheduledAt, countdown });
    const alarmAt = scheduledAt + countdown * 1000;
    await this.ctx.storage.setAlarm(alarmAt);
    console.log('[scheduler] scheduled', { openid, countdown, scheduledAt, alarmAt });
  }

  async alarm(): Promise<void> {
    const task = await this.ctx.storage.get<StoredTask>('task');
    console.log('[scheduler] alarm fired', { task });
    if (!task) return;

    try {
      const message = buildReminderMessage(task.countdown);
      await pushTaskCreated(this.env, task.openid, message);
      console.log('[scheduler] reminder pushed', { openid: task.openid, message });
    } catch (error) {
      console.error('[scheduler] reminder push failed', errorMessage(error));
    } finally {
      await this.ctx.storage.delete('task');
    }
  }

  async getAlarmInfo(): Promise<{ alarmAt: number | null; hasTask: boolean }> {
    const [alarmAt, task] = await Promise.all([
      this.ctx.storage.getAlarm(),
      this.ctx.storage.get<StoredTask>('task'),
    ]);
    return { alarmAt, hasTask: Boolean(task) };
  }
}
