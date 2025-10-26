import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  DefaultOptions,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Platform } from 'react-native';

// Default query options optimized for offline-first with Firebase
const defaultOptions: DefaultOptions = {
  queries: {
    // Stale time - data is considered fresh for longer since we have offline cache
    staleTime: 10 * 60 * 1000, // 10 minutes
    
    // Cache time - keep data in memory cache longer
    gcTime: 30 * 60 * 1000, // 30 minutes
    
    // Retry configuration
    retry: (failureCount, error) => {
      // Don't retry on certain Firebase errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'permission-denied' || 
            firebaseError.code === 'not-found') {
          return false;
        }
      }
      
      return failureCount < 3;
    },
    
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Refetch on window focus for web
    refetchOnWindowFocus: Platform.OS === 'web',
    
    // Refetch on reconnect to sync with server
    refetchOnReconnect: true,
    
    // OFFLINE-FIRST: Allow queries to return cached data even when offline
    networkMode: 'offlineFirst',
  },
  
  mutations: {
    // Retry failed mutations (will be queued if offline)
    retry: 2,
    retryDelay: 1000,
    
    // OFFLINE-FIRST: Allow mutations to be queued when offline
    networkMode: 'offlineFirst',
  },
};

// Create query client with optimized settings
const createQueryClient = () => {
  return new QueryClient({
    defaultOptions,
  });
};

// Singleton query client
let queryClient: QueryClient;

export const getQueryClient = () => {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
};

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* Only show dev tools in development and on web */}
      {__DEV__ && Platform.OS === 'web' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
        />
      )}
    </QueryClientProvider>
  );
};

// Utility functions for manual cache management
export const queryUtils = {
  // Invalidate all queries for a collection
  invalidateCollection: (collectionName: string) => {
    const client = getQueryClient();
    client.invalidateQueries({
      queryKey: ['firebase', 'collections', collectionName],
    });
  },
  
  // Remove all queries for a collection
  removeCollection: (collectionName: string) => {
    const client = getQueryClient();
    client.removeQueries({
      queryKey: ['firebase', 'collections', collectionName],
    });
  },
  
  // Clear all cache
  clearCache: () => {
    const client = getQueryClient();
    client.clear();
  },
  
  // Get cache stats
  getCacheStats: () => {
    const client = getQueryClient();
    const cache = client.getQueryCache();
    return {
      totalQueries: cache.getAll().length,
      activeQueries: cache.getAll().filter(q => q.getObserversCount() > 0).length,
      staleQueries: cache.getAll().filter(q => q.isStale()).length,
    };
  },
};

export default QueryProvider;
