import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useResources, useProjects } from '../hooks/useFeishuData';
import { Resource, ResourceCategory, RESOURCE_CATEGORIES, RESOURCE_CATEGORY_LABELS, Project } from '../types';
import { formatPhone, formatRelativeTime } from '../utils/format';
import { RootStackParamList } from '../navigation/AppNavigator';
import ErrorBanner from '../components/ErrorBanner';
import StatusBadge from '../components/StatusBadge';

// 资源状态颜色映射：合作中绿色 / 暂停橙色 / 终止灰色
const RESOURCE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  '合作中': { bg: Colors.successLight, text: Colors.success },
  '可用': { bg: Colors.successLight, text: Colors.success },
  '在合作': { bg: Colors.successLight, text: Colors.success },
  '正常': { bg: Colors.successLight, text: Colors.success },
  '暂停': { bg: Colors.warningLight, text: Colors.warning },
  '已暂停': { bg: Colors.warningLight, text: Colors.warning },
  '停用': { bg: Colors.warningLight, text: Colors.warning },
  '待定': { bg: Colors.warningLight, text: Colors.warning },
  '已停合作': { bg: '#F5F5F5', text: Colors.statusArchived },
  '已下架': { bg: '#F5F5F5', text: Colors.statusArchived },
  '已归档': { bg: '#F5F5F5', text: Colors.statusArchived },
};

function getStatusColor(status: string): { bg: string; text: string } {
  return RESOURCE_STATUS_COLORS[status] || { bg: Colors.accent + '15', text: Colors.accent };
}

// 分类对应的价格单位
const CATEGORY_PRICE_UNIT: Partial<Record<ResourceCategory, string>> = {
  venue: '/天',
  costume: '/天',
  makeup: '/次',
  model: '/次',
  retouch: '/次',
};

// 分类对应的头像颜色
const CATEGORY_AVATAR_COLORS: Record<ResourceCategory, { bg: string; text: string }> = {
  venue: { bg: '#E3F2FD', text: '#1976D2' },
  costume: { bg: '#FCE4EC', text: '#C2185B' },
  makeup: { bg: '#F3E5F5', text: '#7B1FA2' },
  model: { bg: '#E8F5E9', text: '#388E3C' },
  retouch: { bg: '#FFF3E0', text: '#F57C00' },
  emergency: { bg: '#FFEBEE', text: '#D32F2F' },
};

function formatResourcePrice(resource: Resource): string {
  if (resource.price <= 0) return '面议';
  const unit = CATEGORY_PRICE_UNIT[resource.category] || '';
  const base = resource.priceText || `¥${resource.price.toLocaleString('zh-CN')}`;
  return `${base}${unit}`;
}

function ResourceCard({ resource, onPress }: { resource: Resource; onPress: () => void }) {
  const statusColor = getStatusColor(resource.status);
  const avatarColors = CATEGORY_AVATAR_COLORS[resource.category];
  const displayName = (!resource.name || resource.name === '/' || resource.name === '-') ? '未命名' : resource.name;

  const subText = (() => {
    const phone = formatPhone(resource.contact);
    if (phone && phone !== displayName && /[\d@]/.test(phone)) return { text: phone, isContact: true };
    if (resource.location) return { text: resource.location, isContact: false };
    if (resource.style) return { text: resource.style, isContact: false };
    if (resource.notes) return { text: resource.notes.slice(0, 20), isContact: false };
    if (resource.priority) return { text: resource.priority, isContact: false };
    return { text: '暂无详细信息', isContact: false };
  })();

  const hasTags = resource.tags.length > 0;
  const priceUnit = resource.price > 0 ? CATEGORY_PRICE_UNIT[resource.category] : '';
  const isNegotiable = resource.price <= 0;
  const priceDisplay = isNegotiable ? '面议' : (resource.priceText || `¥${resource.price.toLocaleString('zh-CN')}`);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: avatarColors.bg }]}>
          <Text style={[styles.avatarText, { color: avatarColors.text }]}>{displayName.charAt(0)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {resource.status ? (
              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusText, { color: statusColor.text }]}>{resource.status}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.contact, !subText.isContact && styles.contactSubtle]} numberOfLines={1}>
            {subText.text}
          </Text>
        </View>
      </View>

      {hasTags && (
        <View style={[styles.tagsRow, !hasTags && styles.tagsRowEmpty]}>
          {resource.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: avatarColors.bg }]}>
              <Text style={[styles.tagText, { color: avatarColors.text }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.categoryRow}>
          <View style={[styles.categoryDot, { backgroundColor: avatarColors.text }]} />
          <Text style={styles.categoryLabel}>{RESOURCE_CATEGORY_LABELS[resource.category]}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.priceText, isNegotiable && styles.priceTextMuted]}>
            {priceDisplay}
          </Text>
          {priceUnit ? <Text style={styles.priceUnit}>{priceUnit}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ResourceDetailModal({
  resource,
  visible,
  onClose,
  relatedProjects,
  onProjectPress,
}: {
  resource: Resource | null;
  visible: boolean;
  onClose: () => void;
  relatedProjects: Project[];
  onProjectPress: (projectId: string) => void;
}) {
  if (!resource) return null;

  const avatarColors = CATEGORY_AVATAR_COLORS[resource.category];
  const displayName = (!resource.name || resource.name === '/' || resource.name === '-') ? '未命名' : resource.name;

  const handleCall = () => {
    if (resource.contact) {
      const cleanPhone = resource.contact.replace(/[^\d+]/g, '');
      if (cleanPhone) Linking.openURL(`tel:${cleanPhone}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>资源详情</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailAvatar, { backgroundColor: avatarColors.bg }]}>
                    <Text style={[styles.detailAvatarText, { color: avatarColors.text }]}>{displayName.charAt(0)}</Text>
                  </View>
                  <View style={styles.detailTitle}>
                    <Text style={styles.detailName}>{displayName}</Text>
                    <Text style={styles.detailCategory}>{RESOURCE_CATEGORY_LABELS[resource.category]}</Text>
                  </View>
                </View>

            <View style={styles.detailSection}>
              {resource.status ? renderDetailRow('flag-outline', '状态', resource.status) : null}
              {renderContactRow(
                'call-outline',
                '联系方式',
                formatPhone(resource.contact) || '-',
                resource.contact,
                handleCall,
              )}
              {renderDetailRow('pricetag-outline', '参考价格', formatResourcePrice(resource))}
              {resource.location ? renderDetailRow('location-outline', '地址/地点', resource.location) : null}
              {resource.style ? renderDetailRow('color-palette-outline', '风格/类型', resource.style) : null}
              {resource.notes ? renderDetailRow('document-text-outline', '备注', resource.notes) : null}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>关联项目历史</Text>
              {relatedProjects.length > 0 ? (
                relatedProjects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.relatedProjectItem}
                    activeOpacity={0.7}
                    onPress={() => onProjectPress(project.id)}
                  >
                    <View style={styles.relatedProjectInfo}>
                      <Text style={styles.relatedProjectName} numberOfLines={1}>
                        {project.name}
                      </Text>
                      <Text style={styles.relatedProjectMeta}>
                        {project.scheduledDate ? formatRelativeTime(project.scheduledDate) : '未排期'}
                      </Text>
                    </View>
                    <View style={styles.relatedProjectRight}>
                      <StatusBadge status={project.status} />
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyProjects}>
                  <Ionicons name="folder-open-outline" size={28} color={Colors.textTertiary} />
                  <Text style={styles.emptyProjectsText}>该资源暂未关联任何项目</Text>
                </View>
              )}
            </View>
          </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function renderDetailRow(icon: string, label: string, value: string) {
  return (
    <View style={styles.detailRow} key={label}>
      <View style={styles.detailLabel}>
        <Ionicons name={icon as any} size={16} color={Colors.textTertiary} />
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>
        {value || '-'}
      </Text>
    </View>
  );
}

function renderContactRow(
  icon: string,
  label: string,
  value: string,
  contact: string,
  onPress: () => void,
) {
  const callable = !!contact;
  return (
    <View style={styles.detailRow} key={label}>
      <View style={styles.detailLabel}>
        <Ionicons name={icon as any} size={16} color={Colors.textTertiary} />
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      {callable ? (
        <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.detailValue, styles.contactLink]}>
            {value}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.detailValue}>
          {value || '-'}
        </Text>
      )}
    </View>
  );
}

export default function ResourcesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeCategory, setActiveCategory] = useState<ResourceCategory>('venue');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const { data: resources, loading, refresh, isOffline } = useResources(activeCategory);
  const { data: allProjects } = useProjects();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // 实时过滤当前分类资源（按名称/标签）
  const filteredResources = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return resources;
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(kw) ||
        r.tags.some((tag) => tag.toLowerCase().includes(kw)),
    );
  }, [resources, searchKeyword]);

  // 查询与选中资源关联的项目（按资源名称匹配项目备注/名称/拍摄地点）
  const relatedProjects = useMemo(() => {
    if (!selectedResource) return [];
    const name = selectedResource.name.trim().toLowerCase();
    if (!name) return [];
    return allProjects
      .filter(
        (p) =>
          p.notes.toLowerCase().includes(name) ||
          p.name.toLowerCase().includes(name) ||
          p.location.toLowerCase().includes(name),
      )
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5);
  }, [selectedResource, allProjects]);

  const handleResourcePress = (resource: Resource) => {
    setSelectedResource(resource);
  };

  const handleProjectPress = (projectId: string) => {
    setSelectedResource(null);
    navigation.navigate('ProjectDetail', { projectId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>资源库</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryBar}
      >
        {RESOURCE_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryTab, activeCategory === category && styles.categoryTabActive]}
            onPress={() => setActiveCategory(category)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryTabText,
                activeCategory === category && styles.categoryTabTextActive,
              ]}
            >
              {RESOURCE_CATEGORY_LABELS[category]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchBoxWrap}>
        <Ionicons name="search" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索资源名称、标签..."
          placeholderTextColor={Colors.textTertiary}
          value={searchKeyword}
          onChangeText={setSearchKeyword}
        />
        {searchKeyword.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchKeyword('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
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
        <View style={styles.resultInfo}>
          <Text style={styles.resultCount}>
            共 {filteredResources.length} 条{RESOURCE_CATEGORY_LABELS[activeCategory]}资源
          </Text>
          {searchKeyword.trim() ? (
            <TouchableOpacity
              style={styles.filterTag}
              onPress={() => setSearchKeyword('')}
              activeOpacity={0.7}
            >
              <Text style={styles.filterTagText}>筛选：{searchKeyword.trim()}</Text>
              <Ionicons name="close" size={12} color={Colors.accent} />
            </TouchableOpacity>
          ) : null}
        </View>

        {filteredResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} onPress={() => handleResourcePress(resource)} />
        ))}

        {filteredResources.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>暂无数据</Text>
            <Text style={styles.emptySubtitle}>
              {searchKeyword ? '未找到匹配的资源' : '在飞书多维表格中添加数据后即可在此查看'}
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <ResourceDetailModal
        resource={selectedResource}
        visible={!!selectedResource}
        onClose={() => setSelectedResource(null)}
        relatedProjects={relatedProjects}
        onProjectPress={handleProjectPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  categoryBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  categoryTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    minWidth: 56,
    alignItems: 'center',
  },
  categoryTabActive: {
    backgroundColor: Colors.accent,
    transform: [{ scale: 1.02 }],
  },
  categoryTabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    ...Typography.bodySmall,
    color: Colors.textOnAccent,
    fontWeight: '700',
  },
  searchBoxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    height: 36,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  resultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  resultCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent + '10',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  filterTagText: {
    ...Typography.caption,
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md - 2,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '500',
  },
  contact: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  contactSubtle: {
    color: Colors.textTertiary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tagsRowEmpty: {
    marginBottom: 0,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
  },
  tagText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border + '80',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  categoryLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '700',
  },
  priceTextMuted: {
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  priceUnit: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
    marginLeft: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
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
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: '75%',
    overflow: 'hidden',
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border + '80',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  modalContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  detailAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  detailAvatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  detailTitle: {
    flex: 1,
  },
  detailName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  detailCategory: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  detailSection: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border + '60',
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    width: 90,
    flexShrink: 0,
  },
  detailLabelText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  contactLink: {
    color: Colors.accent,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  emptyProjects: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyProjectsText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  relatedProjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border + '60',
  },
  relatedProjectInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  relatedProjectName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginBottom: 2,
  },
  relatedProjectMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  relatedProjectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
