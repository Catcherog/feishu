import { FEISHU_API_BASE } from '../constants/config';
import { getAccessToken, refreshAccessToken, logout } from './feishuAuth';
import { FeishuRecord, FeishuTableResponse } from '../types';

/** 飞书统一响应体 */
interface FeishuApiResponse<T> {
  code?: number;
  msg?: string;
  data?: T;
}

/** 多维表格单条记录响应（POST/PUT 返回的 data） */
interface FeishuRecordResponse {
  record: FeishuRecord;
}

/** 飞书 token 过期错误码 */
const FEISHU_TOKEN_EXPIRED_CODE = 9910031;

/**
 * 直连飞书 OpenAPI 请求。
 * 自动附带 access_token；遇 HTTP 401 或飞书 code 9910031（token 过期）时
 * 自动刷新一次并重放原请求，仍失败则登出并抛错。避免无限重试。
 */
export async function feishuRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: { body?: any; query?: Record<string, string | number> }
): Promise<T> {
  return feishuRequestInternal<T>(method, path, options, false);
}

async function feishuRequestInternal<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: { body?: any; query?: Record<string, string | number> } | undefined,
  isRetry: boolean
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('未登录');
  }

  let url = `${FEISHU_API_BASE}${path}`;
  if (options?.query) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      sp.set(k, String(v));
    }
    url += `?${sp.toString()}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  };
  if (method !== 'GET' && options?.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (e) {
    throw new Error(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 解析响应体（容错：非 JSON 时使用空对象）
  let payload: FeishuApiResponse<T> = {};
  try {
    payload = (await response.json()) as FeishuApiResponse<T>;
  } catch {
    payload = {};
  }

  // 401 / token 过期拦截：刷新一次后重放，仍失败则登出
  const isTokenExpired = response.status === 401 || payload.code === FEISHU_TOKEN_EXPIRED_CODE;
  if (isTokenExpired) {
    if (isRetry) {
      await logout();
      throw new Error('登录已过期');
    }
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await logout();
      throw new Error('登录已过期');
    }
    return feishuRequestInternal<T>(method, path, options, true);
  }

  if (!response.ok) {
    throw new Error(payload.msg || `HTTP ${response.status}`);
  }

  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.msg || `飞书 API 错误 ${payload.code}`);
  }

  return payload.data as T;
}

// ============ 多维表格便利方法（薄封装，供 feishu.ts 调用） ============

/** 查询多维表格记录（分页） */
export async function bitableGet(
  appToken: string,
  tableId: string,
  params?: { pageSize?: number; pageToken?: string; filter?: string }
): Promise<FeishuTableResponse> {
  const query: Record<string, string | number> = {
    page_size: params?.pageSize ?? 100,
  };
  if (params?.pageToken) query.page_token = params.pageToken;
  if (params?.filter) query.filter = params.filter;
  return feishuRequest<FeishuTableResponse>(
    'GET',
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    { query }
  );
}

/** 新增多维表格记录 */
export async function bitableCreate(
  appToken: string,
  tableId: string,
  fields: Record<string, unknown>
): Promise<FeishuRecordResponse> {
  return feishuRequest<FeishuRecordResponse>(
    'POST',
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    { body: { fields } }
  );
}

/** 更新多维表格记录 */
export async function bitableUpdate(
  appToken: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<FeishuRecordResponse> {
  return feishuRequest<FeishuRecordResponse>(
    'PUT',
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { body: { fields } }
  );
}

/** 按 record_id 查询单条多维表格记录 */
export async function bitableGetRecordById(
  appToken: string,
  tableId: string,
  recordId: string
): Promise<FeishuRecord> {
  return feishuRequest<FeishuRecord>(
    'GET',
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`
  );
}
