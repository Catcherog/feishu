import { CloudBaseCallResult } from '../types';

const CLOUDBASE_ENV_ID = 'zeh-d7glqc07me2155c61';
const SERVICE_BASE = `https://${CLOUDBASE_ENV_ID}.service.tcloudbase.com`;

/**
 * 调用 CloudBase 云函数（仅网关方式，无需认证态）。
 * feishu-auth 等云函数为公开访问，通过 service.tcloudbase.com 网关直调即可。
 */
export async function callFunction<T = unknown>(
  functionName: string,
  data: Record<string, unknown> = {}
): Promise<CloudBaseCallResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${SERVICE_BASE}/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    if (response.ok) {
      const result = await response.json();
      if (result.code === 0) {
        return { code: 0, data: result.data as T, message: 'success', requestId: '' };
      }
      return { code: result.code || -1, data: null as T, message: result.message || '请求失败', requestId: '' };
    }
    return { code: -1, data: null as T, message: `HTTP ${response.status}`, requestId: '' };
  } catch (e) {
    const isAbort = e instanceof Error && e.name === 'AbortError';
    return { code: -1, data: null as T, message: isAbort ? '请求超时' : '网络错误', requestId: '' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export { CLOUDBASE_ENV_ID };
