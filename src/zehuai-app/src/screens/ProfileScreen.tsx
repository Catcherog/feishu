import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { NotificationSetting, AppRole, APP_ROLE_LABELS } from '../types';
import { isAuthenticated, getCurrentUser, logout } from '../services/feishuAuth';
import {
  performSync,
  getLastSyncTime,
  startAutoSync,
  stopAutoSync,
  getPendingSyncCount,
} from '../services/syncManager';
import { requestNotificationPermissions, rescheduleAllReminders } from '../services/notifications';
import { formatSyncTime } from '../utils/format';
import { usePermission } from '../contexts/PermissionContext';

interface ProfileScreenProps {
  onLogout?: () => void;
  role?: AppRole;
}

const NOTIFICATION_SETTINGS_KEY = 'profile_notification_settings';
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSetting = {
  projectReminder: true,
  clientFollowUp: true,
  publishDeadline: true,
  dailyReport: false,
};

export default function ProfileScreen({ onLogout, role }: ProfileScreenProps) {
  const { role: contextRole, roleSource } = usePermission();
  const currentRole = contextRole || role || 'admin';
  const roleLabel = APP_ROLE_LABELS[currentRole];

  const [notifications, setNotifications] = useState<NotificationSetting>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState('管理员');
  const [phone, setPhone] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(getLastSyncTime());
  const [pendingCount, setPendingCount] = useState(0);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const getRoleSourceText = () => {
    switch (roleSource) {
      case 'department_id':
        return '根据您所在飞书部门自动识别';
      case 'department_name':
        return '根据您所在飞书部门名称自动识别';
      case 'default_admin':
        return '当前未配置部门规则，默认开放全部权限';
      case 'fallback_offline':
        return '离线模式，使用缓存的角色权限';
      default:
        return '系统默认角色';
    }
  };

  const rolePermissions = [
    {
      key: 'admin' as AppRole,
      label: '主理人',
      desc: '拥有全部管理权限',
      permissions: [
        '查看所有项目、客户、资源',
        '创建/编辑/删除项目和客户',
        '管理所有数据',
        '查看全部统计数据',
      ],
    },
    {
      key: 'photographer' as AppRole,
      label: '摄影师',
      desc: '执行拍摄相关任务',
      permissions: [
        '查看自己负责的项目',
        '查看资源库',
        '查看自己的任务',
        '客户联系方式可能脱敏',
      ],
    },
    {
      key: 'post' as AppRole,
      label: '后期',
      desc: '负责后期制作处理',
      permissions: [
        '查看待后期处理的项目（后期制作/待交付/已完成）',
        '查看成品发布',
        '查看自己的任务',
        '客户联系方式可能脱敏',
      ],
    },
  ];

  const MENU_SECTIONS: any[] = [
    {
      title: '账号与安全',
      items: [
        { icon: 'phone-portrait-outline', label: '手机号', value: phone || '未登录', onPress: () => Alert.alert('手机号', phone || '当前未登录') },
        { icon: 'shield-checkmark-outline', label: '登录状态', value: loggedIn ? '已登录' : '未登录', onPress: () => Alert.alert('登录状态', loggedIn ? '飞书 Token 有效，已登录' : '当前未登录飞书') },
        { icon: 'shield-outline', label: '身份与权限', value: roleLabel, onPress: () => setShowRoleModal(true) },
      ],
    },
    {
      title: '通知设置',
      items: [
        { icon: 'briefcase-outline', label: '项目提醒', key: 'projectReminder' as const },
        { icon: 'people-outline', label: '客户跟进提醒', key: 'clientFollowUp' as const },
        { icon: 'share-social-outline', label: '发布截止提醒', key: 'publishDeadline' as const },
        { icon: 'document-text-outline', label: '每日数据报告', key: 'dailyReport' as const },
      ],
    },
    {
      title: '其他',
      items: [
        { icon: 'help-circle-outline', label: '帮助与反馈', value: '', onPress: () => Alert.alert('帮助与反馈', '如有问题请联系管理员，或访问飞书知识库文档获取帮助。') },
        { icon: 'information-circle-outline', label: '关于泽怀影像中台', value: 'v1.0.0', onPress: () => Alert.alert('关于泽怀影像中台', '泽怀影像中台 v1.0.0\n基于飞书多维表格的影像项目协同管理平台\n\n功能：项目管理、客户跟进、成品发布、数据统计') },
      ],
    },
  ];

  const loadPendingCount = async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (e) {
      console.warn('加载待同步数量失败:', e);
    }
  };

  React.useEffect(() => {
    (async () => {
      const authed = await isAuthenticated();
      setLoggedIn(authed);
      if (authed) {
        const user = await getCurrentUser();
        if (user) {
          setUserName(user.nickname || user.phone);
          setPhone(user.phone);
        }
      } else {
        setUserName('管理员');
        setPhone('');
      }

      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setNotifications({ ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed });
        }
      } catch {
        // 使用默认设置
      }

      await loadPendingCount();
    })();

    // 启动自动同步
    startAutoSync();

    return () => {
      stopAutoSync();
    };
  }, []);

  const toggleNotification = async (key: keyof NotificationSetting) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});

    if (next[key]) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('权限提示', '请前往系统设置开启通知权限，否则无法接收提醒');
      }
    }

    rescheduleAllReminders(next).catch(() => {});
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const result = await performSync();
      setLastSync(getLastSyncTime());
      await loadPendingCount();
      if (result.failed > 0) {
        Alert.alert('同步完成', `成功同步 ${result.synced} 条，${result.failed} 条失败`);
      } else {
        Alert.alert('同步完成', `成功同步 ${result.synced} 条数据`);
      }
    } catch {
      Alert.alert('同步失败', '数据同步出错，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          await logout();
          setLoggedIn(false);
          setPhone('');
          setUserName('管理员');
          onLogout?.();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <View style={styles.authBadge}>
              <Ionicons
                name={loggedIn ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={loggedIn ? Colors.success : Colors.warning}
              />
              <Text style={[styles.authText, { color: loggedIn ? Colors.success : Colors.warning }]}>
                {loggedIn ? '飞书已连接' : '未连接飞书'}
              </Text>
            </View>
            {roleLabel ? (
              <TouchableOpacity style={styles.roleBadge} onPress={() => setShowRoleModal(true)} activeOpacity={0.7}>
                <Ionicons name="shield-outline" size={12} color={Colors.accent} />
                <Text style={styles.roleText}>{roleLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {MENU_SECTIONS.map((section: any) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item: any, index: number) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      index > 0 && styles.menuItemBorder,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if ('onPress' in item) {
                        item.onPress();
                      }
                    }}
                  >
                    <View style={styles.menuItemLeft}>
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={Colors.accent}
                      />
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.menuItemRight}>
                      {'key' in item && item.key ? (
                        <Switch
                          value={notifications[item.key as keyof NotificationSetting]}
                          onValueChange={() => toggleNotification(item.key as keyof NotificationSetting)}
                          trackColor={{ false: Colors.border, true: Colors.accent + '60' }}
                          thumbColor={notifications[item.key as keyof NotificationSetting] ? Colors.accent : Colors.surface}
                        />
                      ) : (
                        <>
                          {'value' in item && item.value ? (
                            <Text style={styles.menuItemValue}>{item.value}</Text>
                          ) : null}
                          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据源</Text>
          <View style={styles.menuCard}>
            <View style={styles.dataSourceItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="cloud-outline" size={20} color={Colors.info} />
                <View>
                  <Text style={styles.menuItemLabel}>飞书账号</Text>
                  <Text style={styles.dataSourceSub}>{userName || '未登录'}</Text>
                </View>
              </View>
              <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
            </View>
            <View style={[styles.dataSourceItem, styles.menuItemBorder]}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="server-outline" size={20} color={Colors.accent} />
                <View>
                  <Text style={styles.menuItemLabel}>飞书多维表格</Text>
                  <Text style={styles.dataSourceSub}>SOURCE_BASE_ALIAS</Text>
                </View>
              </View>
              <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据同步</Text>
          <View style={styles.menuCard}>
            <View style={styles.dataSourceItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="sync-outline" size={20} color={Colors.accent} />
                <View>
                  <Text style={styles.menuItemLabel}>同步状态</Text>
                  <Text style={styles.dataSourceSub}>
                    {lastSync ? `上次同步：${formatSyncTime(lastSync)}` : '尚未同步'}
                  </Text>
                </View>
              </View>
              {syncing ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <View style={[styles.statusDot, { backgroundColor: lastSync ? Colors.success : Colors.warning }]} />
              )}
            </View>
            {pendingCount > 0 ? (
              <TouchableOpacity
                style={[styles.dataSourceItem, styles.menuItemBorder]}
                onPress={handleManualSync}
                disabled={syncing}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="time-outline" size={20} color={Colors.warning} />
                  <View>
                    <Text style={styles.menuItemLabel}>待同步：{pendingCount} 条</Text>
                    <Text style={styles.dataSourceSub}>点击立即同步</Text>
                  </View>
                </View>
                {syncing ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.dataSourceItem, styles.menuItemBorder]}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="checkmark-done-outline" size={20} color={Colors.success} />
                  <View>
                    <Text style={styles.menuItemLabel}>待同步记录</Text>
                    <Text style={styles.dataSourceSub}>没有待同步的数据</Text>
                  </View>
                </View>
                <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
              </View>
            )}
            <View style={[styles.menuItemBorder, { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }]}>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={handleManualSync}
                disabled={syncing}
                activeOpacity={0.7}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color={Colors.textOnPrimary} />
                )}
                <Text style={styles.syncButtonText}>
                  {syncing ? '同步中...' : '立即同步'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>泽怀影像中台 v1.0.0</Text>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <Modal
        visible={showRoleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRoleModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowRoleModal(false)}>
          <View style={styles.roleInfoOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.roleInfoPanel}>
                <View style={styles.dragIndicator} />

                <View style={styles.roleInfoHeader}>
                  <Text style={styles.roleInfoTitle}>角色说明</Text>
                  <TouchableOpacity
                    onPress={() => setShowRoleModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.roleInfoScroll}
                  contentContainerStyle={styles.roleInfoContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.currentRoleSection}>
                    <View style={styles.currentRoleIcon}>
                      <Ionicons name="shield" size={32} color={Colors.accent} />
                    </View>
                    <Text style={styles.currentRoleName}>{roleLabel}</Text>
                    <Text style={styles.roleSourceText}>{getRoleSourceText()}</Text>
                  </View>

                  <View style={styles.roleInfoDivider} />

                  {rolePermissions.map((roleItem) => (
                    <View
                      key={roleItem.key}
                      style={[
                        styles.roleCard,
                        currentRole === roleItem.key && styles.roleCardActive,
                      ]}
                    >
                      <View style={styles.roleCardHeader}>
                        <Text style={styles.roleCardTitle}>{roleItem.label}</Text>
                        {currentRole === roleItem.key && (
                          <View style={styles.roleCardBadge}>
                            <Text style={styles.roleCardBadgeText}>当前角色</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.roleCardDesc}>{roleItem.desc}</Text>
                      {roleItem.permissions.map((perm, idx) => (
                        <View key={idx} style={styles.permissionItem}>
                          <View style={styles.permissionDot} />
                          <Text style={styles.permissionText}>{perm}</Text>
                        </View>
                      ))}
                    </View>
                  ))}

                  <View style={{ height: Spacing.xxxl }} />
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  avatarText: {
    ...Typography.h2,
    color: Colors.accent,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  authText: {
    ...Typography.caption,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent + '15',
  },
  roleText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '500',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 50,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  menuItemLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  menuItemValue: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  dataSourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dataSourceSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logoutButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  logoutText: {
    ...Typography.h4,
    color: Colors.error,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  syncButtonText: {
    ...Typography.bodySmall,
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  roleInfoOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  roleInfoPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  roleInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  roleInfoTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  roleInfoScroll: {
    flex: 1,
  },
  roleInfoContent: {
    padding: Spacing.lg,
  },
  currentRoleSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
  },
  currentRoleIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  currentRoleName: {
    ...Typography.h2,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  roleSourceText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  roleInfoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  roleCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '08',
  },
  roleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  roleCardTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  roleCardBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  roleCardBadgeText: {
    ...Typography.caption,
    color: Colors.textOnAccent,
    fontWeight: '600',
    fontSize: 11,
  },
  roleCardDesc: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  permissionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 8,
    flexShrink: 0,
  },
  permissionText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
