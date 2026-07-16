import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useDashboardStats, useProjects, usePublishTasks, useNotifications } from '../hooks/useFeishuData';
import { formatDate, isOverdue } from '../utils/format';
import StatCard from '../components/StatCard';
import ProjectCard from '../components/ProjectCard';
import QuickAction from '../components/QuickAction';
import ErrorBanner from '../components/ErrorBanner';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { usePermission } from '../contexts/PermissionContext';
import type { ProjectStatus } from '../types';

// 已完成的项目阶段（不计入「进行中项目」）
const COMPLETED_STATUSES: ProjectStatus[] = ['已完成', '复盘归档'];

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { role, userId, canCreateClient, canCreateProject } = usePermission();
  const { data: stats, loading: statsLoading, refresh: refreshStats, isOffline: statsOffline } = useDashboardStats();
  const { data: projects, loading: projectsLoading, refresh: refreshProjects, isOffline: projectsOffline } = useProjects();
  const { data: publishTasks, loading: publishLoading, refresh: refreshPublish, isOffline: publishOffline } = usePublishTasks();
  const { data: notifications } = useNotifications();

  const refreshing = statsLoading || projectsLoading || publishLoading;
  const hasError = statsOffline || projectsOffline || publishOffline;

  const onRefresh = async () => {
    await Promise.all([refreshStats(), refreshProjects(), refreshPublish()]);
  };

  // 按角色过滤项目数据：主理人看全部，摄影师/后期仅看自己负责的
  // 若无法获取 userId，则不过滤，保持现有行为
  const shouldFilterProjects = (role === 'photographer' || role === 'post') && !!userId;
  const visibleProjects = shouldFilterProjects
    ? projects.filter((p) => p.ownerId === userId)
    : projects;

  // 进行中项目数：所有角色统一基于当前用户可见项目计算
  const activeProjectsCount = visibleProjects.filter((p) => !COMPLETED_STATUSES.includes(p.status)).length;

  // 发布提醒：待发布任务，按截止日升序，最多 3 条
  const pendingPublishReminders = publishTasks
    .filter((t) => t.status === '待发布')
    .slice()
    .sort((a, b) => {
      const ta = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const tb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ta - tb;
    })
    .slice(0, 3);

  // 优先展示项目，没有项目时展示成品发布记录
  const recentProjects = visibleProjects.slice(0, 3);
  const recentPublish = publishTasks.slice(0, 3);
  const hasProjects = recentProjects.length > 0;
  const hasPublish = recentPublish.length > 0;

  // Tab 可见性权限（与 AppNavigator 的 TAB_VISIBILITY 保持一致）
  const canViewProjects = role === 'admin' || role === 'photographer' || role === 'post';
  const canViewPublish = role === 'admin' || role === 'post';

  // 快捷操作按钮可见性
  const showCreateClientBtn = canCreateClient();
  const showCreateProjectBtn = canCreateProject();
  // 发布素材、我的任务对所有角色可见，故快捷操作区始终显示
  const hasAnyQuickAction = true;

  const navigateToProjects = () => {
    try {
      navigation.navigate('Projects');
    } catch (e) {
      Alert.alert('提示', '该功能在当前角色下不可访问');
    }
  };

  const navigateToPublish = () => {
    try {
      navigation.navigate('Publish');
    } catch (e) {
      Alert.alert('提示', '该功能在当前角色下不可访问');
    }
  };

  const navigateToTasks = () => {
    try {
      navigation.navigate('Tasks');
    } catch (e) {
      Alert.alert('提示', '该功能在当前角色下不可访问');
    }
  };

  const navigateToKnowledge = () => {
    try {
      navigation.navigate('Knowledge' as any);
    } catch (e) {
      Alert.alert('提示', '该功能在当前角色下不可访问');
    }
  };

  // 统计卡片点击：无权限时弹 Alert 提示，有权限时跳转
  const handleProjectsCardPress = () => {
    if (!canViewProjects) {
      Alert.alert('提示', '该功能在当前角色下不可访问');
      return;
    }
    navigateToProjects();
  };

  const handlePublishCardPress = () => {
    if (!canViewPublish) {
      Alert.alert('提示', '该功能在当前角色下不可访问');
      return;
    }
    navigateToPublish();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好';
    if (hour < 12) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const isAdmin = role === 'admin';
  const hasUnread = notifications.some(n => !n.read);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner visible={hasError} onRetry={onRefresh} />

        {/* 1. Header（问候语 + 标题 + 通知按钮） */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.title}>泽怀影像中台</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            {hasUnread && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        {/* 2. 统计卡片 2×2 网格 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCardWrapper}>
            <StatCard
              title="进行中项目"
              value={activeProjectsCount}
              icon="briefcase-outline"
              color={Colors.info}
              onPress={handleProjectsCardPress}
            />
          </View>
          <View style={styles.statCardWrapper}>
            <StatCard
              title="待发布任务"
              value={stats.pendingPublishTasks}
              icon="checkmark-done-outline"
              color={Colors.warning}
              onPress={handlePublishCardPress}
            />
          </View>
          <View style={styles.statCardWrapper}>
            <StatCard
              title="成品总数"
              value={stats.totalFinishedProducts}
              icon="images-outline"
              color={Colors.success}
              onPress={handlePublishCardPress}
            />
          </View>
          <View style={styles.statCardWrapper}>
            <StatCard
              title="已发布"
              value={stats.publishedCount}
              icon="send-outline"
              color={Colors.accent}
              onPress={handlePublishCardPress}
            />
          </View>
        </View>

        {/* 3. 发布提醒区 */}
        {pendingPublishReminders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>发布提醒</Text>
              <TouchableOpacity onPress={navigateToPublish}>
                <Text style={styles.seeAll}>查看全部</Text>
              </TouchableOpacity>
            </View>
            {pendingPublishReminders.map((task) => {
              const overdue = task.deadline ? isOverdue(task.deadline) : false;
              return (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.reminderCard, overdue && styles.reminderCardOverdue]}
                  onPress={navigateToPublish}
                  activeOpacity={0.7}
                >
                  <View style={styles.reminderCardHeader}>
                    <Text style={styles.reminderCardTitle} numberOfLines={1}>
                      {task.title || '未命名任务'}
                    </Text>
                    <Text
                      style={[
                        styles.reminderCardDeadline,
                        overdue && styles.reminderCardDeadlineOverdue,
                      ]}
                    >
                      {task.deadline ? formatDate(task.deadline) : '无截止日'}
                    </Text>
                  </View>
                  {task.platforms.length > 0 && (
                    <View style={styles.reminderCardPlatforms}>
                      {task.platforms.map((p) => (
                        <View key={p} style={styles.platformTag}>
                          <Text style={styles.platformTagText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 4. 快捷操作区（按角色权限显示） */}
        {hasAnyQuickAction && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快捷操作</Text>
            <View style={styles.quickActions}>
              {showCreateClientBtn && (
                <QuickAction
                  icon="person-add-outline"
                  label="新建客户"
                  color={Colors.info}
                  onPress={() => navigation.navigate('ClientForm')}
                />
              )}
              {showCreateProjectBtn && (
                <QuickAction
                  icon="add-circle-outline"
                  label="新建项目"
                  color={Colors.accent}
                  onPress={() => navigation.navigate('ProjectForm')}
                />
              )}
              <QuickAction
                icon="share-outline"
                label="发布素材"
                color={Colors.success}
                onPress={navigateToPublish}
              />
              <QuickAction
                icon="list-outline"
                label="我的任务"
                color={Colors.info}
                onPress={navigateToTasks}
              />
              <QuickAction
                icon="book-outline"
                label="知识库"
                color={Colors.info}
                onPress={navigateToKnowledge}
              />
            </View>
          </View>
        )}

        {/* 5. 近期项目 / 近期成品 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{hasProjects ? '近期项目' : '近期成品'}</Text>
            {(canViewProjects || canViewPublish) && (
              <TouchableOpacity
                onPress={() => {
                  try {
                    if (hasProjects && canViewProjects) {
                      navigation.navigate('Projects');
                    } else if (canViewPublish) {
                      navigation.navigate('Publish');
                    }
                  } catch (e) {
                    // Tab 未注册时忽略导航错误
                  }
                }}
              >
                <Text style={styles.seeAll}>查看全部</Text>
              </TouchableOpacity>
            )}
          </View>
          {hasProjects && recentProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onPress={(p) => navigation.navigate('ProjectDetail', { projectId: p.id })}
            />
          ))}
          {!hasProjects && hasPublish && recentPublish.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.publishCard}
              onPress={navigateToPublish}
              activeOpacity={0.7}
            >
              <View style={styles.publishCardHeader}>
                <Text style={styles.publishCardTitle} numberOfLines={1}>{task.title || '未命名成品'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: task.status === '已发布' ? Colors.success + '20' : Colors.warning + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: task.status === '已发布' ? Colors.success : Colors.warning }]}>{task.status}</Text>
                </View>
              </View>
              <View style={styles.publishCardMeta}>
                {task.platforms.length > 0 && (
                  <Text style={styles.publishCardMetaText}>{task.platforms.join(' · ')}</Text>
                )}
                {task.deadline && (
                  <Text style={styles.publishCardMetaText}>{task.deadline}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
          {!hasProjects && !hasPublish && (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyStateText}>暂无数据</Text>
              <Text style={styles.emptyStateSubtext}>在飞书多维表格中添加数据后即可在此查看</Text>
            </View>
          )}
        </View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  greeting: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.lg,
  },
  statCardWrapper: {
    width: '50%',
    marginBottom: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  seeAll: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xl,
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  reminderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
    ...Shadows.sm,
  },
  reminderCardOverdue: {
    borderLeftColor: Colors.error,
  },
  reminderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  reminderCardTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  reminderCardDeadline: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  reminderCardDeadlineOverdue: {
    color: Colors.error,
    fontWeight: '600',
  },
  reminderCardPlatforms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  platformTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  platformTagText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  publishCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  publishCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  publishCardTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  publishCardMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  publishCardMetaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
