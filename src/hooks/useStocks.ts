import { useState, useCallback } from 'react';
import StockService from '../services/data/StockService';
import { ItemDetails } from '../types';

interface UseStocksReturn {
  isLoading: boolean;
  error: string | null;
  addStock: (itemId: string, quantity: number) => Promise<void>;
  updateStock: (itemId: string, newStockLevel: number) => Promise<void>;
  subtractStock: (itemId: string, quantity: number) => Promise<void>;
  getItemStock: (itemId: string) => Promise<number>;
  checkStockAvailability: (itemId: string, requiredQuantity: number) => Promise<boolean>;
  getLowStockItems: (threshold?: number) => Promise<ItemDetails[]>;
  bulkUpdateStocks: (updates: Array<{itemId: string; quantity: number; operation: 'add' | 'subtract' | 'set'}>) => Promise<void>;
}

export const useStocks = (): UseStocksReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsyncOperation = async <T>(
    operation: () => Promise<T>,
    loadingMessage?: string
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);
      if (loadingMessage) {
        console.log(loadingMessage);
      }
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Stock operation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const addStock = useCallback(async (itemId: string, quantity: number): Promise<void> => {
    await handleAsyncOperation(
      () => StockService.addStock(itemId, quantity),
      `Adding ${quantity} stock to item ${itemId}`
    );
  }, []);

  const updateStock = useCallback(async (itemId: string, newStockLevel: number): Promise<void> => {
    await handleAsyncOperation(
      () => StockService.updateStock(itemId, newStockLevel),
      `Updating stock for item ${itemId} to ${newStockLevel}`
    );
  }, []);

  const subtractStock = useCallback(async (itemId: string, quantity: number): Promise<void> => {
    await handleAsyncOperation(
      () => StockService.subtractStock(itemId, quantity),
      `Subtracting ${quantity} stock from item ${itemId}`
    );
  }, []);

  const getItemStock = useCallback(async (itemId: string): Promise<number> => {
    const result = await handleAsyncOperation(
      () => StockService.getItemStock(itemId),
      `Getting stock for item ${itemId}`
    );
    return result || 0;
  }, []);

  const checkStockAvailability = useCallback(async (itemId: string, requiredQuantity: number): Promise<boolean> => {
    const result = await handleAsyncOperation(
      () => StockService.hasLuckyStock(itemId, requiredQuantity),
      `Checking stock availability for item ${itemId}`
    );
    return result || false;
  }, []);

  const getLowStockItems = useCallback(async (threshold: number = 10): Promise<ItemDetails[]> => {
    const result = await handleAsyncOperation(
      () => StockService.getLowStockItems(threshold),
      `Getting items with low stock (threshold: ${threshold})`
    );
    return result || [];
  }, []);

  const bulkUpdateStocks = useCallback(async (
    updates: Array<{itemId: string; quantity: number; operation: 'add' | 'subtract' | 'set'}>
  ): Promise<void> => {
    await handleAsyncOperation(
      () => StockService.bulkUpdateStocks(updates),
      `Bulk updating stocks for ${updates.length} items`
    );
  }, []);

  return {
    isLoading,
    error,
    addStock,
    updateStock,
    subtractStock,
    getItemStock,
    checkStockAvailability,
    getLowStockItems,
    bulkUpdateStocks,
  };
};
