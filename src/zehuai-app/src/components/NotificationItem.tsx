import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { FeishuNotification, NotificationType } from '../types';
import { formatRelativeTime } from '../utils/format';

const ICON_MAP: Record<NotificationType, string> = {
  project_status: 'briefcase-outline',
  task_deadline: 'time-outline',
  client_followup: 'people-outline',
  publish_deadline: 'alarm-outline',
  approval: 'checkmark-circle-outline',
};

const COLOR_MAP: Record<NotificationType, string> = {
  project_status: Colors.info,
  task_deadline: Colors.warning,
  client_followup: Colors.success,
  publish_deadline: Colors.warning,
  approval: Colors.accent,
};

interface NotificationItemProps {
  notification: FeishuNotification;
  onPress: (id: string) => void;
}

export default function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const iconName = ICON_MAP[notification.type] || 'notifications-outline';
  const iconColor = COLOR_MAP[notification.type] || Colors.accent;

  return (
    <TouchableOpacity
      style={[styles.card, !notification.read && styles.cardUnread]}
      onPress={() => onPress(notification.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={iconName as any} size={20} color={iconColor} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {notification.body || notification.content}
        </Text>
        <Text style={styles.time}>{formatRelativeTime(notification.createdAt)}</Text>
      </View>

      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardUnread: {
    backgroundColor: Colors.surfaceWarm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  summary: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  time: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.info,
    marginLeft: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
