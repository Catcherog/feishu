import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { StatusColors } from '../constants/theme';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium';
}

export default function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const colorSet = StatusColors[status] || { bg: Colors.borderLight, text: Colors.textTertiary };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colorSet.bg },
        size === 'medium' && styles.badgeMedium,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: colorSet.text },
          size === 'medium' && styles.textMedium,
        ]}
        numberOfLines={1}
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  badgeMedium: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  text: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  textMedium: {
    fontSize: 12,
  },
});
