import { useState, useEffect } from 'react';
import FirebaseService from '../services/auth/FirebaseService';
import { ItemDetails } from '../types';

interface UseItemDetailsReturn {
  itemDetails: ItemDetails[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useItemDetails = (): UseItemDetailsReturn => {
  const [itemDetails, setItemDetails] = useState<ItemDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItemDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const items = await FirebaseService.getItemDetails();
      
      // Transform the data to match our ItemDetails interface
      const transformedItems: ItemDetails[] = items.map(item => ({
        id: item.id,
        item_name: item.item_name || '',
        price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
        stocks: typeof item.stocks === 'number' ? item.stocks : parseFloat(item.stocks) || 0,
      }));
      
      setItemDetails(transformedItems);
    } catch (err) {
      console.error('Error fetching item details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch item details');
      setItemDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await fetchItemDetails();
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupRealtimeListener = () => {
      try {
        unsubscribe = FirebaseService.subscribeToItemDetails(
          (items) => {
            const transformedItems: ItemDetails[] = items.map(item => ({
              id: item.id,
              item_name: item.item_name || '',
              price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
              stocks: typeof item.stocks === 'number' ? item.stocks : parseFloat(item.stocks) || 0,
            }));
            
            setItemDetails(transformedItems);
            setIsLoading(false);
            setError(null);
          },
          (error) => {
            console.error('Error in item details subscription:', error);
            setError(error.message);
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up real-time listener:', err);
        // Fall back to one-time fetch if real-time fails
        fetchItemDetails();
      }
    };

    setupRealtimeListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return {
    itemDetails,
    isLoading,
    error,
    refetch,
  };
};
