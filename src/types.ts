import type { FlagshipBinding } from './config';

export interface Env {
  WECHAT_TOKEN: string;
  CRON_SECRET: string;
  PAGES: Fetcher;
  RESERVED_30_URL?: string;

  GITHUB_TOKEN_FLOW: string;
  GITHUB_REPO: string;
  WORKFLOW_ID: string;
  GITHUB_REF?: string;

  WX_PUSH_URL: string;

  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

  TEST_FLAGS?: FlagshipBinding;

  TASK_SCHEDULER: DurableObjectNamespace;
}

export interface TaskSchedulerStub {
  schedule(openid: string, countdown: number): Promise<void>;
  getAlarmInfo(): Promise<{ alarmAt: number | null; hasTask: boolean }>;
}

export interface IncomingMessage {
  toUser: string;
  fromUser: string;
  msgType: string;
  content: string;
  event: string;
}
