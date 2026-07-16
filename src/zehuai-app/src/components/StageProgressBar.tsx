import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { getStagesByType, getStageIndex } from '../constants/projectStages';
import { ProjectType } from '../types';

interface StageProgressBarProps {
  type: ProjectType;
  currentStage: string;
}

export default function StageProgressBar({ type, currentStage }: StageProgressBarProps) {
  const stages = getStagesByType(type);
  const currentIndex = getStageIndex(type, currentStage);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>项目进度</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {stages.map((stage, index) => {
          const stageNum = index + 1;
          const isCompleted = stageNum < currentIndex;
          const isCurrent = stageNum === currentIndex;
          return (
            <View key={stage} style={styles.stageItem}>
              <View style={styles.stageTopRow}>
                <View
                  style={[
                    styles.stageCircle,
                    isCompleted && styles.stageCircleCompleted,
                    isCurrent && styles.stageCircleCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.stageNumber,
                      (isCompleted || isCurrent) && styles.stageNumberActive,
                    ]}
                  >
                    {isCompleted ? '✓' : stageNum}
                  </Text>
                </View>
                {index < stages.length - 1 && (
                  <View
                    style={[
                      styles.stageLine,
                      isCompleted && styles.stageLineCompleted,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stageLabel,
                  isCurrent && styles.stageLabelCurrent,
                  isCompleted && styles.stageLabelCompleted,
                ]}
                numberOfLines={1}
              >
                {stage}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  scroll: {
    paddingVertical: Spacing.xs,
  },
  stageItem: {
    width: 80,
    alignItems: 'center',
  },
  stageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    width: '100%',
  },
  stageCircle: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stageCircleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stageCircleCurrent: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  stageNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  stageNumberActive: {
    color: Colors.textOnPrimary,
  },
  stageLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginLeft: 2,
  },
  stageLineCompleted: {
    backgroundColor: Colors.success,
  },
  stageLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  stageLabelCurrent: {
    color: Colors.accent,
    fontWeight: '600',
  },
  stageLabelCompleted: {
    color: Colors.success,
  },
});
