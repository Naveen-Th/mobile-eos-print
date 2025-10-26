import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSyncStore } from '../store/syncStore';
import SyncEngine from '../sync/SyncEngine';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  effectiveType?: string;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: false,
    isInternetReachable: null,
    type: 'unknown',
  });

  const { setConnectionState } = useSyncStore();

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then((state) => {
      handleNetworkChange(state);
    });

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      handleNetworkChange(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleNetworkChange = (state: NetInfoState) => {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable ?? null;
    const type = state.type || 'unknown';

    console.log('🌐 Network status changed:', {
      isConnected,
      isInternetReachable,
      type,
      details: state.details,
    });

    // Update local state
    setNetworkStatus({
      isConnected,
      isInternetReachable,
      type,
      effectiveType: (state.details as any)?.effectiveType,
    });

    // Determine connection quality
    let connectionQuality: 'excellent' | 'good' | 'poor' | 'offline' = 'offline';
    
    if (isConnected && isInternetReachable) {
      // Determine quality based on connection type
      if (type === 'wifi') {
        connectionQuality = 'excellent';
      } else if (type === 'cellular') {
        const effectiveType = (state.details as any)?.cellularGeneration;
        if (effectiveType === '5g' || effectiveType === '4g') {
          connectionQuality = 'good';
        } else if (effectiveType === '3g') {
          connectionQuality = 'poor';
        } else {
          connectionQuality = 'poor';
        }
      } else {
        connectionQuality = 'good';
      }
    }

    // Update sync store
    setConnectionState({
      isOnline: isConnected,
      isConnected: isConnected && (isInternetReachable ?? false),
      connectionQuality,
      ...(isConnected && isInternetReachable && { lastSync: new Date() }),
    });

    // Trigger sync when coming back online
    if (isConnected && isInternetReachable) {
      console.log('✅ Connection restored - triggering sync...');
      
      // Wait a bit to ensure stable connection
      setTimeout(() => {
        SyncEngine.sync().catch((error) => {
          console.error('Auto-sync failed after reconnection:', error);
        });
      }, 2000);
    }
  };

  const refresh = async () => {
    const state = await NetInfo.fetch();
    handleNetworkChange(state);
  };

  return {
    ...networkStatus,
    refresh,
  };
};

export default useNetworkStatus;
