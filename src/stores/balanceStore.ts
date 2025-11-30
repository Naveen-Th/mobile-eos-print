/**
 * Balance Store - Zustand
 * Centralized reactive state management for customer balances
 * Replaces manual cache invalidation with automatic UI updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { calculateCustomerBalance } from '../utils/paymentCalculations';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

export interface CustomerBalance {
  balance: number;
  oldBalance: number; // For receipt creation
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
       * This is the source of truth calculation
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

          // Calculate balance using pure function
          const balance = calculateCustomerBalance(receipts);
          const unpaidCount = receipts.filter(r => {
            const remaining = (r.total || 0) - (r.amountPaid || 0);
            return remaining > 0.01;
          }).length;

          // Update state
          set((state) => {
            state.balances.set(trimmedName, {
              balance,
              oldBalance: balance, // For receipt creation
              lastUpdated: new Date(),
              receiptCount: unpaidCount,
              isCalculating: false,
            });
          });

          if (__DEV__) {
            console.log(`✅ [BalanceStore] Calculated balance for "${trimmedName}": ₹${balance} (${unpaidCount} unpaid receipts)`);
          }

          return balance;
        } catch (error) {
          console.error('[BalanceStore] Error calculating balance:', error);
          
          // Clear calculating state
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
       * Used for real-time updates from listeners
       */
      updateFromReceipts: (customerName: string, receipts: FirebaseReceipt[]) => {
        if (!customerName?.trim()) return;

        const trimmedName = customerName.trim();
        const balance = calculateCustomerBalance(receipts);
        const unpaidCount = receipts.filter(r => {
          const remaining = (r.total || 0) - (r.amountPaid || 0);
          return remaining > 0.01;
        }).length;

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
          console.log(`🔄 [BalanceStore] Updated balance for "${trimmedName}": ₹${balance}`);
        }
      },

      /**
       * Update multiple customers at once
       * Efficient for bulk updates from real-time listeners
       */
      updateMultipleCustomers: (receiptsMap: Map<string, FirebaseReceipt[]>) => {
        set((state) => {
          receiptsMap.forEach((receipts, customerName) => {
            const balance = calculateCustomerBalance(receipts);
            const unpaidCount = receipts.filter(r => {
              const remaining = (r.total || 0) - (r.amountPaid || 0);
              return remaining > 0.01;
            }).length;

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
          console.log(`🔄 [BalanceStore] Updated ${receiptsMap.size} customer balances`);
        }
      },

      /**
       * Invalidate balance (force recalculation on next access)
       * Optional - you may not need this with reactive updates
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

        // Sort by balance (highest first)
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

