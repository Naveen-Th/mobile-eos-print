import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useReceipts } from './useSyncManager';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { performanceTime, performanceTimeEnd } from '../utils/performanceTiming';

/**
 * Ultra-optimized receipts hook with:
 * - Smart caching
 * - Incremental loading
 * - Optimistic updates
 * - Minimal re-renders
 */
export function useOptimizedReceipts() {
  const queryClient = useQueryClient();
  const { data: receipts = [], isLoading, error, refetch } = useReceipts();
  
  // Cache for customer balances - prevents recalculation
  const balanceCache = useRef<Map<string, {
    balance: number;
    timestamp: number;
  }>>(new Map());
  
  const CACHE_TTL = 30000; // 30 seconds
  
  // Memoize receipts with dynamic balance calculations
  // Only recalculates when receipts array reference changes
  const receiptsWithBalance = useMemo(() => {
    if (!receipts || receipts.length === 0) return [];
    
    performanceTime('⚡ Balance calculation');
    
    // Sort once upfront (oldest first)
    const sorted = [...receipts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Calculate balances in single pass
    const customerBalances = new Map<string, number>();
    const result = sorted.map(receipt => {
      const customerName = receipt.customerName || 'Walk-in Customer';
      const previousBalance = customerBalances.get(customerName) || 0;
      const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);
      const newBalance = previousBalance + receiptBalance;
      
      customerBalances.set(customerName, newBalance);
      
      return {
        ...receipt,
        oldBalance: previousBalance,
        newBalance: newBalance,
      };
    });
    
    // Update cache
    const now = Date.now();
    customerBalances.forEach((balance, customer) => {
      balanceCache.current.set(customer, { balance, timestamp: now });
    });
    
    performanceTimeEnd('⚡ Balance calculation');
    return result;
  }, [receipts]); // Only recalculates when receipts reference changes
  
  // Get customer balance from cache (instant)
  const getCustomerBalance = useCallback((customerName: string): number => {
    const cached = balanceCache.current.get(customerName || 'Walk-in Customer');
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.balance;
    }
    
    // Fallback: calculate from receiptsWithBalance
    return receiptsWithBalance
      .filter(r => (r.customerName || 'Walk-in Customer') === customerName)
      .reduce((sum, r) => sum + ((r.total || 0) - (r.amountPaid || 0)), 0);
  }, [receiptsWithBalance]);
  
  // Optimistic payment update
  const optimisticPaymentUpdate = useCallback((
    receiptId: string,
    paymentAmount: number
  ) => {
    console.log('⚡ Optimistic update:', receiptId, paymentAmount);
    
    queryClient.setQueryData(['firebase', 'collections', 'receipts'], (old: FirebaseReceipt[] = []) => {
      return old.map(receipt => {
        if (receipt.id === receiptId) {
          const newAmountPaid = (receipt.amountPaid || 0) + paymentAmount;
          return {
            ...receipt,
            amountPaid: newAmountPaid,
            isPaid: newAmountPaid >= (receipt.total || 0),
          };
        }
        return receipt;
      });
    });
  }, [queryClient]);
  
  // Optimistic delete update
  const optimisticDeleteUpdate = useCallback((receiptId: string) => {
    console.log('⚡ Optimistic delete:', receiptId);
    
    queryClient.setQueryData(['firebase', 'collections', 'receipts'], (old: FirebaseReceipt[] = []) => {
      return old.filter(receipt => receipt.id !== receiptId);
    });
  }, [queryClient]);
  
  // Prefetch next page data (proactive)
  const prefetchNextPage = useCallback((currentFiltered: FirebaseReceipt[], currentPage: number, itemsPerPage: number) => {
    const nextPageStart = currentPage * itemsPerPage;
    const nextPageEnd = nextPageStart + itemsPerPage;
    
    // If we're near the end of current data, trigger load more
    if (nextPageEnd >= currentFiltered.length - 5) {
      console.log('⚡ Prefetching next batch...');
      // This would trigger loading more receipts
      refetch();
    }
  }, [refetch]);
  
  return {
    receipts: receiptsWithBalance,
    isLoading,
    error,
    refetch,
    getCustomerBalance,
    optimisticPaymentUpdate,
    optimisticDeleteUpdate,
    prefetchNextPage,
  };
}

