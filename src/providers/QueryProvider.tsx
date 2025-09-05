import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  DefaultOptions,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Platform } from 'react-native';

// Default query options optimized for Firebase real-time apps
const defaultOptions: DefaultOptions = {
  queries: {
    // Stale time for real-time data (we rely on real-time listeners)
    staleTime: 5 * 60 * 1000, // 5 minutes
    
    // Cache time - how long to keep in cache after component unmounts
    gcTime: 10 * 60 * 1000, // 10 minutes
    
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
    
    // Don't refetch on reconnect since we have real-time listeners
    refetchOnReconnect: false,
    
    // Network mode
    networkMode: 'online',
  },
  
  mutations: {
    // Retry failed mutations
    retry: 1,
    retryDelay: 1000,
    
    // Network mode for mutations
    networkMode: 'online',
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
