import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncConflict {
  field: string;
  localValue: string;
  remoteValue: string;
}

export interface ConflictLogEntry {
  id: string;
  table: string;
  recordId: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localFields?: Record<string, unknown>;
  remoteFields?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

const CONFLICT_LOG_KEY = '@zehuai_sync_conflict_log';
const MAX_LOG_ENTRIES = 200;
const LOG_RETENTION_DAYS = 30;

export function showSyncConflictAlert(conflicts: SyncConflict[]): void {
  Alert.alert(
    '数据冲突',
    `检测到 ${conflicts.length} 项数据冲突，将使用最新数据覆盖`,
    [{ text: '确定', style: 'default' }]
  );
}

function parseTimestamp(value: string | number | Date): number | null {
  if (!value && value !== 0) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getTime();
}

/**
 * 检测是否可能存在数据冲突
 * @param localUpdatedAt 本地记录更新时间
 * @param remoteUpdatedAt 远端记录更新时间
 * @param thresholdMs 冲突时间窗口，默认 60 秒
 * @returns 两侧在阈值内均发生变更时返回 true
 */
export function detectConflict(
  localUpdatedAt: string | number | Date,
  remoteUpdatedAt: string | number | Date,
  thresholdMs: number = 60000
): boolean {
  const localTs = parseTimestamp(localUpdatedAt);
  const remoteTs = parseTimestamp(remoteUpdatedAt);

  if (localTs === null || remoteTs === null) {
    return false;
  }

  return Math.abs(localTs - remoteTs) <= thresholdMs;
}

async function loadConflictLogs(): Promise<ConflictLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICT_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('加载冲突日志失败:', e);
    return [];
  }
}

function pruneExpiredLogs(logs: ConflictLogEntry[]): ConflictLogEntry[] {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter((entry) => {
    const ts = new Date(entry.createdAt).getTime();
    return !Number.isNaN(ts) && ts > cutoff;
  });
}

/**
 * 将冲突记录写入本地 AsyncStorage 冲突日志
 */
export async function logConflict(
  record: Omit<ConflictLogEntry, 'id' | 'createdAt'>
): Promise<void> {
  try {
    const logs = pruneExpiredLogs(await loadConflictLogs());

    const entry: ConflictLogEntry = {
      ...record,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    logs.unshift(entry);

    if (logs.length > MAX_LOG_ENTRIES) {
      logs.length = MAX_LOG_ENTRIES;
    }

    await AsyncStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('写入冲突日志失败:', e);
  }
}

/**
 * 获取本地冲突日志列表
 */
export async function getConflictLogs(): Promise<ConflictLogEntry[]> {
  return pruneExpiredLogs(await loadConflictLogs());
}

/**
 * 清空本地冲突日志
 */
export async function clearConflictLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CONFLICT_LOG_KEY);
  } catch (e) {
    console.warn('清空冲突日志失败:', e);
  }
}
