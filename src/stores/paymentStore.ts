/**
 * Payment Store - Zustand
 * Centralized state management for payment operations
 * Handles payment recording, cascade preview, and payment history
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { 
  calculatePaymentCascade, 
  CascadeReceipt, 
  validatePaymentAmount 
} from '../utils/paymentCalculations';
import { collection, query, where, getDocs, writeBatch, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { useBalanceStore } from './balanceStore';

export interface PaymentState {
  receiptId: string;
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
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
       * @param receiptId - Receipt ID to pay
       * @param amount - Payment amount
       * @returns Cascade preview or null if error
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

          // Validate payment
          const validation = validatePaymentAmount(receipt, amount);
          if (!validation.valid) {
            set((state) => { state.error = validation.error || 'Invalid payment amount'; });
            return null;
          }

          // Get older unpaid receipts for cascade
          const receiptsRef = collection(db, 'receipts');
          const olderReceiptsQuery = query(
            receiptsRef,
            where('customerName', '==', receipt.customerName)
          );
          const olderReceiptsSnapshot = await getDocs(olderReceiptsQuery);

          const unpaidReceipts = olderReceiptsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as FirebaseReceipt))
            .filter(r => {
              const balance = (r.total || 0) - (r.amountPaid || 0);
              return balance > 0.01 && r.id !== receipt.id;
            });

          // Calculate cascade
          const cascadeResult = calculatePaymentCascade(receipt, amount, unpaidReceipts);

          const preview: CascadePreview = {
            receiptsAffected: cascadeResult.affectedReceipts,
            totalReceipts: cascadeResult.affectedReceipts.length,
            oldBalanceCleared: cascadeResult.oldBalanceCleared,
            remainingPayment: cascadeResult.remainingPayment,
          };

          set((state) => {
            state.cascadePreview = preview;
            state.error = null;
          });

          if (__DEV__) {
            console.log(`📋 [PaymentStore] Cascade preview: ${preview.totalReceipts} receipts, ₹${cascadeResult.oldBalanceCleared} oldBalance cleared`);
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
       * @param payment - Payment details
       * @returns Success status
       */
      recordPayment: async (payment: PaymentState): Promise<{ success: boolean; error?: string }> => {
        set((state) => {
          state.isProcessing = true;
          state.error = null;
        });

        try {
          const db = getFirebaseDb();
          if (!db) {
            throw new Error('Firebase not initialized');
          }

          // Validate input
          if (!payment.receiptId || payment.amount <= 0) {
            throw new Error('Invalid payment details');
          }

          // Get receipt
          const receiptRef = doc(db, 'receipts', payment.receiptId);
          const receiptDoc = await getDoc(receiptRef);

          if (!receiptDoc.exists()) {
            throw new Error('Receipt not found');
          }

          const receipt = { id: receiptDoc.id, ...receiptDoc.data() } as FirebaseReceipt;

          // Get older unpaid receipts
          const receiptsRef = collection(db, 'receipts');
          const olderReceiptsQuery = query(
            receiptsRef,
            where('customerName', '==', receipt.customerName)
          );
          const olderReceiptsSnapshot = await getDocs(olderReceiptsQuery);

          const unpaidReceipts = olderReceiptsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as FirebaseReceipt))
            .filter(r => {
              const balance = (r.total || 0) - (r.amountPaid || 0);
              return balance > 0.01 && r.id !== receipt.id;
            });

          // Calculate cascade
          const cascadeResult = calculatePaymentCascade(receipt, payment.amount, unpaidReceipts);

          // Create batch write
          const batch = writeBatch(db);

          // Update all affected receipts
          cascadeResult.affectedReceipts.forEach((affected) => {
            const ref = doc(db, 'receipts', affected.receipt.id);
            const newAmountPaid = (affected.receipt.amountPaid || 0) + affected.paymentToApply;
            const isPaid = affected.newBalance <= 0.01;

            const updateData: any = {
              amountPaid: newAmountPaid,
              newBalance: affected.newBalance,
              isPaid: isPaid,
              status: isPaid ? 'printed' : affected.receipt.status,
              updatedAt: serverTimestamp(),
            };

            // Clear oldBalance on primary receipt if cascade occurred
            if (affected.receipt.id === receipt.id && cascadeResult.oldBalanceCleared > 0) {
              const currentOldBalance = receipt.oldBalance || 0;
              const newOldBalance = Math.max(0, currentOldBalance - cascadeResult.oldBalanceCleared);
              updateData.oldBalance = newOldBalance;
              if (cascadeResult.oldBalanceCleared > 0) {
                updateData.oldBalanceCleared = cascadeResult.oldBalanceCleared;
              }
            }

            batch.update(ref, updateData);
          });

          // Create payment transaction record
          const paymentTransactionRef = doc(collection(db, 'payment_transactions'));
          batch.set(paymentTransactionRef, {
            receiptId: payment.receiptId,
            receiptNumber: receipt.receiptNumber,
            customerName: receipt.customerName || 'Walk-in Customer',
            amount: payment.amount,
            paymentMethod: payment.method,
            notes: payment.notes || '',
            timestamp: serverTimestamp(),
            affectedReceipts: cascadeResult.affectedReceipts.map(a => a.receipt.receiptNumber),
          });

          // Commit batch
          await batch.commit();

          if (__DEV__) {
            console.log(`✅ [PaymentStore] Payment of ₹${payment.amount} recorded successfully (${cascadeResult.affectedReceipts.length} receipts updated)`);
          }

          // Update balance store after payment
          useBalanceStore.getState().calculateBalance(receipt.customerName);

          set((state) => {
            state.isProcessing = false;
            state.currentPayment = null;
            state.cascadePreview = null;
          });

          return { success: true };
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

