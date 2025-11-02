import { collection, getDocs, query, where, orderBy, limit, startAfter, Timestamp } from 'firebase/firestore';
import { db as firebaseDb, isFirebaseInitialized } from '../config/firebase';
import { database } from '../database';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SyncMetrics {
  lastSyncTime: number;
  totalSynced: number;
  totalFailed: number;
  collections: {
    items: { synced: number; failed: number };
    receipts: { synced: number; failed: number };
    customers: { synced: number; failed: number };
  };
}

interface SyncOptions {
  forceFullSync?: boolean; // Force full sync instead of incremental
  batchSize?: number; // Number of documents to fetch per batch
  throttleDelay?: number; // Delay between batches (ms)
}

class AutoSyncService {
  private static instance: AutoSyncService;
  private isSyncing = false;
  private syncListeners: Array<(progress: number, status: string) => void> = [];
  private readonly LAST_SYNC_KEY = 'lastAutoSyncTime';
  private readonly SYNC_METRICS_KEY = 'autoSyncMetrics';
  private readonly BATCH_SIZE = 100; // Fetch 100 documents at a time for better performance
  private readonly THROTTLE_DELAY = 50; // Small delay between batches to prevent overwhelming

  private constructor() {}

  public static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService();
    }
    return AutoSyncService.instance;
  }

  /**
   * Add sync progress listener
   */
  public addSyncListener(listener: (progress: number, status: string) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  private notifyProgress(progress: number, status: string) {
    this.syncListeners.forEach((listener) => listener(progress, status));
  }

  /**
   * Main auto-sync function - called after successful login
   */
  public async syncOnLogin(userId: string, options: SyncOptions = {}): Promise<void> {
    if (this.isSyncing) {
      console.log('⏸️ Sync already in progress, skipping...');
      return;
    }

    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('📵 No network connection - skipping auto-sync');
      this.notifyProgress(0, 'Offline - sync skipped');
      return;
    }

    // Check if Firebase is initialized
    if (!isFirebaseInitialized() || !firebaseDb) {
      console.log('📴 Firebase not initialized - skipping auto-sync');
      this.notifyProgress(0, 'Firebase not ready - sync skipped');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting auto-sync on login for user:', userId);
      this.notifyProgress(0, 'Starting sync...');

      // Get last sync time for incremental sync
      const lastSyncTime = options.forceFullSync 
        ? null 
        : await this.getLastSyncTime();

      const syncType = lastSyncTime ? 'Incremental' : 'Full';
      console.log(`📊 ${syncType} sync initiated ${lastSyncTime ? `(since ${new Date(lastSyncTime).toISOString()})` : ''}`);

      // Initialize metrics
      const metrics: SyncMetrics = {
        lastSyncTime: startTime,
        totalSynced: 0,
        totalFailed: 0,
        collections: {
          items: { synced: 0, failed: 0 },
          receipts: { synced: 0, failed: 0 },
          customers: { synced: 0, failed: 0 },
        },
      };

      // Sync each collection with progress updates
      this.notifyProgress(10, 'Syncing items...');
      const itemsResult = await this.syncCollection(
        'item_details',
        'items',
        lastSyncTime,
        options
      );
      metrics.collections.items = itemsResult;
      metrics.totalSynced += itemsResult.synced;
      metrics.totalFailed += itemsResult.failed;

      this.notifyProgress(40, 'Syncing customers...');
      const customersResult = await this.syncCollection(
        'customers',
        'customers',
        lastSyncTime,
        options
      );
      metrics.collections.customers = customersResult;
      metrics.totalSynced += customersResult.synced;
      metrics.totalFailed += customersResult.failed;

      this.notifyProgress(70, 'Syncing receipts...');
      const receiptsResult = await this.syncReceiptsCollection(lastSyncTime, options);
      metrics.collections.receipts = receiptsResult;
      metrics.totalSynced += receiptsResult.synced;
      metrics.totalFailed += receiptsResult.failed;

      // Save metrics and last sync time
      await this.saveLastSyncTime(startTime);
      await this.saveSyncMetrics(metrics);

      const duration = Date.now() - startTime;
      console.log(`✅ Auto-sync complete in ${duration}ms`);
      console.log(`📊 Synced: ${metrics.totalSynced}, Failed: ${metrics.totalFailed}`);
      
      this.notifyProgress(100, `Synced ${metrics.totalSynced} records`);
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
      this.notifyProgress(0, 'Sync failed');
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single collection with pagination and throttling
   */
  private async syncCollection(
    firebaseCollection: string,
    localTable: string,
    lastSyncTime: number | null,
    options: SyncOptions
  ): Promise<{ synced: number; failed: number }> {
    if (!database) {
      console.error('Database not initialized');
      return { synced: 0, failed: 0 };
    }

    const batchSize = options.batchSize || this.BATCH_SIZE;
    const throttleDelay = options.throttleDelay || this.THROTTLE_DELAY;
    
    let synced = 0;
    let failed = 0;
    let lastDoc: any = null;
    let hasMore = true;

    console.log(`📥 Syncing ${firebaseCollection}...`);

    while (hasMore) {
      try {
        // Build query with pagination
        const colRef = collection(firebaseDb, firebaseCollection);
        let q = query(colRef, orderBy('createdAt', 'asc'), limit(batchSize));

        // Add incremental sync filter if available
        if (lastSyncTime) {
          q = query(
            colRef,
            where('updatedAt', '>', Timestamp.fromMillis(lastSyncTime)),
            orderBy('updatedAt', 'asc'),
            limit(batchSize)
          );
        }

        // Add pagination
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        // Update last document for pagination
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // Process batch
        for (const docSnap of snapshot.docs) {
          try {
            await this.syncDocument(docSnap.id, docSnap.data(), localTable);
            synced++;
          } catch (error) {
            console.error(`Failed to sync document ${docSnap.id}:`, error);
            failed++;
          }
        }

        // Check if there are more documents
        hasMore = snapshot.docs.length === batchSize;

        // Throttle to prevent overwhelming the system
        if (hasMore && throttleDelay > 0) {
          await this.sleep(throttleDelay);
        }

        console.log(`  📦 Batch processed: ${synced} synced, ${failed} failed`);
      } catch (error) {
        console.error(`Error syncing batch from ${firebaseCollection}:`, error);
        failed++;
        hasMore = false; // Stop on error
      }
    }

    console.log(`✅ ${firebaseCollection}: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  /**
   * Sync receipts collection (with items subcollection)
   */
  private async syncReceiptsCollection(
    lastSyncTime: number | null,
    options: SyncOptions
  ): Promise<{ synced: number; failed: number }> {
    if (!database) {
      return { synced: 0, failed: 0 };
    }

    const batchSize = options.batchSize || this.BATCH_SIZE;
    const throttleDelay = options.throttleDelay || this.THROTTLE_DELAY;
    
    let synced = 0;
    let failed = 0;
    let lastDoc: any = null;
    let hasMore = true;

    console.log('📥 Syncing receipts...');

    while (hasMore) {
      try {
        const receiptsRef = collection(firebaseDb, 'receipts');
        let q = query(receiptsRef, orderBy('createdAt', 'asc'), limit(batchSize));

        if (lastSyncTime) {
          q = query(
            receiptsRef,
            where('updatedAt', '>', Timestamp.fromMillis(lastSyncTime)),
            orderBy('updatedAt', 'asc'),
            limit(batchSize)
          );
        }

        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        for (const docSnap of snapshot.docs) {
          try {
            await this.syncReceipt(docSnap.id, docSnap.data());
            synced++;
          } catch (error) {
            console.error(`Failed to sync receipt ${docSnap.id}:`, error);
            failed++;
          }
        }

        hasMore = snapshot.docs.length === batchSize;

        if (hasMore && throttleDelay > 0) {
          await this.sleep(throttleDelay);
        }

        console.log(`  📦 Receipts batch: ${synced} synced, ${failed} failed`);
      } catch (error) {
        console.error('Error syncing receipts batch:', error);
        failed++;
        hasMore = false;
      }
    }

    console.log(`✅ Receipts: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  /**
   * Sync a single document to local database
   */
  private async syncDocument(
    firebaseId: string,
    data: any,
    localTable: string
  ): Promise<void> {
    if (!database) return;

    const now = Date.now();

    try {
      // Check if document exists
      const existing = database.getFirstSync(
        `SELECT * FROM ${localTable} WHERE firebase_id = ?`,
        [firebaseId]
      );

      if (localTable === 'items') {
        const itemData = {
          item_name: data.item_name || '',
          price: data.price || 0,
          stocks: data.stocks || 0,
        };

        if (existing) {
          database.runSync(
            `UPDATE ${localTable} SET item_name = ?, price = ?, stocks = ?, updated_at = ?, synced_at = ?, is_synced = 1 WHERE firebase_id = ?`,
            [itemData.item_name, itemData.price, itemData.stocks, now, now, firebaseId]
          );
        } else {
          const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          database.runSync(
            `INSERT INTO ${localTable} (id, firebase_id, item_name, price, stocks, created_at, updated_at, synced_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [id, firebaseId, itemData.item_name, itemData.price, itemData.stocks, now, now, now]
          );
        }
      } else if (localTable === 'customers') {
        const customerData = {
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
        };

        if (existing) {
          database.runSync(
            `UPDATE ${localTable} SET name = ?, phone = ?, email = ?, address = ?, updated_at = ?, synced_at = ?, is_synced = 1 WHERE firebase_id = ?`,
            [customerData.name, customerData.phone, customerData.email, customerData.address, now, now, firebaseId]
          );
        } else {
          const id = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          database.runSync(
            `INSERT INTO ${localTable} (id, firebase_id, name, phone, email, address, created_at, updated_at, synced_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [id, firebaseId, customerData.name, customerData.phone, customerData.email, customerData.address, now, now, now]
          );
        }
      }
    } catch (error) {
      console.error(`Error syncing document ${firebaseId} to ${localTable}:`, error);
      throw error;
    }
  }

  /**
   * Sync a single receipt with its items
   */
  private async syncReceipt(firebaseId: string, data: any): Promise<void> {
    if (!database) return;

    const now = Date.now();
    const dateMs = data.date?.toMillis?.() || data.date?.seconds ? data.date.seconds * 1000 : Date.now();

    try {
      const existing = database.getFirstSync(
        'SELECT * FROM receipts WHERE firebase_id = ?',
        [firebaseId]
      );

      let receiptId: string;

      const receiptData = {
        receipt_number: data.receiptNumber || '',
        customer_name: data.customerName || '',
        customer_phone: data.customerPhone || '',
        customer_address: data.customerAddress || '',
        subtotal: data.subtotal || 0,
        tax: data.tax || 0,
        total: data.total || 0,
        date: dateMs,
        print_method: data.printMethod || '',
        printed: data.printed ? 1 : 0,
        status: data.status || 'draft',
        notes: data.notes || '',
      };

      if (existing) {
        receiptId = existing.id;
        database.runSync(
          'UPDATE receipts SET receipt_number = ?, customer_name = ?, customer_phone = ?, customer_address = ?, subtotal = ?, tax = ?, total = ?, date = ?, print_method = ?, printed = ?, status = ?, notes = ?, updated_at = ?, synced_at = ?, is_synced = 1 WHERE firebase_id = ?',
          [
            receiptData.receipt_number,
            receiptData.customer_name,
            receiptData.customer_phone,
            receiptData.customer_address,
            receiptData.subtotal,
            receiptData.tax,
            receiptData.total,
            receiptData.date,
            receiptData.print_method,
            receiptData.printed,
            receiptData.status,
            receiptData.notes,
            now,
            now,
            firebaseId,
          ]
        );
      } else {
        receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        database.runSync(
          'INSERT INTO receipts (id, firebase_id, receipt_number, customer_name, customer_phone, customer_address, subtotal, tax, total, date, print_method, printed, status, notes, created_at, updated_at, synced_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          [
            receiptId,
            firebaseId,
            receiptData.receipt_number,
            receiptData.customer_name,
            receiptData.customer_phone,
            receiptData.customer_address,
            receiptData.subtotal,
            receiptData.tax,
            receiptData.total,
            receiptData.date,
            receiptData.print_method,
            receiptData.printed,
            receiptData.status,
            receiptData.notes,
            now,
            now,
            now,
          ]
        );
      }

      // Sync receipt items
      if (data.items && Array.isArray(data.items)) {
        // Delete existing items for this receipt
        database.runSync('DELETE FROM receipt_items WHERE receipt_id = ?', [receiptId]);

        // Insert new items
        for (const itemData of data.items) {
          const itemId = `receipt_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          database.runSync(
            'INSERT INTO receipt_items (id, receipt_id, item_id, item_name, quantity, price, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              itemId,
              receiptId,
              itemData.id || '',
              itemData.item_name || itemData.name || '',
              itemData.quantity || 0,
              itemData.price || 0,
              itemData.total || (itemData.quantity || 0) * (itemData.price || 0),
              now,
              now,
            ]
          );
        }
      }
    } catch (error) {
      console.error(`Error syncing receipt ${firebaseId}:`, error);
      throw error;
    }
  }

  /**
   * Get last sync time from storage
   */
  private async getLastSyncTime(): Promise<number | null> {
    try {
      const lastSync = await AsyncStorage.getItem(this.LAST_SYNC_KEY);
      return lastSync ? parseInt(lastSync, 10) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Save last sync time to storage
   */
  private async saveLastSyncTime(time: number): Promise<void> {
    try {
      await AsyncStorage.setItem(this.LAST_SYNC_KEY, time.toString());
    } catch (error) {
      console.error('Error saving last sync time:', error);
    }
  }

  /**
   * Get sync metrics
   */
  public async getSyncMetrics(): Promise<SyncMetrics | null> {
    try {
      const metrics = await AsyncStorage.getItem(this.SYNC_METRICS_KEY);
      return metrics ? JSON.parse(metrics) : null;
    } catch (error) {
      console.error('Error getting sync metrics:', error);
      return null;
    }
  }

  /**
   * Save sync metrics
   */
  private async saveSyncMetrics(metrics: SyncMetrics): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SYNC_METRICS_KEY, JSON.stringify(metrics));
    } catch (error) {
      console.error('Error saving sync metrics:', error);
    }
  }

  /**
   * Clear all sync data (for testing/debugging)
   */
  public async clearSyncData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.LAST_SYNC_KEY);
      await AsyncStorage.removeItem(this.SYNC_METRICS_KEY);
      console.log('✅ Sync data cleared');
    } catch (error) {
      console.error('Error clearing sync data:', error);
    }
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if sync is currently in progress
   */
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

export default AutoSyncService.getInstance();
