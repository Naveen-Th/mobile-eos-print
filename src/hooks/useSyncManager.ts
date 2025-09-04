import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  Unsubscribe,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useSyncStore, OptimisticUpdate } from '../store/syncStore';

// Query Keys Factory
export const queryKeys = {
  all: ['firebase'] as const,
  collections: () => [...queryKeys.all, 'collections'] as const,
  collection: (name: string) => [...queryKeys.collections(), name] as const,
  document: (collection: string, id: string) => [...queryKeys.collection(collection), id] as const,
  
  // Specific collections
  items: () => [...queryKeys.collection('item_details')] as const,
  receipts: () => [...queryKeys.collection('receipts')] as const,
  customers: () => [...queryKeys.collection('customers')] as const,
};

// Real-time subscription hook
export function useRealtimeCollection<T = any>(
  collectionName: string,
  options: {
    enabled?: boolean;
    onSuccess?: (data: T[]) => void;
    onError?: (error: Error) => void;
    select?: (data: T[]) => T[];
  } = {}
) {
  const queryClient = useQueryClient();
  const { addActiveListener, removeActiveListener, setConnectionState, updateMetrics } = useSyncStore();
  const unsubscribeRef = useRef<Unsubscribe>();
  const listenerIdRef = useRef(`${collectionName}-${Date.now()}`);
  
  const queryKey = queryKeys.collection(collectionName);
  
  // Real-time listener setup
  useEffect(() => {
    if (!options.enabled) return;
    
    const listenerId = listenerIdRef.current;
    addActiveListener(listenerId);
    
    const colRef = collection(db, collectionName);
    const startTime = Date.now();
    
    unsubscribeRef.current = onSnapshot(
      colRef,
      (snapshot) => {
        const syncTime = Date.now() - startTime;
        console.log(`🔄 Real-time update for ${collectionName}:`, snapshot.docs.length, 'documents');
        
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        
        // Update React Query cache
        queryClient.setQueryData(queryKey, documents);
        
        // Update connection state
        setConnectionState({
          isConnected: true,
          lastSync: new Date(),
          connectionQuality: syncTime < 1000 ? 'excellent' : syncTime < 3000 ? 'good' : 'poor'
        });
        
        updateMetrics(syncTime);
        options.onSuccess?.(documents);
      },
      (error) => {
        console.error(`❌ Real-time listener error for ${collectionName}:`, error);
        setConnectionState({
          isConnected: false,
          connectionQuality: 'offline'
        });
        updateMetrics(undefined, true);
        options.onError?.(error);
      }
    );
    
    return () => {
      unsubscribeRef.current?.();
      removeActiveListener(listenerId);
    };
  }, [collectionName, options.enabled, addActiveListener, removeActiveListener, setConnectionState, updateMetrics]);
  
  return useQuery({
    queryKey,
    queryFn: () => [] as T[], // Initial empty data, real-time listener will populate
    enabled: options.enabled ?? true,
    staleTime: Infinity, // Always fresh due to real-time updates
    gcTime: 10 * 60 * 1000, // 10 minutes
    select: options.select,
  });
}

// Optimistic mutation hook
export function useOptimisticMutation<TData = any, TVariables = any>({
  mutationFn,
  onSuccess,
  onError,
  onSettled,
  optimisticUpdate,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  optimisticUpdate?: (variables: TVariables) => OptimisticUpdate;
}) {
  const queryClient = useQueryClient();
  const { 
    addOptimisticUpdate, 
    removeOptimisticUpdate, 
    moveToFailed,
    updateMetrics 
  } = useSyncStore();
  
  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const startTime = Date.now();
      
      // Create optimistic update if provided
      if (optimisticUpdate) {
        const update = optimisticUpdate(variables);
        addOptimisticUpdate(update);
        
        // Cancel outgoing refetches
        const queryKey = queryKeys.collection(update.collection);
        await queryClient.cancelQueries({ queryKey });
        
        // Snapshot previous value
        const previousData = queryClient.getQueryData(queryKey);
        
        // Optimistically update cache
        queryClient.setQueryData(queryKey, (oldData: any[]) => {
          if (!oldData) return [];
          
          switch (update.operation) {
            case 'create':
              return [...oldData, { id: update.documentId, ...update.data }];
            case 'update':
              return oldData.map(item => {
                if (item.id === update.documentId) {
                  // Handle stock changes specially
                  if (update.data.stockChange !== undefined) {
                    const newStock = Math.max(0, (item.stocks || 0) + update.data.stockChange);
                    return { ...item, stocks: newStock };
                  }
                  // Regular update
                  return { ...item, ...update.data };
                }
                return item;
              });
            case 'delete':
              return oldData.filter(item => item.id !== update.documentId);
            default:
              return oldData;
          }
        });
        
        return { previousData, update, startTime };
      }
      
      return { startTime };
    },
    onSuccess: (data, variables, context) => {
      const syncTime = Date.now() - (context?.startTime || 0);
      updateMetrics(syncTime);
      
      // Remove optimistic update on success
      if (context?.update) {
        removeOptimisticUpdate(context.update.id);
      }
      
      onSuccess?.(data, variables);
    },
    onError: (error, variables, context) => {
      console.error('❌ Mutation failed:', error);
      
      // Handle failed optimistic update
      if (context?.update) {
        moveToFailed(context.update.id);
        
        // Rollback optimistic update
        const queryKey = queryKeys.collection(context.update.collection);
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      updateMetrics(undefined, true);
      onError?.(error, variables);
    },
    onSettled: (data, error, variables, context) => {
      // Invalidate queries to ensure consistency
      if (context?.update) {
        const queryKey = queryKeys.collection(context.update.collection);
        queryClient.invalidateQueries({ queryKey });
      }
      
      onSettled?.(data, error, variables);
    },
  });
}

// Specific hooks for collections
export function useItems() {
  return useRealtimeCollection('item_details', {
    enabled: true,
    select: (data) => data.map(item => ({
      ...item,
      stocks: item.stocks || 0,
    })),
  });
}

export function useReceipts() {
  return useRealtimeCollection('receipts', {
    enabled: true,
    select: (data) => data.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    }),
  });
}

// Stock update mutations
export function useUpdateStock() {
  const queryClient = useQueryClient();
  
  return useOptimisticMutation({
    mutationFn: async ({ itemId, stockChange }: { itemId: string; stockChange: number }) => {
      const docRef = doc(db, 'item_details', itemId);
      
      // Get current stock from cache
      const itemsData = queryClient.getQueryData(queryKeys.items()) as any[];
      const currentItem = itemsData?.find(item => item.id === itemId);
      const currentStock = currentItem?.stocks || 0;
      const newStock = Math.max(0, currentStock + stockChange);
      
      await updateDoc(docRef, {
        stocks: newStock,
        updatedAt: serverTimestamp(),
      });
      
      return { itemId, newStock };
    },
    optimisticUpdate: ({ itemId, stockChange }) => ({
      id: `stock-${itemId}-${Date.now()}`,
      collection: 'item_details',
      documentId: itemId,
      operation: 'update',
      timestamp: Date.now(),
      data: { stockChange }, // We'll apply this change to existing stock
    }),
  });
}

// Receipt mutations
export function useCreateReceipt() {
  return useOptimisticMutation({
    mutationFn: async (receiptData: any) => {
      const colRef = collection(db, 'receipts');
      const docRef = await addDoc(colRef, {
        ...receiptData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...receiptData };
    },
    optimisticUpdate: (receiptData) => ({
      id: `receipt-${Date.now()}`,
      collection: 'receipts',
      documentId: receiptData.id || `temp-${Date.now()}`,
      operation: 'create',
      timestamp: Date.now(),
      data: receiptData,
    }),
  });
}

export function useDeleteReceipt() {
  return useOptimisticMutation({
    mutationFn: async (receiptId: string) => {
      const docRef = doc(db, 'receipts', receiptId);
      await deleteDoc(docRef);
      return { id: receiptId };
    },
    optimisticUpdate: (receiptId) => ({
      id: `delete-receipt-${receiptId}-${Date.now()}`,
      collection: 'receipts',
      documentId: receiptId,
      operation: 'delete',
      timestamp: Date.now(),
    }),
  });
}

// Connection monitoring
export function useConnectionMonitor() {
  const { setConnectionState } = useSyncStore();
  
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Online');
      setConnectionState({ 
        isOnline: true, 
        connectionQuality: 'excellent',
        retryCount: 0 
      });
    };
    
    const handleOffline = () => {
      console.log('🌐 Network: Offline');
      setConnectionState({ 
        isOnline: false,
        isConnected: false, 
        connectionQuality: 'offline' 
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setConnectionState]);
}

// Hook to get query client instance
export function useSyncQueryClient() {
  return useQueryClient();
}
