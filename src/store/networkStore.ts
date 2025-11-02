import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isOfflineMode: boolean;
  lastOnlineTime: number | null;
  
  // Actions
  setNetworkState: (state: NetInfoState) => void;
  setOfflineMode: (enabled: boolean) => void;
  initialize: () => void;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isInternetReachable: null,
      type: 'unknown',
      isOfflineMode: false,
      lastOnlineTime: null,

      setNetworkState: (netInfo: NetInfoState) => {
        const isConnected = netInfo.isConnected ?? false;
        const isInternetReachable = netInfo.isInternetReachable;

        set({
          isConnected,
          isInternetReachable,
          type: netInfo.type,
          lastOnlineTime: isConnected ? Date.now() : get().lastOnlineTime,
        });

        console.log('📡 Network state updated:', {
          isConnected,
          isInternetReachable,
          type: netInfo.type,
        });
      },

      setOfflineMode: (enabled: boolean) => {
        set({ isOfflineMode: enabled });
        console.log(`📴 Offline mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
      },

      initialize: () => {
        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener((state) => {
          get().setNetworkState(state);
        });

        // Get initial network state
        NetInfo.fetch().then((state) => {
          get().setNetworkState(state);
        });

        return unsubscribe;
      },
    }),
    {
      name: 'network-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastOnlineTime: state.lastOnlineTime,
        isOfflineMode: state.isOfflineMode,
      }),
    }
  )
);

// Helper hook to check if app should work offline
export const useIsOffline = () => {
  const { isConnected, isOfflineMode } = useNetworkStore();
  return !isConnected || isOfflineMode;
};

// Helper hook to check if Firebase should be used
export const useShouldUseFirebase = () => {
  const { isConnected, isInternetReachable, isOfflineMode } = useNetworkStore();
  return isConnected && isInternetReachable !== false && !isOfflineMode;
};
