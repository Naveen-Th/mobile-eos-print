/**
 * Payment Store - Zustand
 * Centralized state management for payment operations
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import PaymentService, { PaymentTransaction, RecordPaymentData } from '../services/business/PaymentService';
import {
  calculatePaymentCascade,
  calculateReceiptBalance,
  calculateCustomerTotalBalance,
  CascadeResult,
  CascadeReceipt,
} from '../utils/paymentCalculations';

export interface PaymentState {
  receiptId: string;
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
}

export interface CascadePreview {
  receiptsAffected: CascadeReceipt[];
  totalReceipts: number;
  totalApplied: number;
  remainingPayment: number;
  customerTotalBalance: number;
  newCustomerBalance: number;
}

interface PaymentStoreState {
  // State
  isProcessing: boolean;
  currentPayment: PaymentState | null;
  cascadePreview: CascadePreview | null;
  error: string | null;
  lastTransaction: PaymentTransaction | null;
  
  // Cached data for current payment session
  currentReceipt: FirebaseReceipt | null;
  customerReceipts: FirebaseReceipt[];
  
  // Actions
  setPaymentDetails: (payment: PaymentState) => void;
  setCurrentReceipt: (receipt: FirebaseReceipt | null) => void;
  loadCustomerReceipts: (customerName: string) => Promise<void>;
  previewCascade: (receiptId: string, amount: number) => Promise<CascadePreview | null>;
  recordPayment: (payment: PaymentState) => Promise<{ success: boolean; error?: string; transaction?: PaymentTransaction }>;
  clearPayment: () => void;
  clearError: () => void;
  
  // Selectors
  getIsProcessing: () => boolean;
  getCascadePreview: () => CascadePreview | null;
  getError: () => string | null;
  getReceiptBalance: () => number;
  getCustomerTotalBalance: () => number;
}

export const usePaymentStore = create<PaymentStoreState>()(
  devtools(
    immer((set, get) => ({
      isProcessing: false,
      currentPayment: null,
      cascadePreview: null,
      error: null,
      lastTransaction: null,
      currentReceipt: null,
      customerReceipts: [],
      
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
       * Set current receipt being paid
       */
      setCurrentReceipt: (receipt: FirebaseReceipt | null) => {
        set((state) => {
          state.currentReceipt = receipt;
          if (!receipt) {
            state.customerReceipts = [];
            state.cascadePreview = null;
          }
        });
      },
      
      /**
       * Load all receipts for a customer
       */
      loadCustomerReceipts: async (customerName: string) => {
        if (!customerName?.trim()) {
          set((state) => { state.customerReceipts = []; });
          return;
        }

        try {
          const receipts = await PaymentService.getCustomerAllReceipts(customerName);
          set((state) => {
            state.customerReceipts = receipts;
          });
        } catch (error) {
          console.error('[PaymentStore] Error loading customer receipts:', error);
          set((state) => { state.customerReceipts = []; });
        }
      },
      
      /**
       * Preview how payment will cascade across receipts
       */
      previewCascade: async (receiptId: string, amount: number): Promise<CascadePreview | null> => {
        const { currentReceipt, customerReceipts } = get();

        if (!currentReceipt || amount <= 0) {
          set((state) => {
            state.cascadePreview = null;
            state.error = amount <= 0 ? 'Payment amount must be greater than zero' : 'No receipt selected';
          });
          return null;
        }

        try {
          // Calculate cascade using pure function
          const cascadeResult = calculatePaymentCascade(
            currentReceipt,
            amount,
            customerReceipts
          );

          // Calculate customer balance info
          const customerTotalBalance = calculateCustomerTotalBalance(customerReceipts);
          const newCustomerBalance = Math.max(0, customerTotalBalance - cascadeResult.totalApplied);

          const preview: CascadePreview = {
            receiptsAffected: cascadeResult.affectedReceipts,
            totalReceipts: cascadeResult.affectedReceipts.length,
            totalApplied: cascadeResult.totalApplied,
            remainingPayment: cascadeResult.remainingPayment,
            customerTotalBalance,
            newCustomerBalance,
          };

          set((state) => {
            state.cascadePreview = preview;
            state.error = null;
          });

          if (__DEV__) {
            console.log(`💰 [PaymentStore] Cascade preview: ₹${amount} → ${preview.totalReceipts} receipt(s)`);
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
       */
      recordPayment: async (payment: PaymentState): Promise<{ success: boolean; error?: string; transaction?: PaymentTransaction }> => {
        set((state) => {
          state.isProcessing = true;
          state.error = null;
        });

        try {
          // Validate
          if (!payment.receiptId?.trim()) {
            throw new Error('Receipt ID is required');
          }
          if (payment.amount <= 0) {
            throw new Error('Payment amount must be greater than zero');
          }

          // Record payment via service
          const result = await PaymentService.recordPayment({
            receiptId: payment.receiptId,
            amount: payment.amount,
            paymentMethod: payment.method,
            notes: payment.notes,
          });

          if (!result.success) {
            throw new Error(result.error || 'Failed to record payment');
          }

          set((state) => {
            state.isProcessing = false;
            state.lastTransaction = result.paymentTransaction || null;
            state.currentPayment = null;
            state.cascadePreview = null;
            state.error = null;
          });

          if (__DEV__) {
            console.log(`✅ [PaymentStore] Payment recorded: ₹${payment.amount}`);
          }

          return { 
            success: true, 
            transaction: result.paymentTransaction 
          };
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
          state.currentReceipt = null;
          state.customerReceipts = [];
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
      
      /**
       * Selector: Get current receipt balance
       */
      getReceiptBalance: () => {
        const { currentReceipt } = get();
        if (!currentReceipt) return 0;
        return calculateReceiptBalance(currentReceipt);
      },
      
      /**
       * Selector: Get customer total balance
       */
      getCustomerTotalBalance: () => {
        const { customerReceipts } = get();
        return calculateCustomerTotalBalance(customerReceipts);
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

export const useLastPaymentTransaction = () => {
  return usePaymentStore((state) => state.lastTransaction);
};
