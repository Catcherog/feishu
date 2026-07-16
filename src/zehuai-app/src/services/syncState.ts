import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_TIME_KEY = '@zehuai_app/last_sync_time';

let lastSyncTime: string = '';
let isSyncing: boolean = false;

export async function initSyncStateFromStorage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LAST_SYNC_TIME_KEY);
    if (stored) {
      lastSyncTime = stored;
    }
  } catch (e) {
    console.warn('加载 lastSyncTime 失败:', e);
  }
}

export async function persistLastSyncTime(value: string): Promise<void> {
  lastSyncTime = value;
  try {
    await AsyncStorage.setItem(LAST_SYNC_TIME_KEY, value);
  } catch (e) {
    console.warn('持久化 lastSyncTime 失败:', e);
  }
}

export function getLastSyncTime(): string {
  return lastSyncTime;
}

export function setLastSyncTimeMemory(value: string): void {
  lastSyncTime = value;
}

export function getSyncingState(): boolean {
  return isSyncing;
}

export function setSyncingState(value: boolean): void {
  isSyncing = value;
}
