import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { SOPChecklist } from '../types';
import { loadChecklistProgress, saveChecklistProgress } from '../services/checklistStorage';

interface SOPChecklistCardProps {
  checklist: SOPChecklist;
  projectId: string;
}

export default function SOPChecklistCard({ checklist, projectId }: SOPChecklistCardProps) {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  useEffect(() => {
    loadChecklistProgress(projectId, checklist.id).then((progress) => {
      if (progress) setCheckedItems(progress.checkedItems);
    });
  }, [projectId, checklist.id]);

  const toggleItem = async (itemId: string) => {
    const newChecked = checkedItems.includes(itemId)
      ? checkedItems.filter((id) => id !== itemId)
      : [...checkedItems, itemId];
    setCheckedItems(newChecked);
    await saveChecklistProgress(projectId, checklist.id, newChecked);
  };

  const handleOpenWiki = async () => {
    if (!checklist.wikiUrl) return;
    try {
      await WebBrowser.openBrowserAsync(checklist.wikiUrl);
    } catch (e) {
      console.warn('打开 SOP 文档失败:', e);
    }
  };

  const completedCount = checkedItems.length;
  const totalCount = checklist.items.length;
  const allDone = completedCount === totalCount;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="checkbox-outline" size={18} color={Colors.accent} />
          <Text style={styles.title} numberOfLines={1}>
            {checklist.title}
          </Text>
        </View>
        <View
          style={[
            styles.progressBadge,
            allDone && styles.progressBadgeDone,
          ]}
        >
          <Text
            style={[
              styles.progressText,
              allDone && styles.progressTextDone,
            ]}
          >
            {completedCount}/{totalCount}
          </Text>
        </View>
      </View>

      <View style={styles.itemsContainer}>
        {checklist.items.map((item) => {
          const isChecked = checkedItems.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.item}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  isChecked && styles.checkboxChecked,
                ]}
              >
                {isChecked && (
                  <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
                )}
              </View>
              <Text
                style={[
                  styles.itemText,
                  isChecked && styles.itemTextChecked,
                ]}
                numberOfLines={2}
              >
                {item.text}
                {item.required && <Text style={styles.requiredMark}> *</Text>}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {checklist.wikiUrl && (
        <TouchableOpacity
          style={styles.wikiButton}
          onPress={handleOpenWiki}
          activeOpacity={0.7}
        >
          <Ionicons name="book-outline" size={16} color={Colors.accent} />
          <Text style={styles.wikiButtonText}>查看完整 SOP</Text>
          <Ionicons name="open-outline" size={14} color={Colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
    flex: 1,
  },
  progressBadge: {
    backgroundColor: Colors.accent + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  progressBadgeDone: {
    backgroundColor: Colors.successLight,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as any,
  },
  progressTextDone: {
    color: Colors.success,
  },
  itemsContainer: {
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  itemText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  itemTextChecked: {
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  requiredMark: {
    color: Colors.error,
  },
  wikiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  wikiButtonText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
  },
});
