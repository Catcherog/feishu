import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProjects, getClients, getPublishTasks, sendMessage, sendCardMessage } from './feishu';
import { addNotification, getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from './notificationStore';
import { NotificationSetting, NotificationType } from '../types';

const NOTIFICATION_SETTINGS_KEY = 'profile_notification_settings';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSetting = {
  projectReminder: true,
  clientFollowUp: true,
  publishDeadline: true,
  dailyReport: false,
};

export async function getNotificationSettings(): Promise<NotificationSetting> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore read errors
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function buildDateTrigger(targetDate: Date): Notifications.NotificationTriggerInput | null {
  const now = Date.now();
  const targetTime = targetDate.getTime();
  if (targetTime <= now) return null;
  return { date: new Date(targetTime) };
}

export async function scheduleProjectDeadlineReminder(
  projectId: string,
  projectName: string,
  deadline: string
): Promise<string> {
  const settings = await getNotificationSettings();
  if (!settings.projectReminder) return '';

  const deadlineDate = parseDateSafe(deadline);
  if (!deadlineDate) return '';

  const reminderDate = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);
  const trigger = buildDateTrigger(reminderDate);
  if (!trigger) return '';

  const identifier = `project-deadline-${projectId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier);

  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: '项目截止提醒',
      body: `项目「${projectName}」精修交付截止时间为 ${deadlineDate.toLocaleDateString('zh-CN')}，请提前安排。`,
      data: { type: 'project_deadline', projectId },
    },
    trigger,
  });
}

export async function scheduleClientFollowUpReminder(
  clientId: string,
  clientName: string,
  lastContactDate: string
): Promise<string> {
  const settings = await getNotificationSettings();
  if (!settings.clientFollowUp) return '';

  const lastContact = parseDateSafe(lastContactDate);
  if (!lastContact) return '';

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((Date.now() - lastContact.getTime()) / msPerDay);
  if (daysSince < 3) return '';

  const identifier = `client-followup-${clientId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier);

  const triggerDate = new Date(Date.now() + 5 * 1000);

  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: '客户跟进提醒',
      body: `客户「${clientName}」已超过 ${daysSince} 天未跟进，请及时联系。`,
      data: { type: 'client_followup', clientId },
    },
    trigger: { date: triggerDate },
  });
}

export async function schedulePublishDeadlineReminder(
  taskId: string,
  title: string,
  deadline: string
): Promise<string> {
  const settings = await getNotificationSettings();
  if (!settings.publishDeadline) return '';

  const deadlineDate = parseDateSafe(deadline);
  if (!deadlineDate) return '';

  const reminderDate = new Date(deadlineDate.getTime() - 12 * 60 * 60 * 1000);
  const trigger = buildDateTrigger(reminderDate);
  if (!trigger) return '';

  const identifier = `publish-deadline-${taskId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier);

  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: '发布截止提醒',
      body: `发布任务「${title}」截止时间为 ${deadlineDate.toLocaleDateString('zh-CN')}，请尽快完成发布。`,
      data: { type: 'publish_deadline', taskId },
    },
    trigger,
  });
}

export async function cancelReminder(identifier: string): Promise<void> {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

async function cancelRemindersByPrefix(prefix: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(prefix))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {
    // ignore cancellation errors
  }
}

export interface SendFeishuNotificationOptions {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  receiveId?: string;
  receiveIdType?: 'chat_id' | 'user_id';
  card?: boolean;
  cardPayload?: Record<string, unknown>;
}

/**
 * 统一发送飞书消息并将通知写入本地通知中心。
 * 业务代码中应通过 `void sendFeishuNotification(...)` 调用，避免阻塞主流程。
 */
export async function sendFeishuNotification(options: SendFeishuNotificationOptions): Promise<void> {
  try {
    const {
      title,
      body,
      type,
      data,
      receiveId,
      receiveIdType = 'chat_id',
      card,
      cardPayload,
    } = options;

    if (receiveId) {
      if (card && cardPayload) {
        await sendCardMessage(receiveId, JSON.stringify(cardPayload), receiveIdType);
      } else {
        await sendMessage(receiveId, 'text', JSON.stringify({ text: body }), receiveIdType);
      }
    }

    await addNotification({
      type,
      title,
      body,
      data,
    });
  } catch (e) {
    console.warn('发送飞书通知失败:', e);
  }
}

export { getNotifications, markNotificationAsRead, markAllNotificationsAsRead };

export async function rescheduleAllReminders(settings: NotificationSetting): Promise<void> {
  if (settings.projectReminder) {
    try {
      const { data } = await getProjects();
      await Promise.all(
        data
          .filter((p) => p.deadline)
          .map((p) => scheduleProjectDeadlineReminder(p.id, p.name, p.deadline))
      );
    } catch {
      // ignore fetch errors
    }
  } else {
    await cancelRemindersByPrefix('project-deadline-');
  }

  if (settings.clientFollowUp) {
    try {
      const { data } = await getClients();
      await Promise.all(
        data
          .filter((c) => c.lastContactDate)
          .map((c) => scheduleClientFollowUpReminder(c.id, c.name, c.lastContactDate))
      );
    } catch {
      // ignore fetch errors
    }
  } else {
    await cancelRemindersByPrefix('client-followup-');
  }

  if (settings.publishDeadline) {
    try {
      const { data } = await getPublishTasks();
      await Promise.all(
        data
          .filter((t) => t.deadline)
          .map((t) => schedulePublishDeadlineReminder(t.id, t.title, t.deadline))
      );
    } catch {
      // ignore fetch errors
    }
  } else {
    await cancelRemindersByPrefix('publish-deadline-');
  }
}
