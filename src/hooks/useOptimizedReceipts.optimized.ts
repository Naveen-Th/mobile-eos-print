import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useReceipts } from './useSyncManager.optimized';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { performanceTime, performanceTimeEnd } from '../utils/performanceTiming';

/**
 * Ultra-optimized receipts hook with:
 * - Progressive data loading (20 → 50 → all)
 * - Lazy search indexing (only when needed)
 * - Smart caching with TTL
 * - Minimal re-renders
 * - Instant perceived performance
 */
export function useOptimizedReceipts() {
  const queryClient = useQueryClient();
  const { data: receipts = [], isLoading, error, refetch, loadMore, loadedCount, hasMore } = useReceipts();
  
  // Search index (lazy loaded)
  const searchIndexRef = useRef<Map<string, Set<string>> | null>(null);
  const isIndexingRef = useRef(false);
  
  // Cache for customer balances
  const balanceCache = useRef<Map<string, {
    balance: number;
    timestamp: number;
  }>>(new Map());
  
  const CACHE_TTL = 30000; // 30 seconds
  
  // Progressive indexing - only index visible data
  const buildSearchIndex = useCallback((receiptsToIndex: FirebaseReceipt[]) => {
    if (isIndexingRef.current) return;
    
    isIndexingRef.current = true;
    performanceTime('🔍 Building search index');
    
    const index = new Map<string, Set<string>>();
    
    receiptsToIndex.forEach(receipt => {
      const searchableText = [
        receipt.receiptNumber,
        receipt.customerName,
        receipt.customerPhone,
        receipt.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      
      // Tokenize and add to index
      searchableText.split(/\s+/).forEach(term => {
        if (term.length >= 2) {
          if (!index.has(term)) {
            index.set(term, new Set());
          }
          index.get(term)!.add(receipt.id!);
        }
      });
    });
    
    searchIndexRef.current = index;
    isIndexingRef.current = false;
    
    performanceTimeEnd('🔍 Building search index');
    console.log(`📊 Indexed ${receiptsToIndex.length} receipts with ${index.size} unique terms`);
  }, []);
  
  // Lazy search function
  const searchReceipts = useCallback((searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      return receipts;
    }
    
    // Build index on first search if not already built
    if (!searchIndexRef.current && receipts.length > 0) {
      buildSearchIndex(receipts);
    }
    
    if (!searchIndexRef.current) {
      return receipts;
    }
    
    const terms = searchTerm.toLowerCase().split(/\s+/);
    const matchedIds = new Set<string>();
    
    terms.forEach(term => {
      searchIndexRef.current?.forEach((ids, indexTerm) => {
        if (indexTerm.includes(term)) {
          ids.forEach(id => matchedIds.add(id));
        }
      });
    });
    
    return receipts.filter(r => matchedIds.has(r.id!));
  }, [receipts, buildSearchIndex]);
  
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
    console.log(`✅ Final result: ${result.length} receipts`);
    
    return result;
  }, [receipts]);
  
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
  
  // Filter receipts by status (memoized)
  const getReceiptsByStatus = useCallback((status: string) => {
    return receiptsWithBalance.filter(r => r.status === status);
  }, [receiptsWithBalance]);
  
  // Get pending receipts (unpaid/partial)
  const getPendingReceipts = useCallback(() => {
    return receiptsWithBalance.filter(r => {
      const amountPaid = r.amountPaid || 0;
      const total = r.total || 0;
      return amountPaid < total;
    });
  }, [receiptsWithBalance]);
  
  return {
    // Data
    receipts: receiptsWithBalance,
    rawReceipts: receipts,
    isLoading,
    error,
    
    // Progressive loading
    loadMore,
    loadedCount,
    hasMore,
    
    // Actions
    refetch,
    
    // Utilities
    getCustomerBalance,
    searchReceipts,
    getReceiptsByStatus,
    getPendingReceipts,
    
    // Optimistic updates
    optimisticPaymentUpdate,
    optimisticDeleteUpdate,
  };
}
