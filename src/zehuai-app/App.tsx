import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { View, Text, ActivityIndicator, StyleSheet, LogBox, Platform } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import OfflineBanner from './src/components/OfflineBanner';
import { PermissionProvider } from './src/contexts/PermissionContext';
import { isAuthenticated } from './src/services/feishuAuth';
import { checkNetwork, addNetworkListener } from './src/services/network';
import {
  initSyncState,
  performSync,
  startNetworkRecoveryListener,
  stopNetworkRecoveryListener,
} from './src/services/syncManager';

// 触发 Metro 重新打包
LogBox.ignoreLogs([
  'expo-notifications: Push notifications',
  'expo-notifications functionality is not fully supported in Expo Go',
  'We recommend you instead use a development build',
  'Android Push notifications (remote notifications)',
  'expo-notifications: Android Push',
]);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.splash, { backgroundColor: '#E53935', padding: 24 }]}>
          <Text style={[styles.splashTitle, { fontSize: 20, color: '#fff' }]}>App 启动出错</Text>
          <Text style={{ color: '#fff', marginTop: 16, fontSize: 13 }}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function SplashScreen({ onReady }: { onReady: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(onReady, 1200);
    return () => clearTimeout(timer);
  }, [onReady]);

  return (
    <View style={styles.splash}>
      <Text style={styles.splashTitle}>泽怀影像</Text>
      <Text style={styles.splashSubtitle}>专业影像管理平台</Text>
      <ActivityIndicator
        size="small"
        color={Colors.accent}
        style={{ marginTop: Spacing.xxl }}
      />
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  React.useEffect(() => {
    if (Constants.appOwnership === 'expo' && Platform.OS === 'android') {
      const originalError = console.error;
      console.error = (...args: any[]) => {
        const msg = typeof args[0] === 'string' ? args[0] : '';
        if (msg.includes('expo-notifications') && msg.includes('Android Push notifications')) {
          return;
        }
        originalError.apply(console, args);
      };
    }

    // 完成 WebBrowser auth session（Android 必需）
    WebBrowser.maybeCompleteAuthSession();

    // 应用启动时加载持久化的同步状态、检查登录态并监听网络变化
    (async () => {
      try {
        await initSyncState();
      } catch (e) {
        console.warn('初始化同步状态失败:', e);
      }
      try {
        const loggedIn = await isAuthenticated();
        setAuthed(loggedIn);
      } catch (e) {
        console.warn('检查登录态失败:', e);
        setAuthed(false);
      }
    })();

    checkNetwork().then((status) => {
      setIsOnline(status.isOnline);
      setShowOfflineBanner(!status.isOnline);
    });

    const unsubscribeNetwork = addNetworkListener((status) => {
      setIsOnline(status.isOnline);
      setShowOfflineBanner(!status.isOnline);
    });

    startNetworkRecoveryListener();

    return () => {
      unsubscribeNetwork();
      stopNetworkRecoveryListener();
    };
  }, []);

  const handleLoginSuccess = () => {
    setAuthed(true);
  };

  const handleLogout = () => {
    setAuthed(false);
  };

  const handleRetrySync = async () => {
    if (!isOnline) {
      return;
    }
    try {
      await performSync();
    } catch (e) {
      console.warn('立即重试同步失败:', e);
    }
  };

  if (!ready) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen onReady={() => setReady(true)} />
      </>
    );
  }

  if (!authed) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary>
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        <PermissionProvider>
          <OfflineBanner visible={showOfflineBanner} onRetry={handleRetrySync} />
          <AppNavigator onLogout={handleLogout} />
        </PermissionProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    ...Typography.h1,
    color: Colors.accent,
    fontSize: 36,
    letterSpacing: 6,
  },
  splashSubtitle: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
    letterSpacing: 2,
  },
});
