import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows, PlatformColors } from '../constants/theme';
import { usePublishTasks, useProjects, useWikiSOPs } from '../hooks/useFeishuData';
import { PublishTask, PublishStatus, Platform as PublishPlatformType } from '../types';
import { formatDate, formatNumber, getDaysUntil } from '../utils/format';
import { schedulePublishDeadlineReminder, getNotificationSettings } from '../services/notifications';
import { getPublishTasks, updatePublishTask, createPublishTask } from '../services/feishu';
import StatusBadge from '../components/StatusBadge';
import SOPCard from '../components/SOPCard';
import ErrorBanner from '../components/ErrorBanner';
import DatePicker from '../components/DatePicker';

const FILTER_TABS: { label: string; value: PublishStatus | '' }[] = [
  { label: '全部', value: '' },
  { label: '待发布', value: '待发布' },
  { label: '发布中', value: '发布中' },
  { label: '已发布', value: '已发布' },
  { label: '已下架', value: '已下架' },
];

const PLATFORM_LIST: PublishPlatformType[] = ['小红书', '抖音', '朋友圈', '微博', 'B站'];

const DISTRIBUTION_SOP_URL = 'https://YOUR_TENANT.feishu.cn/wiki/WIKI_NODE_PLACEHOLDER';

// ============ 工具函数 ============

function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 周日记为 7
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return date >= monday && date <= sunday;
}

function isTaskOverdue(task: PublishTask): boolean {
  if (task.status === '已发布' || task.status === '已下架') return false;
  return getDaysUntil(task.deadline) < 0;
}

interface PlatformStat {
  pending: number;
  published: number;
  overdue: number;
}

function computePlatformStats(tasks: PublishTask[]): Record<string, PlatformStat> {
  const stats: Record<string, PlatformStat> = {};
  PLATFORM_LIST.forEach((p) => {
    stats[p] = { pending: 0, published: 0, overdue: 0 };
  });
  tasks.forEach((task) => {
    task.platforms.forEach((platform) => {
      if (!stats[platform]) return;
      if (task.status === '已发布') {
        if (isThisWeek(task.publishedAt) || isThisWeek(task.deadline)) {
          stats[platform].published += 1;
        }
      } else if (task.status === '待发布' || task.status === '发布中') {
        if (isThisWeek(task.deadline) || !task.deadline) {
          stats[platform].pending += 1;
        }
      }
      if (isTaskOverdue(task)) {
        stats[platform].overdue += 1;
      }
    });
  });
  return stats;
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('打开失败', '无法打开链接，请检查链接是否有效');
  });
}

// ============ 发布看板 ============

function PublishDashboard({ tasks }: { tasks: PublishTask[] }) {
  const stats = computePlatformStats(tasks);
  const totalOverdue = PLATFORM_LIST.reduce((sum, p) => sum + stats[p].overdue, 0);

  return (
    <View style={styles.dashboardWrap}>
      <View style={styles.dashboardHeader}>
        <Text style={styles.dashboardTitle}>发布看板</Text>
        <Text style={styles.dashboardSubtitle}>本周计划</Text>
        {totalOverdue > 0 && (
          <View style={styles.dashboardAlert}>
            <Ionicons name="alert-circle" size={12} color={Colors.error} />
            <Text style={styles.dashboardAlertText}>{totalOverdue} 项逾期</Text>
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dashboardScroll}
      >
        {PLATFORM_LIST.map((platform) => {
          const s = stats[platform];
          const color = PlatformColors[platform] || Colors.textTertiary;
          return (
            <View key={platform} style={styles.platformCard}>
              <View style={[styles.platformCardHeader, { backgroundColor: color + '15' }]}>
                <View style={[styles.platformDot, { backgroundColor: color }]} />
                <Text style={[styles.platformCardName, { color }]}>{platform}</Text>
              </View>
              <View style={styles.platformCardBody}>
                <View style={styles.platformStatItem}>
                  <Text style={styles.platformStatNum}>{s.pending}</Text>
                  <Text style={styles.platformStatLabel}>待发布</Text>
                </View>
                <View style={styles.platformStatDivider} />
                <View style={styles.platformStatItem}>
                  <Text style={[styles.platformStatNum, { color: Colors.success }]}>
                    {s.published}
                  </Text>
                  <Text style={styles.platformStatLabel}>已发布</Text>
                </View>
                <View style={styles.platformStatDivider} />
                <View style={styles.platformStatItem}>
                  <Text
                    style={[
                      styles.platformStatNum,
                      s.overdue > 0 && { color: Colors.error },
                    ]}
                  >
                    {s.overdue}
                  </Text>
                  <Text
                    style={[
                      styles.platformStatLabel,
                      s.overdue > 0 && { color: Colors.error, fontWeight: '600' },
                    ]}
                  >
                    逾期
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============ 任务卡片 ============

function PublishTaskCard({
  task,
  onPress,
  onStartPublish,
}: {
  task: PublishTask;
  onPress: (task: PublishTask) => void;
  onStartPublish: (task: PublishTask) => void;
}) {
  const daysLeft = getDaysUntil(task.deadline);
  const overdue = isTaskOverdue(task);
  const isUrgent = !overdue && daysLeft >= 0 && daysLeft <= 1;

  return (
    <TouchableOpacity
      style={[styles.taskCard, overdue && styles.taskCardOverdue]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={styles.taskTitle} numberOfLines={1}>
            {task.title || '未命名任务'}
          </Text>
          <StatusBadge status={task.status} />
        </View>
        {task.projectName ? (
          <Text style={styles.taskProject} numberOfLines={1}>
            {task.projectName}
          </Text>
        ) : null}
      </View>

      {task.platforms.length > 0 && (
        <View style={styles.platformsRow}>
          {task.platforms.map((platform) => (
            <View
              key={platform}
              style={[styles.platformTag, { backgroundColor: (PlatformColors[platform] || Colors.textTertiary) + '15' }]}
            >
              <Text style={[styles.platformTagText, { color: PlatformColors[platform] || Colors.textTertiary }]}>
                {platform}
              </Text>
            </View>
          ))}
        </View>
      )}

      {task.copyText ? (
        <Text style={styles.copyText} numberOfLines={2}>
          {task.copyText}
        </Text>
      ) : null}

      {task.status === '已发布' && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.statText}>{formatNumber(task.viewCount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.statText}>{formatNumber(task.likeCount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.statText}>{formatNumber(task.commentCount)}</Text>
          </View>
        </View>
      )}

      <View style={styles.taskFooter}>
        <View style={styles.deadlineRow}>
          {overdue ? (
            <>
              <Ionicons name="alert-circle" size={13} color={Colors.error} />
              <Text style={styles.deadlineOverdue}>已逾期{Math.abs(daysLeft)}天</Text>
            </>
          ) : isUrgent ? (
            <>
              <Ionicons name="time-outline" size={13} color={Colors.warning} />
              <Text style={styles.deadlineUrgent}>剩余{daysLeft}天</Text>
            </>
          ) : (
            <>
              <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.deadlineNormal}>截止 {formatDate(task.deadline)}</Text>
            </>
          )}
        </View>

        {task.status === '待发布' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => onStartPublish(task)}
            activeOpacity={0.7}
          >
            <Text style={styles.startButtonText}>开始发布</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============ 任务详情 Modal（含数据回填） ============

function TaskDetailModal({
  visible,
  task,
  onClose,
  onSaved,
}: {
  visible: boolean;
  task: PublishTask | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [viewCount, setViewCount] = useState('');
  const [likeCount, setLikeCount] = useState('');
  const [commentCount, setCommentCount] = useState('');
  const [saving, setSaving] = useState(false);

  // 当任务变化时重置表单
  useEffect(() => {
    if (task) {
      setViewCount(task.viewCount ? String(task.viewCount) : '');
      setLikeCount(task.likeCount ? String(task.likeCount) : '');
      setCommentCount(task.commentCount ? String(task.commentCount) : '');
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    setSaving(true);
    const fields: Record<string, unknown> = {
      '浏览数': Number(viewCount) || 0,
      '点赞数': Number(likeCount) || 0,
      '评论数': Number(commentCount) || 0,
    };
    const ok = await updatePublishTask(task.id, fields);
    setSaving(false);
    if (ok) {
      Alert.alert('保存成功', '发布数据已更新');
      onSaved();
    } else {
      Alert.alert('保存失败', '请稍后重试');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>任务详情</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScroll}>
            {/* 基础信息 */}
            <Text style={styles.detailTaskTitle}>{task.title || '未命名任务'}</Text>
            <View style={styles.detailStatusRow}>
              <StatusBadge status={task.status} size="medium" />
              {task.platforms.map((platform) => (
                <View
                  key={platform}
                  style={[styles.platformTag, { backgroundColor: (PlatformColors[platform] || Colors.textTertiary) + '15' }]}
                >
                  <Text style={[styles.platformTagText, { color: PlatformColors[platform] || Colors.textTertiary }]}>
                    {platform}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.detailInfoGrid}>
              <View style={styles.detailInfoItem}>
                <Text style={styles.detailInfoLabel}>关联项目</Text>
                <Text style={styles.detailInfoValue}>{task.projectName || '未关联'}</Text>
              </View>
              <View style={styles.detailInfoItem}>
                <Text style={styles.detailInfoLabel}>截止日期</Text>
                <Text style={styles.detailInfoValue}>{formatDate(task.deadline) || '未设置'}</Text>
              </View>
            </View>

            {task.copyText ? (
              <View style={styles.detailCopyWrap}>
                <Text style={styles.detailInfoLabel}>发布文案</Text>
                <Text style={styles.detailCopyText}>{task.copyText}</Text>
              </View>
            ) : null}

            {/* 数据回填区 */}
            <View style={styles.dataSection}>
              <Text style={styles.dataSectionTitle}>数据回填</Text>
              <View style={styles.dataInputRow}>
                <View style={styles.dataInputItem}>
                  <View style={styles.dataInputLabelRow}>
                    <Ionicons name="eye-outline" size={13} color={Colors.textTertiary} />
                    <Text style={styles.dataInputLabel}>浏览数</Text>
                  </View>
                  <TextInput
                    style={styles.dataInput}
                    value={viewCount}
                    onChangeText={setViewCount}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.dataInputItem}>
                  <View style={styles.dataInputLabelRow}>
                    <Ionicons name="heart-outline" size={13} color={Colors.textTertiary} />
                    <Text style={styles.dataInputLabel}>点赞数</Text>
                  </View>
                  <TextInput
                    style={styles.dataInput}
                    value={likeCount}
                    onChangeText={setLikeCount}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.dataInputItem}>
                  <View style={styles.dataInputLabelRow}>
                    <Ionicons name="chatbubble-outline" size={13} color={Colors.textTertiary} />
                    <Text style={styles.dataInputLabel}>评论数</Text>
                  </View>
                  <TextInput
                    style={styles.dataInput}
                    value={commentCount}
                    onChangeText={setCommentCount}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveDataButton, saving && styles.saveDataButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.textOnAccent} />
                ) : (
                  <Text style={styles.saveDataButtonText}>保存数据</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* 底部 SOP 跳转 */}
          <TouchableOpacity
            style={styles.sopButton}
            onPress={() => openUrl(DISTRIBUTION_SOP_URL)}
            activeOpacity={0.7}
          >
            <Ionicons name="book-outline" size={18} color={Colors.accent} />
            <Text style={styles.sopButtonText}>查看分发 SOP</Text>
            <Ionicons name="open-outline" size={16} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============ 新建发布任务 Modal ============

function CreatePublishTaskModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: projects } = useProjects();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [platforms, setPlatforms] = useState<PublishPlatformType[]>([]);
  const [deadline, setDeadline] = useState('');
  const [copyText, setCopyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const resetForm = () => {
    setTitle('');
    setProjectId('');
    setPlatforms([]);
    setDeadline('');
    setCopyText('');
    setProjectOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const togglePlatform = (p: PublishPlatformType) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入发布标题');
      return;
    }
    if (platforms.length === 0) {
      Alert.alert('提示', '请至少选择一个发布平台');
      return;
    }

    setSaving(true);
    const project = projects.find((p) => p.id === projectId);
    const fields: Record<string, unknown> = {
      '发布标题': title.trim(),
      '所属平台': platforms,
      '计划发布时间': deadline.trim(),
      '发布文案': copyText.trim(),
      '发布状态': '待发布',
    };
    if (project) {
      fields['所属项目'] = project.name;
    }

    const recordId = await createPublishTask(fields);
    setSaving(false);

    if (recordId) {
      if (deadline.trim()) {
        schedulePublishDeadlineReminder(recordId, title.trim(), deadline.trim()).catch(() => {});
      }
      Alert.alert('创建成功', '发布任务已创建', [
        { text: '确定', onPress: () => {
          resetForm();
          onCreated();
        } },
      ]);
    } else {
      Alert.alert('创建失败', '请稍后重试');
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新建发布任务</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.createScroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* 标题 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>发布标题 *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="请输入发布标题"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              {/* 关联项目 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>关联项目</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setProjectOpen(!projectOpen)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.dropdownText, !projectId && styles.dropdownPlaceholder]}
                    numberOfLines={1}
                  >
                    {selectedProject ? selectedProject.name : '请选择项目'}
                  </Text>
                  <Ionicons
                    name={projectOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textTertiary}
                  />
                </TouchableOpacity>
                {projectOpen && (
                  <View style={styles.dropdownOptions}>
                    <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                      {projects.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.dropdownOption,
                            p.id === projectId && styles.dropdownOptionActive,
                          ]}
                          onPress={() => {
                            setProjectId(p.id);
                            setProjectOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dropdownOptionText,
                              p.id === projectId && styles.dropdownOptionTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {p.name}
                          </Text>
                          {p.id === projectId && (
                            <Ionicons name="checkmark" size={16} color={Colors.accent} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 平台多选 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>发布平台 *（可多选）</Text>
                <View style={styles.platformPickerRow}>
                  {PLATFORM_LIST.map((p) => {
                    const selected = platforms.includes(p);
                    const color = PlatformColors[p] || Colors.textTertiary;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.platformPickerItem,
                          selected && { backgroundColor: color + '20', borderColor: color },
                        ]}
                        onPress={() => togglePlatform(p)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.platformPickerText,
                            { color: selected ? color : Colors.textSecondary },
                          ]}
                        >
                          {p}
                        </Text>
                        {selected && (
                          <Ionicons name="checkmark-circle" size={14} color={color} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 截止日 */}
              <DatePicker
                label="截止日期"
                value={deadline}
                onChange={setDeadline}
                placeholder="请选择截止日期"
              />

              {/* 文案 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>发布文案</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={copyText}
                  onChangeText={setCopyText}
                  placeholder="请输入发布文案"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.textOnAccent} />
                ) : (
                  <Text style={styles.submitButtonText}>提交</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============ 主屏幕 ============

export default function PublishScreen() {
  const [activeFilter, setActiveFilter] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PublishTask | null>(null);

  const { data: publishSOPs, loading: sopsLoading, error: sopsError } = useWikiSOPs('publish');

  const { data: tasks, loading, refresh, isOffline } = usePublishTasks(
    activeFilter || undefined
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
      getNotificationSettings().then((settings) => {
        if (!settings.publishDeadline) return;
        getPublishTasks()
          .then(({ data }) => {
            data.forEach((t) => {
              if (t.deadline) {
                schedulePublishDeadlineReminder(t.id, t.title, t.deadline).catch(() => {});
              }
            });
          })
          .catch(() => {});
      });
    }, [refresh])
  );

  const filteredTasks = activeFilter
    ? tasks.filter((t) => t.status === activeFilter)
    : tasks;

  const handleCardPress = (task: PublishTask) => {
    setSelectedTask(task);
    setDetailVisible(true);
  };

  const handleStartPublish = (task: PublishTask) => {
    setSelectedTask(task);
    setDetailVisible(true);
  };

  const handleDetailSaved = () => {
    refresh();
  };

  const handleCreated = () => {
    setCreateVisible(false);
    refresh();
  };

  const pendingCount = tasks.filter((t) => t.status === '待发布').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>素材分发</Text>
          {pendingCount > 0 && (
            <Text style={styles.headerSubtitle}>{pendingCount}个待发布任务</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* 顶部发布看板 */}
      <PublishDashboard tasks={tasks} />

      <View style={styles.filterBar}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.filterTab,
              activeFilter === tab.value && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(tab.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.value && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ErrorBanner visible={isOffline} onRetry={refresh} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SOPCard
          title="素材跨平台分发 SOP"
          sops={publishSOPs}
          loading={sopsLoading}
          error={sopsError}
        />

        {filteredTasks.map((task) => (
          <PublishTaskCard
            key={task.id}
            task={task}
            onPress={handleCardPress}
            onStartPublish={handleStartPublish}
          />
        ))}

        {filteredTasks.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>暂无数据</Text>
            <Text style={styles.emptySubtitle}>在飞书多维表格中添加数据后即可在此查看</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <TaskDetailModal
        visible={detailVisible}
        task={selectedTask}
        onClose={() => setDetailVisible(false)}
        onSaved={handleDetailSaved}
      />

      <CreatePublishTaskModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={handleCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.accent,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 发布看板
  dashboardWrap: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dashboardTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  dashboardSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  dashboardAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
    backgroundColor: Colors.errorLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  dashboardAlertText: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
    fontSize: 11,
  },
  dashboardScroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.xs,
  },
  platformCard: {
    minWidth: 132,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  platformCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  platformCardName: {
    ...Typography.bodySmall,
    fontWeight: '700',
  },
  platformCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  platformStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  platformStatNum: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  platformStatLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
  },
  platformStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderLight,
  },
  // 筛选
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  // 任务卡片
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.borderLight,
    ...Shadows.sm,
  },
  taskCardOverdue: {
    borderLeftColor: Colors.error,
  },
  taskHeader: {
    marginBottom: Spacing.md,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  taskProject: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  platformTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  platformTagText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  copyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deadlineNormal: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  deadlineUrgent: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },
  deadlineOverdue: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  startButtonText: {
    ...Typography.bodySmall,
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.section,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  // 详情 Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  detailScroll: {
    marginBottom: Spacing.md,
  },
  detailTaskTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  detailInfoGrid: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  detailInfoItem: {
    flex: 1,
  },
  detailInfoLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  detailInfoValue: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  detailCopyWrap: {
    marginBottom: Spacing.md,
  },
  detailCopyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  // 数据回填
  dataSection: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  dataSectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  dataInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dataInputItem: {
    flex: 1,
  },
  dataInputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  dataInputLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  dataInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    height: 40,
    paddingHorizontal: Spacing.md,
    fontVariant: ['tabular-nums'],
  },
  saveDataButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveDataButtonDisabled: {
    opacity: 0.7,
  },
  saveDataButtonText: {
    ...Typography.body,
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
  sopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    backgroundColor: Colors.accent + '10',
  },
  sopButtonText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
    flex: 0,
  },
  // 新建任务 Modal
  createModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    maxHeight: '90%',
  },
  createScroll: {
    paddingBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    height: 50,
    paddingHorizontal: Spacing.lg,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 96,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    height: 50,
    paddingHorizontal: Spacing.lg,
  },
  dropdownText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  dropdownPlaceholder: {
    color: Colors.textTertiary,
  },
  dropdownOptions: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownOptionActive: {
    backgroundColor: Colors.accent + '10',
  },
  dropdownOptionText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  dropdownOptionTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  platformPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  platformPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  platformPickerText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...Typography.h4,
    color: Colors.textOnAccent,
  },
});
