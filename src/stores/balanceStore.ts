/**
 * Balance Store - Zustand
 * Centralized reactive state management for customer balances
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import {
  calculateReceiptBalance,
  calculateCustomerTotalBalance,
  getUnpaidReceipts,
} from '../utils/paymentCalculations';

export interface CustomerBalance {
  balance: number;           // Total outstanding balance
  receiptCount: number;      // Number of unpaid receipts
  lastUpdated: Date;
  isCalculating: boolean;
}

interface BalanceState {
  // State
  balances: Map<string, CustomerBalance>;
  
  // Actions
  calculateBalance: (customerName: string) => Promise<number>;
  updateFromReceipts: (customerName: string, receipts: FirebaseReceipt[]) => void;
  updateMultipleCustomers: (receiptsMap: Map<string, FirebaseReceipt[]>) => void;
  invalidateBalance: (customerName: string) => void;
  clearAllBalances: () => void;
  
  // Selectors
  getBalance: (customerName: string) => number;
  isCalculating: (customerName: string) => boolean;
  getReceiptCount: (customerName: string) => number;
  getAllBalances: () => Array<{ customerName: string; balance: number; receiptCount: number }>;
  getTotalOutstanding: () => number;
}

export const useBalanceStore = create<BalanceState>()(
  devtools(
    immer((set, get) => ({
      balances: new Map(),
      
      /**
       * Calculate balance from Firebase receipts
       */
      calculateBalance: async (customerName: string): Promise<number> => {
        if (!customerName?.trim()) return 0;

        const trimmedName = customerName.trim();

        // Set calculating state
        set((state) => {
          const existing = state.balances.get(trimmedName);
          state.balances.set(trimmedName, {
            balance: existing?.balance || 0,
            receiptCount: existing?.receiptCount || 0,
            lastUpdated: existing?.lastUpdated || new Date(),
            isCalculating: true,
          });
        });

        try {
          const db = getFirebaseDb();
          if (!db) {
            console.warn('Firebase not initialized');
            set((state) => {
              const existing = state.balances.get(trimmedName);
              if (existing) existing.isCalculating = false;
            });
            return 0;
          }

          // Fetch all receipts for this customer
          const receiptsRef = collection(db, 'receipts');
          const q = query(receiptsRef, where('customerName', '==', trimmedName));
          const querySnapshot = await getDocs(q);

          const receipts: FirebaseReceipt[] = [];
          querySnapshot.forEach((doc) => {
            receipts.push({ id: doc.id, ...doc.data() } as FirebaseReceipt);
          });

          // Calculate total balance using pure function
          const balance = calculateCustomerTotalBalance(receipts);
          const unpaidReceipts = getUnpaidReceipts(receipts);

          // Update state
          set((state) => {
            state.balances.set(trimmedName, {
              balance,
              receiptCount: unpaidReceipts.length,
              lastUpdated: new Date(),
              isCalculating: false,
            });
          });

          if (__DEV__) {
            console.log(`💰 [BalanceStore] ${trimmedName}: ₹${balance} (${unpaidReceipts.length} unpaid)`);
          }

          return balance;
        } catch (error) {
          console.error('[BalanceStore] Error calculating balance:', error);
          
          set((state) => {
            const existing = state.balances.get(trimmedName);
            if (existing) existing.isCalculating = false;
          });

          return 0;
        }
      },

      /**
       * Update balance from provided receipts (no Firebase call)
       */
      updateFromReceipts: (customerName: string, receipts: FirebaseReceipt[]) => {
        if (!customerName?.trim()) return;

        const trimmedName = customerName.trim();
        
        // Calculate using pure functions
        const balance = calculateCustomerTotalBalance(receipts);
        const unpaidReceipts = getUnpaidReceipts(receipts);

        set((state) => {
          state.balances.set(trimmedName, {
            balance,
            receiptCount: unpaidReceipts.length,
            lastUpdated: new Date(),
            isCalculating: false,
          });
        });

        if (__DEV__) {
          console.log(`💰 [BalanceStore] Updated ${trimmedName}: ₹${balance}`);
        }
      },

      /**
       * Update multiple customers at once (batch operation)
       */
      updateMultipleCustomers: (receiptsMap: Map<string, FirebaseReceipt[]>) => {
        set((state) => {
          receiptsMap.forEach((receipts, customerName) => {
            const balance = calculateCustomerTotalBalance(receipts);
            const unpaidReceipts = getUnpaidReceipts(receipts);

            state.balances.set(customerName, {
              balance,
              receiptCount: unpaidReceipts.length,
              lastUpdated: new Date(),
              isCalculating: false,
            });
          });
        });

        if (__DEV__) {
          console.log(`💰 [BalanceStore] Updated ${receiptsMap.size} customers`);
        }
      },

      /**
       * Invalidate balance (force recalculation on next access)
       */
      invalidateBalance: (customerName: string) => {
        if (!customerName?.trim()) return;

        const trimmedName = customerName.trim();
        set((state) => {
          state.balances.delete(trimmedName);
        });

        if (__DEV__) {
          console.log(`🗑️ [BalanceStore] Invalidated ${trimmedName}`);
        }
      },

      /**
       * Clear all cached balances
       */
      clearAllBalances: () => {
        set((state) => {
          state.balances.clear();
        });

        if (__DEV__) {
          console.log('🗑️ [BalanceStore] Cleared all balances');
        }
      },

      /**
       * Get balance for a customer (selector)
       */
      getBalance: (customerName: string): number => {
        if (!customerName?.trim()) return 0;
        return get().balances.get(customerName.trim())?.balance || 0;
      },

      /**
       * Check if balance is currently being calculated (selector)
       */
      isCalculating: (customerName: string): boolean => {
        if (!customerName?.trim()) return false;
        return get().balances.get(customerName.trim())?.isCalculating || false;
      },

      /**
       * Get unpaid receipt count for a customer (selector)
       */
      getReceiptCount: (customerName: string): number => {
        if (!customerName?.trim()) return 0;
        return get().balances.get(customerName.trim())?.receiptCount || 0;
      },

      /**
       * Get all customer balances as array (selector)
       */
      getAllBalances: (): Array<{ customerName: string; balance: number; receiptCount: number }> => {
        const balances = get().balances;
        const result: Array<{ customerName: string; balance: number; receiptCount: number }> = [];

        balances.forEach((value, customerName) => {
          if (value.balance > 0) {
            result.push({
              customerName,
              balance: value.balance,
              receiptCount: value.receiptCount,
            });
          }
        });

        // Sort by balance descending
        result.sort((a, b) => b.balance - a.balance);

        return result;
      },

      /**
       * Get total outstanding balance across all customers (selector)
       */
      getTotalOutstanding: (): number => {
        const balances = get().balances;
        let total = 0;

        balances.forEach((value) => {
          total += value.balance;
        });

        return Math.round(total * 100) / 100;
      },
    })),
    { name: 'BalanceStore' }
  )
);

// Export convenience hooks
export const useCustomerBalance = (customerName: string) => {
  return useBalanceStore((state) => state.getBalance(customerName));
};

export const useCustomerOldBalance = (customerName: string) => {
  // Old balance is the same as current balance for display purposes
  return useBalanceStore((state) => state.getBalance(customerName));
};

export const useIsBalanceCalculating = (customerName: string) => {
  return useBalanceStore((state) => state.isCalculating(customerName));
};

export const useTotalOutstanding = () => {
  return useBalanceStore((state) => state.getTotalOutstanding());
};
