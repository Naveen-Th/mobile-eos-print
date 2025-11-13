import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

export interface ReceiptSection {
  title: string;
  key: string;
  data: FirebaseReceipt[];
  timestamp: number; // For sorting sections
}

/**
 * Groups receipts into time-based sections (Apple Music/Contacts style)
 * Sections: Today, Yesterday, This Week, This Month, Previous Months
 */
export const groupReceiptsIntoSections = (receipts: FirebaseReceipt[]): ReceiptSection[] => {
  if (!receipts || receipts.length === 0) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Section maps
  const sections: Map<string, FirebaseReceipt[]> = new Map();
  const monthSections: Map<string, FirebaseReceipt[]> = new Map();

  receipts.forEach((receipt) => {
    const receiptDate = receipt.createdAt?.toDate?.() || 
                        (receipt.date?.toDate ? receipt.date.toDate() : new Date(0));

    if (receiptDate >= todayStart) {
      // Today
      if (!sections.has('today')) sections.set('today', []);
      sections.get('today')!.push(receipt);
    } else if (receiptDate >= yesterdayStart) {
      // Yesterday
      if (!sections.has('yesterday')) sections.set('yesterday', []);
      sections.get('yesterday')!.push(receipt);
    } else if (receiptDate >= weekStart) {
      // This Week
      if (!sections.has('thisWeek')) sections.set('thisWeek', []);
      sections.get('thisWeek')!.push(receipt);
    } else if (receiptDate >= monthStart) {
      // This Month
      if (!sections.has('thisMonth')) sections.set('thisMonth', []);
      sections.get('thisMonth')!.push(receipt);
    } else {
      // Previous months (grouped by month)
      const monthKey = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth()).padStart(2, '0')}`;
      if (!monthSections.has(monthKey)) monthSections.set(monthKey, []);
      monthSections.get(monthKey)!.push(receipt);
    }
  });

  // Build section array
  const result: ReceiptSection[] = [];

  // Add recent sections
  if (sections.has('today')) {
    result.push({
      title: 'Today',
      key: 'today',
      data: sections.get('today')!,
      timestamp: todayStart.getTime(),
    });
  }

  if (sections.has('yesterday')) {
    result.push({
      title: 'Yesterday',
      key: 'yesterday',
      data: sections.get('yesterday')!,
      timestamp: yesterdayStart.getTime(),
    });
  }

  if (sections.has('thisWeek')) {
    result.push({
      title: 'This Week',
      key: 'thisWeek',
      data: sections.get('thisWeek')!,
      timestamp: weekStart.getTime(),
    });
  }

  if (sections.has('thisMonth')) {
    result.push({
      title: 'This Month',
      key: 'thisMonth',
      data: sections.get('thisMonth')!,
      timestamp: monthStart.getTime(),
    });
  }

  // Add month sections (sorted newest first)
  const sortedMonths = Array.from(monthSections.keys()).sort().reverse();
  sortedMonths.forEach((monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month), 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    result.push({
      title: monthName,
      key: monthKey,
      data: monthSections.get(monthKey)!,
      timestamp: date.getTime(),
    });
  });

  return result;
};

/**
 * Get count summary for a section
 */
export const getSectionSummary = (section: ReceiptSection): string => {
  const count = section.data.length;
  const unpaidCount = section.data.filter(r => !r.isPaid).length;
  
  if (unpaidCount === 0) {
    return `${count} receipt${count !== 1 ? 's' : ''}`;
  }
  
  return `${count} receipt${count !== 1 ? 's' : ''} • ${unpaidCount} unpaid`;
};

/**
 * Filter sections by search query and status
 */
export const filterSections = (
  sections: ReceiptSection[],
  searchQuery: string,
  statusFilter: string
): ReceiptSection[] => {
  if (!searchQuery && statusFilter === 'all') {
    return sections;
  }

  return sections
    .map(section => ({
      ...section,
      data: section.data.filter(receipt => {
        // Status filter
        if (statusFilter !== 'all') {
          const isPaid = receipt.isPaid || (receipt.amountPaid >= receipt.total);
          if (statusFilter === 'paid' && !isPaid) return false;
          if (statusFilter === 'unpaid' && isPaid) return false;
          if (statusFilter === receipt.status?.toLowerCase()) return true;
          if (statusFilter !== 'paid' && statusFilter !== 'unpaid' && 
              receipt.status?.toLowerCase() !== statusFilter) return false;
        }

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const customerName = receipt.customerName?.toLowerCase() || '';
          const receiptNumber = receipt.receiptNumber?.toLowerCase() || '';
          const itemNames = receipt.items?.map(i => i.itemName?.toLowerCase() || '').join(' ') || '';
          
          return customerName.includes(query) || 
                 receiptNumber.includes(query) || 
                 itemNames.includes(query);
        }

        return true;
      }),
    }))
    .filter(section => section.data.length > 0); // Remove empty sections
};
