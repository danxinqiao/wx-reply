# wx-reply

微信公众号回调 Worker：验签、XML 解析、被动回复打包，并本地处理 `20xxx` 运维指令。

## 路由

| 前缀 | 处理 |
|---|---|
| `10xxx` | 转发 Pages `PAGES_WX_URL`（仅签名） |
| `20xxx` | 本地执行（201 / 202 / 203） |
| `30xxx` | 转发 `RESERVED_30_URL`（未配置回「该指令暂未开放」） |
| 其他 | 回提示语 |

`GET /wx` 验签后原样返回 `echostr`；`POST /wx` 验签后处理消息。

## 签名服务

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET`/`POST` | `/sign` | 颁发签名，返回 `{ timestamp, signature }`；需 `X-Cron-Token: CRON_SECRET` |
| `GET`/`POST` | `/verify` | 校验签名，参数 `timestamp`、`signature`（query 或 JSON body），返回 `{ valid, reason? }`；需 `X-Cron-Token: CRON_SECRET` |

签名算法：`md5(毫秒时间戳 + CRON_SECRET)`，时间戳允许前后 ±60 秒。
调用方请求其他 Worker / Pages Function 时带上 `X-Sign-Timestamp` 与 `X-Signature`；
接收方把这两个值交给 `POST /verify` 校验。
调用方通过 `[[services]] binding = "WX_REPLY" service = "wx-reply"` 走内部 service binding，
不经过公网；未绑定该 binding 时才回退到 `WX_REPLY_URL`。

## 20xxx

执行前先读 Upstash key `wx_push_openid`，与消息 `FromUserName` 比对，不一致或读取失败一律回「无权限」。

| 指令 | 动作 | 回复 |
|---|---|---|
| `201` | 触发 GitHub Actions workflow dispatch（`GITHUB_REPO` / `WORKFLOW_ID` / `GITHUB_REF`） | `已触发工作流 ✓` |
| `202 <url>` | 把 URL 写入 Upstash `wx:harness:task`，随后后台调 Supabase `/task-created` 推送 | `已保存 ✓` |
| `203` | 读取 Upstash `wx:harness:task` | URL / `暂无记录` |

`202` 先写 Upstash 再后台推送；推送失败只记日志，不影响已返回的「已保存 ✓」。

## 文件

```
src/
├─ index.ts       Worker 入口：GET/POST /wx、转发、回复
├─ wechat.ts      SHA1 验签、XML 解析、回复 XML
├─ route.ts       10/20/30 前缀路由
├─ sign.ts        /sign 与 /verify：MD5 签名与时间窗校验
├─ md5.ts         纯 JS MD5（Workers 的 Web Crypto 不支持 MD5）
├─ commands20.ts  20xxx：白名单 + 201/202/203
├─ github.ts      GitHub Actions dispatch
├─ upstash.ts     Upstash Redis REST 读写
├─ supabase.ts    调 wx-push /task-created
├─ http.ts        超时 fetch、响应工具
└─ types.ts       Env 与消息类型
```

## 配置

`wrangler.toml` 里填普通变量：

```toml
GITHUB_REPO = "owner/repo"
WORKFLOW_ID = "deploy.yml"   # 或数字 ID
GITHUB_REF  = "main"
```

以下用 secret 写入（不要提交）：

```bash
wrangler secret put WECHAT_TOKEN
wrangler secret put CRON_SECRET
wrangler secret put GITHUB_TOKEN_FLOW
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

> `GITHUB_TOKEN_FLOW` 需要目标仓库 Actions 的 write 权限。
> `CRON_SECRET` 同时用于 `/sign`、`/verify` 与所有签名校验。
> `UPSTASH_REDIS_REST_URL` 也可以放 `[vars]`，但它和 token 成对，建议都走 secret。

Supabase 侧需要新增 `/wx-push/task-created` 路由（见方案 §9.8.1），模板 ID 为 `WECHAT_TEMPLATE_TASK_ID`，字段 `title` / `content`。

## 部署

```bash
npm install
npm run typecheck
npx wrangler deploy
```

`wrangler.toml` 已声明自定义域 `wx.gyegt614.top`；首次部署后到 Cloudflare 面板确认证书 Active，再把微信后台 URL 切到 `https://wx.gyegt614.top/wx`。

## 本地测试

```bash
export WECHAT_TOKEN='你的 WECHAT_TOKEN'
./scripts/verify.sh hello
./scripts/send.sh 101
./scripts/send.sh '202 https://example.com/task/1'
./scripts/send.sh 203
```

也可以直接用 `wrangler dev`，配合 `.dev.vars`（参考 `.dev.vars.example`）在本地起服务。
