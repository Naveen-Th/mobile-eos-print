import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  Unsubscribe,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  query,
  limit,
  orderBy,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db, isFirebaseInitialized } from '../config/firebase';
import { useSyncStore, OptimisticUpdate } from '../store/syncStore';
import { getCache, setCache } from '../utils/offlineStorage';
import { getCircuitBreaker } from '../utils/ErrorHandler';
import { performanceTime, performanceTimeEnd } from '../utils/performanceTiming';

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
    limitCount?: number;
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
  } = {}
) {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<Unsubscribe>();
  
  // Generate a stable listener ID that won't change unless collectionName changes
  const listenerIdRef = useRef<string>();
  if (!listenerIdRef.current) {
    listenerIdRef.current = `${collectionName}-${Date.now()}`;
  }
  
  // Memoize the queryKey to prevent re-creation
  const queryKey = useMemo(() => queryKeys.collection(collectionName), [collectionName]);
  const enabled = options.enabled ?? true;
  
  // Memoize callback references to prevent infinite re-renders
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
    onErrorRef.current = options.onError;
  });
  
  // Real-time listener setup - CRITICAL: Don't put store in dependencies
  useEffect(() => {
    // ✅ Reduced verbose setup logs
    if (!enabled) return;
    
    // Check if Firebase is initialized (offline check)
    if (!isFirebaseInitialized() || !db) return;
    
    const listenerId = listenerIdRef.current!;
    let isActive = true; // Flag to prevent state updates after cleanup
    
    // Get store functions directly inside effect to avoid dependency issues
    const { addActiveListener, removeActiveListener, setConnectionState, updateMetrics } = useSyncStore.getState();
    
    addActiveListener(listenerId);

    // Prefill cache from offline storage on mount (non-blocking)
    (async () => {
      try {
        const cached = await getCache<T[]>(`collection:${collectionName}`);
        if (cached && cached.length > 0) {
          queryClient.setQueryData(queryKey, cached);
        }
      } catch {}
    })();
    
    try {
      const colRef = collection(db, collectionName);
      
      // Build query with optional limit and ordering for better performance
      let queryRef: any = colRef;
      if (options.orderByField) {
        queryRef = query(queryRef, orderBy(options.orderByField, options.orderDirection || 'asc'));
      }
      
      // CRITICAL: Always limit queries for large collections
      const queryLimit = options.limitCount || (collectionName === 'receipts' ? 50 : undefined);
      if (queryLimit) {
        queryRef = query(queryRef, limit(queryLimit));
      }
      
      const startTime = Date.now();
      performanceTime(`realtime_${collectionName}`);
      
      // Circuit breaker for this collection
      const circuitBreaker = getCircuitBreaker(`firebase_${collectionName}`);
      
      // ✅ Track last update to prevent duplicate logs and batch operations
      let lastUpdateTime = 0;
      let lastDocCount = 0;
      let updateTimeout: NodeJS.Timeout | null = null;
      
      unsubscribeRef.current = onSnapshot(
        queryRef,
        async (snapshot) => {
          if (!isActive) return; // Prevent updates after cleanup
          
          const syncTime = Date.now() - startTime;
          const docCount = snapshot.docs.length;
          const now = Date.now();
          
          // ✅ Detect batch operations (rapid count changes)
          const countChanged = Math.abs(docCount - lastDocCount) >= 1;
          const timeSinceLastUpdate = now - lastUpdateTime;
          const isBatchOperation = countChanged && timeSinceLastUpdate < 1000;
          
          // ✅ Skip duplicate updates (same count within 500ms)
          const isDuplicate = (timeSinceLastUpdate < 500) && (docCount === lastDocCount);
          if (isDuplicate) {
            return;
          }
          
          // ✅ Debounce batch operations (wait for them to finish)
          if (isBatchOperation) {
            // Clear previous timeout
            if (updateTimeout) clearTimeout(updateTimeout);
            
            // Wait 800ms for batch to complete
            updateTimeout = setTimeout(() => {
              if (!isActive) return;
              
              // Process the final batch update
              const documents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              } as T));
              
              queryClient.setQueryData(queryKey, documents);
              setCache<T[]>(`collection:${collectionName}`, documents).catch(() => {});
              
              lastUpdateTime = Date.now();
              lastDocCount = documents.length;
            }, 800);
            
            return;
          }
          
          lastUpdateTime = now;
          lastDocCount = docCount;
          
          try {
            const documents = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
              } as T;
            });
            
            // Update React Query cache with error handling
            try {
              queryClient.setQueryData(queryKey, documents);
              
              // Persist to offline storage
              setCache<T[]>(`collection:${collectionName}`, documents)
                .catch(() => {});
            } catch (cacheError) {
              console.error('❌ Error updating React Query cache:', cacheError);
            }
            
            // Record success in circuit breaker
            circuitBreaker.execute(async () => documents).catch(() => {});
            
            // Update connection state (get fresh store reference)
            const { setConnectionState: setConnState, updateMetrics: updateMets } = useSyncStore.getState();
            setConnState({
              isConnected: true,
              lastSync: new Date(),
              connectionQuality: syncTime < 1000 ? 'excellent' : syncTime < 3000 ? 'good' : 'poor'
            });
            
            updateMets(syncTime);
            
            // Call success callback if provided
            if (onSuccessRef.current) {
              try {
                onSuccessRef.current(documents);
              } catch (callbackError) {
                console.error('❌ Error in onSuccess callback:', callbackError);
              }
            }
          } catch (processError) {
            console.error(`❌ Error processing documents for ${collectionName}:`, processError);
            
            // Call error callback if provided
            if (onErrorRef.current) {
              try {
                onErrorRef.current(processError as Error);
              } catch (callbackError) {
                console.error('❌ Error in onError callback:', callbackError);
              }
            }
          }
        },
        (error) => {
          if (!isActive) return; // Prevent updates after cleanup
          
          performanceTimeEnd(`realtime_${collectionName}`);
          
          console.error(`❌ Real-time listener error for ${collectionName}:`, error);
          
          // Record failure in circuit breaker
          circuitBreaker.execute(async () => {
            throw error;
          }).catch(() => {
            // Circuit breaker handles the error
          });
          
          // Get fresh store reference for error handling
          const { setConnectionState: setConnState, updateMetrics: updateMets } = useSyncStore.getState();
          setConnState({
            isConnected: false,
            connectionQuality: 'offline'
          });
          updateMets(undefined, true);
          
          // Call error callback if provided
          if (onErrorRef.current) {
            try {
              onErrorRef.current(error);
            } catch (callbackError) {
              console.error('❌ Error in onError callback:', callbackError);
            }
          }
        }
      );
      
      // ✅ Listener ready
    } catch (error) {
      console.error(`❌ Failed to create listener for ${collectionName}:`, error);
      if (isActive && onErrorRef.current) {
        try {
          onErrorRef.current(error as Error);
        } catch (callbackError) {
          console.error('❌ Error in onError callback:', callbackError);
        }
      }
    }
    
    return () => {
      isActive = false; // Prevent any pending callbacks from executing
      
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
          unsubscribeRef.current = undefined;
        } catch (unsubscribeError) {
          console.warn('Error during unsubscribe:', unsubscribeError);
        }
      }
      
      // Get fresh store reference for cleanup
      const { removeActiveListener: removeListener } = useSyncStore.getState();
      removeListener(listenerId);
    };
  }, [collectionName, enabled, queryClient, queryKey]); // Removed store from dependencies
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      // Fallback query function - should RARELY run since real-time listener is primary
      if (__DEV__) console.log(`🔄 Fallback: ${collectionName}`);
      
      // Check if Firebase is initialized
      if (!isFirebaseInitialized() || !db) {
        const cached = await getCache<T[]>(`collection:${collectionName}`);
        return cached || [];
      }
      
      try {
        const colRef = collection(db, collectionName);
        
        // ✅ CRITICAL: Apply same limit as real-time listener
        let queryRef: any = colRef;
        if (options.orderByField) {
          queryRef = query(queryRef, orderBy(options.orderByField, options.orderDirection || 'asc'));
        }
        
        // ✅ Apply limit for receipts (50 docs max)
        const queryLimit = options.limitCount || (collectionName === 'receipts' ? 50 : undefined);
        if (queryLimit) {
          queryRef = query(queryRef, limit(queryLimit));
        }
        
        const snapshot = await getDocs(queryRef);
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as T));
        
        if (__DEV__) console.log(`✅ Fallback: ${collectionName} (${documents.length} docs)`);
        setCache<T[]>(`collection:${collectionName}`, documents).catch(() => {});
        return documents;
      } catch (error) {
        console.error(`❌ Fallback failed for ${collectionName}:`, error);
        const cached = await getCache<T[]>(`collection:${collectionName}`);
        return cached || [];
      }
    },
    enabled,
    initialData: [], // ✅ CRITICAL: Start with empty array so fallback doesn't run
    staleTime: Infinity, // ✅ Real-time listener keeps data fresh
    gcTime: 60 * 60 * 1000,
    select: options.select,
    // ✅ Never refetch - real-time listener is the ONLY source
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0, // ✅ No retries - real-time listener handles everything
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

// Create a stable select function for items to prevent re-creation
const selectItems = (data: any[]) => data.map(item => ({
  ...item,
  stocks: item.stocks || 0,
}));

// Specific hooks for collections
export function useItems() {
  const queryResult = useRealtimeCollection('item_details', {
    enabled: true,
    select: selectItems,
    onError: (error) => {
      console.error('❌ Items loading error:', error);
    },
  });
  
  return queryResult;
}

// Create a stable select function outside the component to prevent re-creation
const selectReceipts = (data: any[]) => {
  if (!Array.isArray(data)) {
    return [];
  }
  
  const sorted = data.sort((a: any, b: any) => {
    try {
      // Safely handle different date formats
      let dateA: Date, dateB: Date;
      
      if (a.createdAt?.toDate) {
        dateA = a.createdAt.toDate();
      } else if (a.createdAt instanceof Date) {
        dateA = a.createdAt;
      } else if (typeof a.createdAt === 'string') {
        dateA = new Date(a.createdAt);
      } else {
        dateA = new Date(0);
      }
      
      if (b.createdAt?.toDate) {
        dateB = b.createdAt.toDate();
      } else if (b.createdAt instanceof Date) {
        dateB = b.createdAt;
      } else if (typeof b.createdAt === 'string') {
        dateB = new Date(b.createdAt);
      } else {
        dateB = new Date(0);
      }
      
      return dateB.getTime() - dateA.getTime();
    } catch (error) {
      console.error('Error sorting receipts:', error);
      return 0;
    }
  });
  
  return sorted;
};

export function useReceipts() {
  return useRealtimeCollection('receipts', {
    enabled: true,
    select: selectReceipts,
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

// Item mutations
export function useCreateItem() {
  return useOptimisticMutation({
    mutationFn: async (itemData: any) => {
      const colRef = collection(db, 'item_details');
      const docRef = await addDoc(colRef, {
        ...itemData,
        stocks: itemData.stocks || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...itemData };
    },
    optimisticUpdate: (itemData) => ({
      id: `item-${Date.now()}`,
      collection: 'item_details',
      documentId: itemData.id || `temp-${Date.now()}`,
      operation: 'create',
      timestamp: Date.now(),
      data: { ...itemData, stocks: itemData.stocks || 0 },
    }),
  });
}

export function useUpdateItem() {
  return useOptimisticMutation({
    mutationFn: async ({ itemId, itemData }: { itemId: string; itemData: any }) => {
      const docRef = doc(db, 'item_details', itemId);
      await updateDoc(docRef, {
        ...itemData,
        updatedAt: serverTimestamp(),
      });
      return { itemId, ...itemData };
    },
    optimisticUpdate: ({ itemId, itemData }) => ({
      id: `update-item-${itemId}-${Date.now()}`,
      collection: 'item_details',
      documentId: itemId,
      operation: 'update',
      timestamp: Date.now(),
      data: itemData,
    }),
  });
}

export function useDeleteItem() {
  return useOptimisticMutation({
    mutationFn: async (itemId: string) => {
      const docRef = doc(db, 'item_details', itemId);
      await deleteDoc(docRef);
      return { id: itemId };
    },
    optimisticUpdate: (itemId) => ({
      id: `delete-item-${itemId}-${Date.now()}`,
      collection: 'item_details',
      documentId: itemId,
      operation: 'delete',
      timestamp: Date.now(),
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
    // Check if we're in a React Native environment
    const isReactNative = typeof window === 'undefined' || !window.addEventListener;
    
    if (isReactNative) {
      // For React Native, we can't use window.addEventListener
      console.log('🌐 Connection monitoring not available in React Native environment');
      setConnectionState({ 
        isOnline: true, 
        connectionQuality: 'excellent',
        retryCount: 0 
      });
      return;
    }
    
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
    
    // Initial check
    setConnectionState({ 
      isOnline: navigator?.onLine ?? true,
      connectionQuality: navigator?.onLine ? 'excellent' : 'offline',
      retryCount: 0 
    });
    
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
