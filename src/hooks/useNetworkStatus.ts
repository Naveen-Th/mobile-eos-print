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
  const [lastPushTime, setLastPushTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

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
    // Prevent concurrent processing
    if (isProcessing) {
      return;
    }
    
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable ?? null;
    const type = state.type || 'unknown';
    
    // Skip if nothing changed
    if (
      networkStatus.isConnected === isConnected &&
      networkStatus.isInternetReachable === isInternetReachable &&
      networkStatus.type === type
    ) {
      return;
    }
    
    setIsProcessing(true);

    // Only log in development to reduce console overhead
    if (__DEV__) {
      console.log('🌐 Network status changed:', {
        isConnected,
        isInternetReachable,
        type,
        details: state.details,
      });
    }

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

    // Trigger sync when coming back online (only push pending changes)
    // Real-time listeners will automatically receive updates, no need for full sync
    // Debounce to prevent multiple rapid calls
    if (isConnected && isInternetReachable) {
      const now = Date.now();
      // Only push if at least 5 seconds since last push (increased to reduce duplication)
      if (now - lastPushTime > 5000) {
        if (__DEV__) {
          console.log('✅ Connection restored - pushing pending changes...');
        }
        setLastPushTime(now);
        
        // Only push pending local changes, don't pull (real-time handles that)
        // Increased delay to allow network to stabilize
        setTimeout(() => {
          SyncEngine.pushToFirebase().catch((error) => {
            console.error('Auto-push failed after reconnection:', error);
          });
        }, 1000);
      }
    }
    
    // Reset processing flag
    setTimeout(() => setIsProcessing(false), 500);
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
