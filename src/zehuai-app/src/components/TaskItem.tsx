import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { FeishuTask, TaskStatus } from '../types';
import { formatDate } from '../utils/format';

const STATUS_BAR_COLOR: Record<TaskStatus, string> = {
  todo: Colors.warning,
  in_progress: Colors.info,
  done: Colors.success,
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
};

const STATUS_LABEL_STYLE: Record<TaskStatus, { bg: string; text: string }> = {
  todo: { bg: Colors.warningLight, text: Colors.warning },
  in_progress: { bg: Colors.infoLight, text: Colors.info },
  done: { bg: Colors.successLight, text: Colors.success },
};

interface TaskItemProps {
  task: FeishuTask;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

export default function TaskItem({ task, onStatusChange }: TaskItemProps) {
  const barColor = STATUS_BAR_COLOR[task.status];
  const label = STATUS_LABEL[task.status];
  const labelStyle = STATUS_LABEL_STYLE[task.status];

  const handlePress = () => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };
    onStatusChange(task.id, nextStatus[task.status]);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.statusBar, { backgroundColor: barColor }]} />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={[styles.statusLabel, { backgroundColor: labelStyle.bg }]}>
            <Text style={[styles.statusText, { color: labelStyle.text }]}>
              {label}
            </Text>
          </View>
        </View>

        {task.projectName ? (
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.infoText}>{task.projectName}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          {task.dueDate ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.infoText}>{formatDate(task.dueDate)}</Text>
            </View>
          ) : null}
          {task.assigneeName ? (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.infoText}>{task.assigneeName}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  statusBar: {
    width: 4,
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusLabel: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
});
