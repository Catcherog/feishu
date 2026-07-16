declare module 'expo-notifications' {
  export interface Notification {
    identifier: string;
    [key: string]: any;
  }

  export interface NotificationRequestInput {
    identifier?: string;
    content: any;
    trigger: NotificationTriggerInput | { date: Date } | null;
  }

  export type NotificationTriggerInput =
    | { date: Date }
    | { seconds: number; repeats?: boolean }
    | { hour: number; minute: number; repeats?: boolean }
    | null;

  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
  export function getExpoPushTokenAsync(options?: { projectId?: string }): Promise<{ data: string }>;
  export function setNotificationHandler(handler: any): void;
  export function scheduleNotificationAsync(request: NotificationRequestInput): Promise<string>;
  export function cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  export function cancelAllScheduledNotificationsAsync(): Promise<void>;
  export function getAllScheduledNotificationsAsync(): Promise<Notification[]>;
  export function setNotificationChannelAsync(id: string, channel: any): Promise<void>;
  export const AndroidImportance: {
    MAX?: number;
    HIGH?: number;
    [key: string]: number | undefined;
  };
}
