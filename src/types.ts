export interface Env {
  WX_TOKEN: string;
  CRON_SECRET: string;
  PAGES_WX_URL: string;
  RESERVED_20_URL: string;
  RESERVED_30_URL: string;
}

export interface WxContext {
  /** 用户 openid（原 XML 的 FromUserName） */
  openid: string;
  /** 公众号原始 id（原 XML 的 ToUserName），构造回复 XML 用 */
  account: string;
  /** 用户回复的原文（CDATA 内容，已 trim） */
  content: string;
}

/** 文本消息处理结果：reply 有值 → 打包 XML 返回微信；reply 为 null → 回 success */
export interface HandlerResult {
  reply: string | null;
}
