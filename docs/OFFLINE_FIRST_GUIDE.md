# Offline-First Implementation Guide

## Overview

This app now implements a complete offline-first architecture using:
- **WatermelonDB** - Local SQLite database for offline data storage
- **NetInfo** - Real-time network status monitoring
- **Redux Persist** - State persistence across app restarts
- **React Query** - Optimistic updates and cache management
- **Sync Engine** - Bi-directional sync with Firebase

## Architecture

```
┌─────────────────┐
│   React Native  │
│   Components    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ OfflineFirst    │◄────►│   WatermelonDB   │
│    Service      │      │  (Local SQLite)  │
└────────┬────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Sync Engine    │◄────►│    Firebase      │
│  (Queue + Sync) │      │   (Remote DB)    │
└────────┬────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│    NetInfo      │
│ (Network Status)│
└─────────────────┘
```

## Key Features

### 1. **Offline Data Access**
- All data is stored locally in WatermelonDB
- App works 100% offline
- No network required to view/edit data

### 2. **Automatic Sync**
- Background sync when online
- Real-time listeners for Firebase updates
- Conflict resolution (last-write-wins)

### 3. **Sync Queue**
- Failed operations are queued
- Automatic retry when connection restored
- Manual retry option in UI

### 4. **Network Monitoring**
- Real-time connection status
- Connection quality detection
- Automatic sync on reconnection

## Usage

### Initialize Offline-First Service

```typescript
import React, { useEffect } from 'react';
import OfflineFirstService from './src/services/OfflineFirstService';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';

function App() {
  const networkStatus = useNetworkStatus();
  
  useEffect(() => {
    // Initialize offline-first service on app startup
    OfflineFirstService.initialize();
  }, []);

  return (
    <YourAppContent />
  );
}
```

### Working with Items

```typescript
import OfflineFirstService from '../services/OfflineFirstService';

// Get all items (from local DB)
const items = await OfflineFirstService.getItems();

// Create item (saved locally, synced when online)
const newItem = await OfflineFirstService.createItem({
  item_name: 'Coffee',
  price: 3.50,
  stocks: 100,
});

// Update item
await OfflineFirstService.updateItem(itemId, {
  stocks: 50,
});

// Delete item
await OfflineFirstService.deleteItem(itemId);
```

### Working with Receipts

```typescript
// Create receipt (with items)
const receipt = await OfflineFirstService.createReceipt({
  receiptNumber: 'R-001',
  customerName: 'John Doe',
  items: [
    {
      itemName: 'Coffee',
      quantity: 2,
      price: 3.50,
      total: 7.00,
    },
  ],
  subtotal: 7.00,
  tax: 0.70,
  total: 7.70,
  status: 'printed',
});

// Get all receipts
const receipts = await OfflineFirstService.getReceipts();

// Get receipt by ID (with items)
const receiptData = await OfflineFirstService.getReceiptById(receiptId);
```

### Manual Sync

```typescript
// Trigger manual sync
try {
  await OfflineFirstService.syncNow();
  console.log('Sync successful');
} catch (error) {
  console.error('Sync failed:', error);
}

// Check if online
const isOnline = OfflineFirstService.isOnline();

// Get pending sync count
const pendingCount = await OfflineFirstService.getPendingSyncCount();
```

### Using WatermelonDB Observables (Real-time Updates)

```typescript
import { withObservables } from '@nozbe/with-observables';
import { itemsCollection } from '../database';

// Component that auto-updates when data changes
const ItemsList = ({ items }) => (
  <FlatList
    data={items}
    renderItem={({ item }) => (
      <Text>{item.itemName} - ${item.price}</Text>
    )}
  />
);

// Enhance with observables
export default withObservables([], () => ({
  items: itemsCollection.query().observe(),
}))(ItemsList);
```

## How It Works

### 1. **App Starts**
- WatermelonDB initializes local database
- Network status monitoring begins
- If online: Initial sync from Firebase → WatermelonDB
- Real-time listeners established

### 2. **User Creates/Updates Data**
- Data saved immediately to WatermelonDB
- UI updates instantly (optimistic)
- Operation added to sync queue
- If online: Sync immediately to Firebase
- If offline: Queue for later sync

### 3. **User Goes Offline**
- App continues working normally
- All changes saved to local DB
- Operations queued for sync
- UI shows offline indicator

### 4. **User Comes Online**
- NetInfo detects connection
- Automatic sync triggered (after 2s delay)
- Queued operations pushed to Firebase
- Remote changes pulled to local DB
- UI updates with synced data

### 5. **Conflict Resolution**
- Last-write-wins strategy
- Timestamps compared
- Newer data takes precedence
- Failed syncs marked in queue

## Sync Status UI

The app includes a comprehensive sync status indicator:

### Floating Indicator
- Shows connection status (🟢/🟡/🔴)
- Displays pending operation count
- Tap to open detailed status

### Detailed Status Modal
- **Connection Status**: Online/offline, connection quality, network type
- **Sync Operations**: Pending/failed operation counts
- **Performance Metrics**: Total syncs, success rate, average sync time
- **Cache Statistics**: Query cache stats
- **Manual Sync Button**: Force sync when online
- **Retry/Clear Failed**: Manage failed operations

## Testing Offline Functionality

### 1. **Test Offline Creation**
```bash
# Disable network
# Create items/receipts in app
# Check local database
# Enable network
# Verify sync to Firebase
```

### 2. **Test Offline Updates**
```bash
# Create items online (synced)
# Disable network
# Update items
# Check local changes
# Enable network
# Verify sync
```

### 3. **Test Conflict Resolution**
```bash
# Create item on Device A (synced)
# Disable network on Device A
# Update item on Device A
# Update same item on Device B (synced)
# Enable network on Device A
# Check final state (last write wins)
```

## Database Schema

### Items Table
- `id` - Local UUID
- `firebase_id` - Firebase document ID
- `item_name` - Product name
- `price` - Unit price
- `stocks` - Available quantity
- `is_synced` - Sync status
- `synced_at` - Last sync timestamp

### Receipts Table
- `id` - Local UUID  
- `firebase_id` - Firebase document ID
- `receipt_number` - Receipt number
- `customer_name` - Customer name
- `subtotal`, `tax`, `total` - Amounts
- `date` - Receipt date
- `status` - Draft/printed/exported
- `is_synced` - Sync status

### Sync Queue Table
- `entity_type` - Item/receipt/customer
- `entity_id` - Local entity ID
- `operation` - Create/update/delete
- `payload` - JSON data
- `status` - Pending/processing/failed/completed
- `retry_count` - Retry attempts

## Troubleshooting

### Sync Not Working
1. Check network connection
2. Check Firebase permissions
3. View sync queue in database
4. Check console logs for errors

### Data Not Updating
1. Check if observables are set up
2. Verify real-time listeners active
3. Check React Query cache
4. Force refresh/clear cache

### Performance Issues
1. Reduce sync frequency
2. Batch operations
3. Optimize queries with indexes
4. Clean old sync queue items

## Best Practices

1. **Always use OfflineFirstService** for data operations
2. **Use observables** for real-time UI updates
3. **Handle offline state** in UI (show indicators)
4. **Test offline scenarios** regularly
5. **Monitor sync queue** for failed operations
6. **Implement proper error handling** for sync failures
7. **Keep local DB clean** (periodic cleanup)

## Migration from Old Code

To migrate existing code:

1. **Replace direct Firebase calls** with OfflineFirstService
2. **Use WatermelonDB queries** instead of Firestore queries
3. **Add observables** to components for real-time updates
4. **Remove manual cache management** (handled automatically)
5. **Update UI** to show offline/sync status

Example:
```typescript
// OLD
const items = await getDocs(collection(db, 'item_details'));

// NEW
const items = await OfflineFirstService.getItems();
```

## Resources

- [WatermelonDB Docs](https://nozbe.github.io/WatermelonDB/)
- [NetInfo Docs](https://github.com/react-native-netinfo/react-native-netinfo)
- [React Query Offline](https://tanstack.com/query/latest/docs/react/guides/offline)
