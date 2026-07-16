import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppRole, UserPermission, ProjectStatus, APP_ROLE_LABELS } from '../types';
import { getUserRole } from '../services/feishu';
import { getCurrentUser } from '../services/feishuAuth';

interface PermissionContextValue extends UserPermission {
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
  hasPermission: (permission: string) => boolean;
  canAccessData: (
    dataType: 'project' | 'client' | 'publish',
    options?: {
      ownerId?: string;
      ownerName?: string;
      status?: ProjectStatus | string;
      participants?: string[];
    }
  ) => boolean;
  canCreateClient: () => boolean;
  canCreateProject: () => boolean;
  // 获取项目过滤条件（admin 返回 null 表示不过滤，photographer/post 返回 ownerId 过滤）
  getProjectFilter: () => { ownerId?: string } | null;
  // 获取客户过滤条件（admin 返回 null，photographer/post 返回需要脱敏标记）
  getClientFilter: () => { maskContact: boolean } | null;
  refreshRole: () => Promise<void>;
}

const DEFAULT_PERMISSION: UserPermission = {
  role: 'photographer',
  roleLabel: APP_ROLE_LABELS.photographer,
  departmentIds: [],
  departmentNames: [],
  managedProjectIds: [],
  roleSource: 'fallback_offline',
};

const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: ['*'],
  photographer: [
    'project:view:own',
    'project:create',
    'resource:view',
    'task:view',
  ],
  post: [
    'project:view:post',
    'publish:view',
    'task:view',
  ],
};

const POST_RELATED_STATUSES: ProjectStatus[] = ['后期制作', '待交付', '已完成'];

const PERMISSION_CACHE_KEY = 'permission_context_cache';

const PermissionContext = createContext<PermissionContextValue>({
  ...DEFAULT_PERMISSION,
  isLoading: true,
  error: null,
  isReady: false,
  hasPermission: () => false,
  canAccessData: () => false,
  canCreateClient: () => false,
  canCreateProject: () => false,
  getProjectFilter: () => null,
  getClientFilter: () => null,
  refreshRole: async () => {},
});

export function usePermission() {
  return useContext(PermissionContext);
}

interface PermissionProviderProps {
  children: React.ReactNode;
}

function normalizePermissionInput(permission: string): string {
  return (permission || '').trim().toLowerCase();
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const [permission, setPermission] = useState<UserPermission>(DEFAULT_PERMISSION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const loadCachedPermission = useCallback(async (): Promise<UserPermission | null> => {
    try {
      const cached = await AsyncStorage.getItem(PERMISSION_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as UserPermission;
        if (parsed.role && APP_ROLE_LABELS[parsed.role as AppRole]) {
          return {
            ...parsed,
            roleLabel: APP_ROLE_LABELS[parsed.role as AppRole],
            roleSource: parsed.roleSource || 'default_admin',
          };
        }
      }
    } catch {
      // 忽略缓存读取错误
    }
    return null;
  }, []);

  const saveCachedPermission = useCallback(async (value: UserPermission) => {
    try {
      await AsyncStorage.setItem(PERMISSION_CACHE_KEY, JSON.stringify(value));
    } catch {
      // 忽略缓存写入错误
    }
  }, []);

  const clearCachedPermission = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PERMISSION_CACHE_KEY);
    } catch {
      // 忽略缓存清除错误
    }
  }, []);

  const refreshRole = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setPermission(DEFAULT_PERMISSION);
        await clearCachedPermission();
        setIsReady(true);
        return;
      }

      const openId = currentUser.open_id || currentUser.uid;
      const userRole = await getUserRole(openId);
      const roleLabel = APP_ROLE_LABELS[userRole.role];

      const nextPermission: UserPermission = {
        ...userRole,
        roleLabel,
      };

      setPermission(nextPermission);
      await saveCachedPermission(nextPermission);
    } catch (err) {
      const message = err instanceof Error ? err.message : '角色加载失败';
      console.warn('加载用户角色失败:', message);
      setError(message);

      // 出错时尝试使用缓存，避免界面完全不可用
      const cached = await loadCachedPermission();
      if (cached) {
        setPermission(cached);
      } else {
        setPermission(DEFAULT_PERMISSION);
      }
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }, [clearCachedPermission, loadCachedPermission, saveCachedPermission]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const cached = await loadCachedPermission();
      if (mounted && cached) {
        setPermission(cached);
        setIsLoading(false);
        setIsReady(true);
      }
      if (mounted) {
        await refreshRole();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadCachedPermission, refreshRole]);

  const hasPermission = useCallback(
    (permissionName: string): boolean => {
      const normalized = normalizePermissionInput(permissionName);
      if (!normalized) return false;

      const rolePermissions = ROLE_PERMISSIONS[permission.role] || [];
      if (rolePermissions.includes('*')) return true;
      if (rolePermissions.includes(normalized)) return true;

      // 支持通配前缀匹配，例如 project:view 可匹配 project:view:own
      return rolePermissions.some((p) => {
        if (p === normalized) return true;
        if (p.endsWith(':*') && normalized.startsWith(p.slice(0, -2))) return true;
        return false;
      });
    },
    [permission.role]
  );

  const canAccessData = useCallback(
    (
      dataType: 'project' | 'client' | 'publish',
      options?: {
        ownerId?: string;
        ownerName?: string;
        status?: ProjectStatus | string;
        participants?: string[];
      }
    ): boolean => {
      const { role, userId, userName } = permission;

      if (role === 'admin') return true;

      const ownerId = options?.ownerId;
      const ownerName = options?.ownerName;
      const status = options?.status as ProjectStatus | undefined;
      const participants = options?.participants || [];

      if (dataType === 'client') {
        // 除后期等纯执行角色外，其他角色默认可查看客户列表
        return role === 'photographer' || role === 'post';
      }

      if (dataType === 'publish') {
        return role === 'post';
      }

      if (dataType === 'project') {
        if (role === 'photographer') {
          const matchesUserId = !!userId && !!ownerId && ownerId === userId;
          const matchesUserName = !!userName && !!ownerName && ownerName === userName;
          return matchesUserId || matchesUserName;
        }

        if (role === 'post') {
          return status ? POST_RELATED_STATUSES.includes(status) : false;
        }
      }

      return false;
    },
    [permission]
  );

  const canCreateClient = useCallback((): boolean => {
    return hasPermission('client:create');
  }, [hasPermission]);

  const canCreateProject = useCallback((): boolean => {
    return hasPermission('project:create');
  }, [hasPermission]);

  const getProjectFilter = useCallback((): { ownerId?: string } | null => {
    if (permission.role === 'admin') return null;
    // photographer 和 post 只看自己负责的项目
    return { ownerId: permission.userId };
  }, [permission.role, permission.userId]);

  const getClientFilter = useCallback((): { maskContact: boolean } | null => {
    if (permission.role === 'admin') return null;
    // photographer 和 post 查看客户时需要脱敏
    return { maskContact: true };
  }, [permission.role]);

  const value = useMemo<PermissionContextValue>(
    () => ({
      ...permission,
      isLoading,
      error,
      isReady,
      hasPermission,
      canAccessData,
      canCreateClient,
      canCreateProject,
      getProjectFilter,
      getClientFilter,
      refreshRole,
    }),
    [
      permission,
      isLoading,
      error,
      isReady,
      hasPermission,
      canAccessData,
      canCreateClient,
      canCreateProject,
      getProjectFilter,
      getClientFilter,
      refreshRole,
    ]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}
