import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

export interface ReceiptSection {
  title: string;
  key: string;
  data: FirebaseReceipt[];
  timestamp: number; // For sorting sections
}

/**
 * Groups receipts into a single flat section for infinite scroll
 * Modern app approach - no date-based grouping
 */
export const groupReceiptsIntoSections = (receipts: FirebaseReceipt[]): ReceiptSection[] => {
  if (!receipts || receipts.length === 0) return [];

  // Return all receipts in a single section
  return [{
    title: 'Recent Receipts',
    key: 'all',
    data: receipts,
    timestamp: Date.now(),
  }];
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
