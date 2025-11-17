/**
 * Paginated Receipts with React Query Infinite Queries
 * 
 * Loads receipts in chunks for better performance with large datasets.
 * Automatically fetches next page when user scrolls to bottom.
 * 
 * Usage with FlashList:
 * const { data, fetchNextPage, hasNextPage, isLoading } = useReceiptsPaginated();
 * const allReceipts = data?.pages.flatMap(p => p.receipts) ?? [];
 * 
 * <FlashList
 *   data={allReceipts}
 *   onEndReached={() => hasNextPage && fetchNextPage()}
 *   onEndReachedThreshold={0.5}
 * />
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter,
  getDocs,
  QueryConstraint,
  where,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

const PAGE_SIZE = 50; // Load 50 receipts per page
const STALE_TIME = 1000 * 60 * 5; // 5 minutes

interface Receipt {
  id: string;
  createdAt: string;
  customerName?: string;
  status?: string;
  isPaid?: boolean;
  [key: string]: any;
}

interface ReceiptsPage {
  receipts: Receipt[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

interface PaginationFilters {
  status?: string;
  isPaid?: boolean;
  customerName?: string;
}

/**
 * Paginated receipts query with infinite scroll support
 */
export function useReceiptsPaginated(filters?: PaginationFilters) {
  const db = getFirebaseDb();

  return useInfiniteQuery({
    queryKey: ['receipts', 'paginated', filters],
    queryFn: async ({ pageParam = null }): Promise<ReceiptsPage> => {
      if (!db) throw new Error('Firestore not initialized');

      // Build query constraints
      const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      ];

      // Add filters if provided
      if (filters?.status) {
        constraints.unshift(where('status', '==', filters.status));
      }
      if (filters?.isPaid !== undefined) {
        constraints.unshift(where('isPaid', '==', filters.isPaid));
      }
      if (filters?.customerName) {
        constraints.unshift(where('customerName', '==', filters.customerName));
      }

      // Add cursor for pagination
      if (pageParam) {
        constraints.push(startAfter(pageParam));
      }

      const q = query(collection(db, 'receipts'), ...constraints);
      
      const startTime = performance.now();
      const snapshot = await getDocs(q);
      const duration = performance.now() - startTime;
      
      console.log(`📄 Fetched page of ${snapshot.docs.length} receipts in ${duration.toFixed(0)}ms`);

      const receipts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Receipt[];

      return {
        receipts,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: receipts.length === PAGE_SIZE
      };
    },
    getNextPageParam: (lastPage) => 
      lastPage.hasMore ? lastPage.lastDoc : undefined,
    initialPageParam: null,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 6, // 30 minutes (formerly cacheTime)
  });
}

/**
 * Get flattened array of all receipts from paginated data
 */
export function useFlattenedReceipts(filters?: PaginationFilters) {
  const { data, ...rest } = useReceiptsPaginated(filters);
  
  const receipts = data?.pages.flatMap(page => page.receipts) ?? [];
  const totalCount = receipts.length;
  const hasMore = data?.pages[data.pages.length - 1]?.hasMore ?? false;
  
  return {
    receipts,
    totalCount,
    hasMore,
    ...rest
  };
}

/**
 * Paginated receipts with search/filter support
 * Note: For search, you might need to fetch all and filter client-side,
 * or implement Algolia/Elasticsearch for full-text search
 */
export function useReceiptsWithSearch(searchQuery?: string, filters?: PaginationFilters) {
  const { receipts, ...rest } = useFlattenedReceipts(filters);
  
  // Client-side filtering for search
  const filteredReceipts = searchQuery
    ? receipts.filter(receipt => {
        const query = searchQuery.toLowerCase();
        return (
          receipt.customerName?.toLowerCase().includes(query) ||
          receipt.id?.toLowerCase().includes(query) ||
          receipt.status?.toLowerCase().includes(query)
        );
      })
    : receipts;
  
  return {
    receipts: filteredReceipts,
    totalCount: filteredReceipts.length,
    ...rest
  };
}

/**
 * Performance monitoring wrapper
 * Tracks query performance in development
 */
export function useReceiptsPaginatedWithMetrics(filters?: PaginationFilters) {
  const result = useReceiptsPaginated(filters);
  
  // Log performance metrics in development
  if (__DEV__ && result.isSuccess) {
    const pageCount = result.data?.pages.length ?? 0;
    const totalReceipts = result.data?.pages.flatMap(p => p.receipts).length ?? 0;
    
    console.log('📊 Pagination Metrics:', {
      pages: pageCount,
      receipts: totalReceipts,
      hasMore: result.hasNextPage,
      isFetching: result.isFetchingNextPage
    });
  }
  
  return result;
}
