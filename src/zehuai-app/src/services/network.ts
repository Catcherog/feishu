import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  type: NetInfoState['type'];
  isInternetReachable: boolean | null;
  details: NetInfoState['details'];
}

let currentState: NetInfoState | null = null;

function normalizeState(state: NetInfoState): NetworkStatus {
  const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
  return {
    isOnline,
    type: state.type,
    isInternetReachable: state.isInternetReachable ?? null,
    details: state.details,
  };
}

/**
 * 获取当前网络状态
 */
export async function checkNetwork(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch();
  currentState = state;
  return normalizeState(state);
}

/**
 * 判断当前是否在线
 */
export async function isOnline(): Promise<boolean> {
  const status = await checkNetwork();
  return status.isOnline;
}

/**
 * 添加网络状态变化监听器
 * @param callback 在线/离线状态变化时触发
 * @returns 取消监听的函数
 */
export function addNetworkListener(callback: (status: NetworkStatus) => void): NetInfoSubscription {
  return NetInfo.addEventListener((state) => {
    currentState = state;
    callback(normalizeState(state));
  });
}

/**
 * 获取最近一次缓存的网络状态（可能为空）
 */
export function getCurrentNetworkState(): NetworkStatus | null {
  return currentState ? normalizeState(currentState) : null;
}
