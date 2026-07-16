import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRecentChanges, batchSync } from './feishu';
import { addNetworkListener, NetworkStatus } from './network';
import { saveCache } from './localCache';
import { markPendingSync, PENDING_SYNC_PREFIX } from './pendingSync';
import { TABLE_IDS } from '../constants/config';
import {
  getLastSyncTime,
  getSyncingState,
  setSyncingState,
  persistLastSyncTime,
  initSyncStateFromStorage,
} from './syncState';

export { getLastSyncTime, getSyncingState };

let syncInterval: ReturnType<typeof setInterval> | null = null;
let networkUnsubscribe: (() => void) | null = null;

const SYNC_TABLES = [TABLE_IDS.projects, TABLE_IDS.clients, TABLE_IDS.publishTasks, TABLE_IDS.publishDashboard];
const SYNC_SPREADSHEETS: Array<{ key: string; fetcher: () => Promise<{ rows: string[][] }> }> = [
  {
    key: 'projectStats',
    fetcher: async () => {
      const { spreadsheetApi } = await import('./feishu');
      return spreadsheetApi.getProjectStats();
    },
  },
  {
    key: 'publishMatrix',
    fetcher: async () => {
      const { spreadsheetApi } = await import('./feishu');
      return spreadsheetApi.getPublishMatrix();
    },
  },
];

export async function initSyncState(): Promise<void> {
  return initSyncStateFromStorage();
}

export function startAutoSync(intervalMs: number = 5 * 60 * 1000): void {
  stopAutoSync();
  syncInterval = setInterval(async () => {
    await performSync();
  }, intervalMs);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export function startNetworkRecoveryListener(): void {
  stopNetworkRecoveryListener();
  networkUnsubscribe = addNetworkListener((status: NetworkStatus) => {
    if (status.isOnline) {
      retryPendingSync().catch((e) => console.warn('网络恢复重试失败:', e));
    }
  });
}

export function stopNetworkRecoveryListener(): void {
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
}

async function getPendingSyncKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(PENDING_SYNC_PREFIX));
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const keys = await getPendingSyncKeys();
    let count = 0;
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const list: any[] = JSON.parse(raw);
        count += Array.isArray(list) ? list.length : 0;
      }
    }
    return count;
  } catch (e) {
    console.warn('获取待同步数量失败:', e);
    return 0;
  }
}

export async function hasPendingSync(): Promise<boolean> {
  const count = await getPendingSyncCount();
  return count > 0;
}

export async function retryPendingSync(): Promise<{ retried: number; failed: number }> {
  let retried = 0;
  let failed = 0;

  try {
    const keys = await getPendingSyncKeys();
    if (keys.length === 0) {
      return { retried, failed };
    }

    const feishu = await import('./feishu');

    for (const key of keys) {
      const table = key.slice(PENDING_SYNC_PREFIX.length);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const list: any[] = JSON.parse(raw);
      if (list.length === 0) {
        await AsyncStorage.removeItem(key);
        continue;
      }

      const remaining: any[] = [];

      for (const item of list) {
        retried++;
        let success = false;

        try {
          switch (table) {
            case 'projects':
              if (item.recordId) {
                success = await feishu.updateProject(item.recordId, item.fields, item.oldStatus);
              } else {
                success = Boolean(await feishu.createProject(item.fields));
              }
              break;
            case 'clients':
              if (item.recordId) {
                success = await feishu.updateClient(item.recordId, item.fields);
              } else {
                success = Boolean(await feishu.createClient(item.fields));
              }
              break;
            case 'publishBoard':
              success = await feishu.updatePublishTask(item.recordId, item.fields);
              break;
            case 'feishuTasks':
              if (item.taskId) {
                success = await feishu.updateFeishuTask(item.taskId, item.params);
              } else {
                const res = await feishu.createFeishuTask(item.params);
                success = Boolean(res?.taskId);
              }
              break;
            case 'publishMatrix':
              if (item.range && item.values) {
                await feishu.spreadsheetApi.updatePublishMatrix(item.range, item.values);
                success = true;
              }
              break;
            default:
              console.warn(`未知待同步表: ${table}`);
              remaining.push(item);
              continue;
          }
        } catch (e) {
          console.warn(`重试待同步 ${table} 失败:`, e);
          success = false;
        }

        if (!success) {
          failed++;
          remaining.push(item);
        }
      }

      if (remaining.length === 0) {
        await AsyncStorage.removeItem(key);
      } else {
        await AsyncStorage.setItem(key, JSON.stringify(remaining));
      }
    }
  } catch (e) {
    console.warn('重试待同步失败:', e);
  }

  return { retried, failed };
}

async function syncSpreadsheet<T extends { rows: string[][] }>(
  key: string,
  fetcher: () => Promise<T>
): Promise<{ synced: number; failed: number }> {
  try {
    const data = await fetcher();
    await saveCache(key, data.rows);
    return { synced: data.rows.length, failed: 0 };
  } catch (e) {
    console.warn(`同步 Spreadsheet ${key} 失败:`, e);
    return { synced: 0, failed: 1 };
  }
}

export async function performSync(): Promise<{ synced: number; failed: number }> {
  if (getSyncingState()) return { synced: 0, failed: 0 };

  setSyncingState(true);
  let totalSynced = 0;
  let totalFailed = 0;

  try {
    for (const table of SYNC_TABLES) {
      try {
        // 注意：当前为全量同步，sinceTimestamp 参数暂未在 getRecentChanges 中生效
        const changes = await getRecentChanges({
          table,
          sinceTimestamp: getLastSyncTime() || undefined,
        });

        if (changes.items && changes.items.length > 0) {
          await saveCache(`bitable_${table}`, changes.items);
          totalSynced += changes.items.length;
        }
      } catch (e) {
        console.warn(`同步表 ${table} 失败:`, e);
        totalFailed++;
      }
    }

    for (const sheet of SYNC_SPREADSHEETS) {
      const result = await syncSpreadsheet(sheet.key, sheet.fetcher);
      totalSynced += result.synced;
      totalFailed += result.failed;
    }

    const pendingResult = await retryPendingSync();
    totalSynced += pendingResult.retried - pendingResult.failed;
    totalFailed += pendingResult.failed;

    const newSyncTime = new Date().toISOString();
    persistLastSyncTime(newSyncTime).catch((e) => console.warn('持久化 lastSyncTime 失败:', e));
  } finally {
    setSyncingState(false);
  }

  return { synced: totalSynced, failed: totalFailed };
}
