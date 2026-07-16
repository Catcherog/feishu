// 飞书 OAuth 登录云函数（Polling-based 架构）
// 流程：
//   1. App 生成 session_id，打开浏览器进行飞书授权
//   2. 飞书重定向到本云函数（HTTP GET），云函数用 code 换 token 并存入数据库
//   3. 云函数返回纯展示 HTML（不依赖 scheme 跳转）
//   4. App 轮询 checkSession 接口拿 token
//
// 兼容三种调用方式：
//   1. HTTP 网关 POST（service.tcloudbase.com / app.tcloudbase.com）：JSON body 在 event.body 中
//   2. HTTP 网关 GET：飞书 OAuth 回调，query 参数在 event.queryStringParameters 中
//   3. HTTP 网关 OPTIONS：CORS 预检请求

const tcb = require('@cloudbase/node-sdk');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const ENV_ID = 'zeh-d7glqc07me2155c61';

const ACCESS_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v1/access_token';
const REFRESH_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v1/refresh_access_token';

const COLLECTION_NAME = 'feishu_oauth_sessions';
const SESSION_TTL_MS = 5 * 60 * 1000;

// ============ 数据库初始化（懒加载） ============

let dbInstance = null;
function getDb() {
  if (!dbInstance) {
    const app = tcb.init({ env: ENV_ID });
    dbInstance = app.database();
  }
  return dbInstance;
}

// ============ CORS 头 ============

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  ...CORS_HEADERS,
};

// ============ 请求解析 ============

/**
 * 从 event 中获取 HTTP 请求方法（兼容多种网关格式）
 */
function getHttpMethod(event) {
  if (!event) return '';
  // 标准 API 网关格式
  if (typeof event.httpMethod === 'string') return event.httpMethod.toUpperCase();
  // API 网关 v2 格式
  if (event.requestContext?.http?.method) return event.requestContext.http.method.toUpperCase();
  // 旧版 CloudBase 格式
  if (event.requestContext?.httpMethod) return event.requestContext.httpMethod.toUpperCase();
  // 检查 headers 中的方法
  if (event.headers) {
    const method = event.headers['x-http-method'] || event.headers['X-Http-Method'] || event.headers[':method'];
    if (method) return method.toUpperCase();
  }
  return '';
}

/**
 * 判断是否为 HTTP 请求（有 httpMethod 即视为 HTTP 请求）
 */
function isHttpGet(event) {
  return getHttpMethod(event) === 'GET';
}

/**
 * 从 event 中解析出实际请求参数（兼容 HTTP POST body 与 SDK 直调）
 */
function parseEvent(event) {
  if (!event) return { action: '' };

  // 先处理 body（HTTP POST）
  if (event.body !== undefined && event.body !== null) {
    if (typeof event.body === 'string') {
      try {
        const parsed = JSON.parse(event.body);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // body 不是 JSON，返回空 action
      }
    } else if (typeof event.body === 'object') {
      return event.body;
    }
  }

  return event;
}

/**
 * 获取 HTTP 请求的查询参数（兼容多种网关格式）
 */
function getQueryParams(event) {
  if (event.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters;
  }
  if (event.multiValueQueryStringParameters && typeof event.multiValueQueryStringParameters === 'object') {
    // 多值参数，取第一个
    const result = {};
    for (const [key, values] of Object.entries(event.multiValueQueryStringParameters)) {
      result[key] = Array.isArray(values) ? values[0] : values;
    }
    return result;
  }
  if (event.query && typeof event.query === 'object') {
    return event.query;
  }
  if (event.queryParameters && typeof event.queryParameters === 'object') {
    return event.queryParameters;
  }
  return {};
}

// ============ 飞书 API ============

async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data, error: '' };
  } catch (err) {
    return { ok: false, data: null, error: err.message || String(err) };
  }
}

function ensureEnvConfigured() {
  if (!APP_ID || !APP_SECRET) {
    return { code: -1, message: '云函数未配置 FEISHU_APP_ID/FEISHU_APP_SECRET 环境变量' };
  }
  return null;
}

/**
 * Action: exchangeCode — 用授权码换取 access_token
 */
async function exchangeCode(code) {
  if (!code) {
    return { code: -1, message: 'code 不能为空' };
  }

  const { ok, data, error } = await postJSON(ACCESS_TOKEN_URL, {
    app_id: APP_ID,
    app_secret: APP_SECRET,
    grant_type: 'authorization_code',
    code,
  });

  if (!ok) {
    console.error('[feishu-auth] exchangeCode 请求失败:', error);
    return { code: -1, message: `请求飞书失败: ${error}` };
  }

  if (data.code !== 0) {
    console.error('[feishu-auth] exchangeCode 飞书返回错误 code:', data.code, 'msg:', data.msg || data.message);
    return { code: -1, message: data.msg || data.message || `飞书返回错误码 ${data.code}` };
  }

  const d = data.data || {};
  return {
    code: 0,
    data: {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      open_id: d.open_id,
      name: d.name,
      avatar_url: d.avatar_url,
      mobile: d.mobile,
      expires_in: d.expires_in,
      refresh_expires_in: d.refresh_expires_in,
    },
  };
}

/**
 * Action: refreshToken — 用 refresh_token 刷新 access_token
 */
async function refreshToken(refresh_token) {
  if (!refresh_token) {
    return { code: -1, message: 'refresh_token 不能为空' };
  }

  const { ok, data, error } = await postJSON(REFRESH_TOKEN_URL, {
    app_id: APP_ID,
    app_secret: APP_SECRET,
    grant_type: 'refresh_token',
    refresh_token,
  });

  if (!ok) {
    console.error('[feishu-auth] refreshToken 请求失败:', error);
    return { code: -1, message: `请求飞书失败: ${error}` };
  }

  if (data.code !== 0) {
    console.error('[feishu-auth] refreshToken 飞书返回错误 code:', data.code, 'msg:', data.msg || data.message);
    return { code: -1, message: data.msg || data.message || `飞书返回错误码 ${data.code}` };
  }

  const d = data.data || {};
  return {
    code: 0,
    data: {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_in: d.expires_in,
      refresh_expires_in: d.refresh_expires_in,
    },
  };
}

// ============ Session 管理 ============

/**
 * 解析 state 参数，提取 csrf 和 sessionId
 * state 是 base64 编码的 JSON：{ c: csrf, s: sessionId }
 */
function parseState(stateStr) {
  if (!stateStr) return { csrf: '', sessionId: '' };
  try {
    const decoded = Buffer.from(stateStr, 'base64').toString('utf-8');
    const obj = JSON.parse(decoded);
    return {
      csrf: obj.c || stateStr,
      sessionId: obj.s || '',
    };
  } catch {
    return { csrf: stateStr, sessionId: '' };
  }
}

/**
 * 保存 session 到数据库（upsert：存在则替换，不存在则创建）
 */
async function saveSession(sessionId, tokenData, error) {
  if (!sessionId) {
    console.error('[feishu-auth] saveSession: sessionId 为空');
    return;
  }
  const db = getDb();
  const now = Date.now();
  const docData = {
    status: error ? 'error' : 'completed',
    token_data: tokenData || null,
    error: error || null,
    created_at: now,
    expires_at: now + SESSION_TTL_MS,
  };
  try {
    await db.collection(COLLECTION_NAME).doc(sessionId).set({ data: docData });
    console.log('[feishu-auth] saveSession 成功:', sessionId, docData.status);
  } catch (e) {
    console.error('[feishu-auth] saveSession 失败:', e.message || e);
  }
}

/**
 * Action: checkSession — 查询 session 状态
 */
async function checkSession(sessionId) {
  if (!sessionId) {
    return { code: -1, message: 'session_id 不能为空' };
  }
  const db = getDb();
  try {
    const result = await db.collection(COLLECTION_NAME).doc(sessionId).get();
    if (!result.data || result.data.length === 0) {
      return { code: 1, message: 'pending' };
    }
    const doc = result.data[0];
    if (Date.now() > doc.expires_at) {
      return { code: -1, message: '授权会话已过期，请重试' };
    }
    if (doc.status === 'completed' && doc.token_data) {
      return { code: 0, data: doc.token_data };
    }
    if (doc.status === 'error') {
      return { code: -1, message: doc.error || '授权失败' };
    }
    return { code: 1, message: 'pending' };
  } catch (e) {
    console.log('[feishu-auth] checkSession 查询异常（视为 pending）:', e.message || e);
    return { code: 1, message: 'pending' };
  }
}

/**
 * Action: ping — 健康检查，用于验证云函数可访问
 */
function ping() {
  return { code: 0, message: 'pong', timestamp: Date.now() };
}

// ============ HTML 页面 ============

function buildCallbackHtml(success, message) {
  const icon = success ? '✅' : '❌';
  const title = success ? '授权成功' : '授权失败';
  const autoClose = success
    ? `<script>setTimeout(function(){try{window.close();}catch(e){}},2000);</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1A1A2E;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .icon { font-size: 72px; margin-bottom: 24px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { font-size: 16px; opacity: 0.7; }
    .message { font-size: 14px; opacity: 0.5; margin-top: 8px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="icon">${icon}</div>
  <h1>${title}</h1>
  <p>请返回泽怀影像 App</p>
  ${message ? `<div class="message">${message}</div>` : ''}
  ${autoClose}
</body>
</html>`;
}

// ============ HTTP GET 回调处理 ============

async function handleHttpGetCallback(event) {
  const query = getQueryParams(event);
  const code = query.code || '';
  const state = query.state || '';
  const error = query.error || '';

  const parsed = parseState(state);
  const { sessionId } = parsed;

  console.log('[feishu-auth] GET 回调: code=', !!code, 'state_len=', state.length, 'sessionId=', sessionId, 'error=', error, 'all_query_keys=', Object.keys(query).join(','));

  if (error) {
    if (sessionId) {
      await saveSession(sessionId, null, `授权被拒绝: ${error}`);
    }
    return {
      statusCode: 200,
      headers: HTML_HEADERS,
      body: buildCallbackHtml(false, '授权被拒绝: ' + error),
    };
  }

  if (!code) {
    console.log('[feishu-auth] GET 回调无 code，query keys:', Object.keys(query).join(','));
    return {
      statusCode: 200,
      headers: HTML_HEADERS,
      body: buildCallbackHtml(false, '未收到授权码，请返回 App 重试'),
    };
  }

  const tokenResult = await exchangeCode(code);
  if (tokenResult.code === 0) {
    if (sessionId) {
      await saveSession(sessionId, tokenResult.data, null);
    } else {
      console.error('[feishu-auth] GET 回调: 无 sessionId，无法保存 token 到数据库。state=', state.substring(0, 50));
    }
    return {
      statusCode: 200,
      headers: HTML_HEADERS,
      body: buildCallbackHtml(true, null),
    };
  } else {
    if (sessionId) {
      await saveSession(sessionId, null, tokenResult.message);
    }
    return {
      statusCode: 200,
      headers: HTML_HEADERS,
      body: buildCallbackHtml(false, tokenResult.message),
    };
  }
}

// ============ HTTP OPTIONS 处理（CORS 预检） ============

function handleOptions() {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

// ============ 主函数 ============

exports.main = async (event, context) => {
  const requestId = context?.request_id || 'unknown';
  const httpMethod = getHttpMethod(event);

  // 诊断日志：记录每次调用的基本信息
  console.log('[feishu-auth] 请求: method=', httpMethod, 'requestId=', requestId, 'hasBody=', !!(event && event.body), 'hasQuery=', !!(event && (event.queryStringParameters || event.query)), 'eventKeys=', event ? Object.keys(event).slice(0, 10).join(',') : 'null');

  const envErr = ensureEnvConfigured();
  if (envErr) return envErr;

  // HTTP OPTIONS：CORS 预检
  if (httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  // HTTP GET：飞书 OAuth 回调
  if (httpMethod === 'GET') {
    return await handleHttpGetCallback(event);
  }

  // HTTP POST 或 SDK 直调
  const params = parseEvent(event);
  const { action } = params;

  console.log('[feishu-auth] action=', action, 'session_id=', params.session_id || '');

  switch (action) {
    case 'ping':
      return ping();
    case 'exchangeCode':
      return await exchangeCode(params.code);
    case 'refreshToken':
      return await refreshToken(params.refresh_token);
    case 'checkSession':
      return await checkSession(params.session_id);
    default:
      return { code: -1, message: `未知操作: ${action || 'empty'}` };
  }
};
