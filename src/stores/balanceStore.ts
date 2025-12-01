/**
 * Balance Store - Zustand
 * Centralized reactive state management for customer balances
 * 
 * TODO: Rebuild balance calculation logic from scratch
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

export interface CustomerBalance {
  balance: number;
  oldBalance: number;
  lastUpdated: Date;
  receiptCount: number;
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
  getOldBalance: (customerName: string) => number;
  isCalculating: (customerName: string) => boolean;
  getReceiptCount: (customerName: string) => number;
  getAllBalances: () => Array<{ customerName: string; balance: number }>;
  getTotalOutstanding: () => number;
}

export const useBalanceStore = create<BalanceState>()(
  devtools(
    immer((set, get) => ({
      balances: new Map(),
      
      /**
       * Calculate balance from Firebase receipts
       * TODO: Implement proper balance calculation logic
       */
      calculateBalance: async (customerName: string): Promise<number> => {
        if (!customerName?.trim()) return 0;

        const trimmedName = customerName.trim();

        // Set calculating state
        set((state) => {
          const existing = state.balances.get(trimmedName);
          state.balances.set(trimmedName, {
            ...existing,
            balance: existing?.balance || 0,
            oldBalance: existing?.oldBalance || 0,
            lastUpdated: existing?.lastUpdated || new Date(),
            receiptCount: existing?.receiptCount || 0,
            isCalculating: true,
          });
        });

        try {
          // Fetch receipts from Firebase
          const db = getFirebaseDb();
          if (!db) {
            console.warn('Firebase not initialized');
            set((state) => {
              const existing = state.balances.get(trimmedName);
              if (existing) {
                existing.isCalculating = false;
              }
            });
            return 0;
          }

          const receiptsRef = collection(db, 'receipts');
          const q = query(receiptsRef, where('customerName', '==', trimmedName));
          const querySnapshot = await getDocs(q);

          const receipts: FirebaseReceipt[] = [];
          querySnapshot.forEach((doc) => {
            receipts.push({ id: doc.id, ...doc.data() } as FirebaseReceipt);
          });

          // TODO: Implement proper balance calculation
          // For now, return 0 - logic needs to be rebuilt
          const balance = 0;
          const unpaidCount = 0;

          // Update state
          set((state) => {
            state.balances.set(trimmedName, {
              balance,
              oldBalance: balance,
              lastUpdated: new Date(),
              receiptCount: unpaidCount,
              isCalculating: false,
            });
          });

          if (__DEV__) {
            console.log(`⚠️ [BalanceStore] Balance calculation not implemented - returning 0 for "${trimmedName}"`);
          }

          return balance;
        } catch (error) {
          console.error('[BalanceStore] Error calculating balance:', error);
          
          set((state) => {
            const existing = state.balances.get(trimmedName);
            if (existing) {
              existing.isCalculating = false;
            }
          });

          return 0;
        }
      },

      /**
       * Update balance from provided receipts
       * TODO: Implement proper balance calculation logic
       */
      updateFromReceipts: (customerName: string, receipts: FirebaseReceipt[]) => {
        if (!customerName?.trim()) return;

        const trimmedName = customerName.trim();
        
        // TODO: Implement proper balance calculation
        const balance = 0;
        const unpaidCount = 0;

        set((state) => {
          state.balances.set(trimmedName, {
            balance,
            oldBalance: balance,
            lastUpdated: new Date(),
            receiptCount: unpaidCount,
            isCalculating: false,
          });
        });

        if (__DEV__) {
          console.log(`⚠️ [BalanceStore] Balance calculation not implemented for "${trimmedName}"`);
        }
      },

      /**
       * Update multiple customers at once
       * TODO: Implement proper balance calculation logic
       */
      updateMultipleCustomers: (receiptsMap: Map<string, FirebaseReceipt[]>) => {
        set((state) => {
          receiptsMap.forEach((receipts, customerName) => {
            // TODO: Implement proper balance calculation
            const balance = 0;
            const unpaidCount = 0;

            state.balances.set(customerName, {
              balance,
              oldBalance: balance,
              lastUpdated: new Date(),
              receiptCount: unpaidCount,
              isCalculating: false,
            });
          });
        });

        if (__DEV__) {
          console.log(`⚠️ [BalanceStore] Balance calculation not implemented for ${receiptsMap.size} customers`);
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
          console.log(`🗑️ [BalanceStore] Invalidated balance for "${trimmedName}"`);
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
        const trimmedName = customerName.trim();
        return get().balances.get(trimmedName)?.balance || 0;
      },

      /**
       * Get oldBalance for receipt creation (selector)
       */
      getOldBalance: (customerName: string): number => {
        if (!customerName?.trim()) return 0;
        const trimmedName = customerName.trim();
        return get().balances.get(trimmedName)?.oldBalance || 0;
      },

      /**
       * Check if balance is currently being calculated (selector)
       */
      isCalculating: (customerName: string): boolean => {
        if (!customerName?.trim()) return false;
        const trimmedName = customerName.trim();
        return get().balances.get(trimmedName)?.isCalculating || false;
      },

      /**
       * Get unpaid receipt count for a customer (selector)
       */
      getReceiptCount: (customerName: string): number => {
        if (!customerName?.trim()) return 0;
        const trimmedName = customerName.trim();
        return get().balances.get(trimmedName)?.receiptCount || 0;
      },

      /**
       * Get all customer balances as array (selector)
       */
      getAllBalances: (): Array<{ customerName: string; balance: number }> => {
        const balances = get().balances;
        const result: Array<{ customerName: string; balance: number }> = [];

        balances.forEach((value, customerName) => {
          if (value.balance > 0) {
            result.push({ customerName, balance: value.balance });
          }
        });

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

// Export convenience hooks for common use cases
export const useCustomerBalance = (customerName: string) => {
  return useBalanceStore((state) => state.getBalance(customerName));
};

export const useCustomerOldBalance = (customerName: string) => {
  return useBalanceStore((state) => state.getOldBalance(customerName));
};

export const useIsBalanceCalculating = (customerName: string) => {
  return useBalanceStore((state) => state.isCalculating(customerName));
};
