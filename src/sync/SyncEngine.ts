import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db as firebaseDb, isFirebaseInitialized } from '../config/firebase';
import {
  database,
  itemsCollection,
  receiptsCollection,
  receiptItemsCollection,
  customersCollection,
  syncQueueCollection,
} from '../database';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type EntityType = 'item' | 'receipt' | 'customer';
export type OperationType = 'create' | 'update' | 'delete';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

class SyncEngine {
  private static instance: SyncEngine;
  private isSyncing = false;
  private isPushing = false; // Guard against duplicate push operations
  private syncListeners: Array<(status: SyncStatus) => void> = [];
  private realtimeUnsubscribers: Map<string, () => void> = new Map();

  private constructor() {}

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Add sync status listener
   */
  public addSyncListener(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  private notifySyncStatus(status: SyncStatus) {
    this.syncListeners.forEach((listener) => listener(status));
  }

  /**
   * Pull data from Firebase to local database
   */
  public async pullFromFirebase(): Promise<SyncResult> {
    console.log('🔄 Pulling data from Firebase...');
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    // Check if Firebase is initialized (offline check)
    if (!isFirebaseInitialized() || !firebaseDb) {
      console.log('📴 Firebase not initialized - skipping pull (offline mode)');
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Firebase not initialized - app is offline'],
      };
    }

    try {
      // Pull items
      const itemsResult = await this.pullItems();
      result.synced += itemsResult.synced;
      result.failed += itemsResult.failed;
      result.errors.push(...itemsResult.errors);

      // Pull receipts
      const receiptsResult = await this.pullReceipts();
      result.synced += receiptsResult.synced;
      result.failed += receiptsResult.failed;
      result.errors.push(...receiptsResult.errors);

      // Pull customers
      const customersResult = await this.pullCustomers();
      result.synced += customersResult.synced;
      result.failed += customersResult.failed;
      result.errors.push(...customersResult.errors);

      console.log(`✅ Pull complete: ${result.synced} synced, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error('❌ Pull from Firebase failed:', error);
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown pull error'],
      };
    }
  }

  /**
   * Pull items from Firebase
   */
  private async pullItems(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      if (!database) throw new Error('Database not initialized');

      const itemsRef = collection(firebaseDb, 'item_details');
      const snapshot = await getDocs(itemsRef);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const firebaseId = docSnap.id;

        try {
          // Check if item exists
          const existing = database.getFirstSync(
            'SELECT * FROM items WHERE firebase_id = ?',
            [firebaseId]
          );

          const now = Date.now();

          if (existing) {
            // Update existing
            database.runSync(
              'UPDATE items SET item_name = ?, price = ?, stocks = ?, updated_at = ?, synced_at = ?, is_synced = 1 WHERE firebase_id = ?',
              [data.item_name || '', data.price || 0, data.stocks || 0, now, now, firebaseId]
            );
          } else {
            // Create new
            const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            database.runSync(
              'INSERT INTO items (id, firebase_id, item_name, price, stocks, created_at, updated_at, synced_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
              [id, firebaseId, data.item_name || '', data.price || 0, data.stocks || 0, now, now, now]
            );
          }

          result.synced++;
        } catch (error) {
          console.error(`Error syncing item ${firebaseId}:`, error);
          result.failed++;
          result.errors.push(`Failed to sync item ${firebaseId}`);
        }
      }
    } catch (error) {
      console.error('Error pulling items:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Pull customers from Firebase
   */
  private async pullCustomers(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      if (!database) throw new Error('Database not initialized');

      const customersRef = collection(firebaseDb, 'customers');
      const snapshot = await getDocs(customersRef);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const firebaseId = docSnap.id;

        try {
          const existing = database.getFirstSync(
            'SELECT * FROM customers WHERE firebase_id = ?',
            [firebaseId]
          );

          const now = Date.now();

          if (existing) {
            database.runSync(
              'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, updated_at = ?, synced_at = ?, is_synced = 1 WHERE firebase_id = ?',
              [data.name || '', data.phone || '', data.email || '', data.address || '', now, now, firebaseId]
            );
          } else {
            const id = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            database.runSync(
              'INSERT INTO customers (id, firebase_id, name, phone, email, address, created_at, updated_at, synced_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
              [id, firebaseId, data.name || '', data.phone || '', data.email || '', data.address || '', now, now, now]
            );
          }

          result.synced++;
        } catch (error) {
          console.error(`Error syncing customer ${firebaseId}:`, error);
          result.failed++;
          result.errors.push(`Failed to sync customer ${firebaseId}`);
        }
      }
    } catch (error) {
      console.error('Error pulling customers:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Pull receipts with their items
   */
  private async pullReceipts(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      if (!database) throw new Error('Database not initialized');

      const receiptsRef = collection(firebaseDb, 'receipts');
      const snapshot = await getDocs(receiptsRef);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const firebaseId = docSnap.id;

        try {
          // Check if receipt exists
          const existing = database.getFirstSync(
            'SELECT * FROM receipts WHERE firebase_id = ?',
            [firebaseId]
          );

          const now = Date.now();
          const dateMs = data.date?.toMillis?.() || Date.now();
          let receiptId: string;

          if (existing) {
            // Update existing
            receiptId = existing.id;
            database.runSync(
              'UPDATE receipts SET receipt_number = ?, customer_name = ?, customer_phone = ?, customer_address = ?, subtotal = ?, tax = ?, total = ?, date = ?, print_method = ?, printed = ?, status = ?, notes = ?, updated_at = ?, synced_at = ?, is_synced = 1 WHERE firebase_id = ?',
              [
                data.receiptNumber || '',
                data.customerName || '',
                data.customerPhone || '',
                data.customerAddress || '',
                data.subtotal || 0,
                data.tax || 0,
                data.total || 0,
                dateMs,
                data.printMethod || '',
                data.printed ? 1 : 0,
                data.status || 'draft',
                data.notes || '',
                now,
                now,
                firebaseId
              ]
            );
          } else {
            // Create new
            receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            database.runSync(
              'INSERT INTO receipts (id, firebase_id, receipt_number, customer_name, customer_phone, customer_address, subtotal, tax, total, date, print_method, printed, status, notes, created_at, updated_at, synced_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
              [
                receiptId,
                firebaseId,
                data.receiptNumber || '',
                data.customerName || '',
                data.customerPhone || '',
                data.customerAddress || '',
                data.subtotal || 0,
                data.tax || 0,
                data.total || 0,
                dateMs,
                data.printMethod || '',
                data.printed ? 1 : 0,
                data.status || 'draft',
                data.notes || '',
                now,
                now,
                now
              ]
            );
          }

          // Sync receipt items
          if (data.items && Array.isArray(data.items)) {
            // Delete existing items for this receipt
            database.runSync('DELETE FROM receipt_items WHERE receipt_id = ?', [receiptId]);

            // Create new items
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
                  now
                ]
              );
            }
          }

          result.synced++;
        } catch (error) {
          console.error(`Error syncing receipt ${firebaseId}:`, error);
          result.failed++;
          result.errors.push(`Failed to sync receipt ${firebaseId}`);
        }
      }
    } catch (error) {
      console.error('Error pulling receipts:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Push local changes to Firebase
   */
  public async pushToFirebase(): Promise<SyncResult> {
    // Guard against duplicate push operations
    if (this.isPushing) {
      console.log('⏸️ Push already in progress, skipping...');
      return { success: false, synced: 0, failed: 0, errors: ['Push already in progress'] };
    }
    
    this.isPushing = true;
    
    try {
      if (__DEV__) {
        console.log('🔄 Starting push to Firebase...');
      }
      const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

      // Check if Firebase is initialized (offline check)
      if (!isFirebaseInitialized() || !firebaseDb) {
        console.log('📴 Firebase not initialized - skipping push (offline mode)');
        return {
          success: false,
          synced: 0,
          failed: 0,
          errors: ['Firebase not initialized - app is offline'],
        };
      }

      if (!database) {
        throw new Error('Database not initialized');
      }

      // Get all pending sync queue items
      const pendingQueue = database.getAllSync(
        "SELECT * FROM sync_queue WHERE status IN ('pending', 'failed')"
      );

      if (__DEV__) {
        console.log(`📤 Found ${pendingQueue.length} pending operations`);
      }

      for (const queueItem of pendingQueue) {
        try {
          // Mark as processing
          database.runSync(
            'UPDATE sync_queue SET status = ?, updated_at = ? WHERE id = ?',
            ['processing', Date.now(), queueItem.id]
          );

          const payload = JSON.parse(queueItem.payload);
          await this.executeSyncOperation(
            queueItem.entity_type as EntityType,
            queueItem.operation as OperationType,
            queueItem.entity_id,
            payload
          );

          // Mark as completed
          database.runSync(
            'UPDATE sync_queue SET status = ?, updated_at = ? WHERE id = ?',
            ['completed', Date.now(), queueItem.id]
          );

          result.synced++;
          if (__DEV__) {
            console.log(`✅ Synced ${queueItem.entity_type} ${queueItem.operation} operation`);
          }
        } catch (error) {
          console.error(`❌ Failed to sync queue item ${queueItem.id}:`, error);
          
          // Mark as failed and increment retry count
          database.runSync(
            'UPDATE sync_queue SET status = ?, retry_count = retry_count + 1, error_message = ?, updated_at = ? WHERE id = ?',
            ['failed', error instanceof Error ? error.message : 'Unknown error', Date.now(), queueItem.id]
          );

          result.failed++;
          result.errors.push(`Failed ${queueItem.entity_type} ${queueItem.operation}`);
        }
      }

      // Clean up completed items older than 24 hours
      await this.cleanupSyncQueue();

      if (__DEV__) {
        console.log(`✅ Push complete: ${result.synced} synced, ${result.failed} failed`);
      }
      return result;
    } catch (error) {
      console.error('❌ Push to Firebase failed:', error);
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown push error'],
      };
    } finally {
      this.isPushing = false;
    }
  }

  /**
   * Execute a sync operation to Firebase
   */
  private async executeSyncOperation(
    entityType: EntityType,
    operation: OperationType,
    entityId: string,
    payload: any
  ): Promise<void> {
    const collectionName = this.getFirebaseCollection(entityType);
    
    if (operation === 'delete') {
      const docRef = doc(firebaseDb, collectionName, payload.firebaseId || entityId);
      await deleteDoc(docRef);
    } else if (operation === 'create' || operation === 'update') {
      const firebaseData = this.mapLocalToFirebase(payload, entityType);
      const docRef = doc(firebaseDb, collectionName, payload.firebaseId || entityId);
      
      if (operation === 'create') {
        await setDoc(docRef, {
          ...firebaseData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, {
          ...firebaseData,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  /**
   * Full bi-directional sync
   */
  public async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('⏸️ Sync already in progress');
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
    }

    this.isSyncing = true;
    this.notifySyncStatus('syncing');

    try {
      console.log('🔄 Starting full sync...');

      // First, push local changes
      const pushResult = await this.pushToFirebase();

      // Then, pull remote changes
      const pullResult = await this.pullFromFirebase();

      const result: SyncResult = {
        success: pushResult.success && pullResult.success,
        synced: pushResult.synced + pullResult.synced,
        failed: pushResult.failed + pullResult.failed,
        errors: [...pushResult.errors, ...pullResult.errors],
      };

      this.notifySyncStatus(result.success ? 'success' : 'error');
      console.log(`✅ Full sync complete: ${result.synced} synced, ${result.failed} failed`);
      
      return result;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.notifySyncStatus('error');
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Add operation to sync queue
   */
  public async queueOperation(
    entityType: EntityType,
    operation: OperationType,
    entityId: string,
    payload: any
  ): Promise<void> {
    if (!database) {
      console.warn('Database not initialized, cannot queue operation');
      return;
    }

    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    database.runSync(
      'INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, entityType, entityId, operation, JSON.stringify(payload), 0, 'pending', now, now]
    );

    console.log(`📝 Queued ${operation} operation for ${entityType}:${entityId}`);
  }

  /**
   * Clean up old completed sync queue items
   */
  private async cleanupSyncQueue(): Promise<void> {
    if (!database) return;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const result = database.runSync(
      "DELETE FROM sync_queue WHERE status = 'completed' AND updated_at < ?",
      [oneDayAgo]
    );

    console.log(`🧹 Cleaned up old sync queue items`);
  }

  /**
   * Set up real-time listeners for Firebase collections
   */
  public setupRealtimeSync(): void {
    console.log('⚠️ Real-time sync temporarily disabled (migrating to expo-sqlite)');
  }

  /**
   * Set up listener for a collection
   */
  private setupCollectionListener(firebaseCollection: string, localTable: string): void {
    // Temporarily disabled during SQLite migration
    return;
    /* const colRef = collection(firebaseDb, firebaseCollection);
    
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        console.log(`🔄 Real-time update for ${firebaseCollection}:`, snapshot.size, 'documents');
        
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data();
          const firebaseId = change.doc.id;

          try {
            await database.write(async () => {
              const localCollection = database.get(localTable);
              const existing = await localCollection
                .query(Q.where('firebase_id', firebaseId))
                .fetch();

              if (change.type === 'removed') {
                // Delete local record
                if (existing.length > 0) {
                  await existing[0].markAsDeleted();
                }
              } else if (change.type === 'added' || change.type === 'modified') {
                if (existing.length > 0) {
                  // Update existing
                  await existing[0].update((record: any) => {
                    Object.assign(record, this.mapFirebaseToLocal(data, localTable));
                    record.syncedAt = new Date();
                    record.isSynced = true;
                  });
                } else {
                  // Create new
                  await localCollection.create((record: any) => {
                    Object.assign(record, this.mapFirebaseToLocal(data, localTable));
                    record.firebaseId = firebaseId;
                    record.syncedAt = new Date();
                    record.isSynced = true;
                  });
                }
              }
            });
          } catch (error) {
            console.error(`Error processing real-time change for ${firebaseId}:`, error);
          }
        }
      },
      (error) => {
        console.error(`❌ Real-time listener error for ${firebaseCollection}:`, error);
      }
    );

    this.realtimeUnsubscribers.set(firebaseCollection, unsubscribe);
    */
  }

  /**
   * Set up listener for receipts (with items)
   */
  private setupReceiptsListener(): void {
    // Temporarily disabled during SQLite migration
    return;
    /* const receiptsRef = collection(firebaseDb, 'receipts');
    
    const unsubscribe = onSnapshot(
      receiptsRef,
      async (snapshot) => {
        console.log(`🔄 Real-time update for receipts:`, snapshot.size, 'documents');
        
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data();
          const firebaseId = change.doc.id;

          try {
            await database.write(async () => {
              const existing = await receiptsCollection
                .query(Q.where('firebase_id', firebaseId))
                .fetch();

              if (change.type === 'removed') {
                // Delete local record and its items
                if (existing.length > 0) {
                  const receipt = existing[0];
                  const items = await receiptItemsCollection
                    .query(Q.where('receipt_id', receipt.id))
                    .fetch();
                  
                  for (const item of items) {
                    await item.markAsDeleted();
                  }
                  
                  await receipt.markAsDeleted();
                }
              } else {
                let receipt: ReceiptModel;
                
                if (existing.length > 0) {
                  // Update existing
                  receipt = existing[0];
                  await receipt.update((record) => {
                    record.receiptNumber = data.receiptNumber || '';
                    record.customerName = data.customerName || '';
                    record.customerPhone = data.customerPhone;
                    record.customerAddress = data.customerAddress;
                    record.subtotal = data.subtotal || 0;
                    record.tax = data.tax || 0;
                    record.total = data.total || 0;
                    record.date = data.date?.toDate?.() || new Date();
                    record.printMethod = data.printMethod;
                    record.printed = data.printed || false;
                    record.printedAt = data.printedAt?.toDate?.();
                    record.pdfPath = data.pdfPath;
                    record.status = data.status || 'draft';
                    record.notes = data.notes;
                    record.syncedAt = new Date();
                    record.isSynced = true;
                  });
                } else {
                  // Create new
                  receipt = await receiptsCollection.create((record) => {
                    record.firebaseId = firebaseId;
                    record.receiptNumber = data.receiptNumber || '';
                    record.customerName = data.customerName || '';
                    record.customerPhone = data.customerPhone;
                    record.customerAddress = data.customerAddress;
                    record.subtotal = data.subtotal || 0;
                    record.tax = data.tax || 0;
                    record.total = data.total || 0;
                    record.date = data.date?.toDate?.() || new Date();
                    record.printMethod = data.printMethod;
                    record.printed = data.printed || false;
                    record.printedAt = data.printedAt?.toDate?.();
                    record.pdfPath = data.pdfPath;
                    record.status = data.status || 'draft';
                    record.notes = data.notes;
                    record.syncedAt = new Date();
                    record.isSynced = true;
                  });
                }

                // Sync items
                if (data.items && Array.isArray(data.items)) {
                  const existingItems = await receiptItemsCollection
                    .query(Q.where('receipt_id', receipt.id))
                    .fetch();
                  
                  for (const item of existingItems) {
                    await item.markAsDeleted();
                  }

                  for (const itemData of data.items) {
                    await receiptItemsCollection.create((record) => {
                      record.receiptId = receipt.id;
                      record.itemId = itemData.id;
                      record.itemName = itemData.item_name || itemData.name || '';
                      record.quantity = itemData.quantity || 0;
                      record.price = itemData.price || 0;
                      record.total = itemData.total || (itemData.quantity || 0) * (itemData.price || 0);
                    });
                  }
                }
              }
            });
          } catch (error) {
            console.error(`Error processing real-time receipt change for ${firebaseId}:`, error);
          }
        }
      },
      (error) => {
        console.error('❌ Real-time listener error for receipts:', error);
      }
    );

    this.realtimeUnsubscribers.set('receipts', unsubscribe);
    */
  }

  /**
   * Stop all real-time listeners
   */
  public stopRealtimeSync(): void {
    console.log('🛑 Stopping real-time sync listeners...');
    
    this.realtimeUnsubscribers.forEach((unsubscribe) => {
      unsubscribe();
    });
    
    this.realtimeUnsubscribers.clear();
    console.log('✅ Real-time sync listeners stopped');
  }

  /**
   * Helper: Map Firebase data to local model
   */
  private mapFirebaseToLocal(data: any, table: string): any {
    if (table === 'items') {
      return {
        itemName: data.item_name || '',
        price: data.price || 0,
        stocks: data.stocks || 0,
      };
    }
    // Add other mappings as needed
    return data;
  }

  /**
   * Helper: Map local model to Firebase data
   */
  private mapLocalToFirebase(data: any, entityType: EntityType): any {
    if (entityType === 'item') {
      return {
        item_name: data.itemName || data.item_name,
        price: data.price || 0,
        stocks: data.stocks || 0,
      };
    }
    // Add other mappings as needed
    return data;
  }

  /**
   * Helper: Get Firebase collection name for entity type
   */
  private getFirebaseCollection(entityType: EntityType): string {
    switch (entityType) {
      case 'item':
        return 'item_details';
      case 'receipt':
        return 'receipts';
      case 'customer':
        return 'customers';
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
}

export default SyncEngine.getInstance();


