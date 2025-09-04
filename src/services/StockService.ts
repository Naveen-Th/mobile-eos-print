import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  Unsubscribe,
  increment 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ItemDetails } from '../types';

interface StockUpdateData {
  itemId: string;
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
}

class StockService {
  private static instance: StockService;
  private readonly collectionName = 'item_details';

  public static getInstance(): StockService {
    if (!StockService.instance) {
      StockService.instance = new StockService();
    }
    return StockService.instance;
  }

  /**
   * Add stock to an item
   */
  public async addStock(itemId: string, quantity: number): Promise<void> {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      // Validate that the item exists before attempting stock update
      const docRef = doc(db, this.collectionName, itemId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error(`Item not found: ${itemId}`);
      }

      await updateDoc(docRef, {
        stocks: increment(quantity),
        updatedAt: new Date()
      });
      
      console.log(`Successfully added ${quantity} stock to item: ${itemId}`);
    } catch (error) {
      console.error('Error adding stock:', error);
      // Re-throw with more specific error message
      if (error.code === 'not-found') {
        throw new Error('Item no longer exists');
      }
      throw error;
    }
  }

  /**
   * Update stock for an item (set to specific value)
   */
  public async updateStock(itemId: string, newStockLevel: number): Promise<void> {
    try {
      if (newStockLevel < 0) {
        throw new Error('Stock level cannot be negative');
      }

      const docRef = doc(db, this.collectionName, itemId);
      await updateDoc(docRef, {
        stocks: newStockLevel,
        updatedAt: new Date()
      });
      
      console.log(`Updated stock for item ${itemId} to: ${newStockLevel}`);
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  /**
   * Subtract stock from an item (for sales)
   */
  public async subtractStock(itemId: string, quantity: number): Promise<void> {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      // First check current stock level and validate item exists
      const docRef = doc(db, this.collectionName, itemId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error(`Item not found: ${itemId}`);
      }
      
      const currentStock = docSnap.data().stocks || 0;
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
      }

      await updateDoc(docRef, {
        stocks: increment(-quantity),
        updatedAt: new Date()
      });
      
      console.log(`Successfully subtracted ${quantity} stock from item: ${itemId}`);
    } catch (error) {
      console.error('Error subtracting stock:', error);
      // Re-throw with more specific error message
      if (error.code === 'not-found') {
        throw new Error('Item no longer exists');
      }
      throw error;
    }
  }

  /**
   * Get current stock level for a specific item
   */
  public async getItemStock(itemId: string): Promise<number> {
    try {
      const docRef = doc(db, this.collectionName, itemId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.stocks || 0;
      } else {
        throw new Error(`Item not found: ${itemId}`);
      }
    } catch (error) {
      console.error('Error getting item stock:', error);
      throw error;
    }
  }

  /**
   * Bulk update stocks for multiple items
   */
  public async bulkUpdateStocks(updates: StockUpdateData[]): Promise<void> {
    try {
      const promises = updates.map(async (update) => {
        switch (update.operation) {
          case 'add':
            return this.addStock(update.itemId, update.quantity);
          case 'subtract':
            return this.subtractStock(update.itemId, update.quantity);
          case 'set':
            return this.updateStock(update.itemId, update.quantity);
          default:
            throw new Error(`Invalid operation: ${update.operation}`);
        }
      });

      await Promise.all(promises);
      console.log(`Bulk stock update completed for ${updates.length} items`);
    } catch (error) {
      console.error('Error in bulk stock update:', error);
      throw error;
    }
  }

  /**
   * Get all items with low stock (below threshold)
   */
  public async getLowStockItems(threshold: number = 50): Promise<ItemDetails[]> {
    try {
      const colRef = collection(db, this.collectionName);
      
      return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(
          colRef,
          (snapshot) => {
            const lowStockItems: ItemDetails[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              const stocks = data.stocks || 0;
              
              if (stocks <= threshold) {
                lowStockItems.push({
                  id: doc.id,
                  item_name: data.item_name,
                  price: data.price,
                  stocks: stocks
                });
              }
            });
            unsubscribe();
            resolve(lowStockItems);
          },
          (error) => {
            unsubscribe();
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Error getting low stock items:', error);
      throw error;
    }
  }

  /**
   * Subscribe to stock changes for a specific item
   */
  public subscribeToItemStock(
    itemId: string,
    callback: (stock: number) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    try {
      const docRef = doc(db, this.collectionName, itemId);
      
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            callback(data.stocks || 0);
          } else {
            callback(0);
          }
        },
        (error) => {
          console.error('Error in stock subscription:', error);
          if (errorCallback) {
            errorCallback(error);
          }
        }
      );
      
      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to item stock:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
      return () => {};
    }
  }

  /**
   * Check if item has sufficient stock
   */
  public async hasLuckyStock(itemId: string, requiredQuantity: number): Promise<boolean> {
    try {
      const currentStock = await this.getItemStock(itemId);
      return currentStock >= requiredQuantity;
    } catch (error) {
      console.error('Error checking stock availability:', error);
      return false;
    }
  }
}

export default StockService.getInstance();
