import { DurableObject } from 'cloudflare:workers';
import { errorMessage } from './http';
import { pushTaskCreated, type TaskMessage } from './supabase';
import type { Env } from './types';

export const REMINDER_DELAY_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000;

export const REMINDER_MESSAGE: TaskMessage = {
  title: 'dsh剩余时间提醒',
  content: '还剩余15分钟',
};

interface StoredTask {
  openid: string;
  scheduledAt: number;
}

export class TaskScheduler extends DurableObject<Env> {
  async schedule(openid: string): Promise<void> {
    const scheduledAt = Date.now();
    await this.ctx.storage.put('task', { openid, scheduledAt });
    await this.ctx.storage.setAlarm(scheduledAt + REMINDER_DELAY_MS);
  }

  async alarm(): Promise<void> {
    const task = await this.ctx.storage.get<StoredTask>('task');
    if (!task) return;

    try {
      await pushTaskCreated(this.env, task.openid, REMINDER_MESSAGE);
    } catch (error) {
      console.error('[scheduler] reminder push failed', errorMessage(error));
    } finally {
      await this.ctx.storage.delete('task');
    }
  }
}
