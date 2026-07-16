import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useClients } from '../hooks/useFeishuData';
import { Client, ClientStatus } from '../types';
import { usePermission } from '../contexts/PermissionContext';
import { formatPhone, formatRelativeTime, formatCurrency, maskPhone } from '../utils/format';
import { scheduleClientFollowUpReminder, getNotificationSettings } from '../services/notifications';
import { getClients } from '../services/feishu';
import StatusBadge from '../components/StatusBadge';
import ErrorBanner from '../components/ErrorBanner';

type ClientNavigationProp = NativeStackNavigationProp<{
  ClientForm: undefined;
  ClientDetail: { clientId: string };
}>;

const FILTER_TABS: { label: string; value: ClientStatus | '' }[] = [
  { label: '全部', value: '' },
  { label: '潜在客户', value: '潜在客户' },
  { label: '跟进中', value: '跟进中' },
  { label: '已成交', value: '已成交' },
  { label: '已归档', value: '已归档' },
];

const SOURCE_FILTER_TABS: { label: string; value: string }[] = [
  { label: '全部', value: '' },
  { label: '小红书', value: '小红书' },
  { label: '抖音', value: '抖音' },
  { label: '转介绍', value: '转介绍' },
  { label: '其他', value: '其他' },
];

const KNOWN_SOURCES = ['小红书', '抖音', '转介绍'];

function ClientCard({
  client,
  onPress,
  shouldMask,
}: {
  client: Client;
  onPress: () => void;
  shouldMask: boolean;
}) {
  const phoneDisplay = shouldMask ? maskPhone(client.phone) : formatPhone(client.phone);
  return (
    <TouchableOpacity style={styles.clientCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.clientHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {client.name.charAt(0)}
          </Text>
        </View>
        <View style={styles.clientInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.clientName}>{client.name}</Text>
            <StatusBadge status={client.status} />
          </View>
          <Text style={styles.clientPhone}>{phoneDisplay || '未填写'}</Text>
        </View>
      </View>

      <View style={styles.clientMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="briefcase-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.metaText}>{client.totalProjects}个项目</Text>
        </View>
        {client.totalRevenue > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="wallet-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.metaText}>{formatCurrency(client.totalRevenue)}</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.metaText}>
            {client.lastContactDate ? formatRelativeTime(client.lastContactDate) : '未联系'}
          </Text>
        </View>
      </View>

      {client.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {client.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.clientFooter}>
        <View style={styles.sourceRow}>
          <Text style={styles.sourceLabel}>来源</Text>
          <Text style={styles.sourceValue}>{client.source || '未知'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function ClientsScreen() {
  const [activeFilter, setActiveFilter] = useState('');
  const [activeSourceFilter, setActiveSourceFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigation = useNavigation<ClientNavigationProp>();
  const { canCreateClient, role } = usePermission();
  const shouldMask = role === 'photographer' || role === 'post';

  const { data: clients, loading, refresh, isOffline } = useClients();

  useFocusEffect(
    useCallback(() => {
      refresh();
      getNotificationSettings().then((settings) => {
        if (!settings.clientFollowUp) return;
        getClients()
          .then(({ data }) => {
            data.forEach((c) => {
              if (c.lastContactDate) {
                scheduleClientFollowUpReminder(c.id, c.name, c.lastContactDate).catch(() => {});
              }
            });
          })
          .catch(() => {});
      });
    }, [refresh])
  );

  const handleAddClient = () => {
    navigation.navigate('ClientForm');
  };

  const handleClientPress = (client: Client) => {
    navigation.navigate('ClientDetail', { clientId: client.id });
  };

  const filteredClients = clients.filter((c) => {
    if (activeFilter && c.status !== activeFilter) return false;
    if (activeSourceFilter) {
      if (activeSourceFilter === '其他') {
        if (KNOWN_SOURCES.includes(c.source)) return false;
      } else if (c.source !== activeSourceFilter) {
        return false;
      }
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      if (!c.name.toLowerCase().includes(kw) && !c.phone.includes(kw)) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {isSearching ? (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索客户姓名、手机号..."
              placeholderTextColor={Colors.textTertiary}
              value={searchKeyword}
              onChangeText={setSearchKeyword}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchKeyword(''); }}>
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>客户管理</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setIsSearching(true)}
              >
                <Ionicons name="search" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              {canCreateClient() && (
                <TouchableOpacity style={styles.addButton} onPress={handleAddClient}>
                  <Ionicons name="add" size={22} color={Colors.textOnPrimary} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>状态</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
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
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>来源</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {SOURCE_FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.filterTab,
                activeSourceFilter === tab.value && styles.filterTabActive,
              ]}
              onPress={() => setActiveSourceFilter(tab.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeSourceFilter === tab.value && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
            共 {filteredClients.length} 位客户
          </Text>
        </View>

        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onPress={() => handleClientPress(client)}
            shouldMask={shouldMask}
          />
        ))}

        {filteredClients.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>暂无数据</Text>
            <Text style={styles.emptySubtitle}>
              {searchKeyword || activeFilter || activeSourceFilter
                ? '未找到匹配的客户'
                : '在飞书多维表格中添加数据后即可在此查看'}
            </Text>
          </View>
        )}

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  filterSection: {
    marginBottom: Spacing.sm,
  },
  filterLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
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
  resultInfo: {
    paddingVertical: Spacing.md,
  },
  resultCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  clientCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.h4,
    color: Colors.accent,
  },
  clientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  clientName: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  clientPhone: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  clientMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
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
  clientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sourceLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  sourceValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
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
    textAlign: 'center',
  },
});
