import { useMemo } from 'react';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import {
  calculateReceiptBalance,
  calculateCustomerTotalBalance,
  sortReceiptsByDateAsc,
} from '../utils/paymentCalculations';

/**
 * Optimized hook for calculating customer balances
 * 
 * Performance: O(n) instead of O(n²)
 * - Single pass through receipts
 * - Pre-aggregates by customer
 * - O(1) lookup by customer name
 * 
 * Uses pure calculation functions from paymentCalculations.ts
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
    
    // Group receipts by customer
    const customerReceipts = new Map<string, FirebaseReceipt[]>();
    
    for (const receipt of receipts) {
      const customerName = receipt.customerName || 'Walk-in Customer';
      const existing = customerReceipts.get(customerName) || [];
      existing.push(receipt);
      customerReceipts.set(customerName, existing);
    }
    
    // Calculate balance for each customer using pure function
    for (const [customerName, customerReceiptList] of customerReceipts) {
      const balance = calculateCustomerTotalBalance(customerReceiptList);
      balances.set(customerName, balance);
    }
    
    return balances;
  }, [receipts]);
}

/**
 * Calculate dynamic balance for individual receipt (for backward compatibility)
 * 
 * This function calculates the "Previous Balance" shown on each receipt by:
 * 1. For the OLDEST receipt of each customer: Use the Firebase oldBalance (historical balance)
 * 2. For NEWER receipts: Calculate dynamically based on unpaid amounts from older receipts
 * 
 * This ensures:
 * - Historical balance from before the loaded receipts is preserved
 * - When a payment is made on an older receipt, newer receipts show updated Previous Balance
 * 
 * @param receipts - All receipts
 * @returns Array of receipts with calculated oldBalance and newBalance
 */
export function useReceiptsWithBalance(receipts: FirebaseReceipt[]): FirebaseReceipt[] {
  return useMemo(() => {
    if (!receipts || receipts.length === 0) return [];
    
    // Sort receipts by date (oldest first) for accurate balance calculation
    const sorted = sortReceiptsByDateAsc(receipts);
    
    // Track running balance per customer (only unpaid receipt amounts, NOT historical debt)
    const customerUnpaidMap = new Map<string, number>();
    // Track historical debt per customer (from first receipt's oldBalance)
    const customerHistoricalDebt = new Map<string, number>();
    // Track if we've seen the first receipt for each customer
    const customerFirstReceiptSeen = new Set<string>();
    
    return sorted.map(receipt => {
      const customerName = receipt.customerName || 'Walk-in Customer';
      
      // Calculate this receipt's remaining balance (unpaid amount) using pure function
      const receiptBalance = calculateReceiptBalance(receipt);
      
      let oldBalance: number;
      
      if (!customerFirstReceiptSeen.has(customerName)) {
        // This is the FIRST (oldest) receipt for this customer in the loaded data
        // Use the Firebase oldBalance to preserve historical balance
        oldBalance = receipt.oldBalance || 0;
        customerFirstReceiptSeen.add(customerName);
        
        // Store historical debt separately (this is debt from BEFORE the system)
        customerHistoricalDebt.set(customerName, oldBalance);
        
        // Initialize unpaid map with ONLY this receipt's unpaid amount (NOT including historical debt)
        customerUnpaidMap.set(customerName, receiptBalance);
      } else {
        // This is a SUBSEQUENT receipt - calculate oldBalance dynamically
        // oldBalance = historical debt + sum of unpaid amounts from PREVIOUS receipts
        const historicalDebt = customerHistoricalDebt.get(customerName) || 0;
        const previousUnpaid = customerUnpaidMap.get(customerName) || 0;
        oldBalance = historicalDebt + previousUnpaid;
        
        // Update running unpaid total (add this receipt's unpaid amount)
        customerUnpaidMap.set(customerName, previousUnpaid + receiptBalance);
      }
      
      // Round to avoid floating point issues
      const roundedOldBalance = Math.round(oldBalance * 100) / 100;
      const roundedNewBalance = Math.round((oldBalance + receiptBalance) * 100) / 100;
      
      return {
        ...receipt,
        oldBalance: roundedOldBalance,
        newBalance: roundedNewBalance,
      };
    });
  }, [receipts]);
}

/**
 * Hook to get a single customer's balance
 * @param receipts - All receipts
 * @param customerName - Customer name to get balance for
 * @returns Customer's total outstanding balance
 */
export function useCustomerBalance(
  receipts: FirebaseReceipt[],
  customerName: string
): number {
  const balances = useCustomerBalances(receipts);
  return balances.get(customerName) || 0;
}
