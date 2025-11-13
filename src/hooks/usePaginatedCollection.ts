import { useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  where,
  WhereFilterOp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

interface PaginationOptions {
  collectionName: string;
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  whereFilters?: Array<{
    field: string;
    operator: WhereFilterOp;
    value: any;
  }>;
}

interface PaginatedResult<T> {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for paginated Firebase collection queries
 * Useful for loading large collections incrementally (10K+ documents)
 * 
 * @param options - Configuration for pagination
 * @returns Paginated data and control functions
 * 
 * @example
 * ```ts
 * const {
 *   data: receipts,
 *   isLoading,
 *   hasMore,
 *   loadMore
 * } = usePaginatedCollection<Receipt>({
 *   collectionName: 'receipts',
 *   pageSize: 50,
 *   orderByField: 'createdAt',
 *   orderDirection: 'desc'
 * });
 * ```
 */
export function usePaginatedCollection<T = any>(
  options: PaginationOptions
): PaginatedResult<T> {
  const {
    collectionName,
    pageSize = 50,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    whereFilters = [],
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Keep track of the last document for pagination
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Build base query
  const buildQuery = useCallback(
    (lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
      let q = collection(db, collectionName);
      let constraints: any[] = [];

      // Add where filters
      whereFilters.forEach(filter => {
        constraints.push(where(filter.field, filter.operator, filter.value));
      });

      // Add ordering
      constraints.push(orderBy(orderByField, orderDirection));

      // Add pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }
      constraints.push(limit(pageSize));

      return query(q, ...constraints);
    },
    [collectionName, orderByField, orderDirection, pageSize, whereFilters]
  );

  // Load initial data or next page
  const loadData = useCallback(
    async (isInitialLoad: boolean = false) => {
      if (!isInitialLoad && !hasMore) {
        console.log('📄 No more data to load');
        return;
      }

      const loadingState = isInitialLoad ? setIsLoading : setIsLoadingMore;
      loadingState(true);
      setError(null);

      try {
        const q = buildQuery(isInitialLoad ? null : lastDocRef.current);
        const snapshot = await getDocs(q);

        console.log(
          `📄 Loaded ${snapshot.docs.length} documents from ${collectionName}`
        );

        // Check if we have more data
        const loadedCount = snapshot.docs.length;
        setHasMore(loadedCount === pageSize);

        // Update last doc reference
        if (loadedCount > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        // Parse documents
        const newData: T[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];

        // Update data state
        if (isInitialLoad) {
          setData(newData);
        } else {
          setData(prev => [...prev, ...newData]);
        }
      } catch (err) {
        console.error('❌ Error loading paginated data:', err);
        setError(err as Error);
      } finally {
        loadingState(false);
      }
    },
    [buildQuery, collectionName, hasMore, pageSize]
  );

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (!isLoadingMore && hasMore) {
      await loadData(false);
    }
  }, [loadData, isLoadingMore, hasMore]);

  // Refresh (reload from start)
  const refresh = useCallback(async () => {
    lastDocRef.current = null;
    setHasMore(true);
    await loadData(true);
  }, [loadData]);

  // Reset pagination state
  const reset = useCallback(() => {
    setData([]);
    lastDocRef.current = null;
    setHasMore(true);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    reset,
  };
}
