import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ItemDetails } from '../types';

class ItemService {
  private static instance: ItemService;
  private readonly collectionName = 'item_details';
  
  // Real-time caching properties
  private cachedItems: ItemDetails[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private realtimeListener: Unsubscribe | null = null;
  private isListeningToRealtime: boolean = false;
  private changeCallbacks: Array<(items: ItemDetails[]) => void> = [];

  public static getInstance(): ItemService {
    if (!ItemService.instance) {
      ItemService.instance = new ItemService();
    }
    return ItemService.instance;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_DURATION;
  }

  /**
   * Get all items from the item_details collection with caching
   */
  public async getAllItems(): Promise<ItemDetails[]> {
    try {
      // If real-time listener is active, return cached data
      if (this.isListeningToRealtime && this.cachedItems.length >= 0) {
        return this.cachedItems;
      }
      
      // If cache is valid, return cached data
      if (this.isCacheValid() && this.cachedItems.length > 0) {
        return this.cachedItems;
      }
      
      // Otherwise, fetch from Firestore and update cache
      const colRef = collection(db, this.collectionName);
      const snapshot = await getDocs(colRef);
      
      const items: ItemDetails[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          item_name: data.item_name,
          price: data.price,
          stocks: data.stocks || 0
        });
      });
      
      // Update cache
      this.cachedItems = items;
      this.lastCacheUpdate = Date.now();
      
      return items;
    } catch (error) {
      console.error('Error fetching items:', error);
      // Return cached data if available, even if stale
      return this.cachedItems || [];
    }
  }

  /**
   * Create a new item
   */
  public async createItem(itemData: Omit<ItemDetails, 'id'>): Promise<string> {
    try {
      const colRef = collection(db, this.collectionName);
      const docRef = await addDoc(colRef, {
        item_name: itemData.item_name,
        price: itemData.price,
        stocks: itemData.stocks || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Item created with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  }

  /**
   * Update an existing item
   */
  public async updateItem(itemId: string, updates: Partial<Omit<ItemDetails, 'id'>>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, itemId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date()
      });
      
      console.log(`Item updated: ${itemId}`);
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }

  /**
   * Delete an item
   */
  public async deleteItem(itemId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, itemId);
      await deleteDoc(docRef);
      
      console.log(`Item deleted: ${itemId}`);
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  /**
   * Set up real-time listener for item changes
   */
  public setupRealtimeListener(): void {
    if (this.isListeningToRealtime || this.realtimeListener) {
      return; // Already listening
    }

    try {
      const colRef = collection(db, this.collectionName);

      this.realtimeListener = onSnapshot(
        colRef,
        (snapshot) => {
          console.log('🔄 Real-time update: Item data changed, processing', snapshot.docChanges().length, 'changes');
          
          // Log specific changes for debugging
          snapshot.docChanges().forEach((change, index) => {
            const data = change.doc.data();
            console.log(`  Change ${index + 1}: ${change.type} - Item: ${data.item_name} (${change.doc.id}), Stock: ${data.stocks}`);
          });
          
          const items: ItemDetails[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            items.push({
              id: doc.id,
              item_name: data.item_name,
              price: data.price,
              stocks: data.stocks || 0
            });
          });
          
          this.cachedItems = items;
          this.lastCacheUpdate = Date.now();
          
          console.log(`📊 Notifying ${this.changeCallbacks.length} subscribers with updated data`);
          
          // Notify all subscribers
          this.changeCallbacks.forEach((callback, index) => {
            try {
              console.log(`  📡 Calling subscriber ${index + 1}`);
              callback(items);
            } catch (error) {
              console.error('Error in item change callback:', error);
            }
          });
          
          console.log(`✅ Real-time update complete: ${items.length} items loaded`);
        },
        (error) => {
          console.error('Real-time item listener error:', error);
          this.isListeningToRealtime = false;
        }
      );

      this.isListeningToRealtime = true;
      console.log('Real-time item listener established');
    } catch (error) {
      console.error('Failed to setup real-time item listener:', error);
      this.isListeningToRealtime = false;
    }
  }

  /**
   * Force refresh item data from Firestore
   */
  public async forceRefresh(): Promise<void> {
    console.log('Force refreshing item data...');
    this.clearCache();
    
    // If we have a real-time listener, restart it
    if (this.isListeningToRealtime) {
      this.stopRealtimeListener();
      this.setupRealtimeListener();
    } else {
      // Otherwise, do a manual refresh
      await this.getAllItems();
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cachedItems = [];
    this.lastCacheUpdate = 0;
  }

  /**
   * Stop real-time listener
   */
  public stopRealtimeListener(): void {
    if (this.realtimeListener) {
      this.realtimeListener();
      this.realtimeListener = null;
    }
    this.isListeningToRealtime = false;
    this.changeCallbacks = [];
    console.log('Real-time item listener stopped');
  }

  /**
   * Subscribe to real-time updates from the items collection
   */
  public subscribeToItems(
    callback: (items: ItemDetails[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    try {
      // Add callback to list
      this.changeCallbacks.push(callback);
      
      // Setup real-time listener if not already active
      if (!this.isListeningToRealtime) {
        this.setupRealtimeListener();
      }
      
      // If we have cached data, immediately call the callback
      if (this.cachedItems.length > 0 || this.isCacheValid()) {
        try {
          callback(this.cachedItems);
        } catch (error) {
          console.error('Error in immediate item callback:', error);
          if (errorCallback) errorCallback(error as Error);
        }
      }
      
      // Return unsubscribe function
      return () => {
        const index = this.changeCallbacks.indexOf(callback);
        if (index > -1) {
          this.changeCallbacks.splice(index, 1);
        }
        
        // If no more callbacks, stop the listener
        if (this.changeCallbacks.length === 0) {
          this.stopRealtimeListener();
        }
      };
    } catch (error) {
      console.error('Error subscribing to items:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
      return () => {};
    }
  }
}

export default ItemService.getInstance();
