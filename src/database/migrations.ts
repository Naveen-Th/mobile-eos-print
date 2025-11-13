import { getDatabase } from './index';

/**
 * Run database migrations to add missing columns
 * This handles upgrading existing databases without data loss
 */
export async function runMigrations(): Promise<boolean> {
  const database = getDatabase();
  
  if (!database) {
    console.error('❌ Cannot run migrations: database not initialized');
    return false;
  }

  try {
    console.log('🔄 Running database migrations...');

    // Migration 1: Add balance tracking columns to receipts table
    try {
      // Check if columns exist
      const tableInfo = database.getAllSync('PRAGMA table_info(receipts)');
      const columnNames = tableInfo.map((col: any) => col.name);

      const columnsToAdd = [
        { name: 'old_balance', type: 'REAL DEFAULT 0' },
        { name: 'amount_paid', type: 'REAL DEFAULT 0' },
        { name: 'new_balance', type: 'REAL DEFAULT 0' },
        { name: 'is_paid', type: 'INTEGER DEFAULT 0' },
      ];

      for (const column of columnsToAdd) {
        if (!columnNames.includes(column.name)) {
          console.log(`  Adding column: ${column.name} to receipts table`);
          database.execSync(`ALTER TABLE receipts ADD COLUMN ${column.name} ${column.type}`);
        } else {
          console.log(`  ✓ Column ${column.name} already exists`);
        }
      }
    } catch (error) {
      console.error('❌ Migration failed for receipts table:', error);
      throw error;
    }

    // Migration 2: Add balance_due column to customers table
    try {
      const tableInfo = database.getAllSync('PRAGMA table_info(customers)');
      const columnNames = tableInfo.map((col: any) => col.name);

      if (!columnNames.includes('balance_due')) {
        console.log('  Adding column: balance_due to customers table');
        database.execSync('ALTER TABLE customers ADD COLUMN balance_due REAL DEFAULT 0');
      } else {
        console.log('  ✓ Column balance_due already exists');
      }
    } catch (error) {
      console.error('❌ Migration failed for customers table:', error);
      throw error;
    }

    // Migration 3: Ensure default values for existing NULL columns
    try {
      database.execSync(`
        UPDATE items SET is_synced = 0 WHERE is_synced IS NULL;
        UPDATE receipts SET is_synced = 0 WHERE is_synced IS NULL;
        UPDATE receipts SET printed = 0 WHERE printed IS NULL;
        UPDATE receipts SET is_paid = 0 WHERE is_paid IS NULL;
        UPDATE receipts SET old_balance = 0 WHERE old_balance IS NULL;
        UPDATE receipts SET amount_paid = 0 WHERE amount_paid IS NULL;
        UPDATE receipts SET new_balance = 0 WHERE new_balance IS NULL;
        UPDATE customers SET is_synced = 0 WHERE is_synced IS NULL;
        UPDATE customers SET balance_due = 0 WHERE balance_due IS NULL;
      `);
      console.log('  ✓ Updated NULL values with defaults');
    } catch (error) {
      console.warn('⚠️ Failed to update NULL values (non-critical):', error);
    }

    console.log('✅ Database migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database migrations failed:', error);
    return false;
  }
}

/**
 * Check database health and schema
 */
export function checkDatabaseHealth(): boolean {
  const database = getDatabase();
  
  if (!database) {
    console.error('❌ Database health check failed: database not initialized');
    return false;
  }

  try {
    // Check if all required tables exist
    const tables = database.getAllSync(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = tables.map((t: any) => t.name);

    const requiredTables = ['items', 'receipts', 'receipt_items', 'customers', 'sync_queue'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));

    if (missingTables.length > 0) {
      console.error('❌ Missing tables:', missingTables);
      return false;
    }

    // Check receipts table has balance columns
    const receiptsColumns = database.getAllSync('PRAGMA table_info(receipts)');
    const receiptsColumnNames = receiptsColumns.map((col: any) => col.name);
    
    const requiredReceiptColumns = ['old_balance', 'amount_paid', 'new_balance', 'is_paid'];
    const missingColumns = requiredReceiptColumns.filter(c => !receiptsColumnNames.includes(c));

    if (missingColumns.length > 0) {
      console.warn('⚠️ Receipts table missing columns:', missingColumns);
      console.log('💡 Run migrations to add missing columns');
      return false;
    }

    console.log('✅ Database health check passed');
    return true;
  } catch (error) {
    console.error('❌ Database health check error:', error);
    return false;
  }
}
