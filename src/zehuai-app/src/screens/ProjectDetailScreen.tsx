import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { getProjectById, updateProject } from '../services/feishu';
import { useClients, useWikiSOPs, useKnowledgeEntries } from '../hooks/useFeishuData';
import { scheduleProjectDeadlineReminder } from '../services/notifications';
import { Project, ProjectStatus, SOPPhase, KnowledgeEntry } from '../types';
import { getNextStage, isLastStage } from '../constants/projectStages';
import { getChecklistForStage } from '../constants/sopChecklists';
import { RootStackParamList } from '../navigation/AppNavigator';
import StatusBadge from '../components/StatusBadge';
import SOPCard from '../components/SOPCard';
import StageProgressBar from '../components/StageProgressBar';
import SOPChecklistCard from '../components/SOPChecklistCard';
import DatePicker from '../components/DatePicker';
import { formatDate } from '../utils/format';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DetailRouteProp = RouteProp<RootStackParamList, 'ProjectDetail'>;

const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: '待拍摄', value: '待拍摄' },
  { label: '拍摄中', value: '拍摄中' },
  { label: '后期制作', value: '后期制作' },
  { label: '待交付', value: '待交付' },
  { label: '已完成', value: '已完成' },
];

/** 根据项目状态映射适用知识场景 */
function mapProjectStatusToKnowledgeScenarios(status: string): string[] {
  switch (status) {
    case '待拍摄':
      return ['拍摄前准备'];
    case '拍摄中':
      return ['拍摄执行', '拍摄技巧'];
    case '后期制作':
      return ['后期制作'];
    case '已完成':
      return ['运营推广'];
    case '复盘归档':
      return ['客户服务'];
    default:
      return ['拍摄前准备'];
  }
}

export default function ProjectDetailScreen() {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { projectId } = route.params;
  const { data: clients } = useClients();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const projectPhase: SOPPhase = useMemo(() => {
    switch (project?.status) {
      case '拍摄中':
        return 'shooting';
      case '后期制作':
      case '待交付':
      case '已完成':
        return 'post';
      case '待拍摄':
      default:
        return 'project-plan';
    }
  }, [project?.status]);

  const { data: projectSOPs, loading: sopsLoading, error: sopsError } = useWikiSOPs(projectPhase);

  const knowledgeScenarios = mapProjectStatusToKnowledgeScenarios(project?.status || '');
  const { data: knowledgeEntries, loading: knowledgeLoading } = useKnowledgeEntries({
    scenarios: knowledgeScenarios,
  });
  const topKnowledge: KnowledgeEntry[] = knowledgeEntries.slice(0, 3);

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('待拍摄');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const [statusOpen, setStatusOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);

  const resetForm = useCallback((p: Project) => {
    setName(p.name);
    setClientId(p.clientId);
    setScheduledDate(p.scheduledDate);
    setLocation(p.location);
    setStatus(p.status);
    setDeadline(p.deadline);
    setNotes(p.notes);
  }, []);

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const found = await getProjectById(projectId);
      setProject(found);
      if (found) {
        resetForm(found);
      }
    } catch {
      Alert.alert('加载失败', '无法获取项目详情，请重试');
    } finally {
      setLoading(false);
    }
  }, [projectId, resetForm]);

  useFocusEffect(
    useCallback(() => {
      loadProject();
    }, [loadProject])
  );

  const handleSave = async () => {
    if (!project) return;
    if (!name.trim()) {
      Alert.alert('提示', '请输入项目名称');
      return;
    }

    setSaving(true);
    const fields: Record<string, unknown> = {
      '项目名称': name.trim(),
      '拍摄档期': scheduledDate.trim(),
      '拍摄地点': location.trim(),
      '项目状态': status,
      '精修交付时间': deadline.trim(),
      '备注': notes.trim(),
    };
    if (clientId) {
      fields['关联客户ID'] = [{ record_id: clientId }];
    }

    const ok = await updateProject(project.id, fields, project.status);
    setSaving(false);

    if (ok) {
      Alert.alert('保存成功');
      setIsEditing(false);
      loadProject();
      if (deadline.trim()) {
        scheduleProjectDeadlineReminder(project.id, name.trim(), deadline.trim()).catch(() => {});
      }
    } else {
      Alert.alert('保存失败', '请稍后重试');
    }
  };

  const handleCancel = () => {
    if (project) {
      resetForm(project);
    }
    setIsEditing(false);
    setStatusOpen(false);
    setClientOpen(false);
  };

  const handleAdvanceStage = async () => {
    if (!project) return;
    const nextStage = getNextStage(project.type, project.status);
    if (!nextStage) return;

    setAdvancing(true);
    try {
      const fields: Record<string, unknown> = {
        '项目状态': nextStage,
      };
      const ok = await updateProject(project.id, fields, project.status);
      if (ok) {
        Alert.alert('状态已更新', `已推进到：${nextStage}`);
        await loadProject();
      } else {
        // updateProject 内部已通过 markPendingSync 保存到本地待同步
        Alert.alert('提示', '状态更新失败，已保存到本地');
      }
    } catch (e) {
      // 容错：不崩溃，提示已保存到本地，保持当前页面可用
      Alert.alert('提示', '状态更新失败，已保存到本地');
    } finally {
      setAdvancing(false);
    }
  };

  if (loading && !project) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>加载中...</Text>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>未找到项目</Text>
      </SafeAreaView>
    );
  }

  const clientOptions = [
    { label: '请选择客户', value: '' },
    ...clients.map((c) => ({ label: c.name, value: c.id })),
  ];

  const renderInfoRow = (icon: string, label: string, value: string) => (
    <View style={styles.infoRow} key={label}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon as any} size={16} color={Colors.textTertiary} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value || '-'}
      </Text>
    </View>
  );

  const currentChecklist = getChecklistForStage(project.type, project.status);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {project.name}
              </Text>
              <StatusBadge status={project.status} size="medium" />
            </View>
            <Text style={styles.subtitle}>
              创建于 {formatDate(project.createdAt)}
            </Text>
          </View>

          {isEditing ? (
            <View style={styles.editCard}>
              <FormInput
                label="项目名称 *"
                value={name}
                onChangeText={setName}
                placeholder="请输入项目名称"
              />

              <FormDropdown
                label="关联客户"
                value={clientId}
                options={clientOptions}
                onSelect={setClientId}
                open={clientOpen}
                setOpen={setClientOpen}
              />

              <DatePicker
                label="拍摄档期"
                value={scheduledDate}
                onChange={setScheduledDate}
                placeholder="请选择拍摄档期"
              />

              <FormInput
                label="拍摄地点"
                value={location}
                onChangeText={setLocation}
                placeholder="请输入拍摄地点"
              />

              <FormDropdown
                label="项目状态"
                value={status}
                options={STATUS_OPTIONS}
                onSelect={(v) => setStatus(v)}
                open={statusOpen}
                setOpen={setStatusOpen}
              />

              <DatePicker
                label="精修交付时间"
                value={deadline}
                onChange={setDeadline}
                placeholder="请选择精修交付时间"
              />

              <FormInput
                label="备注"
                value={notes}
                onChangeText={setNotes}
                placeholder="请输入备注"
                multiline
                numberOfLines={3}
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.saveButtonText}>保存</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              {renderInfoRow('person-outline', '关联客户', project.clientName)}
              {renderInfoRow('calendar-outline', '拍摄档期', formatDate(project.scheduledDate))}
              {renderInfoRow('location-outline', '拍摄地点', project.location)}
              {renderInfoRow('flag-outline', '项目状态', project.status)}
              {renderInfoRow('time-outline', '精修交付时间', formatDate(project.deadline))}
              {renderInfoRow('document-text-outline', '备注', project.notes)}

              <TouchableOpacity
                style={styles.editToggle}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={18} color={Colors.textOnPrimary} />
                <Text style={styles.editToggleText}>编辑项目</Text>
              </TouchableOpacity>

              {!isLastStage(project.type, project.status) && (() => {
                const nextStage = getNextStage(project.type, project.status);
                if (!nextStage) return null;
                return (
                  <TouchableOpacity
                    style={[styles.advanceButton, advancing && styles.advanceButtonDisabled]}
                    onPress={handleAdvanceStage}
                    disabled={advancing}
                    activeOpacity={0.8}
                  >
                    {advancing ? (
                      <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                    ) : (
                      <>
                        <Ionicons name="arrow-forward-circle-outline" size={18} color={Colors.textOnPrimary} />
                        <Text style={styles.advanceButtonText}>推进到：{nextStage}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

          {/* 关联知识卡片 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleText}>关联知识</Text>
              <Text style={styles.sectionHint}>基于项目阶段：{project?.status || '未知'}</Text>
            </View>
            {knowledgeLoading ? (
              <Text style={styles.loadingText}>加载中...</Text>
            ) : topKnowledge.length === 0 ? (
              <Text style={styles.emptyText}>暂无关联知识</Text>
            ) : (
              topKnowledge.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.knowledgeItem}
                  onPress={() => {
                    // 展示详情 Modal 或跳转 Knowledge Tab
                    // 此处简单实现：直接跳转 Knowledge Tab
                    navigation.navigate('Knowledge' as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.knowledgeTitle} numberOfLines={1}>{entry.title || '未命名知识'}</Text>
                  {entry.keywords.length > 0 && (
                    <View style={styles.knowledgeKeywords}>
                      {entry.keywords.slice(0, 3).map((kw) => (
                        <View key={kw} style={styles.keywordBadge}>
                          <Text style={styles.keywordText}>{kw}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {entry.detailUrl ? (
                    <Text style={styles.knowledgeUrl} numberOfLines={1}>📄 {entry.detailUrl}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </View>

          <StageProgressBar type={project.type} currentStage={project.status} />

          {currentChecklist && (
            <SOPChecklistCard checklist={currentChecklist} projectId={project.id} />
          )}

          <SOPCard
            title="项目执行 SOP"
            sops={projectSOPs}
            loading={sopsLoading}
            error={sopsError}
          />

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

function FormDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
  open,
  setOpen,
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onSelect: (value: T) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label || '';

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}
          numberOfLines={1}
        >
          {value ? selectedLabel : '请选择'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textTertiary}
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownOptions}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.dropdownOption,
                opt.value === value && styles.dropdownOptionActive,
              ]}
              onPress={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  opt.value === value && styles.dropdownOptionTextActive,
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {opt.value === value && (
                <Ionicons name="checkmark" size={16} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
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
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    width: 110,
  },
  infoLabelText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  infoValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    height: 48,
    marginTop: Spacing.lg,
  },
  editToggleText: {
    ...Typography.body,
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  advanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 48,
    marginTop: Spacing.sm,
  },
  advanceButtonDisabled: {
    opacity: 0.7,
  },
  advanceButtonText: {
    ...Typography.body,
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  editCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.borderLight,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.textOnPrimary,
    fontWeight: '600',
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
    minHeight: 88,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
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
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitleText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  sectionHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  knowledgeItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  knowledgeTitle: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  knowledgeKeywords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  keywordBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  keywordText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  knowledgeUrl: {
    ...Typography.caption,
    color: Colors.accent,
    marginTop: 2,
  },
});
