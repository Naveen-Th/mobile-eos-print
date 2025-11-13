import {
  database,
  itemsCollection,
  receiptsCollection,
  receiptItemsCollection,
  Item,
  Receipt,
} from '../../database';

/**
 * Offline-First Service
 * Provides a unified interface for data operations that work offline-first
 */
class OfflineFirstService {
  private static instance: OfflineFirstService;

  private constructor() {}

  public static getInstance(): OfflineFirstService {
    if (!OfflineFirstService.instance) {
      OfflineFirstService.instance = new OfflineFirstService();
    }
    return OfflineFirstService.instance;
  }

  /**
   * Initialize offline-first functionality
   */
  public async initialize(): Promise<void> {
    console.log('✅ SQLite offline-first service initialized');
  }

  // ==================== ITEMS ====================

  /**
   * Get all items (from local DB)
   */
  public async getItems(): Promise<Item[]> {
    const items = await itemsCollection.query().fetch();
    return items as Item[];
  }

  /**
   * Get item by ID
   */
  public async getItemById(id: string): Promise<Item | null> {
    try {
      const item = await itemsCollection.find(id);
      return item as Item;
    } catch {
      return null;
    }
  }

  /**
   * Create new item
   */
  public async createItem(itemData: {
    item_name: string;
    price: number;
    stocks?: number;
  }): Promise<Item> {
    const item = await itemsCollection.create((record: any) => {
      record.firebaseId = `temp-${Date.now()}`;
      record.itemName = itemData.item_name;
      record.price = itemData.price;
      record.stocks = itemData.stocks || 0;
      record.isSynced = false;
    });

    console.log(`✅ Item created locally: ${item.id}`);
    return item as Item;
  }

  /**
   * Update item
   */
  public async updateItem(
    itemId: string,
    updates: Partial<{ item_name: string; price: number; stocks: number }>
  ): Promise<void> {
    if (!database) throw new Error('Database not initialized');
    
    const item = await itemsCollection.find(itemId) as any;
    if (!item) throw new Error('Item not found');
    
    const updateValues: string[] = [];
    const updateParams: any[] = [];
    
    if (updates.item_name !== undefined) {
      updateValues.push('item_name = ?');
      updateParams.push(updates.item_name);
    }
    if (updates.price !== undefined) {
      updateValues.push('price = ?');
      updateParams.push(updates.price);
    }
    if (updates.stocks !== undefined) {
      updateValues.push('stocks = ?');
      updateParams.push(updates.stocks);
    }
    
    updateValues.push('is_synced = ?', 'updated_at = ?');
    updateParams.push(0, Date.now(), itemId);
    
    database.runSync(
      `UPDATE items SET ${updateValues.join(', ')} WHERE id = ?`,
      updateParams
    );

    console.log(`✅ Item updated locally: ${itemId}`);
  }

  /**
   * Delete item
   */
  public async deleteItem(itemId: string): Promise<void> {
    if (!database) throw new Error('Database not initialized');
    
    database.runSync('DELETE FROM items WHERE id = ?', [itemId]);
    console.log(`✅ Item deleted locally: ${itemId}`);
  }

  // ==================== RECEIPTS ====================

  /**
   * Get all receipts (from local DB)
   */
  public async getReceipts(): Promise<any[]> {
    const receipts = await receiptsCollection.query().fetch();
    return receipts;
  }

  /**
   * Get receipt by ID with items
   */
  public async getReceiptById(id: string): Promise<{
    receipt: Receipt;
    items: any[];
  } | null> {
    try {
      if (!database) return null;
      
      const receipt = await receiptsCollection.find(id);
      if (!receipt) return null;
      
      const items = database.getAllSync(
        'SELECT * FROM receipt_items WHERE receipt_id = ?',
        [id]
      );
      
      return {
        receipt: receipt as Receipt,
        items: items.map((item: any) => ({
          id: item.id,
          itemId: item.item_id,
          itemName: item.item_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      };
    } catch {
      return null;
    }
  }

  /**
   * Create new receipt
   */
  public async createReceipt(receiptData: {
    receiptNumber: string;
    customerName: string;
    customerPhone?: string;
    customerAddress?: string;
    items: Array<{
      itemId?: string;
      itemName: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    printMethod?: string;
    printed?: boolean;
    status?: string;
    notes?: string;
  }): Promise<Receipt> {
    const newReceipt = await receiptsCollection.create((record) => {
      record.firebaseId = `temp-${Date.now()}`;
      record.receiptNumber = receiptData.receiptNumber;
      record.customerName = receiptData.customerName;
      record.customerPhone = receiptData.customerPhone;
      record.customerAddress = receiptData.customerAddress;
      record.subtotal = receiptData.subtotal;
      record.tax = receiptData.tax;
      record.total = receiptData.total;
      record.date = new Date();
      record.printMethod = receiptData.printMethod;
      record.printed = receiptData.printed || false;
      record.status = receiptData.status || 'draft';
      record.notes = receiptData.notes;
      record.isSynced = false;
    });

    // Create receipt items
    for (const itemData of receiptData.items) {
      await receiptItemsCollection.create((record) => {
        record.receiptId = newReceipt.id;
        record.itemId = itemData.itemId;
        record.itemName = itemData.itemName;
        record.quantity = itemData.quantity;
        record.price = itemData.price;
        record.total = itemData.total;
      });
    }

    console.log(`✅ Receipt created locally: ${newReceipt.id}`);
    return newReceipt as Receipt;
  }

  /**
   * Delete receipt
   */
  public async deleteReceipt(receiptId: string): Promise<void> {
    if (!database) throw new Error('Database not initialized');
    
    // Delete associated items
    database.runSync('DELETE FROM receipt_items WHERE receipt_id = ?', [receiptId]);
    
    // Delete receipt
    database.runSync('DELETE FROM receipts WHERE id = ?', [receiptId]);
    
    console.log(`✅ Receipt deleted locally: ${receiptId}`);
  }

  // ==================== SYNC OPERATIONS ====================
  // Note: Sync operations are handled separately via SyncEngine and Firebase services
}

export default OfflineFirstService.getInstance();
