import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { Project } from '../types';
import { formatDate, formatProgress, getDaysUntil } from '../utils/format';
import StatusBadge from './StatusBadge';

interface ProjectCardProps {
  project: Project;
  onPress?: (project: Project) => void;
}

const DOC_ACTIONS = [
  { key: 'planning', label: '策划案', icon: 'document-text-outline', urlField: 'planningDocUrl' as const },
  { key: 'selection', label: '选片', icon: 'images-outline', urlField: 'selectionFolderUrl' as const },
  { key: 'delivery', label: '交付', icon: 'checkmark-done-outline', urlField: 'deliveryFolderUrl' as const },
] as const;

function openUrl(url: string, label: string) {
  if (!url) {
    Alert.alert('提示', `暂无${label}链接`);
    return;
  }
  Linking.openURL(url).catch(() => {
    Alert.alert('打开失败', '无法打开链接，请检查链接是否有效');
  });
}

export default function ProjectCard({ project, onPress }: ProjectCardProps) {
  const daysLeft = getDaysUntil(project.deadline);
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 2;
  const hasDocLinks = DOC_ACTIONS.some(a => project[a.urlField]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(project)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {project.name}
          </Text>
          <StatusBadge status={project.status} />
        </View>
        <View style={styles.clientRow}>
          <Ionicons name="person-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.clientName}>{project.clientName}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.infoText}>{formatDate(project.scheduledDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.infoText} numberOfLines={1}>{project.location}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>进度</Text>
            <Text style={styles.progressValue}>
              {project.completedShots}/{project.totalShots}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${formatProgress(project.completedShots, project.totalShots)}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {hasDocLinks && (
        <View style={styles.docActions}>
          {DOC_ACTIONS.map(action => {
            const url = project[action.urlField];
            if (!url) return null;
            return (
              <TouchableOpacity
                key={action.key}
                style={styles.docAction}
                onPress={() => openUrl(url, action.label)}
                activeOpacity={0.7}
              >
                <Ionicons name={action.icon as any} size={14} color={Colors.accent} />
                <Text style={styles.docActionText}>{action.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        {isOverdue ? (
          <View style={styles.deadlineOverdue}>
            <Ionicons name="alert-circle" size={13} color={Colors.error} />
            <Text style={styles.deadlineTextOverdue}>已逾期{Math.abs(daysLeft)}天</Text>
          </View>
        ) : isUrgent ? (
          <View style={styles.deadlineUrgent}>
            <Ionicons name="time-outline" size={13} color={Colors.warning} />
            <Text style={styles.deadlineTextUrgent}>剩余{daysLeft}天</Text>
          </View>
        ) : (
          <View style={styles.deadlineNormal}>
            <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.deadlineTextNormal}>截止 {formatDate(project.deadline)}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  name: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  clientName: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  body: {
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  infoText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  progressSection: {
    gap: Spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  progressValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  docActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  docAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  docActionText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '500',
  },
  deadlineNormal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deadlineTextNormal: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  deadlineUrgent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deadlineTextUrgent: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },
  deadlineOverdue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  deadlineTextOverdue: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600',
  },
});
