import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeishuNotification, NotificationType } from '../types';

const NOTIFICATIONS_KEY = '@zehuai_notifications';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getNotifications(): Promise<FeishuNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('读取通知列表失败:', e);
    return [];
  }
}

export async function saveNotifications(notifications: FeishuNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.warn('保存通知列表失败:', e);
  }
}

export async function addNotification(
  notification: Omit<FeishuNotification, 'id' | 'createdAt' | 'read'>,
): Promise<FeishuNotification> {
  const newNotification: FeishuNotification = {
    ...notification,
    id: generateId(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  const notifications = await getNotifications();
  notifications.unshift(newNotification);
  await saveNotifications(notifications);
  return newNotification;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const notifications = await getNotifications();
  const index = notifications.findIndex((n) => n.id === id);
  if (index >= 0) {
    notifications[index] = { ...notifications[index], read: true };
    await saveNotifications(notifications);
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const notifications = await getNotifications();
  const updated = notifications.map((n) => ({ ...n, read: true }));
  await saveNotifications(updated);
}

export async function clearNotifications(): Promise<void> {
  await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
}

export function buildNotificationTitle(type: NotificationType, subject: string): string {
  switch (type) {
    case 'project_status':
      return `项目状态变更：${subject}`;
    case 'task_deadline':
      return `任务到期提醒：${subject}`;
    case 'client_followup':
      return `客户跟进提醒：${subject}`;
    case 'publish_deadline':
      return `发布截止提醒：${subject}`;
    case 'approval':
      return `审批结果：${subject}`;
    default:
      return subject;
  }
}
