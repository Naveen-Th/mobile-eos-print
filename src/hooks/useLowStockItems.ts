import { useQuery } from '@tanstack/react-query';
import { useItems } from './useSyncManager';
import { ItemDetails } from '../types';
import { useMemo } from 'react';

interface LowStockItem extends ItemDetails {
  lowStockThreshold?: number;
  quantity: number;
}

export function useLowStockItems() {
  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useItems();

  // Use useMemo to compute low stock items from the live items data
  const lowStockItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    // Filter items where quantity is below threshold
    const filtered: LowStockItem[] = items
      .map(item => ({
        ...item,
        quantity: item.stocks || 0,
        lowStockThreshold: item.lowStockThreshold || 10,
      }))
      .filter(item => item.quantity < (item.lowStockThreshold || 10))
      .sort((a, b) => a.quantity - b.quantity); // Sort by quantity, lowest first

    return filtered;
  }, [items]);

  return {
    data: lowStockItems,
    isLoading: itemsLoading,
    error: itemsError,
    refetch: () => {}, // Items are already live-updated via real-time listener
  };
}
