# Translation Implementation Guide

## ✅ Completed
1. **Translation files created** for all three languages (English, Hindi, Kannada)
2. **Language service** created for persisting language preference
3. **Language context** created with `useLanguage` hook
4. **LanguageProvider** added to app root in `MobileApp.tsx`
5. **Settings screen** fully translated and working

## 🔄 To Implement

### Pattern for Using Translations

Add this to the top of each screen component:

```typescript
import { useLanguage } from '../../contexts/LanguageContext';

// Inside component:
const { t } = useLanguage();
```

Then replace hardcoded strings with translation keys:

```typescript
// Before:
<Text>Receipts</Text>

// After:
<Text>{t('receipts.title')}</Text>
```

### Available Translation Keys

#### Receipts Screen (`receipts.*`)
- `receipts.title` - "Receipts"
- `receipts.receiptCount` - "{{count}} receipts"
- `receipts.searchPlaceholder` - "Search receipts, customers, items..."
- `receipts.total` - "Total"
- `receipts.print` - "Print"
- `receipts.savePDF` - "Save PDF"
- `receipts.loading` - "Loading receipts..."
- `receipts.error` - "Failed to load receipts"
- `receipts.retry` - "Retry"
- `receipts.status.all/printed/exported/draft/failed`
- `receipts.sortBy` - "Sort by"
- `receipts.filter` - "Filter"
- `receipts.date` - "Date"
- `receipts.customer` - "Customer"
- `receipts.delete` - "Delete"
- `receipts.deleteConfirm` - "Are you sure you want to delete this receipt?"

#### POS/Home Screen (`pos.*`)
- `pos.title` - "POS"
- `pos.greeting.morning/afternoon/evening/night`
- `pos.todaysSales` - "Today's Sales"
- `pos.transactions` - "Transactions"
- `pos.itemsSold` - "Items Sold"
- `pos.avgOrder` - "Avg Order"
- `pos.completedToday` - "completed today"
- `pos.unitsMoved` - "units moved"
- `pos.perTransaction` - "per transaction"
- `pos.quickActions` - "Quick Actions"
- `pos.createReceipt` - "Create Receipt"
- `pos.quickPrint` - "Quick Print"
- `pos.manageItems` - "Manage Items"
- `pos.reports` - "Reports"
- `pos.printerSetup` - "Printer Setup"
- `pos.backup` - "Backup"

#### Items Screen (`items.*`)
- `items.title` - "Items"
- `items.itemCount` - "{{count}} items"
- `items.searchPlaceholder` - "Search items..."
- `items.addItem` - "Add Item"
- `items.editItem` - "Edit Item"
- `items.deleteItem` - "Delete Item"
- `items.deleteConfirm` - "Are you sure you want to delete this item?"
- `items.deleteMultiple` - "Delete {{count}} items"
- `items.deleteAll` - "Delete All Items"
- `items.noItems` - "No items found"
- `items.loading` - "Loading items..."
- `items.error` - "Failed to load items"
- `items.itemName` - "Item Name"
- `items.price` - "Price"
- `items.stock` - "Stock"
- `items.inStock` - "In Stock"
- `items.outOfStock` - "Out of Stock"
- `items.lowStock` - "Low Stock"
- `items.addStock` - "Add Stock"
- `items.sortBy` - "Sort by"
- `items.name` - "Name"
- `items.filters` - "Filters"

#### Common (`common.*`)
- `common.ok` - "OK"
- `common.cancel` - "Cancel"
- `common.save` - "Save"
- `common.close` - "Close"
- `common.delete` - "Delete"
- `common.edit` - "Edit"
- `common.add` - "Add"
- `common.search` - "Search"
- `common.filter` - "Filter"
- `common.sort` - "Sort"
- `common.loading` - "Loading..."
- `common.error` - "Error"
- `common.success` - "Success"
- `common.retry` - "Retry"
- `common.refresh` - "Refresh"
- `common.yes` - "Yes"
- `common.no` - "No"

### Examples with Parameters

For dynamic values, use parameters:

```typescript
// With count parameter:
t('receipts.receiptCount', { count: receipts.length })
// Output: "6 receipts" / "6 रसीदें" / "6 ರಸೀತಿಗಳು"

// With rate parameter:
t('settings.taxSettingsSubtitle', { rate: currentTaxRate })
// Output: "Current rate: 8%" / "वर्तमान दर: 8%" / "ಪ್ರಸ್ತುತ ದರ: 8%"
```

## Quick Implementation Priority

1. **Tab Bar Labels** - Update `_layout.tsx` tab titles
2. **Receipts Screen** - Most visible to users (Search bar, buttons, status labels)
3. **POS Screen** - Greetings, stats labels, quick action buttons
4. **Items Screen** - Search bar, buttons, empty states

## Testing

After implementing translations:
1. Go to Settings → Language
2. Select Hindi - verify all translated text appears in Hindi
3. Select Kannada - verify all translated text appears in Kannada
4. Switch back to English

## Notes

- **Customer names** (like "Navi", "Shashwath") will NOT be translated - these are proper nouns
- **Dynamic data** (prices, dates, counts) will remain as-is
- Only **UI labels, buttons, and static text** are translated
- Language preference is saved and persists across app restarts
