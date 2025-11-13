import * as SQLite from 'expo-sqlite';

// Use expo-sqlite for Expo Go compatibility
let database: SQLite.SQLiteDatabase | null = null;
let initializationAttempted = false;
let initializationSuccessful = false;

/**
 * Initialize SQLite database with retry logic
 */
function initializeDatabase(): SQLite.SQLiteDatabase | null {
  if (initializationSuccessful && database) {
    return database;
  }
  
  if (initializationAttempted) {
    console.warn('⚠️ Database initialization already attempted and failed');
    return database;
  }
  
  initializationAttempted = true;
  
  try {
    console.log('🔄 Initializing SQLite database...');
    database = SQLite.openDatabaseSync('thermalprinter.db');
    
    if (!database) {
      throw new Error('Failed to open database');
    }
    
    // Create tables with error handling
    database.execSync(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        firebase_id TEXT,
        item_name TEXT,
        price REAL,
        stocks INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        synced_at INTEGER,
        is_synced INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        firebase_id TEXT,
        receipt_number TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        subtotal REAL,
        tax REAL,
        total REAL,
        date INTEGER,
        print_method TEXT,
        printed INTEGER DEFAULT 0,
        printed_at INTEGER,
        pdf_path TEXT,
        status TEXT,
        notes TEXT,
        old_balance REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        new_balance REAL DEFAULT 0,
        is_paid INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        synced_at INTEGER,
        is_synced INTEGER DEFAULT 0
      );
    
      CREATE TABLE IF NOT EXISTS receipt_items (
        id TEXT PRIMARY KEY,
        receipt_id TEXT,
        item_id TEXT,
        item_name TEXT,
        quantity INTEGER,
        price REAL,
        total REAL,
        created_at INTEGER,
        updated_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        firebase_id TEXT,
        name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        balance_due REAL DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        synced_at INTEGER,
        is_synced INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT,
        entity_id TEXT,
        operation TEXT,
        payload TEXT,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);
    
    // Verify tables were created
    const tables = database.getAllSync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'receipts', 'receipt_items', 'customers', 'sync_queue')"
    );
    
    if (tables.length < 5) {
      throw new Error(`Only ${tables.length}/5 tables created`);
    }
    
    console.log('✅ SQLite database initialized successfully with', tables.length, 'tables');
    initializationSuccessful = true;
    return database;
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database:', error);
    database = null;
    initializationSuccessful = false;
    return null;
  }
}

// Initialize on module load
database = initializeDatabase();

/**
 * Get database instance with lazy initialization
 */
export function getDatabase(): SQLite.SQLiteDatabase | null {
  if (!database && !initializationAttempted) {
    return initializeDatabase();
  }
  return database;
}

/**
 * Check if database is ready
 */
export function isDatabaseReady(): boolean {
  return initializationSuccessful && database !== null;
}

export { database };

// Helper functions for collection-like access
export const itemsCollection = {
  query: (conditions?: any) => ({
    fetch: async () => {
      if (!database) return [];
      const result = database.getAllSync('SELECT * FROM items');
      return result;
    }
  }),
  find: async (id: string) => {
    if (!database) return null;
    const result = database.getFirstSync('SELECT * FROM items WHERE id = ?', [id]);
    return result;
  },
  create: async (callback: any) => {
    if (!database) throw new Error('Database not initialized');
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: any = { id };
    callback(record);
    
    database.runSync(
      'INSERT INTO items (id, firebase_id, item_name, price, stocks, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [record.id, record.firebaseId || '', record.itemName || '', record.price || 0, record.stocks || 0, Date.now(), Date.now(), record.isSynced ? 1 : 0]
    );
    return record;
  }
};

export const receiptsCollection = {
  query: (conditions?: any) => ({
    fetch: async () => {
      if (!database) return [];
      return database.getAllSync('SELECT * FROM receipts ORDER BY created_at DESC');
    }
  }),
  find: async (id: string) => {
    if (!database) return null;
    return database.getFirstSync('SELECT * FROM receipts WHERE id = ?', [id]);
  },
  create: async (callback: any) => {
    if (!database) throw new Error('Database not initialized');
    const id = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: any = { id };
    callback(record);
    
    database.runSync(
      'INSERT INTO receipts (id, firebase_id, receipt_number, customer_name, customer_phone, customer_address, subtotal, tax, total, date, print_method, printed, status, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.id, record.firebaseId || '', record.receiptNumber || '', record.customerName || '', record.customerPhone || '', record.customerAddress || '', record.subtotal || 0, record.tax || 0, record.total || 0, Date.now(), record.printMethod || '', record.printed ? 1 : 0, record.status || 'draft', Date.now(), Date.now(), record.isSynced ? 1 : 0]
    );
    return record;
  }
};

export const receiptItemsCollection = {
  query: (conditions?: any) => ({
    fetch: async () => {
      if (!database) return [];
      return database.getAllSync('SELECT * FROM receipt_items');
    }
  }),
  create: async (callback: any) => {
    if (!database) throw new Error('Database not initialized');
    const id = `receipt_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: any = { id };
    callback(record);
    
    database.runSync(
      'INSERT INTO receipt_items (id, receipt_id, item_id, item_name, quantity, price, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.id, record.receiptId || '', record.itemId || '', record.itemName || '', record.quantity || 0, record.price || 0, record.total || 0, Date.now(), Date.now()]
    );
    return record;
  }
};

export const customersCollection = {
  query: (conditions?: any) => ({
    fetch: async () => {
      if (!database) return [];
      return database.getAllSync('SELECT * FROM customers');
    }
  }),
  create: async (callback: any) => {
    if (!database) throw new Error('Database not initialized');
    const id = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: any = { id };
    callback(record);
    
    database.runSync(
      'INSERT INTO customers (id, firebase_id, name, phone, email, address, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.id, record.firebaseId || '', record.name || '', record.phone || '', record.email || '', record.address || '', Date.now(), Date.now(), record.isSynced ? 1 : 0]
    );
    return record;
  }
};

export const syncQueueCollection = {
  query: (conditions?: any) => ({
    fetch: async () => {
      if (!database) return [];
      return database.getAllSync('SELECT * FROM sync_queue');
    }
  }),
  create: async (callback: any) => {
    if (!database) throw new Error('Database not initialized');
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: any = { id };
    callback(record);
    
    database.runSync(
      'INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record.id, record.entityType || '', record.entityId || '', record.operation || '', record.payload || '', record.retryCount || 0, record.status || 'pending', Date.now(), Date.now()]
    );
    return record;
  }
};

// Type definitions for compatibility
export interface Item {
  id: string;
  firebase_id?: string;
  item_name: string;
  price: number;
  stocks: number;
  created_at: number;
  updated_at: number;
  synced_at?: number;
  is_synced: number;
}

export interface Receipt {
  id: string;
  firebase_id?: string;
  receipt_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  subtotal: number;
  tax: number;
  total: number;
  date: number;
  print_method?: string;
  printed: number;
  printed_at?: number;
  pdf_path?: string;
  status: string;
  notes?: string;
  created_at: number;
  updated_at: number;
  synced_at?: number;
  is_synced: number;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  item_id?: string;
  item_name: string;
  quantity: number;
  price: number;
  total: number;
  created_at: number;
  updated_at: number;
}

export interface Customer {
  id: string;
  firebase_id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: number;
  updated_at: number;
  synced_at?: number;
  is_synced: number;
}

export interface SyncQueue {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  retry_count: number;
  status: string;
  error_message?: string;
  created_at: number;
  updated_at: number;
}

// Type exports for compatibility
export type ItemModel = Item;
export type ReceiptModel = Receipt;
export type ReceiptItemModel = ReceiptItem;
export type CustomerModel = Customer;
export type SyncQueueModel = SyncQueue;
