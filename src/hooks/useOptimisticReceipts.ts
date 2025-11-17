/**
 * Optimistic Updates for Receipts
 * 
 * Provides instant UI updates while syncing changes to Firebase in the background.
 * Automatically rolls back on errors.
 * 
 * Usage:
 * const updateReceipt = useOptimisticReceiptUpdate();
 * updateReceipt.mutate({ id: '123', data: { status: 'paid', amountPaid: 100 } });
 * // UI updates INSTANTLY! ⚡
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

interface Receipt {
  id: string;
  [key: string]: any;
}

interface UpdateReceiptParams {
  id: string;
  data: Partial<Receipt>;
}

interface AddReceiptParams {
  data: Omit<Receipt, 'id'>;
}

/**
 * Optimistic receipt update mutation
 * Updates UI immediately, syncs to Firebase in background
 */
export function useOptimisticReceiptUpdate() {
  const queryClient = useQueryClient();
  const db = getFirebaseDb();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateReceiptParams) => {
      if (!db) throw new Error('Firestore not initialized');
      const receiptRef = doc(db, 'receipts', id);
      await updateDoc(receiptRef, data);
      return { id, data };
    },
    
    // ⚡ OPTIMISTIC UPDATE: Update UI immediately
    onMutate: async (newReceipt) => {
      // Cancel any outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries({ queryKey: ['receipts'] });
      
      // Snapshot the previous value for rollback
      const previousReceipts = queryClient.getQueryData(['receipts']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['receipts'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((receipt: Receipt) => 
          receipt.id === newReceipt.id 
            ? { ...receipt, ...newReceipt.data }
            : receipt
        );
      });
      
      console.log('⚡ Optimistic update applied for receipt:', newReceipt.id);
      
      // Return snapshot for potential rollback
      return { previousReceipts };
    },
    
    // 🔄 ROLLBACK: Restore previous state on error
    onError: (err, newReceipt, context) => {
      if (context?.previousReceipts) {
        queryClient.setQueryData(['receipts'], context.previousReceipts);
        console.error('❌ Receipt update failed, rolled back:', err);
      }
    },
    
    // ✅ SYNC: Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
    
    // Show success/error messages
    onSuccess: (data) => {
      console.log('✅ Receipt updated successfully:', data.id);
    },
  });
}

/**
 * Optimistic receipt creation
 * Shows new receipt immediately in list while syncing
 */
export function useOptimisticReceiptCreate() {
  const queryClient = useQueryClient();
  const db = getFirebaseDb();

  return useMutation({
    mutationFn: async ({ data }: AddReceiptParams) => {
      if (!db) throw new Error('Firestore not initialized');
      const receiptsRef = collection(db, 'receipts');
      const docRef = await addDoc(receiptsRef, {
        ...data,
        createdAt: new Date().toISOString(),
      });
      return { id: docRef.id, ...data };
    },
    
    onMutate: async (newReceipt) => {
      await queryClient.cancelQueries({ queryKey: ['receipts'] });
      const previousReceipts = queryClient.getQueryData(['receipts']);
      
      // Add temporary receipt with temp ID
      const tempId = `temp_${Date.now()}`;
      queryClient.setQueryData(['receipts'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return [{ id: tempId, ...newReceipt.data }, ...old];
      });
      
      console.log('⚡ Optimistic create applied');
      return { previousReceipts, tempId };
    },
    
    onError: (err, newReceipt, context) => {
      if (context?.previousReceipts) {
        queryClient.setQueryData(['receipts'], context.previousReceipts);
        console.error('❌ Receipt creation failed, rolled back:', err);
      }
    },
    
    onSuccess: (data) => {
      console.log('✅ Receipt created successfully:', data.id);
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}

/**
 * Optimistic receipt deletion
 * Removes from UI immediately
 */
export function useOptimisticReceiptDelete() {
  const queryClient = useQueryClient();
  const db = getFirebaseDb();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error('Firestore not initialized');
      const receiptRef = doc(db, 'receipts', id);
      await deleteDoc(receiptRef);
      return id;
    },
    
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['receipts'] });
      const previousReceipts = queryClient.getQueryData(['receipts']);
      
      // Remove from UI immediately
      queryClient.setQueryData(['receipts'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((receipt: Receipt) => receipt.id !== deletedId);
      });
      
      console.log('⚡ Optimistic delete applied for receipt:', deletedId);
      return { previousReceipts };
    },
    
    onError: (err, deletedId, context) => {
      if (context?.previousReceipts) {
        queryClient.setQueryData(['receipts'], context.previousReceipts);
        console.error('❌ Receipt deletion failed, rolled back:', err);
      }
    },
    
    onSuccess: (id) => {
      console.log('✅ Receipt deleted successfully:', id);
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}
