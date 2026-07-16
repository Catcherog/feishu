import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { getClients, updateClient } from '../services/feishu';
import { scheduleClientFollowUpReminder } from '../services/notifications';
import { useWikiSOPs, useProjects, useScriptLibrary } from '../hooks/useFeishuData';
import { Client, ClientStatus, CLIENT_STATUSES, Project, ScriptEntry } from '../types';
import { formatPhone, formatRelativeTime, maskPhone, maskWechat } from '../utils/format';
import { usePermission } from '../contexts/PermissionContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import StatusBadge from '../components/StatusBadge';
import SOPCard from '../components/SOPCard';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientDetail'>;

const WIKI_SCRIPT_URL = 'https://YOUR_TENANT.feishu.cn/wiki/WIKI_NODE_PLACEHOLDER';

/** 根据客户状态映射适用话术场景 */
function mapClientStatusToScriptScenes(status: string): string[] {
  switch (status) {
    case '潜在客户':
      return ['客户咨询', '资源首次触达'];
    case '跟进中':
      return ['预约成交'];
    case '已成交':
      return ['拍摄前对接', '拍摄执行', '成片交付'];
    case '已归档':
      return ['售后维护'];
    default:
      return ['客户咨询'];
  }
}

/** 转化效果颜色（与 KnowledgeScreen 保持一致：高转化绿/中转化黄/低转化橙/待优化灰） */
function getConversionColor(conversion: string): { bg: string; text: string } {
  switch (conversion) {
    case '高转化':
      return { bg: '#E8F5E9', text: '#2E7D32' };
    case '中转化':
      return { bg: '#FFF8E1', text: '#F57F17' };
    case '低转化':
      return { bg: '#FFF3E0', text: '#E65100' };
    case '待优化':
      return { bg: '#ECEFF1', text: '#546E7A' };
    default:
      return { bg: '#ECEFF1', text: '#546E7A' };
  }
}

export default function ClientDetailScreen({ navigation, route }: Props) {
  const { clientId } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const { role } = usePermission();
  const shouldMask = role === 'photographer' || role === 'post';

  const { data: clientSOPs, loading: sopsLoading, error: sopsError } = useWikiSOPs('client');
  const { data: allProjects } = useProjects();

  const scriptScenes = mapClientStatusToScriptScenes(client?.status || '');
  // 取第一个场景作为筛选条件（Hook 不支持多场景 OR 查询）
  const { data: scripts, loading: scriptsLoading } = useScriptLibrary({
    scene: scriptScenes[0],
  });
  const topScripts: ScriptEntry[] = scripts.slice(0, 3);

  const [form, setForm] = useState<Partial<Client>>({});

  const loadClient = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getClients();
      const found = data.find((c) => c.id === clientId) || null;
      setClient(found);
      if (found) {
        setForm({
          name: found.name,
          phone: found.phone,
          wechat: found.wechat,
          source: found.source,
          status: found.status,
          notes: found.notes,
        });
      }
    } catch (err: any) {
      Alert.alert('加载失败', err?.message || '无法获取客户信息');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const relatedProjects = client
    ? allProjects.filter((p) => p.clientId === client.id)
    : [];

  const followUpRecords = client
    ? (client.followUpRecords || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            if (isEditing) {
              setForm({
                name: client?.name,
                phone: client?.phone,
                wechat: client?.wechat,
                source: client?.source,
                status: client?.status,
                notes: client?.notes,
              });
              setIsEditing(false);
            } else {
              setIsEditing(true);
            }
          }}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>
            {isEditing ? '取消' : '编辑'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditing, client]);

  const updateForm = (key: keyof Client, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      Alert.alert('提示', '客户姓名不能为空');
      return;
    }

    setSaving(true);
    try {
      const ok = await updateClient(clientId, {
        '客户姓名': form.name?.trim() || '',
        '联系方式': form.phone?.trim() || '',
        '微信号': form.wechat?.trim() || '',
        '来源渠道': form.source?.trim() || '',
        '客户状态': form.status || '潜在客户',
        '备注': form.notes?.trim() || '',
      });

      if (ok) {
        await loadClient();
        setIsEditing(false);
        if (client?.lastContactDate) {
          scheduleClientFollowUpReminder(clientId, client.name, client.lastContactDate).catch(() => {});
        }
      } else {
        Alert.alert('保存失败', '无法更新客户信息，请稍后重试');
      }
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || '更新客户时出错');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenWiki = () => {
    Linking.openURL(WIKI_SCRIPT_URL).catch(() => {
      Alert.alert('提示', '无法打开话术库链接');
    });
  };

  const handleProjectPress = (projectId: string) => {
    navigation.navigate('ProjectDetail', { projectId });
  };

  const handleAddFollowUp = async () => {
    const text = followUpText.trim();
    if (!text) {
      Alert.alert('提示', '请输入跟进内容');
      return;
    }
    setSavingFollowUp(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const newRecord = `${dateStr}: ${text}`;
      const existing = client?.followUpRecords || '';
      const updated = existing ? `${existing}\n${newRecord}` : newRecord;
      const ok = await updateClient(clientId, { '跟进记录': updated });
      if (ok) {
        setFollowUpModalVisible(false);
        setFollowUpText('');
        await loadClient();
      } else {
        Alert.alert('保存失败', '无法更新跟进记录，请稍后重试');
      }
    } catch (err: any) {
      Alert.alert('保存失败', err?.message || '更新跟进记录时出错');
    } finally {
      setSavingFollowUp(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <Ionicons name="person-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>未找到该客户</Text>
      </SafeAreaView>
    );
  }

  const phoneFormatter = shouldMask ? maskPhone : formatPhone;
  const wechatFormatter = shouldMask ? maskWechat : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.name.charAt(0)}</Text>
            </View>
            <View style={styles.headerInfo}>
              {isEditing ? (
                <TextInput
                  style={styles.nameInput}
                  value={form.name}
                  onChangeText={(text) => updateForm('name', text)}
                  placeholder="客户姓名"
                  placeholderTextColor={Colors.textTertiary}
                />
              ) : (
                <Text style={styles.nameText}>{client.name}</Text>
              )}
              <StatusBadge status={form.status || client.status} size="medium" />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle icon="call-outline" title="联系方式" />
            <InfoRow
              label="电话"
              value={client.phone}
              editing={isEditing}
              editValue={form.phone}
              onChangeText={(text) => updateForm('phone', text)}
              keyboardType="phone-pad"
              formatter={phoneFormatter}
              placeholder="未填写"
            />
            <InfoRow
              label="微信"
              value={client.wechat}
              editing={isEditing}
              editValue={form.wechat}
              onChangeText={(text) => updateForm('wechat', text)}
              formatter={wechatFormatter}
              placeholder="未填写"
            />
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle icon="information-circle-outline" title="客户信息" />
            <InfoRow
              label="来源渠道"
              value={client.source}
              editing={isEditing}
              editValue={form.source}
              onChangeText={(text) => updateForm('source', text)}
              placeholder="未知"
            />
            {isEditing ? (
              <View style={styles.editRow}>
                <Text style={styles.rowLabel}>客户状态</Text>
                <TouchableOpacity
                  style={styles.statusSelector}
                  onPress={() => setStatusModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <StatusBadge status={form.status || '潜在客户'} size="medium" />
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoRow}>
                <Text style={styles.rowLabel}>客户状态</Text>
                <StatusBadge status={client.status} size="medium" />
              </View>
            )}
            <View style={[styles.infoRow, styles.noBorder]}>
              <Text style={styles.rowLabel}>最近联系</Text>
              <Text style={styles.rowValue}>{formatRelativeTime(client.lastContactDate) || '暂无'}</Text>
            </View>
            {client.tags.length > 0 && (
              <View style={[styles.infoRow, styles.noBorder]}>
                <Text style={styles.rowLabel}>标签</Text>
                <View style={styles.tagsContainer}>
                  {client.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* 适用话术卡片 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleText}>适用话术</Text>
              <Text style={styles.sectionHint}>基于客户状态：{client.status}</Text>
            </View>
            {scriptsLoading ? (
              <Text style={styles.loadingText}>加载中...</Text>
            ) : topScripts.length === 0 ? (
              <Text style={styles.emptySectionText}>暂无适用话术</Text>
            ) : (
              topScripts.map((script) => (
                <TouchableOpacity
                  key={script.id}
                  style={styles.scriptItem}
                  onPress={() => navigation.navigate('Knowledge' as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.scriptItemHeader}>
                    <Text style={styles.scriptScene} numberOfLines={1}>{script.scene}</Text>
                    {script.conversion ? (
                      <View style={[styles.conversionBadge, { backgroundColor: getConversionColor(script.conversion).bg }]}>
                        <Text style={[styles.conversionText, { color: getConversionColor(script.conversion).text }]}>
                          {script.conversion}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.scriptGoal} numberOfLines={2}>{script.goal || '无目标描述'}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle icon="briefcase-outline" title="关联项目" />
            {relatedProjects.length === 0 ? (
              <Text style={styles.emptySectionText}>暂无关联项目</Text>
            ) : (
              relatedProjects.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  onPress={() => handleProjectPress(project.id)}
                />
              ))
            )}
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle
              icon="chatbubble-outline"
              title="跟进记录"
              action={
                <TouchableOpacity
                  style={styles.addFollowUpButton}
                  onPress={() => setFollowUpModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
                  <Text style={styles.addFollowUpText}>添加</Text>
                </TouchableOpacity>
              }
            />
            {followUpRecords.length > 0 ? (
              followUpRecords.map((record, index) => (
                <View key={index} style={styles.followUpItem}>
                  <View style={styles.followUpDot} />
                  <Text style={styles.followUpText}>{record}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptySectionText}>暂无跟进记录</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle icon="document-text-outline" title="备注" />
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={form.notes}
                onChangeText={(text) => updateForm('notes', text)}
                placeholder="补充客户信息、需求或跟进记录..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.notesText}>
                {client.notes || '暂无备注'}
              </Text>
            )}
          </View>

          <SOPCard
            title="客户/获客 SOP"
            sops={clientSOPs}
            loading={sopsLoading}
            error={sopsError}
          />

          <TouchableOpacity
            style={styles.wikiButton}
            onPress={handleOpenWiki}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={20} color={Colors.accent} />
            <Text style={styles.wikiButtonText}>查看话术库</Text>
            <Ionicons name="open-outline" size={16} color={Colors.accent} />
          </TouchableOpacity>

          {isEditing && (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
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
          )}

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={statusModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择客户状态</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {CLIENT_STATUSES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.statusOption,
                  item === form.status && styles.statusOptionActive,
                ]}
                onPress={() => {
                  setForm((prev) => ({ ...prev, status: item }));
                  setStatusModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <StatusBadge status={item} size="medium" />
                {item === form.status && (
                  <Ionicons name="checkmark" size={20} color={Colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={followUpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFollowUpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加跟进记录</Text>
              <TouchableOpacity onPress={() => setFollowUpModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.followUpInput]}
              value={followUpText}
              onChangeText={setFollowUpText}
              placeholder="请输入跟进内容..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.saveButton, savingFollowUp && styles.saveButtonDisabled]}
              onPress={handleAddFollowUp}
              disabled={savingFollowUp}
              activeOpacity={0.8}
            >
              {savingFollowUp ? (
                <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={16} color={Colors.accent} />
      <Text style={[styles.sectionTitleText, action ? { flex: 1 } : null]}>{title}</Text>
      {action}
    </View>
  );
}

function InfoRow({
  label,
  value,
  editing,
  editValue,
  onChangeText,
  keyboardType,
  placeholder,
  formatter,
}: {
  label: string;
  value: string;
  editing?: boolean;
  editValue?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  placeholder?: string;
  formatter?: (v: string) => string;
}) {
  return (
    <View style={[styles.infoRow, editing && styles.editRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.rowInput}
          value={editValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType={keyboardType}
        />
      ) : (
        <Text style={styles.rowValue}>{formatter ? formatter(value) : value || placeholder || '-'}</Text>
      )}
    </View>
  );
}

function ProjectItem({ project, onPress }: { project: Project; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.projectItem} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.projectInfo}>
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.projectMeta}>
          {project.scheduledDate ? formatRelativeTime(project.scheduledDate) : '未排期'}
        </Text>
      </View>
      <View style={styles.projectRight}>
        <StatusBadge status={project.status} />
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  headerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
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
  headerInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  nameText: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  nameInput: {
    ...Typography.h2,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitleText: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  scriptItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  scriptItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scriptScene: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  conversionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  conversionText: {
    ...Typography.caption,
    fontWeight: '500',
  },
  scriptGoal: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  editRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  rowValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  rowInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    height: 40,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
  },
  notesInput: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  notesText: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'flex-end',
    flex: 1,
    marginLeft: Spacing.md,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent + '15',
  },
  tagText: {
    ...Typography.caption,
    color: Colors.accent,
    fontSize: 11,
  },
  emptySectionText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    paddingVertical: Spacing.md,
    textAlign: 'center',
  },
  addFollowUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  addFollowUpText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
  },
  followUpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  followUpDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 6,
  },
  followUpText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  followUpInput: {
    height: 120,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.lg,
    textAlignVertical: 'top',
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  projectInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  projectName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginBottom: 2,
  },
  projectMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  projectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wikiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent + '15',
    borderRadius: BorderRadius.md,
    height: 48,
    marginBottom: Spacing.lg,
  },
  wikiButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  statusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceWarm,
    height: 40,
    paddingHorizontal: Spacing.md,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.h4,
    color: Colors.textOnAccent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  statusOptionActive: {
    backgroundColor: Colors.accent + '15',
  },
});
