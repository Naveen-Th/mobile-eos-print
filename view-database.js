/**
 * Database Viewer Script
 * Run this in the app to view SQLite database contents
 * 
 * Usage: Import and call viewDatabase() from any component or screen
 */

import { database } from './src/database';

export async function viewDatabase() {
  if (!database) {
    console.log('❌ Database not initialized');
    return;
  }

  console.log('\n========================================');
  console.log('📊 SQLITE DATABASE VIEWER');
  console.log('========================================\n');

  try {
    // View Items Table
    console.log('📦 ITEMS TABLE');
    console.log('----------------------------------------');
    const items = database.getAllSync('SELECT * FROM items');
    console.log(`Total Items: ${items.length}\n`);
    
    if (items.length > 0) {
      items.forEach((item, index) => {
        console.log(`Item ${index + 1}:`);
        console.log(`  ID: ${item.id}`);
        console.log(`  Firebase ID: ${item.firebase_id || 'N/A'}`);
        console.log(`  Name: ${item.item_name}`);
        console.log(`  Price: ₹${item.price}`);
        console.log(`  Stock: ${item.stocks}`);
        console.log(`  Synced: ${item.is_synced ? 'Yes' : 'No'}`);
        console.log(`  Created: ${new Date(item.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('  No items found\n');
    }

    // View Receipts Table
    console.log('📋 RECEIPTS TABLE');
    console.log('----------------------------------------');
    const receipts = database.getAllSync('SELECT * FROM receipts');
    console.log(`Total Receipts: ${receipts.length}\n`);
    
    if (receipts.length > 0) {
      receipts.forEach((receipt, index) => {
        console.log(`Receipt ${index + 1}:`);
        console.log(`  ID: ${receipt.id}`);
        console.log(`  Firebase ID: ${receipt.firebase_id || 'N/A'}`);
        console.log(`  Receipt #: ${receipt.receipt_number}`);
        console.log(`  Customer: ${receipt.customer_name}`);
        console.log(`  Phone: ${receipt.customer_phone || 'N/A'}`);
        console.log(`  Total: ₹${receipt.total}`);
        console.log(`  Status: ${receipt.status}`);
        console.log(`  Synced: ${receipt.is_synced ? 'Yes' : 'No'}`);
        console.log(`  Date: ${new Date(receipt.date).toLocaleString()}`);
        
        // Get receipt items
        const receiptItems = database.getAllSync(
          'SELECT * FROM receipt_items WHERE receipt_id = ?',
          [receipt.id]
        );
        if (receiptItems.length > 0) {
          console.log(`  Items (${receiptItems.length}):`);
          receiptItems.forEach((item) => {
            console.log(`    - ${item.item_name}: ${item.quantity} x ₹${item.price} = ₹${item.total}`);
          });
        }
        console.log('');
      });
    } else {
      console.log('  No receipts found\n');
    }

    // View Customers Table
    console.log('👥 CUSTOMERS TABLE');
    console.log('----------------------------------------');
    const customers = database.getAllSync('SELECT * FROM customers');
    console.log(`Total Customers: ${customers.length}\n`);
    
    if (customers.length > 0) {
      customers.forEach((customer, index) => {
        console.log(`Customer ${index + 1}:`);
        console.log(`  ID: ${customer.id}`);
        console.log(`  Firebase ID: ${customer.firebase_id || 'N/A'}`);
        console.log(`  Name: ${customer.name}`);
        console.log(`  Phone: ${customer.phone || 'N/A'}`);
        console.log(`  Email: ${customer.email || 'N/A'}`);
        console.log(`  Address: ${customer.address || 'N/A'}`);
        console.log(`  Synced: ${customer.is_synced ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('  No customers found\n');
    }

    // View Sync Queue Table
    console.log('🔄 SYNC QUEUE TABLE');
    console.log('----------------------------------------');
    const syncQueue = database.getAllSync('SELECT * FROM sync_queue');
    console.log(`Total Pending Syncs: ${syncQueue.length}\n`);
    
    if (syncQueue.length > 0) {
      syncQueue.forEach((sync, index) => {
        console.log(`Sync ${index + 1}:`);
        console.log(`  ID: ${sync.id}`);
        console.log(`  Entity Type: ${sync.entity_type}`);
        console.log(`  Entity ID: ${sync.entity_id}`);
        console.log(`  Operation: ${sync.operation}`);
        console.log(`  Status: ${sync.status}`);
        console.log(`  Retry Count: ${sync.retry_count}`);
        console.log(`  Error: ${sync.error_message || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('  No pending syncs\n');
    }

    // Summary Statistics
    console.log('📊 SUMMARY');
    console.log('----------------------------------------');
    const unsyncedItems = database.getFirstSync('SELECT COUNT(*) as count FROM items WHERE is_synced = 0');
    const unsyncedReceipts = database.getFirstSync('SELECT COUNT(*) as count FROM receipts WHERE is_synced = 0');
    const totalRevenue = database.getFirstSync('SELECT SUM(total) as sum FROM receipts WHERE status != "draft"');
    
    console.log(`  Total Items: ${items.length} (${unsyncedItems?.count || 0} unsynced)`);
    console.log(`  Total Receipts: ${receipts.length} (${unsyncedReceipts?.count || 0} unsynced)`);
    console.log(`  Total Customers: ${customers.length}`);
    console.log(`  Total Revenue: ₹${totalRevenue?.sum || 0}`);
    console.log(`  Pending Syncs: ${syncQueue.length}`);
    
    console.log('\n========================================');
    console.log('✅ Database viewing complete');
    console.log('========================================\n');

    return {
      items,
      receipts,
      customers,
      syncQueue,
      stats: {
        totalItems: items.length,
        totalReceipts: receipts.length,
        totalCustomers: customers.length,
        unsyncedItems: unsyncedItems?.count || 0,
        unsyncedReceipts: unsyncedReceipts?.count || 0,
        totalRevenue: totalRevenue?.sum || 0,
        pendingSyncs: syncQueue.length,
      }
    };
  } catch (error) {
    console.error('❌ Error viewing database:', error);
    throw error;
  }
}

// Export for use in components
export default viewDatabase;
