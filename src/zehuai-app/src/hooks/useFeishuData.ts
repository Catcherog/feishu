import { useState, useEffect, useCallback } from 'react';
import { getProjects, getClients, getPublishTasks, getResources, getDashboardStats, listMyTasks, listFolderContents, getSyncStatus, getSOPsByPhase, spreadsheetApi, getKnowledgeEntries, getScriptLibrary, getSOPRules, getTrendingResearch } from '../services/feishu';
import { getNotifications } from '../services/notificationStore';
import { loadCache, saveCache } from '../services/localCache';
import { Project, Client, PublishTask, DashboardStats, FeishuNotification, FeishuTask, DocumentRef, SyncStatus, Resource, ResourceCategory, ProjectStats, PublishMatrix, SOPItem, SOPPhase, KnowledgeEntry, ScriptEntry, SOPRule, TrendingCase } from '../types';

interface UseFeishuDataResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isOffline: boolean;
}

function useAsyncData<T>(
  fetcher: () => Promise<T>,
  initialValue: T,
): UseFeishuDataResult<T> {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err: any) {
      setError(err?.message || '数据加载失败');
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, isOffline };
}

function useCachedListData<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  initialValue: T[],
): UseFeishuDataResult<T[]> {
  const [data, setData] = useState<T[]>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const result = await fetcher();
      setData(result);
      await saveCache(table, result);
    } catch (err: any) {
      setError(err?.message || '当前离线，已展示缓存数据');
      setIsOffline(true);
      // API 失败时尝试从本地缓存读取兜底数据
      try {
        const cached = await loadCache<T>(table);
        if (cached.length > 0) {
          setData(cached);
        }
      } catch (cacheErr) {
        // 忽略缓存读取失败
      }
    } finally {
      setLoading(false);
    }
  }, [fetcher, table]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setIsOffline(false);

    (async () => {
      const cached = await loadCache<T>(table);
      if (mounted && cached.length > 0) {
        setData(cached);
      }
      try {
        const result = await fetcher();
        if (mounted) {
          setData(result);
        }
        await saveCache(table, result);
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || '当前离线，已展示缓存数据');
          setIsOffline(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetcher, table]);

  return { data, loading, error, refresh, isOffline };
}

export function useProjects(status?: string): UseFeishuDataResult<Project[]> {
  return useCachedListData(
    status ? `projects_${status}` : 'projects',
    useCallback(async () => {
      const { data } = await getProjects({ status });
      return data;
    }, [status]),
    [],
  );
}

export function useClients(params?: {
  status?: string;
  keyword?: string;
}): UseFeishuDataResult<Client[]> {
  const clientsCacheKey = params?.status || params?.keyword 
    ? `clients_${params?.status || 'all'}_${params?.keyword || ''}` 
    : 'clients';
  return useCachedListData(
    clientsCacheKey,
    useCallback(async () => {
      const { data } = await getClients(params);
      return data;
    }, [params?.status, params?.keyword]),
    [],
  );
}

export function usePublishTasks(status?: string): UseFeishuDataResult<PublishTask[]> {
  return useCachedListData(
    status ? `publishTasks_${status}` : 'publishTasks',
    useCallback(async () => {
      const { data } = await getPublishTasks({ status });
      return data;
    }, [status]),
    [],
  );
}

export function useResources(category: ResourceCategory, keyword?: string): UseFeishuDataResult<Resource[]> {
  return useCachedListData(
    `resources_${category}`,
    useCallback(async () => {
      const { data } = await getResources(category, { keyword });
      return data;
    }, [category, keyword]),
    [],
  );
}

export function useDashboardStats(): UseFeishuDataResult<DashboardStats> {
  return useAsyncData(
    useCallback(async () => {
      const stats = await getDashboardStats();
      return {
        activeProjects: stats.activeProjects || 0,
        pendingPublishTasks: stats.pendingPublishTasks || 0,
        totalFinishedProducts: stats.totalFinishedProducts || 0,
        publishedCount: stats.publishedCount || 0,
        newClientsThisMonth: stats.newClientsThisMonth || 0,
      };
    }, []),
    {
      activeProjects: 0,
      pendingPublishTasks: 0,
      totalFinishedProducts: 0,
      publishedCount: 0,
      newClientsThisMonth: 0,
    },
  );
}

// ============ 飞书集成新增 Hooks ============

export function useNotifications(): UseFeishuDataResult<FeishuNotification[]> {
  return useAsyncData(
    useCallback(async () => {
      return getNotifications();
    }, []),
    [],
  );
}

export function useTasks(completed?: boolean): UseFeishuDataResult<FeishuTask[]> {
  return useCachedListData(
    completed !== undefined ? `tasks_${completed}` : 'tasks',
    useCallback(async () => {
      const { data } = await listMyTasks({ completed });
      return data;
    }, [completed]),
    [],
  );
}

export function useFolderContents(folderToken?: string): UseFeishuDataResult<DocumentRef[]> {
  return useAsyncData(
    useCallback(async () => {
      if (!folderToken) return [];
      return listFolderContents(folderToken);
    }, [folderToken]),
    [],
  );
}

export function useSyncStatus(table: string): UseFeishuDataResult<SyncStatus> {
  return useAsyncData(
    useCallback(async () => {
      return getSyncStatus(table);
    }, [table]),
    {
      lastSyncTime: '',
      totalRecords: 0,
      tableId: '',
      isSyncing: false,
    },
  );
}

export function useWikiSOPs(phase: SOPPhase): UseFeishuDataResult<SOPItem[]> {
  return useCachedListData(
    `wikiSOPs-${phase}`,
    useCallback(async () => {
      return getSOPsByPhase(phase);
    }, [phase]),
    [],
  );
}

export function useProjectStats(): UseFeishuDataResult<ProjectStats> {
  return useAsyncData(
    useCallback(async () => spreadsheetApi.getProjectStats(), []),
    {
      headers: [],
      rows: [],
      totalProjects: 0,
      thisMonthShoots: 0,
    },
  );
}

export function usePublishMatrix(): UseFeishuDataResult<PublishMatrix> {
  return useAsyncData(
    useCallback(async () => spreadsheetApi.getPublishMatrix(), []),
    {
      headers: [],
      rows: [],
    },
  );
}

// ============ 知识库模块 Hooks ============

export function useKnowledgeEntries(params?: {
  keyword?: string;
  keywords?: string[];
  scenarios?: string[];
}): UseFeishuDataResult<KnowledgeEntry[]> {
  const cacheKey = `knowledgeBase_${params?.keyword || ''}_${(params?.keywords || []).join(',')}_${(params?.scenarios || []).join(',')}`;
  return useCachedListData(
    cacheKey,
    useCallback(async () => {
      const { data } = await getKnowledgeEntries(params);
      return data;
    }, [params?.keyword, (params?.keywords || []).join(','), (params?.scenarios || []).join(',')]),
    [],
  );
}

export function useScriptLibrary(params?: {
  scene?: string;
  target?: string;
  conversion?: string;
  keyword?: string;
}): UseFeishuDataResult<ScriptEntry[]> {
  const cacheKey = `scripts_${params?.scene || ''}_${params?.target || ''}_${params?.conversion || ''}_${params?.keyword || ''}`;
  return useCachedListData(
    cacheKey,
    useCallback(async () => {
      const { data } = await getScriptLibrary(params);
      return data;
    }, [params?.scene, params?.target, params?.conversion, params?.keyword]),
    [],
  );
}

export function useSOPRules(params?: {
  category?: string;
}): UseFeishuDataResult<SOPRule[]> {
  return useCachedListData(
    `sopRules_${params?.category || 'all'}`,
    useCallback(async () => {
      const { data } = await getSOPRules(params);
      return data;
    }, [params?.category]),
    [],
  );
}

export function useTrendingResearch(params?: {
  platform?: string;
  elements?: string[];
  keyword?: string;
}): UseFeishuDataResult<TrendingCase[]> {
  const cacheKey = `trendingResearch_${params?.platform || ''}_${(params?.elements || []).join(',')}_${params?.keyword || ''}`;
  return useCachedListData(
    cacheKey,
    useCallback(async () => {
      const { data } = await getTrendingResearch(params);
      return data;
    }, [params?.platform, (params?.elements || []).join(','), params?.keyword]),
    [],
  );
}
