# feishu-auth 云函数

飞书 OAuth token 交换极简云函数。仅做 `code → token` 与 `refresh_token → token` 交换，`app_secret` 只从环境变量读取，绝不下发到 App 端。

## 用途

APP 改用飞书 OAuth 登录后，授权码换 token 必须在服务端完成（app_secret 不可放 App），由本云函数承担：

- `exchangeCode`：用授权码换取 access_token / refresh_token 及用户信息
- `refreshToken`：用 refresh_token 刷新 access_token

> 本函数不调用任何 Bitable / Spreadsheet / Wiki / Drive / IM / Task API，纯 token 交换。

## 接口

通过 `event.action` 分发：

### exchangeCode
入参：
```json
{ "action": "exchangeCode", "code": "飞书授权码" }
```
成功返回：
```json
{ "code": 0, "data": { "access_token", "refresh_token", "open_id", "name", "avatar_url", "mobile", "expires_in", "refresh_expires_in" } }
```

### refreshToken
入参：
```json
{ "action": "refreshToken", "refresh_token": "刷新令牌" }
```
成功返回：
```json
{ "code": 0, "data": { "access_token", "refresh_token", "expires_in", "refresh_expires_in" } }
```

失败统一返回 `{ "code": -1, "message": "错误描述" }`。

## 环境变量

在 CloudBase 云函数环境变量中配置（**必须**，缺失时函数将直接返回配置错误）：

| 变量名 | 说明 |
|--------|------|
| `FEISHU_APP_ID` | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret（仅服务端可见） |

## 安全说明

- `app_secret` 仅从 `process.env.FEISHU_APP_SECRET` 读取，绝不硬编码、绝不下发 App
- 不输出 `app_secret` / `access_token` / `refresh_token` 等敏感值到日志
- 失败日志仅输出飞书返回的错误 message 与 code

## 部署

使用 tcb / cloudbase CLI 部署：

```bash
# 在 zehuai-app 目录下
tcb fn deploy feishu-auth --envId <your-env-id>

# 或
cloudbase functions:deploy feishu-auth --envId <your-env-id>
```

部署后需在控制台为该云函数配置环境变量 `FEISHU_APP_ID` 与 `FEISHU_APP_SECRET`。
