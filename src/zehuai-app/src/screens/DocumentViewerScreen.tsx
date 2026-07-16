import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';

type RootStackParamList = {
  MainTabs: undefined;
  Notifications: undefined;
  Tasks: undefined;
  DocumentViewer: { url: string; title?: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentViewer'>;

export default function DocumentViewerScreen({ route }: Props) {
  const { url, title } = route.params;

  const handleOpenExternal = () => {
    Linking.openURL(url).catch(() => {
      Alert.alert('打开失败', '无法打开文档链接');
    });
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('复制成功', '链接已复制到剪贴板');
    } catch {
      Alert.alert('复制失败', '无法复制链接，请重试');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="document-text-outline" size={64} color={Colors.accent} />
        </View>
        <Text style={styles.title}>{title || '文档预览'}</Text>
        <Text style={styles.subtitle}>
          当前使用外部浏览器打开文档
        </Text>
        <Text style={styles.urlText} numberOfLines={2}>
          {url}
        </Text>
        <TouchableOpacity style={styles.openButton} onPress={handleOpenExternal} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={18} color={Colors.textOnPrimary} />
          <Text style={styles.openButtonText}>在浏览器中打开</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink} activeOpacity={0.7}>
          <Text style={styles.copyButtonText}>复制链接</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  urlText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: 18,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  openButtonText: {
    ...Typography.h4,
    color: Colors.textOnPrimary,
  },
  copyButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  copyButtonText: {
    ...Typography.bodySmall,
    color: Colors.accent,
  },
});
