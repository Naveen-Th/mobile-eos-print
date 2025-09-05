import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { Platform } from 'react-native';

// Enable Immer MapSet plugin for Map and Set support
enableMapSet();

export interface ConnectionState {
  isOnline: boolean;
  isConnected: boolean;
  lastSync: Date | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  retryCount: number;
}

export interface OptimisticUpdate {
  id: string;
  collection: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  data?: any;
  originalData?: any;
}

export interface SyncState {
  // Connection management
  connection: ConnectionState;
  
  // Optimistic updates tracking (using Record instead of Map)
  pendingUpdates: Record<string, OptimisticUpdate>;
  failedUpdates: Record<string, OptimisticUpdate>;
  
  // Real-time listeners tracking (using array instead of Set)
  activeListeners: string[];
  
  // Performance metrics
  metrics: {
    totalSyncs: number;
    failedSyncs: number;
    avgSyncTime: number;
  };
  
  // Actions
  setConnectionState: (state: Partial<ConnectionState>) => void;
  addOptimisticUpdate: (update: OptimisticUpdate) => void;
  removeOptimisticUpdate: (id: string) => void;
  moveToFailed: (id: string) => void;
  retryFailedUpdate: (id: string) => void;
  clearFailedUpdates: () => void;
  addActiveListener: (listenerId: string) => void;
  removeActiveListener: (listenerId: string) => void;
  updateMetrics: (syncTime?: number, failed?: boolean) => void;
  reset: () => void;
};

const initialConnectionState: ConnectionState = {
  isOnline: true, // React Native doesn't have navigator.onLine
  isConnected: false,
  lastSync: null,
  connectionQuality: 'excellent',
  retryCount: 0,
};

export const useSyncStore = create<SyncState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        connection: initialConnectionState,
        pendingUpdates: {},
        failedUpdates: {},
        activeListeners: [],
        metrics: {
          totalSyncs: 0,
          failedSyncs: 0,
          avgSyncTime: 0,
        },

        setConnectionState: (newState) =>
          set((state) => {
            state.connection = { ...state.connection, ...newState };
          }),

        addOptimisticUpdate: (update) =>
          set((state) => {
            state.pendingUpdates[update.id] = update;
          }),

        removeOptimisticUpdate: (id) =>
          set((state) => {
            delete state.pendingUpdates[id];
          }),

        moveToFailed: (id) =>
          set((state) => {
            const update = state.pendingUpdates[id];
            if (update) {
              delete state.pendingUpdates[id];
              state.failedUpdates[id] = update;
            }
          }),

        retryFailedUpdate: (id) =>
          set((state) => {
            const update = state.failedUpdates[id];
            if (update) {
              delete state.failedUpdates[id];
              state.pendingUpdates[id] = update;
            }
          }),

        clearFailedUpdates: () =>
          set((state) => {
            state.failedUpdates = {};
          }),

        addActiveListener: (listenerId) =>
          set((state) => {
            if (!state.activeListeners.includes(listenerId)) {
              state.activeListeners.push(listenerId);
            }
          }),

        removeActiveListener: (listenerId) =>
          set((state) => {
            const index = state.activeListeners.indexOf(listenerId);
            if (index > -1) {
              state.activeListeners.splice(index, 1);
            }
          }),

        updateMetrics: (syncTime, failed = false) =>
          set((state) => {
            state.metrics.totalSyncs++;
            if (failed) {
              state.metrics.failedSyncs++;
            }
            if (syncTime) {
              const { totalSyncs, avgSyncTime } = state.metrics;
              state.metrics.avgSyncTime = 
                (avgSyncTime * (totalSyncs - 1) + syncTime) / totalSyncs;
            }
          }),

        reset: () =>
          set((state) => {
            state.pendingUpdates = {};
            state.failedUpdates = {};
            state.activeListeners = [];
            state.connection = initialConnectionState;
            state.metrics = {
              totalSyncs: 0,
              failedSyncs: 0,
              avgSyncTime: 0,
            };
          }),
      }))
    ),
    { name: 'sync-store' }
  )
);

// Selector hooks for better performance
export const useConnectionState = () => useSyncStore((state) => state.connection);
export const usePendingUpdates = () => {
  const updates = useSyncStore((state) => state.pendingUpdates);
  // Convert Record to Map for compatibility with existing code
  return new Map(Object.entries(updates));
};
export const useFailedUpdates = () => {
  const updates = useSyncStore((state) => state.failedUpdates);
  // Convert Record to Map for compatibility with existing code  
  return new Map(Object.entries(updates));
};
export const useSyncMetrics = () => useSyncStore((state) => state.metrics);
