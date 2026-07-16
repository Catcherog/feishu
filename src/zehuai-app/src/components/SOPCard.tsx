import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { SOPItem } from '../types';

interface SOPCardProps {
  title?: string;
  sops: SOPItem[];
  loading?: boolean;
  error?: string | null;
}

export default function SOPCard({ title = 'SOP 引导', sops, loading, error }: SOPCardProps) {
  const handleOpen = async (url: string) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      console.warn('打开 Wiki 文档失败:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="book-outline" size={16} color={Colors.accent} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="book-outline" size={16} color={Colors.accent} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.emptyText}>加载失败：{error}</Text>
      </View>
    );
  }

  if (sops.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="book-outline" size={16} color={Colors.accent} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {sops.map((sop) => (
        <TouchableOpacity
          key={sop.nodeToken}
          style={styles.item}
          onPress={() => handleOpen(sop.url)}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.itemText} numberOfLines={1}>
            {sop.title}
          </Text>
          <Ionicons name="open-outline" size={16} color={Colors.accent} />
        </TouchableOpacity>
      ))}
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
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  loader: {
    marginVertical: Spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
});
