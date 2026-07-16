import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useTasks } from '../hooks/useFeishuData';
import { createFeishuTask, updateFeishuTask } from '../services/feishu';
import { FeishuTask, TaskStatus } from '../types';
import TaskItem from '../components/TaskItem';
import DatePicker from '../components/DatePicker';

export default function TasksScreen() {
  const { data: tasks, loading, refresh } = useTasks();
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    try {
      await updateFeishuTask(id, { status });
      refresh();
    } catch (e: any) {
      Alert.alert('更新失败', e?.message || '请稍后重试');
    }
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入任务标题');
      return;
    }
    setFormLoading(true);
    try {
      await createFeishuTask({
        summary: title.trim(),
        description: description.trim(),
        dueDate: dueDate.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setShowForm(false);
      refresh();
    } catch (e: any) {
      Alert.alert('创建失败', e?.message || '请稍后重试');
    } finally {
      setFormLoading(false);
    }
  }, [title, description, dueDate, refresh]);

  const renderFilters = () => (
    <View style={styles.filterRow}>
      {(['all', 'todo', 'in_progress', 'done'] as const).map((key) => {
        const active = filter === key;
        const labelMap: Record<typeof key, string> = {
          all: '全部',
          todo: '待办',
          in_progress: '进行中',
          done: '已完成',
        };
        return (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
              {labelMap[key]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderForm = () => (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>新建任务</Text>
      <TextInput
        style={styles.input}
        placeholder="任务标题"
        placeholderTextColor={Colors.textTertiary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="任务描述（可选）"
        placeholderTextColor={Colors.textTertiary}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />
      <DatePicker
        label="截止日期"
        value={dueDate}
        onChange={setDueDate}
        placeholder="请选择截止日期"
      />
      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.formButton, styles.cancelButton]}
          onPress={() => setShowForm(false)}
          disabled={formLoading}
        >
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.formButton, styles.submitButton]}
          onPress={handleCreate}
          disabled={formLoading}
        >
          {formLoading ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>创建</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>任务管理</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm((prev) => !prev)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={24} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {renderFilters()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />
        }
      >
        {showForm && renderForm()}

        {loading && tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={Colors.accent} />
          </View>
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkbox-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>
              {filter === 'all' ? '暂无任务' : '该状态下暂无任务'}
            </Text>
            <Text style={styles.emptySubtext}>点击右上角 + 创建新任务</Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem key={task.id} task={task} onStatusChange={handleStatusChange} />
          ))
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
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textOnAccent,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.section * 2,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  formTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  formButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  submitButton: {
    backgroundColor: Colors.accent,
  },
  submitButtonText: {
    ...Typography.bodySmall,
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
});
