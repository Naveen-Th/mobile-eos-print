import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useReceiptStore } from '../stores/receiptStore';
import { Receipt } from '../types';

/**
 * React Query hook for optimistic receipt creation
 * Provides instant UI feedback while receipt saves in background
 */
export function useReceiptMutation() {
  const queryClient = useQueryClient();
  const createReceipt = useReceiptStore(state => state.createReceipt);

  return useMutation({
    mutationFn: async () => {
      // Call the optimized createReceipt from store
      const result = await createReceipt();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create receipt');
      }
      
      return result.receipt!;
    },
    
    // Optimistic update: immediately update UI before server confirms
    onMutate: async () => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['receipts'] });
      
      // Return context with previous data for rollback
      const previousReceipts = queryClient.getQueryData<Receipt[]>(['receipts']);
      return { previousReceipts };
    },
    
    // On success: invalidate and refetch
    onSuccess: (newReceipt) => {
      // Optimistically add the new receipt to the cache
      queryClient.setQueryData<Receipt[]>(['receipts'], (old = []) => {
        return [newReceipt, ...old];
      });
      
      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      
      console.log('✅ Optimistic update: Receipt added to UI cache');
    },
    
    // On error: rollback optimistic update
    onError: (error, variables, context) => {
      if (context?.previousReceipts) {
        queryClient.setQueryData(['receipts'], context.previousReceipts);
      }
      console.error('❌ Receipt creation failed, rolled back:', error);
    },
    
    // Always refetch after error or success to sync with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}

/**
 * Hook for instant receipt creation feedback
 * Shows success immediately while operations complete in background
 */
export function useOptimisticReceiptCreation() {
  const mutation = useReceiptMutation();
  const clearForm = useReceiptStore(state => state.clearForm);

  const createReceiptOptimistic = async () => {
    try {
      await mutation.mutateAsync();
      
      // Clear form immediately on success
      clearForm();
      
      return { 
        success: true, 
        message: 'Receipt created! Background sync in progress...' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create receipt' 
      };
    }
  };

  return {
    createReceipt: createReceiptOptimistic,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
