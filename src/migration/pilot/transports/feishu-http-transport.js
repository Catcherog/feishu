'use strict';

// Real Feishu HTTP Pilot transport.
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-04
//
// Stage B runner 在生产模式下使用此 transport 调用飞书 API：
//   1. 用 app_id + app_secret 换取 tenant_access_token（缓存到过期前 60s）
//   2. POST /bitable/v1/apps/:app_token/tables/:table_id/records
//   3. 返回 { record_id }
//
// 失败时 fail-closed — 抛错，不返回伪造的 record_id。
//
// 环境变量（生产模式必需）：
//   FEISHU_APP_ID            飞书应用 App ID
//   FEISHU_APP_SECRET        飞书应用 App Secret
//   FEISHU_BASE_APP_TOKEN    飞书 Base App Token（多维表格所属的 app token）
//   FEISHU_OPEN_API_BASE     可选，默认 https://open.feishu.cn/open-apis
//
// 安全：App Secret 不会出现在日志、错误消息或返回值中。fetch 失败时只
// 抛出包含 HTTP 状态码和阶段（token / record）的通用错误。

const DEFAULT_BASE_URL = 'https://open.feishu.cn/open-apis';
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000; // 提前 60s 刷新 token

/**
 * Create a real Feishu HTTP transport.
 *
 * @param {object} options
 * @param {string} options.appId         - FEISHU_APP_ID
 * @param {string} options.appSecret     - FEISHU_APP_SECRET
 * @param {string} options.appToken      - FEISHU_BASE_APP_TOKEN (bitable app token)
 * @param {string} [options.baseUrl]     - Open API base URL
 * @param {typeof fetch} [options.fetchImpl] - 可注入 fetch（用于测试）
 * @returns {Function} transport(tableId, fields, idempotencyKey) -> Promise<{record_id}>
 */
function createFeishuHttpTransport(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('createFeishuHttpTransport: options object is required');
  }
  const { appId, appSecret, appToken, baseUrl = DEFAULT_BASE_URL, fetchImpl } = options;
  if (!appId || !appSecret) {
    throw new Error(
      'createFeishuHttpTransport: appId and appSecret are required for real Feishu transport'
    );
  }
  if (!appToken) {
    throw new Error(
      'createFeishuHttpTransport: appToken (FEISHU_BASE_APP_TOKEN) is required for real Feishu transport'
    );
  }
  const _fetch = typeof fetchImpl === 'function' ? fetchImpl : fetch;
  if (typeof _fetch !== 'function') {
    throw new Error(
      'createFeishuHttpTransport: global fetch is not available. Use Node 18+ or inject fetchImpl.'
    );
  }

  // tenant_access_token cache
  let cachedToken = null;
  let cachedTokenExpiresAt = 0;

  async function getTenantAccessToken() {
    const now = Date.now();
    if (cachedToken && now < cachedTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return cachedToken;
    }
    const resp = await _fetch(`${baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    if (!resp.ok) {
      throw new Error(
        `FeishuHttpTransport: tenant_access_token HTTP ${resp.status} (token phase)`
      );
    }
    const data = await resp.json();
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(
        `FeishuHttpTransport: tenant_access_token failed code=${data.code} msg=${data.msg || '<empty>'}`
      );
    }
    cachedToken = data.tenant_access_token;
    cachedTokenExpiresAt = now + (data.expire || 7200) * 1000;
    return cachedToken;
  }

  /**
   * transport(tableId, fields, idempotencyKey)
   *
   * @param {string} tableId
   * @param {object} fields
   * @param {string} idempotencyKey
   * @returns {Promise<{record_id: string}>}
   */
  async function transport(tableId, fields, idempotencyKey) {
    const token = await getTenantAccessToken();
    const url = `${baseUrl}/bitable/v1/apps/${appToken}/tables/${tableId}/records`;
    const resp = await _fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!resp.ok) {
      throw new Error(
        `FeishuHttpTransport: create record HTTP ${resp.status} (record phase, table=${tableId})`
      );
    }
    const data = await resp.json();
    if (data.code !== 0) {
      throw new Error(
        `FeishuHttpTransport: create record failed code=${data.code} msg=${data.msg || '<empty>'} (table=${tableId})`
      );
    }
    const recordId = data && data.data && data.data.record && data.data.record.record_id;
    if (!recordId) {
      throw new Error(
        `FeishuHttpTransport: create record returned no record_id (table=${tableId})`
      );
    }
    return { record_id: recordId };
  }

  return transport;
}

module.exports = {
  createFeishuHttpTransport,
  DEFAULT_BASE_URL,
};
