import AsyncStorage from '@react-native-async-storage/async-storage';

// 待同步记录的 AsyncStorage key 前缀
export const PENDING_SYNC_PREFIX = '@zehuai_pending_sync/';

// 将失败的写入标记为待同步
export async function markPendingSync(table: string, record: any): Promise<void> {
  const key = `${PENDING_SYNC_PREFIX}${table}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const list: any[] = raw ? JSON.parse(raw) : [];
    list.push({ ...record, _pendingAt: new Date().toISOString() });
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn(`标记待同步 ${table} 失败:`, e);
  }
}
