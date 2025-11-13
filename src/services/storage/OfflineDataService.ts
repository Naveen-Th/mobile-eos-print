import { getDatabase, isDatabaseReady } from '../../database';
import NetInfo from '@react-native-community/netinfo';

/**
 * Offline-First Data Service
 * 
 * This service provides optimized data access for all screens:
 * - Reads from SQLite first (instant offline access)
 * - Falls back to Firebase only when needed
 * - Caches everything for optimal performance
 */

export interface QueryOptions {
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  statusFilter?: string;
}

class OfflineDataService {
  private static instance: OfflineDataService;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds cache for memory

  private constructor() {}

  public static getInstance(): OfflineDataService {
    if (!OfflineDataService.instance) {
      OfflineDataService.instance = new OfflineDataService();
    }
    return OfflineDataService.instance;
  }

  /**
   * Get network status
   */
  private async isOnline(): Promise<boolean> {
    const netState = await NetInfo.fetch();
    return netState.isConnected ?? false;
  }

  /**
   * Memory cache helper
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`📦 Returning cached data for ${key}`);
      return cached.data as T;
    }
    return null;
  }

  private setCached(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get all items (optimized for Items screen)
   */
  public async getItems(options: QueryOptions = {}): Promise<any[]> {
    const cacheKey = `items_${JSON.stringify(options)}`;
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database || !isDatabaseReady()) {
      console.error('❌ Database not initialized - cannot fetch items');
      return [];
    }

    try {
      console.log('📥 [OfflineDataService] Fetching items from SQLite...');
      const startTime = Date.now();

      // Build query with filters
      let query = 'SELECT * FROM items WHERE 1=1';
      const params: any[] = [];

      if (options.searchTerm) {
        query += ' AND (item_name LIKE ? OR CAST(price AS TEXT) LIKE ?)';
        const searchPattern = `%${options.searchTerm}%`;
        params.push(searchPattern, searchPattern);
      }

      // Add sorting
      const sortBy = options.sortBy || 'item_name';
      const sortOrder = options.sortOrder || 'asc';
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Add pagination
      if (options.limit) {
        query += ` LIMIT ${options.limit}`;
        if (options.offset) {
          query += ` OFFSET ${options.offset}`;
        }
      }

      const items = database.getAllSync(query, params);
      const duration = Date.now() - startTime;

      console.log(`✅ [OfflineDataService] Fetched ${items.length} items in ${duration}ms`);
      
      // Cache result
      this.setCached(cacheKey, items);
      
      return items;
    } catch (error) {
      console.error('❌ [OfflineDataService] Error fetching items:', error);
      return [];
    }
  }

  /**
   * Get single item by ID
   */
  public async getItemById(itemId: string): Promise<any | null> {
    const cacheKey = `item_${itemId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database) return null;

    try {
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [itemId]);
      if (item) {
        this.setCached(cacheKey, item);
      }
      return item;
    } catch (error) {
      console.error('Error fetching item:', error);
      return null;
    }
  }

  /**
   * Get all receipts (optimized for Receipts screen)
   */
  public async getReceipts(options: QueryOptions = {}): Promise<any[]> {
    const cacheKey = `receipts_${JSON.stringify(options)}`;
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database || !isDatabaseReady()) {
      console.error('❌ Database not initialized - cannot fetch receipts');
      return [];
    }

    try {
      console.log('📥 [OfflineDataService] Fetching receipts from SQLite...');
      const startTime = Date.now();

      // Build query
      let query = 'SELECT * FROM receipts WHERE 1=1';
      const params: any[] = [];

      // Search filter
      if (options.searchTerm) {
        query += ' AND (customer_name LIKE ? OR receipt_number LIKE ?)';
        const searchPattern = `%${options.searchTerm}%`;
        params.push(searchPattern, searchPattern);
      }

      // Status filter
      if (options.statusFilter && options.statusFilter !== 'all') {
        query += ' AND status = ?';
        params.push(options.statusFilter);
      }

      // Sorting
      const sortBy = options.sortBy || 'date';
      const sortOrder = options.sortOrder || 'desc';
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Pagination
      if (options.limit) {
        query += ` LIMIT ${options.limit}`;
        if (options.offset) {
          query += ` OFFSET ${options.offset}`;
        }
      }

      const receipts = database.getAllSync(query, params);

      // Fetch receipt items for each receipt
      const receiptsWithItems = receipts.map((receipt: any) => {
        const items = database.getAllSync(
          'SELECT * FROM receipt_items WHERE receipt_id = ?',
          [receipt.id]
        );
        return {
          ...receipt,
          items: items.map((item: any) => ({
            id: item.item_id || item.id,
            name: item.item_name,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })),
        };
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [OfflineDataService] Fetched ${receiptsWithItems.length} receipts in ${duration}ms`);

      // Cache result
      this.setCached(cacheKey, receiptsWithItems);

      return receiptsWithItems;
    } catch (error) {
      console.error('❌ [OfflineDataService] Error fetching receipts:', error);
      return [];
    }
  }

  /**
   * Get single receipt by ID with items
   */
  public async getReceiptById(receiptId: string): Promise<any | null> {
    const cacheKey = `receipt_${receiptId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database) return null;

    try {
      const receipt = database.getFirstSync('SELECT * FROM receipts WHERE id = ?', [receiptId]);
      if (!receipt) return null;

      const items = database.getAllSync(
        'SELECT * FROM receipt_items WHERE receipt_id = ?',
        [receiptId]
      );

      const receiptWithItems = {
        ...receipt,
        items: items.map((item: any) => ({
          id: item.item_id || item.id,
          name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      };

      this.setCached(cacheKey, receiptWithItems);
      return receiptWithItems;
    } catch (error) {
      console.error('Error fetching receipt:', error);
      return null;
    }
  }

  /**
   * Get customers (for POS screen autocomplete)
   */
  public async getCustomers(searchTerm?: string): Promise<any[]> {
    const cacheKey = `customers_${searchTerm || 'all'}`;
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database) return [];

    try {
      let query = 'SELECT * FROM customers';
      const params: any[] = [];

      if (searchTerm) {
        query += ' WHERE name LIKE ? OR phone LIKE ?';
        const pattern = `%${searchTerm}%`;
        params.push(pattern, pattern);
      }

      query += ' ORDER BY name ASC LIMIT 50';

      const customers = database.getAllSync(query, params);
      this.setCached(cacheKey, customers);
      return customers;
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  }

  /**
   * Get dashboard stats (for POS screen)
   */
  public async getDashboardStats(): Promise<{
    sales: number;
    transactions: number;
    items: number;
    avgOrder: number;
  }> {
    const cacheKey = 'dashboard_stats';
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database) {
      return { sales: 0, transactions: 0, items: 0, avgOrder: 0 };
    }

    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;

      // Get sales and transaction count
      const salesData = database.getFirstSync(
        'SELECT COUNT(*) as count, SUM(total) as sum FROM receipts WHERE date >= ? AND date < ? AND status != ?',
        [todayStart, todayEnd, 'draft']
      );

      // Get items sold count
      const itemsData = database.getFirstSync(
        `SELECT SUM(ri.quantity) as count 
         FROM receipt_items ri 
         INNER JOIN receipts r ON ri.receipt_id = r.id 
         WHERE r.date >= ? AND r.date < ? AND r.status != ?`,
        [todayStart, todayEnd, 'draft']
      );

      const transactions = (salesData?.count as number) || 0;
      const sales = (salesData?.sum as number) || 0;
      const items = (itemsData?.count as number) || 0;
      const avgOrder = transactions > 0 ? sales / transactions : 0;

      const stats = {
        sales,
        transactions,
        items,
        avgOrder,
      };

      this.setCached(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return { sales: 0, transactions: 0, items: 0, avgOrder: 0 };
    }
  }

  /**
   * Get low stock items (for POS screen alerts)
   */
  public async getLowStockItems(threshold: number = 10): Promise<any[]> {
    const cacheKey = `low_stock_${threshold}`;
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    const database = getDatabase();
    if (!database) return [];

    try {
      const items = database.getAllSync(
        'SELECT * FROM items WHERE stocks <= ? ORDER BY stocks ASC LIMIT 10',
        [threshold]
      );
      
      this.setCached(cacheKey, items);
      return items;
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      return [];
    }
  }

  /**
   * Search items for POS screen
   */
  public async searchItems(searchTerm: string): Promise<any[]> {
    const database = getDatabase();
    if (!database) return [];

    try {
      const items = database.getAllSync(
        'SELECT * FROM items WHERE item_name LIKE ? ORDER BY item_name ASC LIMIT 20',
        [`%${searchTerm}%`]
      );
      return items;
    } catch (error) {
      console.error('Error searching items:', error);
      return [];
    }
  }

  /**
   * Get sync statistics
   */
  public async getSyncStats(): Promise<{
    totalItems: number;
    totalReceipts: number;
    totalCustomers: number;
    unsyncedItems: number;
    unsyncedReceipts: number;
    lastSync: number | null;
  }> {
    const database = getDatabase();
    if (!database) {
      return {
        totalItems: 0,
        totalReceipts: 0,
        totalCustomers: 0,
        unsyncedItems: 0,
        unsyncedReceipts: 0,
        lastSync: null,
      };
    }

    try {
      const itemsCount = database.getFirstSync('SELECT COUNT(*) as count FROM items');
      const receiptsCount = database.getFirstSync('SELECT COUNT(*) as count FROM receipts');
      const customersCount = database.getFirstSync('SELECT COUNT(*) as count FROM customers');
      const unsyncedItems = database.getFirstSync('SELECT COUNT(*) as count FROM items WHERE is_synced = 0');
      const unsyncedReceipts = database.getFirstSync('SELECT COUNT(*) as count FROM receipts WHERE is_synced = 0');
      
      // Get last sync time
      const lastSyncItem = database.getFirstSync('SELECT MAX(synced_at) as last_sync FROM items');
      const lastSyncReceipt = database.getFirstSync('SELECT MAX(synced_at) as last_sync FROM receipts');
      const lastSync = Math.max(
        lastSyncItem?.last_sync || 0,
        lastSyncReceipt?.last_sync || 0
      );

      return {
        totalItems: (itemsCount?.count as number) || 0,
        totalReceipts: (receiptsCount?.count as number) || 0,
        totalCustomers: (customersCount?.count as number) || 0,
        unsyncedItems: (unsyncedItems?.count as number) || 0,
        unsyncedReceipts: (unsyncedReceipts?.count as number) || 0,
        lastSync: lastSync || null,
      };
    } catch (error) {
      console.error('Error fetching sync stats:', error);
      return {
        totalItems: 0,
        totalReceipts: 0,
        totalCustomers: 0,
        unsyncedItems: 0,
        unsyncedReceipts: 0,
        lastSync: null,
      };
    }
  }

  /**
   * Clear memory cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('✅ Memory cache cleared');
  }

  /**
   * Clear specific cache entry
   */
  public clearCacheEntry(key: string): void {
    this.cache.delete(key);
  }
}

export default OfflineDataService.getInstance();
