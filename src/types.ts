export interface Env {
  WX_TOKEN: string;
  CRON_SECRET: string;
  PAGES_WX_URL: string;
  RESERVED_30_URL?: string;

  GITHUB_TOKEN_FLOW: string;
  GITHUB_REPO: string;
  WORKFLOW_ID: string;
  GITHUB_REF?: string;

  WX_PUSH_URL: string;
  WX_PUSH_TOKEN: string;

  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

  TEST_FLAGS: Flagship;

  TASK_SCHEDULER: DurableObjectNamespace;
}

export interface IncomingMessage {
  toUser: string;
  fromUser: string;
  msgType: string;
  content: string;
  event: string;
}
