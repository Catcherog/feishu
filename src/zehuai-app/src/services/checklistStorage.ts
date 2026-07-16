import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChecklistProgress } from '../types';

const STORAGE_KEY_PREFIX = '@zehuai_checklist/';

export async function loadChecklistProgress(
  projectId: string,
  checklistId: string
): Promise<ChecklistProgress | null> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${projectId}_${checklistId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ChecklistProgress;
  } catch (e) {
    console.warn('加载检查清单进度失败:', e);
    return null;
  }
}

export async function saveChecklistProgress(
  projectId: string,
  checklistId: string,
  checkedItems: string[]
): Promise<void> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${projectId}_${checklistId}`;
    const progress: ChecklistProgress = {
      projectId,
      checklistId,
      checkedItems,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(progress));
  } catch (e) {
    console.warn('保存检查清单进度失败:', e);
  }
}
