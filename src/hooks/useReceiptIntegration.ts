import { useEffect, useCallback, useMemo } from 'react';
import { useReceiptStore } from '../stores/receiptStore';
import ItemService from '../services/data/ItemService';

/**
 * Custom hook to integrate the receipt store with existing item management
 * This provides backward compatibility and cleaner integration
 */
export const useReceiptIntegration = (visible: boolean) => {
  const {
    setAvailableItems,
    setItemsLoading,
    setItemsError,
    calculateTotals,
    loadTaxRate
  } = useReceiptStore();

  // Get store data
  const store = useReceiptStore();
  
  // Note: Totals calculation is handled automatically by the store when data changes
  // No need to trigger it manually here to avoid infinite loops

  // Subscribe to items and load tax rate when component becomes visible
  useEffect(() => {
    if (visible) {
      console.log('📱 Receipt screen became visible - loading items...');
      setItemsLoading(true);
      setItemsError(null);
      
      // Load current tax rate
      loadTaxRate();
      
      // Add timeout to prevent indefinite loading
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Items loading timeout - forcing error state');
        setItemsError('Loading items took too long. Please try again.');
      }, 10000); // 10 second timeout
      
      const unsubscribe = ItemService.subscribeToItems(
        (items) => {
          clearTimeout(timeoutId);
          console.log('✅ Received real-time items update:', items.length, 'items');
          setAvailableItems(items);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('❌ Error subscribing to items:', error);
          setItemsError('Failed to load items. Please try again.');
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
      setItemsLoading(true);
      setItemsError(null);
    }
  }, [visible, setAvailableItems, setItemsLoading, setItemsError, loadTaxRate]);

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
