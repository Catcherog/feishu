import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { TEMPLATE_FOLDER_TOKEN } from '../constants/config';
import { useProjects } from '../hooks/useFeishuData';
import { ProjectStatus, Project } from '../types';
import { shareDocument, getProjects } from '../services/feishu';
import { usePermission } from '../contexts/PermissionContext';
import { scheduleProjectDeadlineReminder, getNotificationSettings } from '../services/notifications';
import ProjectCard from '../components/ProjectCard';
import DocumentPickerModal from '../components/DocumentPickerModal';
import ErrorBanner from '../components/ErrorBanner';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FILTER_TABS: { label: string; value: ProjectStatus | '' }[] = [
  { label: '全部', value: '' },
  { label: '待拍摄', value: '待拍摄' },
  { label: '进行中', value: '拍摄中' },
  { label: '已完成', value: '已完成' },
];

export default function ProjectsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeFilter, setActiveFilter] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const { canAccessData, canCreateProject } = usePermission();
  const { data: projects, loading, refresh, isOffline } = useProjects(
    activeFilter || undefined
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
      getNotificationSettings().then((settings) => {
        if (!settings.projectReminder) return;
        getProjects()
          .then(({ data }) => {
            data.forEach((p) => {
              if (p.deadline) {
                scheduleProjectDeadlineReminder(p.id, p.name, p.deadline).catch(() => {});
              }
            });
          })
          .catch(() => {});
      });
    }, [refresh])
  );

  const roleFilteredProjects = projects.filter((p) =>
    canAccessData('project', {
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      status: p.status,
      participants: p.participants,
    })
  );

  const filteredProjects = activeFilter
    ? roleFilteredProjects.filter((p) => p.status === activeFilter)
    : roleFilteredProjects;

  const handleProjectPress = (project: Project) => {
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  const handleCreateProject = () => {
    navigation.navigate('ProjectForm');
  };

  const handleShareDoc = async (project: Project) => {
    if (!project.planningDocUrl && !project.folderToken) {
      Alert.alert('提示', '该项目暂无可分享的文档');
      return;
    }
    try {
      const result = await shareDocument(
        project.folderToken || project.id,
        'folder',
        'all',
        'view'
      );
      if (result.url) {
        await Clipboard.setStringAsync(result.url);
        Alert.alert('分享成功', '文档链接已复制到剪贴板');
      }
    } catch {
      Alert.alert('分享失败', '无法生成分享链接，请重试');
    }
  };

  const handleCreateFromTemplate = () => {
    setPickerVisible(true);
  };

  const handleTemplateCreated = (doc: { fileToken: string; url: string }) => {
    refresh();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>项目管理</Text>
        <View style={styles.headerActions}>
          {TEMPLATE_FOLDER_TOKEN ? (
            <TouchableOpacity style={styles.iconButton} onPress={handleCreateFromTemplate}>
              <Ionicons name="document-outline" size={20} color={Colors.accent} />
            </TouchableOpacity>
          ) : null}
          {canCreateProject() && (
            <TouchableOpacity style={styles.addButton} onPress={handleCreateProject}>
              <Ionicons name="add" size={22} color={Colors.textOnPrimary} />
              <Text style={styles.addButtonText}>新建</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
        <View style={styles.resultInfo}>
          <Text style={styles.resultCount}>
            共 {filteredProjects.length} 个项目
          </Text>
        </View>

        {filteredProjects.map((project) => (
          <View key={project.id}>
            <ProjectCard project={project} onPress={handleProjectPress} />
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShareDoc(project)}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={14} color={Colors.accent} />
              <Text style={styles.shareButtonText}>分享文档</Text>
            </TouchableOpacity>
          </View>
        ))}

        {filteredProjects.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>暂无数据</Text>
            <Text style={styles.emptySubtitle}>在飞书多维表格中添加数据后即可在此查看</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <DocumentPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        folderToken={TEMPLATE_FOLDER_TOKEN}
        onCreated={handleTemplateCreated}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addButtonText: {
    ...Typography.bodySmall,
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
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
  resultInfo: {
    paddingVertical: Spacing.md,
  },
  resultCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
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
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    alignSelf: 'flex-end',
  },
  shareButtonText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '500',
  },
});
