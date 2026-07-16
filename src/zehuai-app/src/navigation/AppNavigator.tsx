import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/theme';
import { AppRole } from '../types';
import { usePermission } from '../contexts/PermissionContext';
import DashboardScreen from '../screens/DashboardScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import ProjectFormScreen from '../screens/ProjectFormScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import ClientsScreen from '../screens/ClientsScreen';
import ClientFormScreen from '../screens/ClientFormScreen';
import ClientDetailScreen from '../screens/ClientDetailScreen';
import PublishScreen from '../screens/PublishScreen';
import ResourcesScreen from '../screens/ResourcesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import TasksScreen from '../screens/TasksScreen';
import DocumentViewerScreen from '../screens/DocumentViewerScreen';
import KnowledgeScreen from '../screens/KnowledgeScreen';

const Tab = createBottomTabNavigator();

export type RootStackParamList = {
  MainTabs: undefined;
  Notifications: undefined;
  Tasks: undefined;
  DocumentViewer: { url: string; title?: string };
  ProjectForm: undefined;
  ProjectDetail: { projectId: string };
  ClientForm: undefined;
  ClientDetail: { clientId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_CONFIG = [
  { name: 'Dashboard', component: DashboardScreen, label: '看板', icon: 'grid-outline', activeIcon: 'grid' },
  { name: 'Projects', component: ProjectsScreen, label: '项目', icon: 'briefcase-outline', activeIcon: 'briefcase' },
  { name: 'Clients', component: ClientsScreen, label: '客户', icon: 'people-outline', activeIcon: 'people' },
  { name: 'Resources', component: ResourcesScreen, label: '资源', icon: 'cube-outline', activeIcon: 'cube' },
  { name: 'Publish', component: PublishScreen, label: '分发', icon: 'share-social-outline', activeIcon: 'share-social' },
  { name: 'Knowledge', component: KnowledgeScreen, label: '知识库', icon: 'book-outline', activeIcon: 'book' },
] as const;

const PROFILE_TAB = { name: 'Profile', label: '我的', icon: 'person-outline', activeIcon: 'person' } as const;

const TAB_VISIBILITY: Record<string, AppRole[]> = {
  Dashboard: ['admin', 'photographer', 'post'],
  Projects: ['admin', 'photographer', 'post'],
  Clients: ['admin'],
  Resources: ['admin', 'photographer', 'post'],
  Publish: ['admin', 'post'],
  Knowledge: ['admin', 'photographer', 'post'],
};

function isTabVisible(tabName: string, role: AppRole): boolean {
  const allowedRoles = TAB_VISIBILITY[tabName];
  if (!allowedRoles) return true;
  return allowedRoles.includes(role);
}

interface TabNavigatorProps {
  onLogout: () => void;
}

function TabNavigator({ onLogout }: TabNavigatorProps) {
  const { role } = usePermission();

  const visibleTabs = TAB_CONFIG.filter((tab) => isTabVisible(tab.name, role));
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const config = TAB_CONFIG.find((t) => t.name === route.name);
        const profileConfig = PROFILE_TAB.name === route.name ? PROFILE_TAB : undefined;
        const tabConfig = config || profileConfig;
        return {
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? tabConfig?.activeIcon : tabConfig?.icon;
            return <Ionicons name={iconName as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textTertiary,
          tabBarLabelStyle: {
            fontSize: 11,
            marginTop: -Spacing.xs,
            marginBottom: Platform.OS === 'ios' ? Spacing.xs : Spacing.md,
          },
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.borderLight,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 64,
            paddingTop: Spacing.xs,
            paddingBottom: Platform.OS === 'ios' ? Spacing.xxl : Spacing.sm,
          },
        };
      }}
    >
      {visibleTabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
      <Tab.Screen
        name={PROFILE_TAB.name}
        options={{ tabBarLabel: PROFILE_TAB.label }}
      >
        {(props) => <ProfileScreen {...props} role={role} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  onLogout: () => void;
}

const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  headerTintColor: Colors.textPrimary,
  headerStyle: {
    backgroundColor: Colors.background,
  },
  headerTitleStyle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
};

export default function AppNavigator({ onLogout }: AppNavigatorProps) {
  return (
    <NavigationContainer
      theme={{
        dark: false,
        colors: {
          primary: Colors.accent,
          background: Colors.background,
          card: Colors.surface,
          text: Colors.textPrimary,
          border: Colors.border,
          notification: Colors.error,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs">
          {(props) => <TabNavigator {...props} onLogout={onLogout} />}
        </Stack.Screen>
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '通知中心',
          }}
        />
        <Stack.Screen
          name="Tasks"
          component={TasksScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '任务管理',
          }}
        />
        <Stack.Screen
          name="DocumentViewer"
          component={DocumentViewerScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '文档预览',
          }}
        />
        <Stack.Screen
          name="ProjectForm"
          component={ProjectFormScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '新建项目',
          }}
        />
        <Stack.Screen
          name="ProjectDetail"
          component={ProjectDetailScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '项目详情',
          }}
        />
        <Stack.Screen
          name="ClientForm"
          component={ClientFormScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '新建客户',
          }}
        />
        <Stack.Screen
          name="ClientDetail"
          component={ClientDetailScreen}
          options={{
            ...stackScreenOptions,
            headerTitle: '客户详情',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
