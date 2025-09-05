import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  Unsubscribe,
  increment,
  runTransaction,
  writeBatch,
  serverTimestamp
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
   * Add stock to an item using atomic transaction
   */
  public async addStock(itemId: string, quantity: number, reason?: string): Promise<{ success: boolean; newStock: number; error?: string }> {
    try {
      if (!itemId || typeof itemId !== 'string') {
        throw new Error('Valid item ID is required');
      }
      
      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      if (quantity > 999999) {
        throw new Error('Quantity too large. Maximum allowed is 999,999');
      }

      const docRef = doc(db, this.collectionName, itemId);
      
      // Use Firebase transaction for atomic operation
      const result = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        
        if (!docSnap.exists()) {
          throw new Error(`Item not found: ${itemId}`);
        }

        const currentData = docSnap.data();
        const currentStock = typeof currentData.stocks === 'number' ? currentData.stocks : 0;
        const newStock = currentStock + quantity;

        // Business rule: Maximum stock limit
        if (newStock > 999999) {
          throw new Error(`Cannot add stock. Maximum stock limit (999,999) would be exceeded. Current: ${currentStock}, Requested: ${quantity}`);
        }

        // Update with transaction
        transaction.update(docRef, {
          stocks: newStock,
          updatedAt: serverTimestamp(),
          lastStockUpdate: {
            type: 'add',
            quantity: quantity,
            reason: reason || 'Manual addition',
            timestamp: serverTimestamp()
          }
        });

        return newStock;
      });
      
      console.log(`Successfully added ${quantity} stock to item: ${itemId}. New stock: ${result}`);
      return { success: true, newStock: result };
    } catch (error: any) {
      console.error('Error adding stock:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error.code === 'not-found') {
        errorMessage = 'Item no longer exists';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied: Cannot update stock';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, newStock: 0, error: errorMessage };
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
   * Subtract stock from an item (for sales) using atomic transaction
   */
  public async subtractStock(itemId: string, quantity: number, reason?: string, receiptId?: string): Promise<{ success: boolean; newStock: number; error?: string }> {
    try {
      if (!itemId || typeof itemId !== 'string') {
        throw new Error('Valid item ID is required');
      }
      
      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      if (quantity > 9999) {
        throw new Error('Quantity too large. Maximum allowed per transaction is 9,999');
      }

      const docRef = doc(db, this.collectionName, itemId);
      
      // Use Firebase transaction for atomic operation
      const result = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        
        if (!docSnap.exists()) {
          throw new Error(`Item not found: ${itemId}`);
        }

        const currentData = docSnap.data();
        const currentStock = typeof currentData.stocks === 'number' ? currentData.stocks : 0;
        
        // Critical business rule: Prevent negative stock
        if (currentStock < quantity) {
          throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
        }

        const newStock = currentStock - quantity;

        // Update with transaction
        transaction.update(docRef, {
          stocks: newStock,
          updatedAt: serverTimestamp(),
          lastStockUpdate: {
            type: 'subtract',
            quantity: quantity,
            reason: reason || 'Sale',
            receiptId: receiptId || null,
            timestamp: serverTimestamp()
          }
        });

        return newStock;
      });
      
      console.log(`Successfully subtracted ${quantity} stock from item: ${itemId}. New stock: ${result}`);
      return { success: true, newStock: result };
    } catch (error: any) {
      console.error('Error subtracting stock:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error.code === 'not-found') {
        errorMessage = 'Item no longer exists';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied: Cannot update stock';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, newStock: 0, error: errorMessage };
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
   * Bulk update stocks for multiple items using batch operation
   */
  public async bulkUpdateStocks(updates: StockUpdateData[], reason?: string): Promise<{ success: boolean; results: Array<{ itemId: string; success: boolean; newStock?: number; error?: string }> }> {
    const results: Array<{ itemId: string; success: boolean; newStock?: number; error?: string }> = [];
    
    try {
      // Validate all updates first
      for (const update of updates) {
        if (!update.itemId || typeof update.itemId !== 'string') {
          throw new Error('All items must have valid IDs');
        }
        if (typeof update.quantity !== 'number' || update.quantity <= 0) {
          throw new Error('All quantities must be positive numbers');
        }
      }

      // For bulk operations, we'll use individual transactions to ensure atomicity
      // This is safer than a single large transaction that might timeout
      const promises = updates.map(async (update) => {
        try {
          let result;
          switch (update.operation) {
            case 'add':
              result = await this.addStock(update.itemId, update.quantity, reason);
              break;
            case 'subtract':
              result = await this.subtractStock(update.itemId, update.quantity, reason);
              break;
            case 'set':
              result = await this.updateStock(update.itemId, update.quantity);
              break;
            default:
              throw new Error(`Invalid operation: ${update.operation}`);
          }
          
          return {
            itemId: update.itemId,
            success: result.success,
            newStock: result.newStock,
            error: result.error
          };
        } catch (error: any) {
          return {
            itemId: update.itemId,
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      const allResults = await Promise.allSettled(promises);
      
      allResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            itemId: 'unknown',
            success: false,
            error: result.reason?.message || 'Promise rejected'
          });
        }
      });

      const successCount = results.filter(r => r.success).length;
      console.log(`Bulk stock update completed: ${successCount}/${updates.length} successful`);
      
      return {
        success: successCount === updates.length,
        results
      };
    } catch (error: any) {
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
  public async hasSufficientStock(itemId: string, requiredQuantity: number): Promise<boolean> {
    try {
      if (!itemId || typeof itemId !== 'string') {
        console.error('Invalid item ID provided to hasSufficientStock');
        return false;
      }
      
      if (requiredQuantity <= 0) {
        console.error('Invalid quantity provided to hasSufficientStock');
        return false;
      }
      
      const currentStock = await this.getItemStock(itemId);
      return currentStock >= requiredQuantity;
    } catch (error) {
      console.error('Error checking stock availability:', error);
      return false;
    }
  }
  
  /**
   * @deprecated Use hasSufficientStock instead
   */
  public async hasLuckyStock(itemId: string, requiredQuantity: number): Promise<boolean> {
    console.warn('hasLuckyStock is deprecated. Use hasSufficientStock instead.');
    return this.hasSufficientStock(itemId, requiredQuantity);
  }
}

export default StockService.getInstance();
