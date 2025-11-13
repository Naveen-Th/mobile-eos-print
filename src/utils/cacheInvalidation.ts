import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/useSyncManager';

/**
 * Utility to force invalidate and refetch React Query cache
 * Use this after critical mutations like payments to ensure UI updates
 */
export class CacheInvalidation {
  /**
   * Invalidate receipts cache and force refetch
   * This ensures the UI shows updated payment status immediately
   */
  static async invalidateReceipts(queryClient: QueryClient) {
    try {
      console.log('🔄 Invalidating receipts cache...');
      
      // Invalidate the receipts query
      await queryClient.invalidateQueries({
        queryKey: queryKeys.receipts(),
        refetchType: 'active', // Only refetch active queries
      });
      
      // Force refetch immediately
      await queryClient.refetchQueries({
        queryKey: queryKeys.receipts(),
        type: 'active',
      });
      
      console.log('✅ Receipts cache invalidated and refetched');
    } catch (error) {
      console.error('❌ Error invalidating receipts cache:', error);
    }
  }

  /**
   * Invalidate a specific receipt by ID
   */
  static async invalidateReceipt(queryClient: QueryClient, receiptId: string) {
    try {
      console.log(`🔄 Invalidating receipt ${receiptId}...`);
      
      await queryClient.invalidateQueries({
        queryKey: queryKeys.document('receipts', receiptId),
      });
      
      // Also invalidate the receipts collection since it contains this receipt
      await this.invalidateReceipts(queryClient);
      
      console.log(`✅ Receipt ${receiptId} invalidated`);
    } catch (error) {
      console.error(`❌ Error invalidating receipt ${receiptId}:`, error);
    }
  }

  /**
   * Clear stale data from cache
   * Use this when you suspect the cache has outdated data
   */
  static async clearStaleData(queryClient: QueryClient) {
    try {
      console.log('🧹 Clearing stale cache data...');
      
      // Remove stale queries older than 5 minutes
      queryClient.getQueryCache().clear();
      
      // Refetch all active queries
      await queryClient.refetchQueries({
        type: 'active',
      });
      
      console.log('✅ Stale cache cleared and refetched');
    } catch (error) {
      console.error('❌ Error clearing stale cache:', error);
    }
  }

  /**
   * Force refresh all collections
   */
  static async refreshAll(queryClient: QueryClient) {
    try {
      console.log('🔄 Refreshing all collections...');
      
      await queryClient.invalidateQueries({
        queryKey: queryKeys.collections(),
      });
      
      await queryClient.refetchQueries({
        queryKey: queryKeys.collections(),
        type: 'active',
      });
      
      console.log('✅ All collections refreshed');
    } catch (error) {
      console.error('❌ Error refreshing collections:', error);
    }
  }
}

