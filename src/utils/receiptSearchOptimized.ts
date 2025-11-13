import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { performanceTime, performanceTimeEnd } from './performanceTiming';

/**
 * Ultra-optimized search and filter for receipts
 * Uses indexing and caching for instant results
 */

// Search index cache
const searchIndexCache = new Map<string, Set<string>>();
let lastIndexedReceipts: FirebaseReceipt[] = [];
let indexBuildTimeout: NodeJS.Timeout | null = null;
let lastIndexTime = 0;

/**
 * Build search index for instant lookups
 * This runs once per receipts update
 * ✅ Debounced to prevent rebuilding during batch operations
 */
export function buildSearchIndex(receipts: FirebaseReceipt[]) {
  // Only rebuild if receipts changed
  if (receipts === lastIndexedReceipts) {
    return;
  }
  
  // ✅ Debounce: If called rapidly (batch delete), wait for operations to finish
  const now = Date.now();
  const timeSinceLastIndex = now - lastIndexTime;
  
  if (timeSinceLastIndex < 1000) {
    // Clear previous timeout and schedule new one
    if (indexBuildTimeout) clearTimeout(indexBuildTimeout);
    
    indexBuildTimeout = setTimeout(() => {
      buildSearchIndexImmediate(receipts);
    }, 500); // Wait 500ms after last change
    
    return;
  }
  
  // Build immediately if enough time has passed
  buildSearchIndexImmediate(receipts);
}

/**
 * Internal function that actually builds the index
 */
function buildSearchIndexImmediate(receipts: FirebaseReceipt[]) {
  performanceTime('🔍 Building search index');
  searchIndexCache.clear();
  
  receipts.forEach(receipt => {
    const searchableFields = [
      receipt.customerName?.toLowerCase(),
      receipt.receiptNumber?.toLowerCase(),
      receipt.companyName?.toLowerCase(),
      ...receipt.items.map(item => item.name?.toLowerCase()),
    ].filter(Boolean) as string[];
    
    // Index each word for fast lookup
    searchableFields.forEach(field => {
      const words = field.split(/\s+/);
      words.forEach(word => {
        if (!searchIndexCache.has(word)) {
          searchIndexCache.set(word, new Set());
        }
        searchIndexCache.get(word)!.add(receipt.id);
      });
    });
  });
  
  lastIndexedReceipts = receipts;
  lastIndexTime = Date.now(); // ✅ Track when index was last built
  performanceTimeEnd('🔍 Building search index');
  
  // ✅ Only log in DEV mode
  if (__DEV__) {
    console.log(`📊 Indexed ${receipts.length} receipts`);
  }
}

/**
 * Ultra-fast search using index
 * O(1) lookup instead of O(n) iteration
 */
export function searchReceipts(
  receipts: FirebaseReceipt[],
  query: string
): FirebaseReceipt[] {
  if (!query || query.trim().length === 0) {
    return receipts;
  }
  
  performanceTime(`🔍 Search: "${query}"`);
  
  const searchTerm = query.toLowerCase().trim();
  const words = searchTerm.split(/\s+/);
  
  // Get receipt IDs that match ALL words (AND logic)
  let matchingIds: Set<string> | null = null;
  
  for (const word of words) {
    const idsForWord = searchIndexCache.get(word);
    
    if (!idsForWord || idsForWord.size === 0) {
      // If any word has no matches, result is empty
      performanceTimeEnd(`🔍 Search: "${query}"`);
      return [];
    }
    
    if (matchingIds === null) {
      matchingIds = new Set(idsForWord);
    } else {
      // Intersection: keep only IDs that match all words
      matchingIds = new Set(
        [...matchingIds].filter(id => idsForWord.has(id))
      );
    }
  }
  
  // Return receipts in original order
  const result = receipts.filter(r => matchingIds?.has(r.id));
  
  performanceTimeEnd(`🔍 Search: "${query}"`);
  
  // ✅ Only log search results in DEV mode
  if (__DEV__ && result.length < receipts.length) {
    console.log(`🔍 Found ${result.length}/${receipts.length} matches for "${query}"`);
  }
  
  return result;
}

/**
 * Optimized filter with early exit
 */
export function filterReceipts(
  receipts: FirebaseReceipt[],
  statusFilter: string
): FirebaseReceipt[] {
  if (statusFilter === 'all') {
    return receipts;
  }
  
  performanceTime(`🔍 Filter: ${statusFilter}`);
  const result = receipts.filter(receipt => receipt.status === statusFilter);
  performanceTimeEnd(`🔍 Filter: ${statusFilter}`);
  
  return result;
}

/**
 * Optimized sort with stable algorithm
 */
export function sortReceipts(
  receipts: FirebaseReceipt[],
  sortBy: 'date' | 'customer' | 'total',
  sortOrder: 'asc' | 'desc'
): FirebaseReceipt[] {
  performanceTime(`🔍 Sort: ${sortBy} ${sortOrder}`);
  
  // Use native sort with optimized comparator
  const result = [...receipts].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        comparison = dateA - dateB;
        break;
      case 'customer':
        const customerA = (a.customerName || 'Walk-in').toLowerCase();
        const customerB = (b.customerName || 'Walk-in').toLowerCase();
        comparison = customerA.localeCompare(customerB);
        break;
      case 'total':
        comparison = (a.total || 0) - (b.total || 0);
        break;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  performanceTimeEnd(`🔍 Sort: ${sortBy} ${sortOrder}`);
  return result;
}

/**
 * Combined search, filter, and sort in single pass
 * Most efficient for chained operations
 */
export function searchFilterSort(
  receipts: FirebaseReceipt[],
  query: string,
  statusFilter: string,
  sortBy: 'date' | 'customer' | 'total',
  sortOrder: 'asc' | 'desc'
): FirebaseReceipt[] {
  performanceTime('🔍 Combined search+filter+sort');
  
  // Build index if needed
  if (receipts !== lastIndexedReceipts) {
    buildSearchIndex(receipts);
  }
  
  // Search first (most restrictive)
  let result = query ? searchReceipts(receipts, query) : receipts;
  
  // Then filter
  result = statusFilter !== 'all' ? filterReceipts(result, statusFilter) : result;
  
  // Finally sort
  result = sortReceipts(result, sortBy, sortOrder);
  
  performanceTimeEnd('🔍 Combined search+filter+sort');
  
  // ✅ Remove verbose final result log
  // if (__DEV__) console.log(`✅ ${result.length} receipts after search+filter+sort`);
  
  return result;
}

/**
 * Clear cache (call when receipts are deleted)
 */
export function clearSearchCache() {
  searchIndexCache.clear();
  lastIndexedReceipts = [];
}

