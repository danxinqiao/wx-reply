# wx-reply
处理微信公众号用户回复的内容

微信协议层 Worker：验签、XML 解析、按指令前缀路由、回复打包。**不含业务逻辑**——落库、
15:00 截止、回复文案都在 Pages 的 `/api/wx/callback`（stock-assessment 仓库）。

## 行为

| 用户发 | Worker 动作 |
|---|---|
| `GET /wx`（验签） | 验签通过返回 `echostr`，否则 403 |
| `10xxx`（含 101/102/103） | 转发 Pages `PAGES_WX_URL`，把返回的 reply 包成 XML |
| `20xxx` | 转发 `RESERVED_20_URL`；未配置 → 回「该指令暂未开放」 |
| `30xxx` | 转发 `RESERVED_30_URL`；未配置 → 回「该指令暂未开放」 |
| 其他文本 | 回「回复 101 看涨 · 102 看跌 · 103 看平」 |
| subscribe 事件 | 转发 Pages 写 openid，回 `success` |
| 图片等其他消息 | 回 `success` |

转发带 `X-Cron-Token`（Pages 侧校验），4 秒超时兜底，异常一律回 `success` 让微信停止重试。

## 配置

```bash
wrangler secret put WX_TOKEN       # 微信后台 Token
wrangler secret put CRON_SECRET    # 与 Pages 的 CRON_SECRET 同值
```

`wrangler.toml` 的 `[vars]`：`PAGES_WX_URL`、`RESERVED_20_URL`、`RESERVED_30_URL`（预留两个默认空）。

域名绑定：Worker 面板 → wx-reply → Domains & Routes → 加 `wx.gyegt614.top`，证书 Active 后
再把微信后台服务器配置 URL 填 `https://wx.gyegt614.top/wx`。

## 部署

```bash
wrangler deploy
```
