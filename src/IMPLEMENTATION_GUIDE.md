# Feature Implementation Guide

This guide provides the complete implementation for the new features added to the Thermal Receipt Printer application.

## ✅ Completed Services

The following services have been created and are ready to use:

1. **AnalyticsService** (`services/AnalyticsService.ts`)
   - Sales analytics and reporting
   - Top selling items
   - Sales by day and category
   - Customer statistics

2. **CategoryService** (`services/CategoryService.ts`)
   - CRUD operations for categories
   - Category validation
   - Item count tracking

3. **PendingBillsService** (`services/PendingBillsService.ts`)
   - Create and manage pending bills
   - Record payments
   - Track customer balances
   - Overdue bill detection

4. **LowStockAlertService** (`services/LowStockAlertService.ts`)
   - Monitor low stock items
   - Critical stock alerts
   - Restock suggestions

5. **ReceiptDeliveryService** (`services/ReceiptDeliveryService.ts`)
   - Email receipt sending (requires Firebase Functions)
   - SMS receipt sending (requires Firebase Functions + Twilio)

6. **CartContext Updates**
   - Balance tracking support
   - Old balance, amount paid, new balance fields

## 📋 Remaining UI Components to Create

### 1. Analytics/Reports Screen

Create: `screens/AnalyticsScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import AnalyticsService from '../services/AnalyticsService';

// This screen will display:
// - Date range selector (Today, Week, Month, Custom)
// - Sales statistics cards
// - Top selling items list
// - Sales chart (daily)
// - Category breakdown
// - Customer stats

export default function AnalyticsScreen() {
  // Implementation here
}
```

### 2. Pending Bills Screen

Create: `screens/PendingBillsScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import PendingBillsService from '../services/PendingBillsService';

// This screen will display:
// - Total pending amount
// - List of customers with pending bills
// - Bill status (pending, partial, overdue)
// - Payment recording functionality
// - Filter and search options

export default function PendingBillsScreen() {
  // Implementation here
}
```

### 3. Category Management Modal

Create: `components/CategoryManagementModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import CategoryService from '../services/CategoryService';

// This component will:
// - List all categories
// - Add new category
// - Edit category
// - Delete category (with validation)
// - Show item count per category

export default function CategoryManagementModal() {
  // Implementation here
}
```

### 4. Low Stock Alerts Component

Create: `components/LowStockAlertsPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import LowStockAlertService from '../services/LowStockAlertService';

// This component will display:
// - Alert banner showing critical/low stock count
// - Expandable list of low stock items
// - Restock suggestions
// - Quick links to edit item stock

export default function LowStockAlertsPanel() {
  // Implementation here
}
```

### 5. Receipt Delivery Options Modal

Create: `components/ReceiptDeliveryModal.tsx`

```typescript
import React, { useState } from 'react';
import ReceiptDeliveryService from '../services/ReceiptDeliveryService';

// This modal will provide:
// - Email input and send button
// - Phone number input and SMS button
// - Delivery status feedback

export default function ReceiptDeliveryModal({ receipt }) {
  // Implementation here
}
```

## 🔧 Integration Points

### 1. Update Receipt Creation Screen

In `components/ReceiptCreationScreen.tsx`, add balance tracking:

```typescript
import PendingBillsService from '../services/PendingBillsService';
import { useCart } from '../context/CartContext';

// On component load, fetch customer balance
useEffect(() => {
  if (cartState.customerName) {
    const fetchBalance = async () => {
      const balance = await PendingBillsService.getInstance()
        .getCustomerBalanceByName(cartState.customerName);
      updateBalance(balance, 0); // Set old balance
    };
    fetchBalance();
  }
}, [cartState.customerName]);

// Add UI to display old balance
<View>
  {cartState.oldBalance && cartState.oldBalance > 0 && (
    <View style={styles.balanceSection}>
      <Text style={styles.balanceLabel}>Previous Balance:</Text>
      <Text style={styles.balanceAmount}>${cartState.oldBalance.toFixed(2)}</Text>
    </View>
  )}
</View>

// Add payment amount input
<View>
  <TextInput
    placeholder="Amount Paid"
    value={amountPaid.toString()}
    onChangeText={(text) => {
      const amount = parseFloat(text) || 0;
      updateBalance(cartState.oldBalance || 0, amount);
    }}
    keyboardType="numeric"
  />
  {cartState.newBalance !== undefined && (
    <Text>New Balance: ${cartState.newBalance.toFixed(2)}</Text>
  )}
</View>

// On receipt creation, save pending bill if there's remaining balance
const createReceipt = async () => {
  // ... existing receipt creation code
  
  if (cartState.newBalance && cartState.newBalance > 0) {
    await PendingBillsService.getInstance().createBill({
      customerId: 'customer_id_here', // Get from customer selection
      customerName: cartState.customerName,
      businessName: cartState.businessName,
      businessPhone: cartState.businessPhone,
      amount: cartState.total,
      paidAmount: cartState.amountPaid || 0,
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
    });
  }
};
```

### 2. Add to Settings Tab

In `app/(tabs)/settings.tsx`, add navigation options:

```typescript
// Add menu items for:
- Categories Management
- Pending Bills
- Low Stock Alerts
- Analytics/Reports
```

### 3. Update Items Screen with Category Filter

In `components/ItemsScreen.tsx` or `app/(tabs)/items.tsx`:

```typescript
import CategoryService from '../services/CategoryService';

// Add category filter dropdown
const [categories, setCategories] = useState([]);
const [selectedCategory, setSelectedCategory] = useState('all');

useEffect(() => {
  const loadCategories = async () => {
    const cats = await CategoryService.getInstance().getAllCategories();
    setCategories(cats);
  };
  loadCategories();
}, []);

// Filter items by category
const filteredItems = items.filter(item => 
  selectedCategory === 'all' || item.category === selectedCategory
);
```

### 4. Add Low Stock Alerts to Home Screen

In `app/(tabs)/index.tsx`:

```typescript
import LowStockAlertService from '../services/LowStockAlertService';

// Show alert banner if there are low stock items
useEffect(() => {
  const checkLowStock = async () => {
    const hasAlerts = await LowStockAlertService.getInstance().hasLowStockAlerts();
    setShowLowStockBanner(hasAlerts);
  };
  checkLowStock();
}, []);
```

### 5. Add Receipt Delivery to Receipt Preview/Detail

In receipt preview/detail screens:

```typescript
import ReceiptDeliveryService from '../services/ReceiptDeliveryService';

// Add buttons for email/SMS
<TouchableOpacity onPress={() => setShowDeliveryModal(true)}>
  <Text>Send Receipt</Text>
</TouchableOpacity>

<ReceiptDeliveryModal 
  visible={showDeliveryModal}
  receipt={receipt}
  onClose={() => setShowDeliveryModal(false)}
/>
```

## 🗄️ Firebase Firestore Collections

The following collections will be created automatically by the services:

1. **categories**
   - id, name, description, color, icon, itemCount, createdAt, updatedAt

2. **pending_bills**
   - id, customerId, customerName, businessName, businessPhone
   - amount, paidAmount, remainingBalance
   - receiptId, receiptNumber, notes, dueDate, status
   - createdAt, updatedAt

3. **bill_payments**
   - id, billId, amount, paymentMethod, notes
   - receiptId, receiptNumber, createdAt

4. **person_details** (updated)
   - ... existing fields
   - balanceDue (new field for tracking total customer balance)

## 🔔 Firebase Cloud Functions Setup

For Email/SMS functionality, create Firebase Functions:

```bash
cd functions
npm install nodemailer twilio
```

Then implement the functions as shown in `ReceiptDeliveryService.ts` comments.

## 📊 Chart Libraries (Optional)

For analytics charts, consider installing:

```bash
npm install react-native-chart-kit
# or
npm install victory-native
```

## 🧪 Testing Checklist

- [ ] Test analytics with different date ranges
- [ ] Create and manage categories
- [ ] Test low stock alerts with items below threshold
- [ ] Create pending bills and record payments
- [ ] Verify balance tracking in receipt creation
- [ ] Test email/SMS delivery (after Cloud Functions setup)
- [ ] Test category filtering in items screen
- [ ] Verify pending bills statistics

## 📝 Next Steps

1. Create the UI components listed above
2. Integrate services into existing screens
3. Test all functionality
4. Set up Firebase Cloud Functions for email/SMS
5. Add proper error handling and loading states
6. Implement chart visualizations for analytics
7. Add export functionality for reports

## 🎨 UI Design Recommendations

- Use consistent color coding:
  - Red for critical/overdue
  - Orange for low stock/partial payments
  - Green for paid/good stock
  - Blue for information

- Add badges/indicators for:
  - Low stock alerts count
  - Pending bills count
  - Unread notifications

- Use modals for:
  - Category management
  - Receipt delivery
  - Payment recording

- Use dedicated screens for:
  - Analytics/Reports
  - Pending Bills list
  - Low Stock items list

This implementation provides a solid foundation for a complete POS system with advanced features!
