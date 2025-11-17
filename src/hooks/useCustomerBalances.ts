import { useMemo } from 'react';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

/**
 * Optimized hook for calculating customer balances
 * 
 * Performance: O(n) instead of O(n²)
 * - Single pass through receipts
 * - Pre-aggregates by customer
 * - O(1) lookup by customer name
 * 
 * @param receipts - Array of receipts
 * @returns Map of customer name to total outstanding balance
 */
export function useCustomerBalances(receipts: FirebaseReceipt[]): Map<string, number> {
  return useMemo(() => {
    const balances = new Map<string, number>();
    
    if (!receipts || receipts.length === 0) {
      return balances;
    }
    
    // Single pass through all receipts - O(n)
    for (const receipt of receipts) {
      const customerName = receipt.customerName || 'Walk-in Customer';
      const outstanding = (receipt.total || 0) - (receipt.amountPaid || 0);
      
      // Accumulate balance for this customer
      const currentBalance = balances.get(customerName) || 0;
      balances.set(customerName, currentBalance + outstanding);
    }
    
    return balances;
  }, [receipts]); // Only recalculates when receipts array changes
}

/**
 * Calculate dynamic balance for individual receipt (for backward compatibility)
 * 
 * @param receipts - All receipts
 * @returns Array of receipts with calculated oldBalance and newBalance
 */
export function useReceiptsWithBalance(receipts: FirebaseReceipt[]): FirebaseReceipt[] {
  return useMemo(() => {
    if (!receipts || receipts.length === 0) return [];
    
    // Sort receipts by date (oldest first) for accurate balance calculation
    const sorted = [...receipts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
      const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
      return dateA.getTime() - dateB.getTime();
    });
    
    // Track running balance per customer
    const customerBalanceMap = new Map<string, number>();
    
    return sorted.map(receipt => {
      const customerName = receipt.customerName || 'Walk-in Customer';
      
      // Get cumulative balance before this receipt
      const previousBalance = customerBalanceMap.get(customerName) || 0;
      
      // Calculate this receipt's remaining balance
      const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);
      
      // Use Firebase oldBalance if exists, otherwise use calculated
      const oldBalanceFromFirebase = receipt.oldBalance || 0;
      const oldBalance = oldBalanceFromFirebase > 0 ? oldBalanceFromFirebase : previousBalance;
      
      // Update running balance for this customer
      customerBalanceMap.set(customerName, oldBalance + receiptBalance);
      
      return {
        ...receipt,
        oldBalance,
        newBalance: oldBalance + receiptBalance,
      };
    });
  }, [receipts]);
}
