import { useEffect, useCallback, useMemo } from 'react';
import { useReceiptStore } from '../stores/receiptStore';
import { useShallow } from 'zustand/react/shallow';
import ItemService from '../services/data/ItemService';

/**
 * Custom hook to integrate the receipt store with existing item management
 * This provides backward compatibility and cleaner integration
 */
export const useReceiptIntegration = (visible: boolean) => {
  // Select only the actions we need (these are stable references)
  const actions = useReceiptStore(
    useShallow((state) => ({
      setAvailableItems: state.setAvailableItems,
      setItemsLoading: state.setItemsLoading,
      setItemsError: state.setItemsError,
      calculateTotals: state.calculateTotals,
      loadTaxRate: state.loadTaxRate,
      addFormItem: state.addFormItem,
      removeFormItem: state.removeFormItem,
      updateFormItem: state.updateFormItem,
      selectItem: state.selectItem,
      updateCustomerInfo: state.updateCustomerInfo,
      updateBalanceInfo: state.updateBalanceInfo,
      validateForm: state.validateForm,
      createReceipt: state.createReceipt,
      clearForm: state.clearForm,
      setError: state.setError,
      clearError: state.clearError,
    }))
  );

  // Select state slices separately with useShallow to prevent unnecessary re-renders
  const formItems = useReceiptStore((state) => state.formItems);
  const customer = useReceiptStore(useShallow((state) => state.customer));
  const balance = useReceiptStore(useShallow((state) => state.balance));
  const availableItems = useReceiptStore((state) => state.availableItems);
  const isLoadingItems = useReceiptStore((state) => state.isLoadingItems);
  const itemsError = useReceiptStore((state) => state.itemsError);
  const isProcessing = useReceiptStore((state) => state.isProcessing);
  const errors = useReceiptStore(useShallow((state) => state.errors));
  const receiptTotals = useReceiptStore(useShallow((state) => state.receiptTotals));
  const taxRate = useReceiptStore((state) => state.taxRate);

  // Combine into store object for backward compatibility
  const store = useMemo(() => ({
    formItems,
    customer,
    balance,
    availableItems,
    isLoadingItems,
    itemsError,
    isProcessing,
    errors,
    receiptTotals,
    taxRate,
    ...actions,
  }), [
    formItems,
    customer,
    balance,
    availableItems,
    isLoadingItems,
    itemsError,
    isProcessing,
    errors,
    receiptTotals,
    taxRate,
    actions,
  ]);
  
  // Note: Totals calculation is handled automatically by the store when data changes
  // No need to trigger it manually here to avoid infinite loops

  // Subscribe to items and load tax rate when component becomes visible
  useEffect(() => {
    if (visible) {
      console.log('📱 Receipt screen became visible - loading items...');
      actions.setItemsLoading(true);
      actions.setItemsError(null);
      
      // Load current tax rate
      actions.loadTaxRate();
      
      // Add timeout to prevent indefinite loading
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Items loading timeout - forcing error state');
        actions.setItemsError('Loading items took too long. Please try again.');
      }, 10000); // 10 second timeout
      
      const unsubscribe = ItemService.subscribeToItems(
        (items) => {
          clearTimeout(timeoutId);
          console.log('✅ Received real-time items update:', items.length, 'items');
          actions.setAvailableItems(items);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('❌ Error subscribing to items:', error);
          actions.setItemsError('Failed to load items. Please try again.');
        }
      );

      return () => {
        console.log('🔚 Receipt screen cleanup');
        clearTimeout(timeoutId);
        unsubscribe();
      };
    } else {
      // Reset state when modal closes to prevent stale data
      console.log('👋 Receipt screen hidden - resetting items state');
      actions.setItemsLoading(true);
      actions.setItemsError(null);
    }
  }, [visible, actions]);

  // Provide compatibility layer for existing cart-like functionality
  // Memoize to prevent unnecessary recalculations
  const cartCompatibility = useMemo(() => ({
    items: formItems.map(formItem => {
      const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
      return {
        id: formItem.id,
        name: selectedItem?.item_name || '',
        price: parseFloat(formItem.price) || 0,
        quantity: parseInt(formItem.quantity) || 0,
      };
    }).filter(item => item.name && item.price > 0 && item.quantity > 0),
    
    subtotal: receiptTotals.subtotal,
    tax: receiptTotals.tax,
    total: receiptTotals.total,
    
    customerName: customer.customerName,
    businessName: (customer as any).businessName,
    businessPhone: (customer as any).businessPhone,
  }), [formItems, availableItems, receiptTotals, customer]);

  return {
    store,
    cartCompatibility,
  };
};

export default useReceiptIntegration;
