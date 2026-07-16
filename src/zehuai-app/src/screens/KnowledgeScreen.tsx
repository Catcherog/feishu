import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  FlatList,
  SectionList,
  ActivityIndicator,
  Alert,
  ListRenderItem,
  SectionListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import {
  KnowledgeEntry,
  ScriptEntry,
  SOPRule,
  TrendingCase,
  KNOWLEDGE_KEYWORDS,
  KNOWLEDGE_SCENARIOS,
  SCRIPT_SCENES,
  SCRIPT_TARGETS,
  SCRIPT_CONVERSIONS,
  TRENDING_PLATFORMS,
  TRENDING_ELEMENTS,
} from '../types';
import {
  useKnowledgeEntries,
  useScriptLibrary,
  useSOPRules,
  useTrendingResearch,
} from '../hooks/useFeishuData';
import { formatDate } from '../utils/format';
import ErrorBanner from '../components/ErrorBanner';

// ============ 常量 ============

/** 顶部 4 个分段 Tab */
const TABS = [
  { key: 'knowledge', label: '知识库' },
  { key: 'script', label: '话术库' },
  { key: 'sop', label: 'SOP规则' },
  { key: 'trending', label: '爆款参考' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** 话术转化效果颜色映射：高转化绿/中转化黄/低转化橙/待优化灰 */
const CONVERSION_COLORS: Record<string, { bg: string; text: string }> = {
  高转化: { bg: Colors.successLight, text: Colors.success },
  中转化: { bg: Colors.warningLight, text: Colors.warning },
  低转化: { bg: Colors.errorLight, text: Colors.error },
  待优化: { bg: '#F5F5F5', text: Colors.statusArchived },
};

/** SOP 规则分组类型 */
interface SOPSection {
  title: string;
  data: SOPRule[];
}

// ============ 通用 Hooks / 子组件 ============

/** 简单防抖：延迟 delay 毫秒同步 value */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** 单个筛选 Chip */
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** 横向滚动的 Chip 组（带分组标题） */
function ChipGroup({
  title,
  options,
  selectedValues,
  onPress,
}: {
  title: string;
  options: readonly string[];
  selectedValues: string[];
  onPress: (val: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            active={selectedValues.includes(opt)}
            onPress={() => onPress(opt)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** 搜索框 */
function SearchBox({
  value,
  onChange,
  placeholder,
  onClear,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  onClear?: () => void;
}) {
  return (
    <View style={styles.searchBoxWrap}>
      <Ionicons name="search" size={18} color={Colors.textTertiary} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => (onClear ? onClear() : onChange(''))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** 空状态 */
function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="documents-outline" size={40} color={Colors.textTertiary} />
      <Text style={styles.emptyTitle}>暂无数据</Text>
      <Text style={styles.emptySubtitle}>{message}</Text>
    </View>
  );
}

/** 加载状态 */
function LoadingState() {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>加载中…</Text>
    </View>
  );
}

/** 详情 Modal 框架（底部弹出） */
function DetailModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {title}
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/** 轻量标签徽章（带可选颜色） */
function TagBadge({
  label,
  color,
}: {
  label: string;
  color?: { bg: string; text: string };
}) {
  const bg = color ? color.bg : Colors.accent + '12';
  const txt = color ? color.text : Colors.accent;
  return (
    <View style={[styles.tagBadge, { backgroundColor: bg }]}>
      <Text style={[styles.tagBadgeText, { color: txt }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** 标签行（自动换行） */
function TagRow({ tags, colors }: { tags: string[]; colors?: Record<string, { bg: string; text: string }> }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View style={styles.tagRow}>
      {tags.map((tag) => (
        <TagBadge key={tag} label={tag} color={colors ? colors[tag] : undefined} />
      ))}
    </View>
  );
}

/** 详情区块标题 */
function DetailSectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.detailSectionTitle}>{children}</Text>;
}

/** 详情文本区块 */
function DetailTextBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailBlockLabel}>{label}</Text>
      <Text style={styles.detailBlockValue}>{value}</Text>
    </View>
  );
}

/** 复制文本到剪贴板 */
async function copyToClipboard(text: string) {
  try {
    await Clipboard.setStringAsync(text);
    Alert.alert('已复制', '内容已复制到剪贴板');
  } catch {
    Alert.alert('复制失败', '请长按文本手动复制');
  }
}

/** 打开 URL，失败时提示 */
async function openUrl(url: string) {
  if (!url) return;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('提示', `无法打开此链接：${url}`);
    }
  } catch {
    Alert.alert('打开失败', '链接打开失败，请稍后重试');
  }
}

/** 复制按钮 */
function CopyButton({ text, label = '复制内容' }: { text: string; label?: string }) {
  return (
    <TouchableOpacity
      style={styles.copyButton}
      onPress={() => copyToClipboard(text)}
      activeOpacity={0.7}
    >
      <Ionicons name="copy-outline" size={16} color={Colors.accent} />
      <Text style={styles.copyButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** 链接按钮（打开 URL） */
function LinkButton({ url, label }: { url: string; label: string }) {
  if (!url) return null;
  return (
    <TouchableOpacity
      style={styles.linkButton}
      onPress={() => openUrl(url)}
      activeOpacity={0.7}
    >
      <Ionicons name="open-outline" size={16} color={Colors.textOnAccent} />
      <Text style={styles.linkButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============ 子视图 1: 知识库 ============

function KnowledgeLibraryView() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [selected, setSelected] = useState<KnowledgeEntry | null>(null);

  const { data, loading, error, refresh, isOffline } = useKnowledgeEntries({
    keyword: debouncedKeyword,
    keywords: selectedKeywords,
    scenarios: selectedScenarios,
  });

  // 多选切换
  const toggleKeyword = useCallback((val: string) => {
    setSelectedKeywords((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }, []);
  const toggleScenario = useCallback((val: string) => {
    setSelectedScenarios((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }, []);

  const renderItem: ListRenderItem<KnowledgeEntry> = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => setSelected(item)}
    >
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title || '未命名知识'}
      </Text>
      {item.keywords.length > 0 && (
        <View style={styles.cardSection}>
          <Text style={styles.cardSectionLabel}>核心关键词</Text>
          <TagRow tags={item.keywords} />
        </View>
      )}
      {item.scenarios.length > 0 && (
        <View style={styles.cardSection}>
          <Text style={styles.cardSectionLabel}>适用场景</Text>
          <TagRow tags={item.scenarios} />
        </View>
      )}
      {item.updatedAt ? (
        <Text style={styles.cardMeta}>最后更新：{formatDate(item.updatedAt)}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.subViewContainer}>
      <SearchBox
        value={keyword}
        onChange={setKeyword}
        placeholder="搜索知识标题"
      />
      <ScrollView
        style={styles.filterArea}
        contentContainerStyle={styles.filterAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <ChipGroup
          title="核心关键词"
          options={KNOWLEDGE_KEYWORDS}
          selectedValues={selectedKeywords}
          onPress={toggleKeyword}
        />
        <ChipGroup
          title="适用场景"
          options={KNOWLEDGE_SCENARIOS}
          selectedValues={selectedScenarios}
          onPress={toggleScenario}
        />
      </ScrollView>

      <ErrorBanner visible={!!error || isOffline} onRetry={refresh} message={error || undefined} />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState message={keyword || selectedKeywords.length || selectedScenarios.length ? '未找到匹配的知识' : '在飞书多维表格中添加数据后即可在此查看'} />
          ) : null
        }
        ListHeaderComponent={
          loading && data.length === 0 ? <LoadingState /> : null
        }
        showsVerticalScrollIndicator={false}
      />

      <DetailModal
        visible={!!selected}
        title="知识详情"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <View>
            <Text style={styles.detailTitle}>{selected.title || '未命名知识'}</Text>
            {selected.knowledgeId ? (
              <Text style={styles.detailId}>ID：{selected.knowledgeId}</Text>
            ) : null}

            {selected.keywords.length > 0 && (
              <View style={styles.detailSection}>
                <DetailSectionTitle>核心关键词</DetailSectionTitle>
                <TagRow tags={selected.keywords} />
              </View>
            )}
            {selected.scenarios.length > 0 && (
              <View style={styles.detailSection}>
                <DetailSectionTitle>适用场景</DetailSectionTitle>
                <TagRow tags={selected.scenarios} />
              </View>
            )}

            {selected.detailUrl ? (
              <LinkButton url={selected.detailUrl} label="查看飞书文档" />
            ) : null}

            <DetailTextBlock label="备注" value={selected.notes} />

            {selected.updatedAt ? (
              <Text style={styles.detailMeta}>最后更新：{formatDate(selected.updatedAt)}</Text>
            ) : null}
          </View>
        )}
      </DetailModal>
    </View>
  );
}

// ============ 子视图 2: 话术库 ============

function ScriptLibraryView() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [scene, setScene] = useState('');
  const [target, setTarget] = useState('');
  const [conversion, setConversion] = useState('');
  const [selected, setSelected] = useState<ScriptEntry | null>(null);

  const { data, loading, error, refresh, isOffline } = useScriptLibrary({
    keyword: debouncedKeyword,
    scene: scene || undefined,
    target: target || undefined,
    conversion: conversion || undefined,
  });

  // 单选切换（再次点击取消）
  const toggleSingle = useCallback(
    (val: string, current: string, setter: (v: string) => void) => {
      setter(current === val ? '' : val);
    },
    [],
  );

  const renderItem: ListRenderItem<ScriptEntry> = ({ item }) => {
    const convColor = item.conversion ? CONVERSION_COLORS[item.conversion] : undefined;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setSelected(item)}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.goal || '未命名话术'}
        </Text>
        <View style={styles.tagRow}>
          {item.scene ? <TagBadge label={item.scene} /> : null}
          {item.target ? <TagBadge label={item.target} /> : null}
          {item.conversion ? (
            <TagBadge label={item.conversion} color={convColor} />
          ) : null}
        </View>
        {item.content ? (
          <Text style={styles.cardPreview} numberOfLines={2}>
            {item.content}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.subViewContainer}>
      <SearchBox
        value={keyword}
        onChange={setKeyword}
        placeholder="搜索话术目标或全文"
      />
      <ScrollView
        style={styles.filterArea}
        contentContainerStyle={styles.filterAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <ChipGroup
          title="话术场景"
          options={SCRIPT_SCENES}
          selectedValues={scene ? [scene] : []}
          onPress={(v) => toggleSingle(v, scene, setScene)}
        />
        <ChipGroup
          title="适用对象"
          options={SCRIPT_TARGETS}
          selectedValues={target ? [target] : []}
          onPress={(v) => toggleSingle(v, target, setTarget)}
        />
        <ChipGroup
          title="转化效果"
          options={SCRIPT_CONVERSIONS}
          selectedValues={conversion ? [conversion] : []}
          onPress={(v) => toggleSingle(v, conversion, setConversion)}
        />
      </ScrollView>

      <ErrorBanner visible={!!error || isOffline} onRetry={refresh} message={error || undefined} />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState message={keyword || scene || target || conversion ? '未找到匹配的话术' : '在飞书多维表格中添加数据后即可在此查看'} />
          ) : null
        }
        ListHeaderComponent={
          loading && data.length === 0 ? <LoadingState /> : null
        }
        showsVerticalScrollIndicator={false}
      />

      <DetailModal
        visible={!!selected}
        title="话术详情"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <View>
            <Text style={styles.detailTitle}>{selected.goal || '未命名话术'}</Text>
            {selected.scriptId ? (
              <Text style={styles.detailId}>ID：{selected.scriptId}</Text>
            ) : null}

            <View style={styles.detailSection}>
              <TagRow
                tags={[selected.scene, selected.target, selected.conversion].filter(Boolean) as string[]}
                colors={CONVERSION_COLORS}
              />
            </View>

            {selected.content ? (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <DetailSectionTitle>话术全文</DetailSectionTitle>
                  <CopyButton text={selected.content} label="复制全文" />
                </View>
                <Text style={styles.detailLongText}>{selected.content}</Text>
              </View>
            ) : null}

            <DetailTextBlock label="注意事项" value={selected.cautions} />
            <DetailTextBlock label="备注" value={selected.notes} />

            {selected.updatedAt ? (
              <Text style={styles.detailMeta}>版本更新：{formatDate(selected.updatedAt)}</Text>
            ) : null}
          </View>
        )}
      </DetailModal>
    </View>
  );
}

// ============ 子视图 3: SOP 规则 ============

function SOPRulesView() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selected, setSelected] = useState<SOPRule | null>(null);

  // 始终拉取全部规则，客户端按类别分组与过滤
  const { data, loading, error, refresh, isOffline } = useSOPRules();

  // 从数据中动态去重提取类别，追加"全部"
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return ['全部', ...Array.from(set)];
  }, [data]);

  // 按选中类别过滤
  const filteredRules = useMemo(() => {
    if (!selectedCategory || selectedCategory === '全部') return data;
    return data.filter((r) => r.category === selectedCategory);
  }, [data, selectedCategory]);

  // 按类别分组
  const sections = useMemo<SOPSection[]>(() => {
    const groups = new Map<string, SOPRule[]>();
    filteredRules.forEach((r) => {
      const cat = r.category || '未分类';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(r);
    });
    return Array.from(groups, ([title, list]) => ({ title, data: list }));
  }, [filteredRules]);

  const toggleCategory = useCallback((val: string) => {
    setSelectedCategory((prev) => (prev === val ? '' : val));
  }, []);

  const renderItem: SectionListRenderItem<SOPRule> = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => setSelected(item)}
    >
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.name || '未命名规则'}
      </Text>
      {item.content ? (
        <Text style={styles.cardPreview} numberOfLines={2}>
          {item.content}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.subViewContainer}>
      <ScrollView
        style={styles.filterArea}
        contentContainerStyle={styles.filterAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <ChipGroup
          title="规则类别"
          options={categories}
          selectedValues={selectedCategory ? [selectedCategory] : ['全部']}
          onPress={toggleCategory}
        />
      </ScrollView>

      <ErrorBanner visible={!!error || isOffline} onRetry={refresh} message={error || undefined} />

      <SectionList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <Text style={styles.sectionHeaderCount}>{section.data.length} 条</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState message={selectedCategory && selectedCategory !== '全部' ? '该类别暂无规则' : '在飞书多维表格中添加数据后即可在此查看'} />
          ) : null
        }
        ListHeaderComponent={
          loading && data.length === 0 ? <LoadingState /> : null
        }
        showsVerticalScrollIndicator={false}
      />

      <DetailModal
        visible={!!selected}
        title="规则详情"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <View>
            <Text style={styles.detailTitle}>{selected.name || '未命名规则'}</Text>
            {selected.category ? (
              <View style={styles.detailSection}>
                <TagBadge label={selected.category} />
              </View>
            ) : null}

            {selected.content ? (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <DetailSectionTitle>规则详细内容</DetailSectionTitle>
                  <CopyButton text={selected.content} label="复制规则" />
                </View>
                <Text style={styles.detailLongText}>{selected.content}</Text>
              </View>
            ) : null}

            {selected.example ? (
              <View style={styles.detailSection}>
                <DetailSectionTitle>示例</DetailSectionTitle>
                <View style={styles.exampleBox}>
                  <Text style={styles.exampleText}>{selected.example}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </DetailModal>
    </View>
  );
}

// ============ 子视图 4: 爆款参考 ============

function TrendingResearchView() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [platform, setPlatform] = useState('');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selected, setSelected] = useState<TrendingCase | null>(null);

  const { data, loading, error, refresh, isOffline } = useTrendingResearch({
    keyword: debouncedKeyword,
    platform: platform || undefined,
    elements: selectedElements,
  });

  const toggleElement = useCallback((val: string) => {
    setSelectedElements((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }, []);

  const togglePlatform = useCallback((val: string) => {
    setPlatform((prev) => (prev === val ? '' : val));
  }, []);

  const renderItem: ListRenderItem<TrendingCase> = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => setSelected(item)}
    >
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title || '未命名爆款'}
      </Text>
      <View style={styles.tagRow}>
        {item.platform ? <TagBadge label={item.platform} /> : null}
        {item.elements.map((el) => (
          <TagBadge key={el} label={el} />
        ))}
      </View>
      <View style={styles.cardFooter}>
        {item.publishedAt ? (
          <Text style={styles.cardMeta}>发布：{formatDate(item.publishedAt)}</Text>
        ) : (
          <View />
        )}
        {item.interactionData ? (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item.interactionData}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.subViewContainer}>
      <SearchBox
        value={keyword}
        onChange={setKeyword}
        placeholder="搜索爆款标题或可复用点"
      />
      <ScrollView
        style={styles.filterArea}
        contentContainerStyle={styles.filterAreaContent}
        showsVerticalScrollIndicator={false}
      >
        <ChipGroup
          title="所属平台"
          options={TRENDING_PLATFORMS}
          selectedValues={platform ? [platform] : []}
          onPress={togglePlatform}
        />
        <ChipGroup
          title="核心爆款元素"
          options={TRENDING_ELEMENTS}
          selectedValues={selectedElements}
          onPress={toggleElement}
        />
      </ScrollView>

      <ErrorBanner visible={!!error || isOffline} onRetry={refresh} message={error || undefined} />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState message={keyword || platform || selectedElements.length ? '未找到匹配的爆款案例' : '在飞书多维表格中添加数据后即可在此查看'} />
          ) : null
        }
        ListHeaderComponent={
          loading && data.length === 0 ? <LoadingState /> : null
        }
        showsVerticalScrollIndicator={false}
      />

      <DetailModal
        visible={!!selected}
        title="爆款详情"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <View>
            <Text style={styles.detailTitle}>{selected.title || '未命名爆款'}</Text>
            {selected.researchId ? (
              <Text style={styles.detailId}>ID：{selected.researchId}</Text>
            ) : null}

            <View style={styles.detailSection}>
              <TagRow
                tags={[selected.platform, ...selected.elements].filter(Boolean) as string[]}
              />
            </View>

            {selected.reusablePoints ? (
              <View style={styles.detailSection}>
                <DetailSectionTitle>可复用点</DetailSectionTitle>
                <Text style={styles.detailLongText}>{selected.reusablePoints}</Text>
              </View>
            ) : null}

            {selected.copywriting ? (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <DetailSectionTitle>全文文案</DetailSectionTitle>
                  <CopyButton text={selected.copywriting} label="复制文案" />
                </View>
                <Text style={styles.detailLongText}>{selected.copywriting}</Text>
              </View>
            ) : null}

            {selected.url ? <LinkButton url={selected.url} label="查看笔记链接" /> : null}

            <DetailTextBlock label="互动数据" value={selected.interactionData} />
            <DetailTextBlock label="热门标签/话题" value={selected.tags} />

            {selected.publishedAt ? (
              <Text style={styles.detailMeta}>发布时间：{formatDate(selected.publishedAt)}</Text>
            ) : null}
          </View>
        )}
      </DetailModal>
    </View>
  );
}

// ============ 主组件 ============

export default function KnowledgeScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('knowledge');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>知识库</Text>
      </View>

      {/* 顶部 SegmentedControl：4 个分段切换 */}
      <View style={styles.segmentedControl}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 子视图区域 */}
      {activeTab === 'knowledge' && <KnowledgeLibraryView />}
      {activeTab === 'script' && <ScriptLibraryView />}
      {activeTab === 'sop' && <SOPRulesView />}
      {activeTab === 'trending' && <TrendingResearchView />}
    </SafeAreaView>
  );
}

// ============ 样式 ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  // SegmentedControl
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    ...Shadows.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
  segmentText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: Colors.textOnAccent,
    fontWeight: '700',
  },
  // 子视图容器
  subViewContainer: {
    flex: 1,
  },
  // 搜索框
  searchBoxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    height: 40,
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
  // 筛选器区
  filterArea: {
    flexShrink: 0,
    maxHeight: 180,
  },
  filterAreaContent: {
    paddingBottom: Spacing.xs,
  },
  filterGroup: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 2,
  },
  filterLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: '500',
  },
  chipScroll: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 0,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    minWidth: 48,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    transform: [{ scale: 1.02 }],
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  chipTextActive: {
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
  // 列表
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  // 卡片
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md - 2,
    ...Shadows.sm,
  },
  cardTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  cardSection: {
    marginBottom: Spacing.sm,
  },
  cardSectionLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
    marginBottom: 4,
  },
  cardPreview: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border + '60',
  },
  // 标签行
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tagBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '500',
  },
  // 空状态 / 加载状态
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.section,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  // SectionList 组头
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceWarm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionHeaderText: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  sectionHeaderCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border + '80',
  },
  modalTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  // 详情内容
  detailTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  detailId: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  detailSection: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  detailSectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  detailLongText: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  detailBlock: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailBlockLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 4,
    fontWeight: '500',
  },
  detailBlockValue: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  detailMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  // 示例区块
  exampleBox: {
    backgroundColor: Colors.surfaceWarm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  exampleText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // 按钮
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent + '12',
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    marginBottom: Spacing.md,
  },
  linkButtonText: {
    ...Typography.body,
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
});
