import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useNotifications } from '../hooks/useFeishuData';
import { markNotificationAsRead } from '../services/notificationStore';
import NotificationItem from '../components/NotificationItem';

export default function NotificationsScreen() {
  const { data: notifications, loading, refresh } = useNotifications();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const handlePress = useCallback((id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    void markNotificationAsRead(id);
  }, []);

  const displayedNotifications = useMemo(
    () =>
      notifications.map((n) => ({
        ...n,
        read: n.read || readIds.has(n.id),
      })),
    [notifications, readIds],
  );

  const unreadCount = displayedNotifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.unreadBar}>
          <Text style={styles.unreadText}>{unreadCount} 条未读</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={Colors.accent} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>暂无通知</Text>
            <Text style={styles.emptySubtext}>下拉刷新查看最新提醒</Text>
          </View>
        ) : (
          displayedNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onPress={handlePress}
            />
          ))
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  unreadBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  unreadText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.section * 2,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
