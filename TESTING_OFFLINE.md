# Testing Offline-First Functionality

## Quick Test Checklist

### ✅ Phase 1: Setup & Initial Sync
1. Start the app with internet connection
2. Check console logs for "Initializing offline-first service"
3. Verify "Initial sync: X items synced" message
4. Confirm floating sync status shows 🟢 (green)

### ✅ Phase 2: Test Offline Creation
1. **Disable internet** (airplane mode or WiFi off)
2. Check sync status shows 🔴 (red/offline)
3. Create a new item:
   ```typescript
   await OfflineFirstService.createItem({
     item_name: 'Test Item',
     price: 10.00,
     stocks: 5,
   });
   ```
4. Item should appear immediately in UI
5. Sync status should show "1" pending operation
6. **Enable internet**
7. Watch console for "Auto-sync triggered"
8. Verify item syncs to Firebase
9. Check Firebase console - item should be there
10. Pending operations should go to 0

### ✅ Phase 3: Test Offline Updates
1. Create/select an existing item (while online)
2. **Disable internet**
3. Update the item:
   ```typescript
   await OfflineFirstService.updateItem(itemId, {
     stocks: 20,
   });
   ```
4. Changes should show immediately
5. Check pending operations count increases
6. **Enable internet**
7. Verify update syncs to Firebase
8. Check Firebase console for updated data

### ✅ Phase 4: Test Offline Receipts
1. **Disable internet**
2. Create a receipt:
   ```typescript
   await OfflineFirstService.createReceipt({
     receiptNumber: 'R-TEST-001',
     customerName: 'Test Customer',
     items: [{
       itemName: 'Test Item',
       quantity: 2,
       price: 10.00,
       total: 20.00,
     }],
     subtotal: 20.00,
     tax: 2.00,
     total: 22.00,
   });
   ```
3. Receipt appears in list immediately
4. **Enable internet**
5. Verify receipt syncs to Firebase

### ✅ Phase 5: Test Real-time Sync
1. Open app on Device A (online)
2. Open app on Device B (online) or Firebase console
3. Create item on Device B
4. Watch Device A - should auto-update
5. Update item on Device A
6. Watch Device B - should see change

### ✅ Phase 6: Test Sync Queue Recovery
1. **Disable internet**
2. Create 5 items
3. Update 3 existing items
4. Delete 1 item
5. Check sync status modal:
   - Should show 9 pending operations
   - Operations list visible
6. **Force close app**
7. **Restart app** (still offline)
8. Check pending operations - should still be 9
9. **Enable internet**
10. All operations should sync automatically

### ✅ Phase 7: Test Failed Sync Handling
1. **Disable internet**
2. Create item with invalid data (test error)
3. **Enable internet**
4. Item sync fails
5. Check sync status:
   - Failed operations count increases
   - Error message displayed
6. Use "Retry All" button
7. Use "Clear Failed" if needed

## Manual Testing Commands

### Check Local Database
```bash
# iOS Simulator
xcrun simctl get_app_container booted <bundle-id> data

# Android Emulator
adb shell run-as <package-name> ls databases/
```

### View Sync Queue
```typescript
import { syncQueueCollection } from './src/database';

// Get all pending
const pending = await syncQueueCollection
  .query(Q.where('status', 'pending'))
  .fetch();

console.log('Pending operations:', pending.length);
```

### Force Sync
```typescript
import OfflineFirstService from './src/services/OfflineFirstService';

await OfflineFirstService.syncNow();
```

## Expected Console Logs

### On App Start (Online)
```
🚀 Initializing offline-first service...
🔄 Starting pull from Firebase...
📥 Initial sync: 10 items synced, 0 failed
🔄 Setting up real-time sync listeners...
✅ Offline-first service initialized
🌐 Network status changed: { isConnected: true, type: 'wifi' }
```

### On Offline Creation
```
✅ Item created locally: abc123
📝 Queued create operation for item:abc123
🌐 Network status changed: { isConnected: false }
```

### On Reconnection
```
🌐 Network status changed: { isConnected: true }
✅ Connection restored - triggering sync...
🔄 Starting full sync...
🔄 Starting push to Firebase...
📤 Found 1 pending operations
✅ Synced item create operation
✅ Push complete: 1 synced, 0 failed
🔄 Starting pull from Firebase...
✅ Pull complete: 0 synced, 0 failed
✅ Full sync complete: 1 synced, 0 failed
```

## Common Issues & Solutions

### Issue: Items not syncing
**Solution:**
1. Check network connection (tap sync status)
2. Check sync queue for errors
3. Verify Firebase permissions
4. Check console for error messages
5. Try manual sync button

### Issue: Duplicate items after sync
**Solution:**
1. This shouldn't happen with proper Firebase IDs
2. Check that `firebaseId` is set correctly
3. Verify sync queue is processing in order
4. Clear local DB and re-sync if needed

### Issue: Real-time updates not working
**Solution:**
1. Check if listeners are active (console logs)
2. Verify Firebase rules allow read access
3. Check network connection
4. Restart app to re-establish listeners

### Issue: App slow when offline
**Solution:**
1. Check size of local database
2. Clean old sync queue items
3. Add indexes to frequently queried fields
4. Batch operations when possible

## Performance Benchmarks

### Expected Performance
- **Local read**: < 50ms
- **Local write**: < 100ms
- **Sync push**: 200-500ms per operation
- **Sync pull**: 500-2000ms (depends on data size)
- **Real-time update**: 100-300ms

### Database Size Limits
- **Items**: Up to 10,000 recommended
- **Receipts**: Up to 50,000 recommended
- **Sync Queue**: Auto-cleanup after 24h

## Automated Testing

### Unit Tests
```typescript
describe('OfflineFirstService', () => {
  it('should create item offline', async () => {
    // Disable network
    await NetInfo.configure({ reachabilityTest: () => Promise.resolve(false) });
    
    const item = await OfflineFirstService.createItem({
      item_name: 'Test',
      price: 10,
    });
    
    expect(item.isSynced).toBe(false);
    
    // Check sync queue
    const queue = await syncQueueCollection.query().fetch();
    expect(queue.length).toBeGreaterThan(0);
  });
});
```

## Monitoring Sync Health

Check these metrics regularly:

1. **Pending Operations** - Should be 0 when online
2. **Failed Operations** - Should be 0 
3. **Sync Success Rate** - Should be > 95%
4. **Average Sync Time** - Should be < 1000ms

## Reset & Clean Database

### Clear All Local Data
```typescript
import { database } from './src/database';

await database.write(async () => {
  await database.unsafeResetDatabase();
});
```

### Clear Sync Queue Only
```typescript
import { syncQueueCollection } from './src/database';
import { Q } from '@nozbe/watermelondb';

await database.write(async () => {
  const allQueue = await syncQueueCollection.query().fetch();
  await Promise.all(allQueue.map(item => item.markAsDeleted()));
});
```

## Debug Mode

Enable detailed logging:
```typescript
// In SyncEngine.ts, add to top:
const DEBUG = true;

// Then add throughout:
if (DEBUG) console.log('Detailed debug info:', data);
```

## Next Steps

After confirming offline functionality works:

1. ✅ Test on physical devices (iOS & Android)
2. ✅ Test with poor network conditions (3G simulation)
3. ✅ Load test with large datasets
4. ✅ Test multi-device sync scenarios
5. ✅ Monitor Firebase usage/costs
6. ✅ Set up error reporting (Sentry/Crashlytics)
7. ✅ Add analytics for sync metrics
