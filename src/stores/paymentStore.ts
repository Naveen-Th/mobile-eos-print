/**
 * Payment Store - Zustand
 * Centralized state management for payment operations
 * 
 * TODO: Rebuild payment recording and cascade logic from scratch
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { collection, query, where, getDocs, writeBatch, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { useBalanceStore } from './balanceStore';

export interface PaymentState {
  receiptId: string;
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
}

export interface CascadeReceipt {
  receipt: FirebaseReceipt;
  paymentToApply: number;
  currentBalance: number;
  newBalance: number;
}

export interface CascadePreview {
  receiptsAffected: CascadeReceipt[];
  totalReceipts: number;
  oldBalanceCleared: number;
  remainingPayment: number;
}

interface PaymentStoreState {
  // State
  isProcessing: boolean;
  currentPayment: PaymentState | null;
  cascadePreview: CascadePreview | null;
  error: string | null;
  
  // Actions
  setPaymentDetails: (payment: PaymentState) => void;
  previewCascade: (receiptId: string, amount: number) => Promise<CascadePreview | null>;
  recordPayment: (payment: PaymentState) => Promise<{ success: boolean; error?: string }>;
  clearPayment: () => void;
  clearError: () => void;
  
  // Selectors
  getIsProcessing: () => boolean;
  getCascadePreview: () => CascadePreview | null;
  getError: () => string | null;
}

export const usePaymentStore = create<PaymentStoreState>()(
  devtools(
    immer((set, get) => ({
      isProcessing: false,
      currentPayment: null,
      cascadePreview: null,
      error: null,
      
      /**
       * Set payment details for preview/recording
       */
      setPaymentDetails: (payment: PaymentState) => {
        set((state) => {
          state.currentPayment = payment;
          state.error = null;
        });
      },
      
      /**
       * Preview how payment will cascade across receipts
       * TODO: Implement cascade preview logic
       */
      previewCascade: async (receiptId: string, amount: number): Promise<CascadePreview | null> => {
        try {
          const db = getFirebaseDb();
          if (!db) {
            set((state) => { state.error = 'Firebase not initialized'; });
            return null;
          }

          // Get current receipt
          const receiptRef = doc(db, 'receipts', receiptId);
          const receiptDoc = await getDoc(receiptRef);

          if (!receiptDoc.exists()) {
            set((state) => { state.error = 'Receipt not found'; });
            return null;
          }

          const receipt = { id: receiptDoc.id, ...receiptDoc.data() } as FirebaseReceipt;

          // Basic validation
          if (amount <= 0) {
            set((state) => { state.error = 'Payment amount must be greater than zero'; });
            return null;
          }

          // TODO: Implement proper cascade preview calculation
          // For now, return empty preview
          const preview: CascadePreview = {
            receiptsAffected: [],
            totalReceipts: 0,
            oldBalanceCleared: 0,
            remainingPayment: amount,
          };

          set((state) => {
            state.cascadePreview = preview;
            state.error = null;
          });

          if (__DEV__) {
            console.log(`⚠️ [PaymentStore] Cascade preview not implemented`);
          }

          return preview;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to preview cascade';
          set((state) => { state.error = errorMessage; });
          console.error('[PaymentStore] Preview error:', error);
          return null;
        }
      },
      
      /**
       * Record payment with cascade to Firebase
       * TODO: Implement payment recording logic
       */
      recordPayment: async (payment: PaymentState): Promise<{ success: boolean; error?: string }> => {
        set((state) => {
          state.isProcessing = true;
          state.error = null;
        });

        try {
          // TODO: Implement payment recording logic
          // This should:
          // 1. Validate input
          // 2. Get the receipt
          // 3. Calculate payment distribution (cascade if needed)
          // 4. Update receipt(s) with payment
          // 5. Create payment transaction record
          // 6. Update customer balance

          if (__DEV__) {
            console.log(`⚠️ [PaymentStore] Payment recording not implemented`);
          }

          set((state) => {
            state.isProcessing = false;
            state.error = 'Payment recording not implemented - rebuild in progress';
          });

          return { success: false, error: 'Payment recording not implemented - rebuild in progress' };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to record payment';
          
          set((state) => {
            state.isProcessing = false;
            state.error = errorMessage;
          });

          console.error('[PaymentStore] Payment error:', error);
          return { success: false, error: errorMessage };
        }
      },
      
      /**
       * Clear current payment state
       */
      clearPayment: () => {
        set((state) => {
          state.currentPayment = null;
          state.cascadePreview = null;
          state.error = null;
        });
      },
      
      /**
       * Clear error message
       */
      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
      
      /**
       * Selector: Get processing status
       */
      getIsProcessing: () => {
        return get().isProcessing;
      },
      
      /**
       * Selector: Get cascade preview
       */
      getCascadePreview: () => {
        return get().cascadePreview;
      },
      
      /**
       * Selector: Get error message
       */
      getError: () => {
        return get().error;
      },
    })),
    { name: 'PaymentStore' }
  )
);

// Export convenience hooks
export const useIsPaymentProcessing = () => {
  return usePaymentStore((state) => state.isProcessing);
};

export const usePaymentCascadePreview = () => {
  return usePaymentStore((state) => state.cascadePreview);
};

export const usePaymentError = () => {
  return usePaymentStore((state) => state.error);
};
