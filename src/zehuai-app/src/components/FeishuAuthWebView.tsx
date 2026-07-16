import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { buildFeishuAuthUrl, completeLoginWithCode, getRedirectUriPrefix } from '../services/feishuAuth';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface FeishuAuthWebViewProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function FeishuAuthWebView({ visible, onClose, onSuccess, onError }: FeishuAuthWebViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const webViewRef = useRef<WebView<{}>>(null);
  const processedRef = useRef(false);
  const authUrl = buildFeishuAuthUrl();
  const redirectPrefix = getRedirectUriPrefix();

  const processCode = useCallback(
    (url: string) => {
      if (processedRef.current) return;

      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const err = urlObj.searchParams.get('error');

        if (err) {
          processedRef.current = true;
          console.log('[FeishuAuthWebView] 授权被拒绝:', err);
          onError('授权被拒绝: ' + err);
          return;
        }

        if (!code) {
          console.log('[FeishuAuthWebView] 回调中无 code');
          return;
        }

        processedRef.current = true;
        console.log('[FeishuAuthWebView] 获取到 code，开始换 token');
        setLoading(true);
        completeLoginWithCode(code)
          .then(result => {
            if (result.success) {
              onSuccess();
            } else {
              onError(result.message || '登录失败');
            }
          })
          .catch(e => {
            onError(e instanceof Error ? e.message : '登录失败');
          });
      } catch (e) {
        console.error('[FeishuAuthWebView] URL 解析失败:', e);
      }
    },
    [onSuccess, onError]
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const { url } = navState;
      console.log('[FeishuAuthWebView] navigate:', url.substring(0, 120));

      if (url.startsWith(redirectPrefix)) {
        processCode(url);
      }
    },
    [redirectPrefix, processCode]
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => {
      const { url } = event;

      if (
        url.startsWith('lark://') ||
        url.startsWith('feishu://') ||
        url.startsWith('larkssoconductor://') ||
        url.startsWith('sslocal://')
      ) {
        console.log('[FeishuAuthWebView] 拦截飞书 App scheme 跳转:', url.substring(0, 60));
        return false;
      }

      if (url.startsWith(redirectPrefix)) {
        processCode(url);
      }

      return true;
    },
    [redirectPrefix, processCode]
  );

  const handleLoadStart = useCallback(() => {
    setLoadError(false);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setLoadError(true);
  }, []);

  const handleHttpError = useCallback(() => {
    setLoading(false);
    setLoadError(true);
  }, []);

  const handleRetry = useCallback(() => {
    processedRef.current = false;
    setLoadError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleClose = useCallback(() => {
    processedRef.current = false;
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>飞书登录</Text>
          <View style={styles.headerRight} />
        </View>

        {loadError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.errorTitle}>加载失败</Text>
            <Text style={styles.errorDesc}>请检查网络连接后重试</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>重新加载</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webviewContainer}>
            <WebView<{}>
              ref={webViewRef}
              source={{ uri: authUrl }}
              style={styles.webview}
              userAgent={DESKTOP_USER_AGENT}
              onNavigationStateChange={handleNavigationStateChange}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleHttpError}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>正在加载飞书登录页...</Text>
                </View>
              )}
            />
            {loading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  errorDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    ...Typography.h4,
    color: Colors.textOnPrimary,
  },
});
