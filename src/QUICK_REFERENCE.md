# 🚀 Quick Reference Guide

## New Files Created

### Services (Backend Logic)
```
services/
├── AnalyticsService.ts       (288 lines) - Sales analytics & reports
├── CategoryService.ts         (284 lines) - Category CRUD operations
├── PendingBillsService.ts     (481 lines) - Customer balance tracking
├── LowStockAlertService.ts    (254 lines) - Stock monitoring
└── ReceiptDeliveryService.ts  (330 lines) - Email/SMS delivery
```

### Screens (Full Pages)
```
screens/
├── AnalyticsScreen.tsx        (326 lines) - Analytics dashboard
└── PendingBillsScreen.tsx     (355 lines) - Bill management
```

### Components (Reusable UI)
```
components/
├── CategoryManagementModal.tsx  (288 lines) - Category manager
├── LowStockAlertsPanel.tsx      (141 lines) - Alert banner
└── ReceiptDeliveryModal.tsx     (254 lines) - Email/SMS sender
```

### Updated Files
```
Modified:
├── app/(tabs)/index.tsx          - Added low stock alerts
├── app/(tabs)/settings.tsx       - Added 3 new menu items
├── layout/AppLayout.tsx          - Added stack navigation
├── context/CartContext.tsx       - Added balance tracking
├── types/index.ts                - Updated CartState interface
└── components/Receipts/ReceiptDetailModal.tsx - Added send button
```

## Import Statements

### Use Analytics
```typescript
import AnalyticsService from '../services/AnalyticsService';

const analytics = await AnalyticsService.getInstance().getTodayStats();
```

### Use Categories
```typescript
import CategoryService from '../services/CategoryService';

const categories = await CategoryService.getInstance().getAllCategories();
```

### Use Pending Bills
```typescript
import PendingBillsService from '../services/PendingBillsService';

const bills = await PendingBillsService.getInstance().getAllPendingBills();
```

### Use Low Stock
```typescript
import LowStockAlertService from '../services/LowStockAlertService';

const alerts = await LowStockAlertService.getInstance().getLowStockItems();
```

### Use Receipt Delivery
```typescript
import ReceiptDeliveryService from '../services/ReceiptDeliveryService';

await ReceiptDeliveryService.getInstance().sendEmailReceipt({...});
```

## Component Usage

### Low Stock Panel
```typescript
import LowStockAlertsPanel from '../components/LowStockAlertsPanel';

<LowStockAlertsPanel onItemPress={(id) => console.log(id)} />
```

### Category Modal
```typescript
import CategoryManagementModal from '../components/CategoryManagementModal';

<CategoryManagementModal
  visible={show}
  onClose={() => setShow(false)}
/>
```

### Receipt Delivery
```typescript
import ReceiptDeliveryModal from '../components/ReceiptDeliveryModal';

<ReceiptDeliveryModal
  visible={show}
  receipt={receipt}
  onClose={() => setShow(false)}
/>
```

## Navigation

### Go to Analytics
```typescript
navigation.navigate('AnalyticsScreen');
```

### Go to Pending Bills
```typescript
navigation.navigate('PendingBillsScreen');
```

## Firebase Collections

### Auto-Created Collections
- `categories` - Product categories with colors
- `pending_bills` - Customer unpaid balances
- `bill_payments` - Payment transaction history

### Collection Queries
```typescript
// Get all categories
const categoriesRef = collection(db, 'categories');

// Get pending bills
const billsRef = collection(db, 'pending_bills');

// Get payments for a bill
const paymentsRef = collection(db, 'bill_payments');
```

## Common Tasks

### Check Low Stock
```typescript
const service = LowStockAlertService.getInstance();
const hasAlerts = await service.hasLowStockAlerts();
const items = await service.getLowStockItems();
```

### Get Sales Data
```typescript
const service = AnalyticsService.getInstance();
const today = await service.getTodayStats();
const week = await service.getWeekStats();
const month = await service.getMonthStats();
```

### Manage Categories
```typescript
const service = CategoryService.getInstance();

// Create
await service.createCategory({
  name: 'Electronics',
  description: 'Electronic items',
  color: '#3b82f6'
});

// Update
await service.updateCategory(id, { name: 'Updated' });

// Delete
await service.deleteCategory(id);
```

### Record Payment
```typescript
const service = PendingBillsService.getInstance();

await service.recordPayment({
  billId: 'bill123',
  amount: 50,
  paymentMethod: 'cash'
});
```

### Send Receipt
```typescript
const service = ReceiptDeliveryService.getInstance();

// Email
await service.sendEmailReceipt({
  to: 'customer@email.com',
  subject: 'Your Receipt',
  receipt: receiptData
});

// SMS
await service.sendSMSReceipt({
  to: '+1234567890',
  receipt: receiptData
});
```

## Cart Context Updates

### Balance Tracking
```typescript
import { useCart } from '../context/CartContext';

const { state, updateBalance } = useCart();

// Set old balance
updateBalance(100, 0);

// Record payment
updateBalance(100, 50); // Old: 100, Paid: 50, New: 50

// Access values
state.oldBalance    // 100
state.amountPaid    // 50
state.newBalance    // 50
```

## Color Codes

```typescript
// Use these for consistent UI
const colors = {
  primary: '#3b82f6',    // Blue - Primary actions
  success: '#10b981',    // Green - Success, payments
  danger: '#ef4444',     // Red - Critical, delete
  warning: '#f59e0b',    // Orange - Warnings, low stock
  secondary: '#8b5cf6',  // Purple - Secondary info
  gray: '#6b7280'        // Gray - Neutral
};
```

## Error Handling

All services include try-catch blocks and return:
```typescript
try {
  const result = await service.someMethod();
} catch (error) {
  console.error('Error:', error);
  Alert.alert('Error', 'Something went wrong');
}
```

## Testing Tips

1. **Analytics**: Create some receipts first to see data
2. **Categories**: Create before assigning to items
3. **Pending Bills**: Requires customer with personId
4. **Low Stock**: Set item minStock and stocks values
5. **Email/SMS**: Requires Firebase Cloud Functions setup

## Troubleshooting

### Navigation Not Working?
Ensure `@react-navigation/stack` is installed:
```bash
npm install @react-navigation/stack
```

### Services Not Working?
Check Firebase initialization in the service.

### UI Not Showing?
Verify imports and component names are correct.

### Styles Not Applied?
Check NativeWind/Tailwind CSS is configured.

## Next Steps

1. ✅ Run the app
2. ✅ Test each feature
3. ✅ Create test data
4. ✅ Verify Firebase collections
5. ⏳ Set up Cloud Functions (optional for email/SMS)

## Support

All services have:
- ✅ Error logging
- ✅ Type safety (TypeScript)
- ✅ Singleton pattern
- ✅ Firebase integration
- ✅ Cache management

Check console logs for debugging!
