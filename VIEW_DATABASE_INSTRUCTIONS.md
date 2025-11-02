# How to View SQLite Database Data

Since you're running the app in Expo Go (non-rooted), you can't directly access the database file via adb. Instead, use the built-in database viewer.

## Method 1: Using the Settings Screen (Easiest)

I've added a "View Database" button to your Settings screen.

### Steps:

1. **Open the app** in your Android emulator/device
2. **Navigate to Settings** (tap the Settings tab)
3. **Scroll down** and tap on **"View Database"**
4. **Check the Metro bundler console** (terminal where you ran `npm start`)
5. You'll see a complete dump of all tables with formatted data

### What You'll See:

```
========================================
📊 SQLITE DATABASE VIEWER
========================================

📦 ITEMS TABLE
----------------------------------------
Total Items: 5

Item 1:
  ID: item_1234567890_abc123
  Firebase ID: xyz789
  Name: Thermal Paper Roll
  Price: ₹250
  Stock: 50
  Synced: Yes
  Created: 10/31/2025, 5:45:00 PM

📋 RECEIPTS TABLE
----------------------------------------
Total Receipts: 3

Receipt 1:
  ID: receipt_1234567890_xyz456
  Receipt #: REC-001
  Customer: John Doe
  Phone: +91 9876543210
  Total: ₹1500
  Status: completed
  Synced: Yes
  Date: 10/31/2025, 5:30:00 PM
  Items (2):
    - Thermal Paper Roll: 2 x ₹250 = ₹500
    - Printer Ink: 1 x ₹1000 = ₹1000

👥 CUSTOMERS TABLE
----------------------------------------
Total Customers: 10

🔄 SYNC QUEUE TABLE
----------------------------------------
Total Pending Syncs: 0

📊 SUMMARY
----------------------------------------
  Total Items: 5 (0 unsynced)
  Total Receipts: 3 (0 unsynced)
  Total Customers: 10
  Total Revenue: ₹4500
  Pending Syncs: 0
```

## Method 2: Using React Native Debugger

1. Open React Native Debugger or Chrome DevTools
2. In the console, run:
   ```javascript
   require('./view-database').default()
   ```

## Method 3: From Any Component (Programmatic)

You can call `viewDatabase()` from anywhere in your app:

```typescript
import viewDatabase from '../../view-database';

// In your component
const handleViewDatabase = async () => {
  const data = await viewDatabase();
  console.log('Database stats:', data.stats);
};
```

## Method 4: Using adb (For Development Builds Only)

If you build a development APK (not Expo Go):

```bash
# Pull the database
adb exec-out run-as com.thermalprinter.mobile cat databases/thermalprinter.db > thermalprinter.db

# Query it
sqlite3 thermalprinter.db "SELECT * FROM items;"
```

## Tables in the Database

Your SQLite database contains:

1. **items** - Product inventory
   - id, firebase_id, item_name, price, stocks, created_at, updated_at, synced_at, is_synced

2. **receipts** - Receipt records
   - id, firebase_id, receipt_number, customer_name, customer_phone, customer_address, 
   - subtotal, tax, total, date, print_method, printed, status, notes
   - created_at, updated_at, synced_at, is_synced

3. **receipt_items** - Line items for receipts
   - id, receipt_id, item_id, item_name, quantity, price, total, created_at, updated_at

4. **customers** - Customer information
   - id, firebase_id, name, phone, email, address, created_at, updated_at, synced_at, is_synced

5. **sync_queue** - Pending synchronization operations
   - id, entity_type, entity_id, operation, payload, retry_count, status, error_message
   - created_at, updated_at

## Troubleshooting

### "Database not initialized" error
- Make sure the app has fully loaded
- Try logging in first (database initializes on app start)

### "No data found"
- If tables are empty, add some items or receipts through the app
- Check if sync has occurred (login required for Firebase sync)

### Console not showing output
- Check the Metro bundler terminal (where you ran `npm start`)
- Not the Android Studio logcat - output goes to Metro

## Location of Database File

The SQLite database is stored at:
- **Android**: `/data/data/host.exp.exponent/databases/thermalprinter.db` (in Expo Go)
- **iOS**: App Container → Documents → SQLite/thermalprinter.db

Database persistence:
- ✅ Survives app restarts
- ✅ Survives app updates
- ❌ Cleared on app uninstall
- ❌ Not accessible without root/debug mode in production
