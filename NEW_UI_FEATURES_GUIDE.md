# 🎉 New UI Features - Usage Guide

## Features Implemented

### ✅ Smart Search with Filters

---

## 🔍 Smart Search with Filters

### What it does:
Powerful search bar with 8 filter options!

**Filters:**
- All
- Paid ✓
- Unpaid ⚠
- Partial ⏱
- Overdue 🚨
- Today 📅
- This Week 📆
- This Month 📆

### How to use:

```tsx
import SmartSearchBar from '../components/Receipts/SmartSearchBar';

// In component state:
const [searchQuery, setSearchQuery] = useState('');
const [activeFilters, setActiveFilters] = useState<string[]>(['all']);

// Filter toggle logic:
const handleFilterToggle = (filterId: string) => {
  if (filterId === 'all') {
    setActiveFilters(['all']);
  } else {
    const newFilters = activeFilters.includes(filterId)
      ? activeFilters.filter(f => f !== filterId)
      : [...activeFilters.filter(f => f !== 'all'), filterId];
    
    setActiveFilters(newFilters.length === 0 ? ['all'] : newFilters);
  }
};

// In JSX (replace existing search):
<SmartSearchBar
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  activeFilters={activeFilters}
  onFilterToggle={handleFilterToggle}
  onClearAll={() => setActiveFilters(['all'])}
/>
```

### Filter Logic Implementation:

Add this filtering logic to your receipts list:

```tsx
// Filter receipts based on search and filters
const filteredReceipts = useMemo(() => {
  let filtered = receipts;
  
  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(receipt =>
      receipt.customerName?.toLowerCase().includes(query) ||
      receipt.receiptNumber?.toLowerCase().includes(query)
    );
  }
  
  // Active filters
  if (!activeFilters.includes('all')) {
    filtered = filtered.filter(receipt => {
      const isPaid = (receipt.amountPaid ?? 0) >= (receipt.total || 0);
      const isPartial = (receipt.amountPaid ?? 0) > 0 && !isPaid;
      const isUnpaid = (receipt.amountPaid ?? 0) === 0;
      
      const receiptDate = receipt.date?.toDate?.() || new Date(receipt.date);
      const now = new Date();
      const hoursDiff = (now.getTime() - receiptDate.getTime()) / (1000 * 60 * 60);
      const isOverdue = isUnpaid && hoursDiff > 48;
      
      const isToday = receiptDate.toDateString() === now.toDateString();
      const isThisWeek = hoursDiff < 168; // 7 days
      const isThisMonth = receiptDate.getMonth() === now.getMonth() && 
                          receiptDate.getFullYear() === now.getFullYear();
      
      return activeFilters.some(filter => {
        if (filter === 'paid') return isPaid;
        if (filter === 'unpaid') return isUnpaid;
        if (filter === 'partial') return isPartial;
        if (filter === 'overdue') return isOverdue;
        if (filter === 'today') return isToday;
        if (filter === 'week') return isThisWeek;
        if (filter === 'month') return isThisMonth;
        return true;
      });
    });
  }
  
  return filtered;
}, [receipts, searchQuery, activeFilters]);
```

---

## 🌨 Visual Example:
```
┌─────────────────────────────┐
│ 🔍 Search...         [⚙ 3] │
│ [All] [✓ Paid] [⚠ Unpaid]  │
│ [⏱ Partial] [🚨 Overdue]   │
└─────────────────────────────┘
```

---

## 🚀 Quick Start

### Step 1: Add import to receipts.tsx
```tsx
import SmartSearchBar from '../../components/Receipts/SmartSearchBar';
```

### Step 2: Add state
```tsx
const [activeFilters, setActiveFilters] = useState<string[]>(['all']);
```

### Step 3: Replace search header
Replace existing search with `<SmartSearchBar />` component

### Step 4: Add filter logic
Implement the filter logic as shown above in the "Filter Logic Implementation" section

---

## 🎯 Pro Tips

1. **Smart Filters**: Can combine multiple filters (e.g., "Paid" + "This Week")
2. **Search**: Searches both customer names and receipt numbers
3. **Filter Count**: Shows number of active filters in the button badge

---

## 📱 Testing

1. **Search**: Type customer names or receipt numbers
2. **Filters**: Tap filter button, select multiple filters
3. **Clear**: Use "Clear all filters" to reset

Enjoy your new search feature! 🎉
