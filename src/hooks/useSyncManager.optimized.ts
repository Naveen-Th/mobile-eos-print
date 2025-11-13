import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
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

// Progressive loading configuration
const PROGRESSIVE_LOAD_CONFIG = {
  receipts: {
    initial: 20,      // Show first 20 immediately
    increment: 50,     // Load 50 more on demand
    indexBatch: 100,   // Index in batches of 100
  },
  item_details: {
    initial: 50,
    increment: 50,
  },
  customers: {
    initial: 50,
    increment: 50,
  },
};

// Real-time subscription hook with progressive loading
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
    progressive?: boolean; // Enable progressive loading
  } = {}
) {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<Unsubscribe>();
  const [loadedCount, setLoadedCount] = useState(0);
  const isInitialLoadRef = useRef(true);
  
  // Generate a stable listener ID
  const listenerIdRef = useRef<string>();
  if (!listenerIdRef.current) {
    listenerIdRef.current = `${collectionName}-${Date.now()}`;
  }
  
  const queryKey = useMemo(() => queryKeys.collection(collectionName), [collectionName]);
  const enabled = options.enabled ?? true;
  const progressive = options.progressive ?? (collectionName === 'receipts');
  
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
    onErrorRef.current = options.onError;
  });
  
  // Load more data function
  const loadMore = useCallback(() => {
    const config = PROGRESSIVE_LOAD_CONFIG[collectionName as keyof typeof PROGRESSIVE_LOAD_CONFIG];
    if (config && progressive) {
      const newCount = loadedCount + config.increment;
      setLoadedCount(newCount);
      console.log(`📈 Loading more ${collectionName}: ${loadedCount} -> ${newCount}`);
    }
  }, [collectionName, loadedCount, progressive]);
  
  // Real-time listener setup
  useEffect(() => {
    if (__DEV__) console.log(`🔄 Setting up real-time listener for ${collectionName}, enabled:`, enabled);
    
    if (!enabled) {
      if (__DEV__) console.log(`⏸️ Real-time listener for ${collectionName} is disabled`);
      return;
    }
    
    if (!isFirebaseInitialized() || !db) {
      if (__DEV__) console.log(`📴 Firebase not initialized - skipping real-time listener for ${collectionName}`);
      return;
    }
    
    const listenerId = listenerIdRef.current!;
    let isActive = true;
    
    const { addActiveListener, removeActiveListener, setConnectionState, updateMetrics } = useSyncStore.getState();
    
    addActiveListener(listenerId);
    if (__DEV__) console.log(`✅ Added active listener: ${listenerId}`);
    
    // CRITICAL: Only load minimal cache on initial mount for fast startup
    (async () => {
      try {
        const config = PROGRESSIVE_LOAD_CONFIG[collectionName as keyof typeof PROGRESSIVE_LOAD_CONFIG];
        const initialLimit = config?.initial || 50;
        
        // Check if we already have fresh data in React Query cache
        const existingData = queryClient.getQueryData(queryKey) as T[] | undefined;
        if (existingData && existingData.length > 0) {
          console.log(`⚡ Using existing ${collectionName} cache (${existingData.length} items)`);
          return;
        }
        
        const cached = await getCache<T[]>(`collection:${collectionName}`);
        if (cached && cached.length > 0) {
          // Progressive: Only show first N items from cache
          const initialData = progressive ? cached.slice(0, initialLimit) : cached;
          queryClient.setQueryData(queryKey, initialData);
          setLoadedCount(initialData.length);
          
          if (__DEV__) console.log(`💾 Loaded ${initialData.length}/${cached.length} cached ${collectionName} items (progressive: ${progressive})`);
          
          // Load rest in background if progressive
          if (progressive && cached.length > initialLimit) {
            setTimeout(() => {
              if (isActive) {
                queryClient.setQueryData(queryKey, cached);
                setLoadedCount(cached.length);
                console.log(`💾 Loaded remaining ${cached.length - initialLimit} ${collectionName} items`);
              }
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error loading cache:', error);
      }
    })();
    
    try {
      const colRef = collection(db, collectionName);
      
      // Build query with optional limit and ordering
      let queryRef: any = colRef;
      if (options.orderByField) {
        queryRef = query(queryRef, orderBy(options.orderByField, options.orderDirection || 'desc'));
      }
      
      // CRITICAL: Smart limiting based on collection
      const config = PROGRESSIVE_LOAD_CONFIG[collectionName as keyof typeof PROGRESSIVE_LOAD_CONFIG];
      let queryLimit = options.limitCount;
      
      // For receipts, use progressive loading strategy
      if (!queryLimit && config) {
        queryLimit = progressive && isInitialLoadRef.current ? config.initial : undefined;
      }
      
      if (queryLimit) {
        queryRef = query(queryRef, limit(queryLimit));
        if (__DEV__) console.log(`🔢 Limiting ${collectionName} query to ${queryLimit} documents`);
      }
      
      const startTime = Date.now();
      if (__DEV__) console.log(`🔄 Creating onSnapshot for ${collectionName}...`);
      
      unsubscribeRef.current = onSnapshot(
        queryRef,
        async (snapshot) => {
          if (!isActive) return;
          
          const syncTime = Date.now() - startTime;
          if (__DEV__) console.log(`🔄 Real-time update for ${collectionName}:`, snapshot.docs.length, 'documents');
          
          try {
            const documents = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
              } as T;
            });
            
            // Merge with existing data if progressive
            const existingData = queryClient.getQueryData(queryKey) as T[] | undefined;
            let finalData = documents;
            
            if (progressive && existingData && existingData.length > documents.length) {
              // Keep more data if we already have it
              const newIds = new Set(documents.map((d: any) => d.id));
              const kept = existingData.filter((d: any) => !newIds.has(d.id));
              finalData = [...documents, ...kept];
              console.log(`🔄 Merged ${documents.length} new with ${kept.length} existing = ${finalData.length} total`);
            }
            
            queryClient.setQueryData(queryKey, finalData);
            setLoadedCount(finalData.length);
            
            // Persist to cache in background (debounced)
            if (isInitialLoadRef.current) {
              isInitialLoadRef.current = false;
              // Save full dataset to cache for offline use
              setCache<T[]>(`collection:${collectionName}`, documents).catch(() => {});
            }
            
            // Update connection state
            const { setConnectionState: setConnState, updateMetrics: updateMets } = useSyncStore.getState();
            setConnState({
              isConnected: true,
              lastSync: new Date(),
              connectionQuality: syncTime < 500 ? 'excellent' : syncTime < 2000 ? 'good' : 'poor'
            });
            
            updateMets(syncTime);
            
            if (onSuccessRef.current) {
              try {
                onSuccessRef.current(finalData);
              } catch (callbackError) {
                console.error('❌ Error in onSuccess callback:', callbackError);
              }
            }
          } catch (processError) {
            console.error(`❌ Error processing documents for ${collectionName}:`, processError);
            
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
          if (!isActive) return;
          
          console.error(`❌ Real-time listener error for ${collectionName}:`, error);
          
          const { setConnectionState: setConnState, updateMetrics: updateMets } = useSyncStore.getState();
          setConnState({
            isConnected: false,
            connectionQuality: 'offline'
          });
          updateMets(undefined, true);
          
          if (onErrorRef.current) {
            try {
              onErrorRef.current(error);
            } catch (callbackError) {
              console.error('❌ Error in onError callback:', callbackError);
            }
          }
        }
      );
      
      console.log(`✅ onSnapshot listener created for ${collectionName}`);
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
      isActive = false;
      console.log(`🧹 Cleaning up listener for ${collectionName}`);
      
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
          unsubscribeRef.current = undefined;
        } catch (unsubscribeError) {
          console.warn('Error during unsubscribe:', unsubscribeError);
        }
      }
      
      const { removeActiveListener: removeListener } = useSyncStore.getState();
      removeListener(listenerId);
    };
  }, [collectionName, enabled, queryClient, queryKey, progressive]);
  
  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      // CRITICAL: Don't fetch if we already have data from real-time listener
      const existingData = queryClient.getQueryData(queryKey) as T[] | undefined;
      if (existingData && existingData.length > 0) {
        console.log(`⚡ Using existing ${collectionName} data (${existingData.length} items)`);
        return existingData;
      }
      
      console.log(`🔄 Fallback queryFn called for ${collectionName}`);
      
      if (!isFirebaseInitialized() || !db) {
        console.log(`📴 Firebase not initialized - serving from cache for ${collectionName}`);
        const cached = await getCache<T[]>(`collection:${collectionName}`);
        return cached || [];
      }
      
      try {
        const colRef = collection(db, collectionName);
        
        let queryRef: any = colRef;
        if (options.orderByField) {
          queryRef = query(queryRef, orderBy(options.orderByField, options.orderDirection || 'desc'));
        }
        
        // Use same limiting strategy
        const config = PROGRESSIVE_LOAD_CONFIG[collectionName as keyof typeof PROGRESSIVE_LOAD_CONFIG];
        const initialLimit = config?.initial || 50;
        
        if (progressive) {
          queryRef = query(queryRef, limit(initialLimit));
        } else if (options.limitCount) {
          queryRef = query(queryRef, limit(options.limitCount));
        }
        
        const snapshot = await getDocs(queryRef);
        const documents = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          } as T;
        });
        
        console.log(`✅ Fallback fetch for ${collectionName} returned ${documents.length} documents`);
        setCache<T[]>(`collection:${collectionName}`, documents).catch(() => {});
        return documents;
      } catch (error) {
        console.error(`❌ Fallback fetch failed for ${collectionName}:`, error);
        const cached = await getCache<T[]>(`collection:${collectionName}`);
        if (cached) {
          const config = PROGRESSIVE_LOAD_CONFIG[collectionName as keyof typeof PROGRESSIVE_LOAD_CONFIG];
          const toShow = progressive && config ? cached.slice(0, config.initial) : cached;
          console.log(`📦 Serving ${toShow.length}/${cached.length} cached ${collectionName} items`);
          return toShow;
        }
        return [] as T[];
      }
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - longer since we have real-time updates
    gcTime: 60 * 60 * 1000, // 1 hour
    select: options.select,
    refetchOnMount: false, // Don't refetch on mount - rely on cache + real-time
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  return {
    ...queryResult,
    loadMore,
    loadedCount,
    hasMore: progressive && loadedCount < (queryResult.data?.length || 0),
  };
}

// Optimistic mutation hook (unchanged but included for completeness)
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
      
      if (optimisticUpdate) {
        const update = optimisticUpdate(variables);
        addOptimisticUpdate(update);
        
        const queryKey = queryKeys.collection(update.collection);
        await queryClient.cancelQueries({ queryKey });
        
        const previousData = queryClient.getQueryData(queryKey);
        
        queryClient.setQueryData(queryKey, (oldData: any[]) => {
          if (!oldData) return [];
          
          switch (update.operation) {
            case 'create':
              return [...oldData, { id: update.documentId, ...update.data }];
            case 'update':
              return oldData.map(item => {
                if (item.id === update.documentId) {
                  if (update.data.stockChange !== undefined) {
                    const newStock = Math.max(0, (item.stocks || 0) + update.data.stockChange);
                    return { ...item, stocks: newStock };
                  }
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
      
      if (context?.update) {
        removeOptimisticUpdate(context.update.id);
      }
      
      onSuccess?.(data, variables);
    },
    onError: (error, variables, context) => {
      console.error('❌ Mutation failed:', error);
      
      if (context?.update) {
        moveToFailed(context.update.id);
        
        const queryKey = queryKeys.collection(context.update.collection);
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      updateMetrics(undefined, true);
      onError?.(error, variables);
    },
    onSettled: (data, error, variables, context) => {
      if (context?.update) {
        const queryKey = queryKeys.collection(context.update.collection);
        queryClient.invalidateQueries({ queryKey });
      }
      
      onSettled?.(data, error, variables);
    },
  });
}

// Stable select functions
const selectItems = (data: any[]) => data.map(item => ({
  ...item,
  stocks: item.stocks || 0,
}));

const selectReceipts = (data: any[]) => {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.sort((a: any, b: any) => {
    try {
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
};

// Specific hooks
export function useItems() {
  return useRealtimeCollection('item_details', {
    enabled: true,
    select: selectItems,
    progressive: false,
  });
}

export function useReceipts() {
  return useRealtimeCollection('receipts', {
    enabled: true,
    select: selectReceipts,
    orderByField: 'createdAt',
    orderDirection: 'desc',
    progressive: true, // Enable progressive loading
  });
}

// Stock and CRUD mutations (same as before)
export function useUpdateStock() {
  const queryClient = useQueryClient();
  
  return useOptimisticMutation({
    mutationFn: async ({ itemId, stockChange }: { itemId: string; stockChange: number }) => {
      const docRef = doc(db, 'item_details', itemId);
      
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
      data: { stockChange },
    }),
  });
}

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

export function useConnectionMonitor() {
  const { setConnectionState } = useSyncStore();
  
  useEffect(() => {
    const isReactNative = typeof window === 'undefined' || !window.addEventListener;
    
    if (isReactNative) {
      console.log('🌐 Connection monitoring handled by useNetworkStatus');
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

export function useSyncQueryClient() {
  return useQueryClient();
}
