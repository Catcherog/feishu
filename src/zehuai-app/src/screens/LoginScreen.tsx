import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import FeishuAuthWebView from '../components/FeishuAuthWebView';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(() => {
    setError(null);
    setWebViewVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setWebViewVisible(false);
  }, []);

  const handleSuccess = useCallback(() => {
    setWebViewVisible(false);
    onLoginSuccess();
  }, [onLoginSuccess]);

  const handleAuthError = useCallback((message: string) => {
    setWebViewVisible(false);
    setError(message);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="camera" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.title}>泽怀影像</Text>
          <Text style={styles.subtitle}>专业影像管理平台</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>飞书登录</Text>
          <Text style={styles.formDesc}>使用工作室飞书账号登录，非工作室成员无法授权</Text>

          <TouchableOpacity
            style={[styles.loginButton, webViewVisible && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={webViewVisible}
            activeOpacity={0.8}
          >
            {webViewVisible ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses" size={20} color={Colors.textOnPrimary} />
                <Text style={styles.loginButtonText}>使用飞书登录</Text>
              </>
            )}
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <Text style={styles.hint}>登录即表示同意使用泽怀影像中台</Text>
      </ScrollView>

      <FeishuAuthWebView
        visible={webViewVisible}
        onClose={handleClose}
        onSuccess={handleSuccess}
        onError={handleAuthError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    ...Shadows.md,
  },
  formTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  formDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    ...Typography.h4,
    color: Colors.textOnPrimary,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
