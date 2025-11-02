# Firebase Firestore Database Structure

This document outlines the proper Firestore database structure for the Thermal Receipt Printer app with a focus on **proper customer balance tracking**.

## Overview

The app uses two main collections to track customer data and receipt history:
1. **`person_details`** - Master customer/party database with current balance
2. **`receipts`** - Historical receipt records with balance snapshots

## Collections

### 1. `person_details` Collection

**Purpose**: Master customer/party database - single source of truth for customer information and current balance.

**Collection Path**: `/person_details/{personId}`

**Document Structure**:
```typescript
{
  id: string;                    // Auto-generated document ID
  personName: string;            // Customer/Person name (required)
  businessName: string;          // Business name (required)
  phoneNumber: string;           // Formatted phone number with +91 country code
  balanceDue: number;            // CURRENT OUTSTANDING BALANCE (most important field)
  createdAt: Timestamp;          // When customer was first added
  updatedAt: Timestamp;          // Last modified timestamp
}
```

**Key Points**:
- `balanceDue` is the **single source of truth** for customer's current balance
- This field is **updated automatically** when receipts are created
- `balanceDue` represents money the customer OWES (positive = debt, negative = credit)
- Always query this collection to get the latest customer balance
- Indexed on `phoneNumber` for fast duplicate checking
- Indexed on `updatedAt` for recent customers query

**Balance Logic**:
```
New Balance = Current balanceDue + Receipt Total - Amount Paid
```

**Example Documents**:
```javascript
// Customer with outstanding balance
{
  id: "person_001",
  personName: "Navi",
  businessName: "Navi Traders",
  phoneNumber: "+91 98765 43210",
  balanceDue: 14000.00,
  createdAt: Timestamp(2025-01-15),
  updatedAt: Timestamp(2025-01-31)
}

// Customer with no balance (paid in full)
{
  id: "person_002",
  personName: "Raj Kumar",
  businessName: "Raj Electronics",
  phoneNumber: "+91 87654 32109",
  balanceDue: 0,
  createdAt: Timestamp(2025-01-10),
  updatedAt: Timestamp(2025-01-30)
}

// Customer with credit (paid more than owed)
{
  id: "person_003",
  personName: "Priya Sharma",
  businessName: "Sharma General Store",
  phoneNumber: "+91 76543 21098",
  balanceDue: -500.00,  // Negative = customer has credit
  createdAt: Timestamp(2025-01-05),
  updatedAt: Timestamp(2025-01-29)
}
```

---

### 2. `receipts` Collection

**Purpose**: Historical record of all receipts with balance snapshots at time of creation.

**Collection Path**: `/receipts/{receiptId}`

**Document Structure**:
```typescript
{
  id: string;                    // Receipt ID (same as document ID)
  receiptNumber: string;         // Human-readable receipt number (e.g., "R-2025-001")
  customerName: string;          // Customer name at time of receipt
  businessName?: string;         // Business name (optional)
  businessPhone?: string;        // Phone number (optional)
  
  // Items sold
  items: Array<{
    id: string;
    name: string;
    price: number;               // Unit price
    quantity: number;            // Quantity sold
  }>;
  
  // Financial calculations
  subtotal: number;              // Sum of all items
  tax: number;                   // Tax amount
  total: number;                 // Final total (subtotal + tax)
  
  // Balance tracking (snapshot at time of receipt creation)
  oldBalance: number;            // Customer's balance BEFORE this receipt
  isPaid: boolean;               // Whether customer made a payment
  amountPaid: number;            // Amount customer paid (if isPaid is true)
  newBalance: number;            // Customer's balance AFTER this receipt
  
  // Receipt metadata
  date: Timestamp;               // Receipt date
  createdAt: Timestamp;          // When receipt was created
  updatedAt: Timestamp;          // Last modified
  printMethod: 'thermal' | 'pdf'; // How receipt was printed
  printed: boolean;              // Whether receipt was printed
  printedAt?: Timestamp;         // When receipt was printed
  pdfPath?: string;              // Path to PDF if exported
  status: 'draft' | 'printed' | 'exported';
  
  // Company info (for receipt printing)
  companyName: string;
  companyAddress: string;
  footerMessage?: string;
}
```

**Key Points**:
- Balance fields (`oldBalance`, `newBalance`, `amountPaid`) are **SNAPSHOTS** at time of receipt creation
- These are historical records and should NOT be used to determine current balance
- Always use `person_details.balanceDue` for current balance
- Indexed on `customerName` for querying customer receipts
- Indexed on `createdAt` for chronological sorting

**Balance Snapshot Example**:
```javascript
{
  id: "receipt_001",
  receiptNumber: "R-2025-001",
  customerName: "Navi",
  items: [
    { id: "1", name: "Pepper", price: 200.00, quantity: 70 }
  ],
  subtotal: 14000.00,
  tax: 0.00,
  total: 14000.00,
  
  // Balance snapshot at time of receipt
  oldBalance: 0,           // Customer had no previous balance
  isPaid: false,           // Customer did not pay
  amountPaid: 0,           // No payment made
  newBalance: 14000.00,    // New balance after this receipt
  
  date: Timestamp(2025-01-31),
  createdAt: Timestamp(2025-01-31),
  updatedAt: Timestamp(2025-01-31),
  printMethod: "thermal",
  printed: true,
  status: "printed",
  
  companyName: "My Thermal Receipt Store",
  companyAddress: "123 Business St, City, State 12345"
}
```

---

## Balance Tracking Workflow

### When Creating a Receipt:

1. **Fetch Current Balance**:
   ```typescript
   const personDetails = await PersonDetailsService.getPersonDetails();
   const customer = personDetails.find(p => p.personName === customerName);
   const oldBalance = customer?.balanceDue || 0;
   ```

2. **Calculate New Balance**:
   ```typescript
   const receiptTotal = subtotal + tax;
   const amountPaid = isPaid ? userEnteredAmount : 0;
   const newBalance = oldBalance + receiptTotal - amountPaid;
   ```

3. **Save Receipt** (with balance snapshot):
   ```typescript
   const receipt = {
     // ... other fields
     oldBalance: oldBalance,
     isPaid: isPaid,
     amountPaid: amountPaid,
     newBalance: newBalance
   };
   await ReceiptFirebaseService.saveReceipt(receipt);
   ```

4. **Update Customer Balance** in `person_details`:
   ```typescript
   await PersonDetailsService.updatePersonDetail(customerId, {
     balanceDue: newBalance
   });
   ```

### When Querying Customer Balance:

**❌ WRONG** - Don't query receipts collection:
```typescript
// This is inefficient and error-prone
const receipts = await ReceiptFirebaseService.getAllReceipts();
const customerReceipts = receipts.filter(r => r.customerName === name);
const latestReceipt = customerReceipts[0];
const balance = latestReceipt?.newBalance || 0;
```

**✅ CORRECT** - Query person_details directly:
```typescript
// This is fast and reliable
const personDetails = await PersonDetailsService.getPersonDetails();
const customer = personDetails.find(p => p.personName === name);
const balance = customer?.balanceDue || 0;
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Person Details - Protected by authentication
    match /person_details/{personId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null 
        && request.resource.data.keys().hasAll(['personName', 'businessName', 'phoneNumber', 'balanceDue'])
        && request.resource.data.balanceDue is number;
      allow delete: if request.auth != null;
    }
    
    // Receipts - Protected by authentication
    match /receipts/{receiptId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.keys().hasAll(['customerName', 'total', 'oldBalance', 'newBalance'])
        && request.resource.data.oldBalance is number
        && request.resource.data.newBalance is number
        && request.resource.data.amountPaid is number;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

---

## Firestore Indexes

### Required Composite Indexes:

1. **person_details Collection**:
   - Single field: `updatedAt` (Descending) - for recent customers
   - Single field: `phoneNumber` (Ascending) - for duplicate checking

2. **receipts Collection**:
   - Single field: `createdAt` (Descending) - for chronological sorting
   - Composite: `customerName` (Ascending) + `createdAt` (Descending) - for customer receipt history

### Index Creation Commands:

```bash
# Person details indexes
gcloud firestore indexes create --collection-group=person_details \
  --field-config=field-path=updatedAt,order=descending

gcloud firestore indexes create --collection-group=person_details \
  --field-config=field-path=phoneNumber,order=ascending

# Receipts indexes
gcloud firestore indexes create --collection-group=receipts \
  --field-config=field-path=createdAt,order=descending

gcloud firestore indexes create --collection-group=receipts \
  --field-config=field-path=customerName,order=ascending \
  --field-config=field-path=createdAt,order=descending
```

---

## Migration Guide

If you're migrating from an old structure:

1. **Backup existing data**:
   ```bash
   gcloud firestore export gs://your-bucket/backup
   ```

2. **Update person_details with current balances**:
   ```typescript
   // Run this migration script once
   const persons = await PersonDetailsService.getPersonDetails();
   for (const person of persons) {
     const balance = await ReceiptFirebaseService.getCustomerLatestBalance(person.personName);
     await PersonDetailsService.updatePersonDetail(person.id, {
       balanceDue: balance
     });
   }
   ```

3. **Update code to use new balance tracking**

---

## Best Practices

1. **Always use `person_details.balanceDue` for current balance** - Never calculate from receipts
2. **Update balance atomically** - Use Firestore transactions when updating both receipts and person_details
3. **Keep receipt balance fields for audit trail** - Historical snapshots are valuable
4. **Handle new customers gracefully** - Auto-create person_details entry if customer doesn't exist
5. **Validate balance calculations** - Ensure oldBalance + total - amountPaid = newBalance
6. **Use proper error handling** - Balance updates are critical operations

---

## Common Queries

### Get customer current balance:
```typescript
const customer = await PersonDetailsService.searchPersonDetails(customerName);
const balance = customer[0]?.balanceDue || 0;
```

### Get customer receipt history:
```typescript
const receipts = await ReceiptFirebaseService.getAllReceipts();
const customerReceipts = receipts
  .filter(r => r.customerName === customerName)
  .sort((a, b) => b.createdAt - a.createdAt);
```

### Get all customers with outstanding balances:
```typescript
const allCustomers = await PersonDetailsService.getPersonDetails();
const customersWithBalance = allCustomers.filter(c => c.balanceDue > 0);
```

---

## Summary

- **`person_details`**: Master customer database with CURRENT balance (`balanceDue`)
- **`receipts`**: Historical records with balance SNAPSHOTS
- **Always** fetch current balance from `person_details.balanceDue`
- **Always** update `person_details.balanceDue` when creating receipts
- **Keep** historical balance data in receipts for audit trail
