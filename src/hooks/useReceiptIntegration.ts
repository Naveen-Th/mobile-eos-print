import { useEffect, useCallback } from 'react';
import { useReceiptStore } from '../stores/receiptStore';
import ItemService from '../services/ItemService';

/**
 * Custom hook to integrate the receipt store with existing item management
 * This provides backward compatibility and cleaner integration
 */
export const useReceiptIntegration = (visible: boolean) => {
  const {
    setAvailableItems,
    setItemsLoading,
    setItemsError,
    calculateTotals
  } = useReceiptStore();

  // Auto-calculate totals when form items change
  const store = useReceiptStore();
  
  useEffect(() => {
    calculateTotals();
  }, [store.formItems, calculateTotals]);

  // Subscribe to items when component becomes visible
  useEffect(() => {
    if (visible) {
      setItemsLoading(true);
      
      const unsubscribe = ItemService.subscribeToItems(
        (items) => {
          console.log('Received real-time items update:', items.length, 'items');
          setAvailableItems(items);
        },
        (error) => {
          console.error('Error subscribing to items:', error);
          setItemsError('Failed to load items. Please try again.');
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [visible, setAvailableItems, setItemsLoading, setItemsError]);

  // Provide compatibility layer for existing cart-like functionality
  const cartCompatibility = {
    items: store.formItems.map(formItem => {
      const selectedItem = store.availableItems.find(item => item.id === formItem.selectedItemId);
      return {
        id: formItem.id,
        name: selectedItem?.item_name || '',
        price: parseFloat(formItem.price) || 0,
        quantity: parseInt(formItem.quantity) || 0,
      };
    }).filter(item => item.name && item.price > 0 && item.quantity > 0),
    
    subtotal: store.receiptTotals.subtotal,
    tax: store.receiptTotals.tax,
    total: store.receiptTotals.total,
    
    customerName: store.customer.customerName,
    businessName: store.customer.businessName,
    businessPhone: store.customer.businessPhone,
  };

  return {
    store,
    cartCompatibility,
  };
};

export default useReceiptIntegration;
