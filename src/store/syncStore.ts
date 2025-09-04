import { create } from 'zustand';
import { devtools, subscribeWithSelector, immer } from 'zustand/middleware';

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
  
  // Optimistic updates tracking
  pendingUpdates: Map<string, OptimisticUpdate>;
  failedUpdates: Map<string, OptimisticUpdate>;
  
  // Real-time listeners tracking
  activeListeners: Set<string>;
  
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
}

const initialConnectionState: ConnectionState = {
  isOnline: navigator.onLine ?? true,
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
        pendingUpdates: new Map(),
        failedUpdates: new Map(),
        activeListeners: new Set(),
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
            state.pendingUpdates.set(update.id, update);
          }),

        removeOptimisticUpdate: (id) =>
          set((state) => {
            state.pendingUpdates.delete(id);
          }),

        moveToFailed: (id) =>
          set((state) => {
            const update = state.pendingUpdates.get(id);
            if (update) {
              state.pendingUpdates.delete(id);
              state.failedUpdates.set(id, update);
            }
          }),

        retryFailedUpdate: (id) =>
          set((state) => {
            const update = state.failedUpdates.get(id);
            if (update) {
              state.failedUpdates.delete(id);
              state.pendingUpdates.set(id, update);
            }
          }),

        clearFailedUpdates: () =>
          set((state) => {
            state.failedUpdates.clear();
          }),

        addActiveListener: (listenerId) =>
          set((state) => {
            state.activeListeners.add(listenerId);
          }),

        removeActiveListener: (listenerId) =>
          set((state) => {
            state.activeListeners.delete(listenerId);
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
            state.pendingUpdates.clear();
            state.failedUpdates.clear();
            state.activeListeners.clear();
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
export const usePendingUpdates = () => useSyncStore((state) => state.pendingUpdates);
export const useFailedUpdates = () => useSyncStore((state) => state.failedUpdates);
export const useSyncMetrics = () => useSyncStore((state) => state.metrics);
