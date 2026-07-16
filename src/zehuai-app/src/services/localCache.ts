import AsyncStorage from '@react-native-async-storage/async-storage';

// 本地缓存服务：为飞书数据提供离线兜底

const CACHE_PREFIX = '@zehuai_cache/';

export async function loadCache<T>(table: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${table}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`加载缓存 ${table} 失败:`, e);
    return [];
  }
}

export async function saveCache<T>(table: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${table}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`保存缓存 ${table} 失败:`, e);
  }
}

export async function clearCache(table?: string): Promise<void> {
  try {
    if (table) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${table}`);
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (e) {
    console.warn('清除缓存失败:', e);
  }
}
