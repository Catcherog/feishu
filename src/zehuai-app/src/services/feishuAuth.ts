import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callFunction } from './cloudbase';
import { UserProfile } from '../types';
import { FEISHU_APP_ID, FEISHU_REDIRECT_URI, FEISHU_AUTHORIZE_URL, FEISHU_OAUTH_SCOPES } from '../constants/config';

// ============ AsyncStorage 键 ============

const STORAGE_KEYS = {
  accessToken: 'feishu_access_token',
  refreshToken: 'feishu_refresh_token',
  userInfo: 'feishu_user_info',
  tokenExpiresAt: 'feishu_token_expires_at',
  refreshExpiresAt: 'feishu_refresh_expires_at',
} as const;

// ============ 模块级缓存 ============

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: UserProfile | null = null;
let expiresAt: number = 0; // 毫秒时间戳
let refreshExpiresAt: number = 0; // 毫秒时间戳
let tokensLoaded = false;

// OAuth state（CSRF 防护，仅暂存内存）
let pendingState: string | null = null;

// ============ 飞书云函数返回数据类型 ============

interface FeishuTokenData {
  access_token: string;
  refresh_token: string;
  open_id: string;
  name: string;
  avatar_url: string;
  mobile: string;
  expires_in: number;
  refresh_expires_in: number;
}

interface FeishuRefreshData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}

// ============ Token 持久化 ============

/** 启动时从 AsyncStorage 加载 token 到内存（仅加载一次） */
async function loadPersistedTokens(): Promise<void> {
  if (tokensLoaded) return;
  tokensLoaded = true;
  try {
    const [[, a], [, r], [, u], [, ea], [, rea]] = await AsyncStorage.multiGet([
      STORAGE_KEYS.accessToken,
      STORAGE_KEYS.refreshToken,
      STORAGE_KEYS.userInfo,
      STORAGE_KEYS.tokenExpiresAt,
      STORAGE_KEYS.refreshExpiresAt,
    ]);
    if (a) accessToken = a;
    if (r) refreshToken = r;
    if (u) {
      try {
        currentUser = JSON.parse(u) as UserProfile;
      } catch {
        currentUser = null;
      }
    }
    if (ea) expiresAt = Number(ea) || 0;
    if (rea) refreshExpiresAt = Number(rea) || 0;
  } catch {
    // 加载失败保持默认空值
  }
}

/** 写入内存 + AsyncStorage（refresh 场景不传 user，保留原 currentUser） */
async function persistTokens(args: {
  accessToken: string;
  refreshToken: string;
  user?: UserProfile;
  expiresIn: number;
  refreshExpiresIn: number;
}): Promise<void> {
  accessToken = args.accessToken;
  refreshToken = args.refreshToken;
  if (args.user) currentUser = args.user;
  expiresAt = Date.now() + args.expiresIn * 1000;
  refreshExpiresAt = Date.now() + args.refreshExpiresIn * 1000;
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.accessToken, accessToken],
      [STORAGE_KEYS.refreshToken, refreshToken],
      [STORAGE_KEYS.userInfo, JSON.stringify(currentUser)],
      [STORAGE_KEYS.tokenExpiresAt, String(expiresAt)],
      [STORAGE_KEYS.refreshExpiresAt, String(refreshExpiresAt)],
    ]);
  } catch {
    // 写入失败忽略，内存仍可用
  }
}

/** 清空内存 + AsyncStorage */
async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  expiresAt = 0;
  refreshExpiresAt = 0;
  pendingState = null;
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.accessToken,
      STORAGE_KEYS.refreshToken,
      STORAGE_KEYS.userInfo,
      STORAGE_KEYS.tokenExpiresAt,
      STORAGE_KEYS.refreshExpiresAt,
    ]);
  } catch {
    // 忽略
  }
}

// ============ 工具函数 ============

/** 生成 16 位 hex 随机字符串用于 OAuth state（CSRF 防护） */
function generateState(): string {
  const bytes = new Uint8Array(8);
  const cryptoObj = (globalThis as unknown as {
    crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array };
  }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** 生成 32 位 hex 随机字符串用于 session_id（OAuth 会话标识） */
function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = (globalThis as unknown as {
    crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array };
  }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** 将 state 对象编码为 base64 字符串（传递 csrf token + sessionId） */
function encodeState(csrf: string, sessionId: string): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify({ c: csrf, s: sessionId }))));
  } catch {
    return csrf;
  }
}

/** 安全关闭浏览器（兼容 dismissBrowser 返回 undefined 或抛错的情况） */
async function safeDismissBrowser(): Promise<void> {
  try {
    await WebBrowser.dismissBrowser();
  } catch {
    // 忽略所有错误（浏览器已关闭 / 返回 undefined / 抛异常）
  }
}

// ============ 对外 API ============

/**
 * 构造飞书 OAuth 授权 URL（WebView 内嵌使用）
 * 使用桌面 UA 加载时飞书显示网页登录，不会拉起飞书 App
 */
export function buildFeishuAuthUrl(): string {
  return (
    `${FEISHU_AUTHORIZE_URL}?app_id=${FEISHU_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(FEISHU_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(FEISHU_OAUTH_SCOPES)}` +
    `&state=${encodeURIComponent('webview')}`
  );
}

/**
 * 直接用授权码 code 完成登录（WebView 拦截回调后调用）
 * 不依赖轮询，直接通过云函数 exchangeCode 接口换 token
 */
export async function completeLoginWithCode(code: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callFunction<FeishuTokenData>('feishu-auth', {
      action: 'exchangeCode',
      code,
    });

    if (result.code === 0 && result.data) {
      const d = result.data;
      const user: UserProfile = {
        uid: d.open_id,
        phone: d.mobile || '',
        nickname: d.name || '',
        avatar: d.avatar_url || '',
        role: 'staff',
        loginAt: new Date().toISOString(),
        open_id: d.open_id,
      };
      await persistTokens({
        accessToken: d.access_token,
        refreshToken: d.refresh_token,
        user,
        expiresIn: d.expires_in,
        refreshExpiresIn: d.refresh_expires_in,
      });
      pendingState = null;
      console.log('[feishuAuth] 登录成功 (code exchange)');
      return { success: true, message: '登录成功' };
    }

    return { success: false, message: result.message || '授权码无效，请重试' };
  } catch (e) {
    console.error('[feishuAuth] exchangeCode 异常:', e);
    return { success: false, message: '网络错误，请重试' };
  }
}

/**
 * 获取 OAuth 回调的 redirect URI 前缀，用于 WebView 拦截
 */
export function getRedirectUriPrefix(): string {
  return FEISHU_REDIRECT_URI;
}

/**
 * 发起飞书 OAuth 登录流程（Polling-based 架构 - 已废弃，保留作降级）
 *
 * @deprecated 移动端飞书会强制拉起飞书 App 导致回调丢失，请使用 WebView 方式
 */
export async function loginWithFeishu(): Promise<{ success: boolean; message: string }> {
  // 1. 生成 session_id 和 csrf token
  const sessionId = generateSessionId();
  const csrfToken = generateState();
  pendingState = csrfToken;

  // 2. 构造 state（编码 csrf + sessionId）
  const stateParam = encodeState(csrfToken, sessionId);

  // 3. 构造飞书授权 URL
  const authorizeUrl =
    `${FEISHU_AUTHORIZE_URL}?app_id=${FEISHU_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(FEISHU_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(FEISHU_OAUTH_SCOPES)}` +
    `&state=${encodeURIComponent(stateParam)}`;

  console.log('[feishuAuth] session_id:', sessionId);
  console.log('[feishuAuth] authorizeUrl:', authorizeUrl);

  // 4. 打开浏览器（fire-and-forget，不阻塞）
  try {
    const browserResult = WebBrowser.openBrowserAsync(authorizeUrl);
    if (browserResult && typeof browserResult.catch === 'function') {
      browserResult.catch((e: unknown) => {
        console.error('[feishuAuth] 打开浏览器失败:', e);
      });
    }
  } catch (e) {
    console.error('[feishuAuth] 打开浏览器异常:', e);
    pendingState = null;
    return { success: false, message: '无法打开浏览器，请重试' };
  }

  // 5. 轮询 checkSession，等待云函数处理完成
  const timeoutMs = 90 * 1000; // 90 秒超时
  const pollIntervalMs = 2000; // 每 2 秒轮询一次
  const startTime = Date.now();
  let pollCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    // 等待轮询间隔
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    pollCount++;

    try {
      const result = await callFunction<FeishuTokenData>('feishu-auth', {
        action: 'checkSession',
        session_id: sessionId,
      });

      console.log(`[feishuAuth] checkSession #${pollCount}: code=${result.code}`);

      if (result.code === 0 && result.data) {
        // 授权成功，拿到 token 数据
        const d = result.data;
        const user: UserProfile = {
          uid: d.open_id,
          phone: d.mobile || '',
          nickname: d.name || '',
          avatar: d.avatar_url || '',
          role: 'staff',
          loginAt: new Date().toISOString(),
          open_id: d.open_id,
        };
        await persistTokens({
          accessToken: d.access_token,
          refreshToken: d.refresh_token,
          user,
          expiresIn: d.expires_in,
          refreshExpiresIn: d.refresh_expires_in,
        });
        pendingState = null;
        await safeDismissBrowser();
        console.log('[feishuAuth] 登录成功');
        return { success: true, message: '登录成功' };
      }

      if (result.code === -1) {
        // 明确错误（非 pending），终止
        pendingState = null;
        await safeDismissBrowser();
        return { success: false, message: result.message || '授权失败' };
      }

      // code === 1，pending，继续轮询
    } catch (e) {
      console.error('[feishuAuth] checkSession 异常:', e);
      // 网络错误等，继续重试
    }
  }

  // 6. 超时
  pendingState = null;
  await safeDismissBrowser();
  console.log('[feishuAuth] 授权超时');
  return { success: false, message: '授权超时，请重试' };
}

/** 判断是否已登录（access token 存在且 refresh token 仍未过期） */
export async function isAuthenticated(): Promise<boolean> {
  await loadPersistedTokens();
  return accessToken !== null && Date.now() < refreshExpiresAt;
}

/** 获取当前登录用户信息 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  await loadPersistedTokens();
  return currentUser;
}

/**
 * 获取 access token：若剩余有效期 <5min 且 refresh token 仍有效，自动刷新。
 * 返回 null 表示未登录或刷新失败。
 */
export async function getAccessToken(): Promise<string | null> {
  await loadPersistedTokens();
  if (!accessToken) return null;
  // 即将过期或已过期，尝试用 refresh_token 刷新
  if (Date.now() >= expiresAt - 5 * 60 * 1000) {
    if (Date.now() >= refreshExpiresAt) {
      return null;
    }
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
  }
  return accessToken;
}

/** 用 refresh_token 刷新 access_token；失败则清空登录态 */
export async function refreshAccessToken(): Promise<boolean> {
  await loadPersistedTokens();
  if (!refreshToken) return false;
  try {
    const result = await callFunction<FeishuRefreshData>('feishu-auth', {
      action: 'refreshToken',
      refresh_token: refreshToken,
    });
    if (result.code !== 0 || !result.data) {
      await clearTokens();
      return false;
    }
    const d = result.data;
    await persistTokens({
      accessToken: d.access_token,
      refreshToken: d.refresh_token,
      expiresIn: d.expires_in,
      refreshExpiresIn: d.refresh_expires_in,
    });
    return true;
  } catch {
    await clearTokens();
    return false;
  }
}

/** 退出登录，清空所有 token 与用户信息 */
export async function logout(): Promise<void> {
  await clearTokens();
}
