/**
 * Optimized balance calculation utilities
 * Designed for processing 10K+ receipts efficiently
 */

import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

export interface ReceiptWithBalance extends FirebaseReceipt {
  oldBalance: number;
  newBalance: number;
}

export interface CustomerBalance {
  customerName: string;
  totalBalance: number;
  receiptCount: number;
  lastReceiptDate: Date;
}

/**
 * Calculate dynamic balances for receipts
 * Optimized for large datasets (10K+ receipts)
 */
export function calculateDynamicBalances(receipts: FirebaseReceipt[]): ReceiptWithBalance[] {
  if (!receipts || receipts.length === 0) return [];

  // Sort receipts by creation date (oldest first) for accurate balance calculation
  const sorted = [...receipts].sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
    const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
    return dateA.getTime() - dateB.getTime();
  });

  // Group by customer and calculate running balances
  const customerBalanceMap = new Map<string, number>();

  return sorted.map(receipt => {
    const customerName = receipt.customerName || 'Walk-in Customer';

    // Get the cumulative balance before this receipt
    const previousBalance = customerBalanceMap.get(customerName) || 0;

    // Calculate this receipt's remaining balance (total - amountPaid)
    const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);

    // Update cumulative balance for this customer
    customerBalanceMap.set(customerName, previousBalance + receiptBalance);

    // Return receipt with dynamically calculated oldBalance
    return {
      ...receipt,
      oldBalance: previousBalance, // Dynamic Previous Balance
      newBalance: previousBalance + receiptBalance, // Dynamic Balance Due
    };
  });
}

/**
 * Calculate customer balances from receipts
 * Returns a map of customer names to their total outstanding balance
 */
export function calculateCustomerBalances(receipts: ReceiptWithBalance[]): Map<string, number> {
  const balances = new Map<string, number>();

  // Group receipts by customer first
  const customerReceipts = new Map<string, ReceiptWithBalance[]>();

  receipts.forEach(receipt => {
    const customerKey = receipt.customerName || 'Walk-in Customer';
    if (!customerReceipts.has(customerKey)) {
      customerReceipts.set(customerKey, []);
    }
    customerReceipts.get(customerKey)!.push(receipt);
  });

  // Calculate total balance for each customer
  customerReceipts.forEach((receipts, customerName) => {
    const totalBalance = receipts.reduce((sum, receipt) => {
      // Each receipt's outstanding balance is: total - amountPaid
      const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);
      return sum + receiptBalance;
    }, 0);

    // Store the total balance (even if 0) so we can show payment button
    balances.set(customerName, totalBalance);
  });

  return balances;
}

/**
 * Get detailed customer balance information
 */
export function getCustomerBalanceDetails(receipts: ReceiptWithBalance[]): CustomerBalance[] {
  const customerMap = new Map<string, CustomerBalance>();

  receipts.forEach(receipt => {
    const customerName = receipt.customerName || 'Walk-in Customer';
    const balance = (receipt.total || 0) - (receipt.amountPaid || 0);
    const receiptDate = receipt.createdAt?.toDate?.() || receipt.date?.toDate?.() || new Date();

    if (!customerMap.has(customerName)) {
      customerMap.set(customerName, {
        customerName,
        totalBalance: 0,
        receiptCount: 0,
        lastReceiptDate: receiptDate,
      });
    }

    const customer = customerMap.get(customerName)!;
    customer.totalBalance += balance;
    customer.receiptCount += 1;

    // Update last receipt date if this one is more recent
    if (receiptDate > customer.lastReceiptDate) {
      customer.lastReceiptDate = receiptDate;
    }
  });

  return Array.from(customerMap.values()).sort((a, b) => b.totalBalance - a.totalBalance);
}

/**
 * Filter receipts by date range
 * Client-side filtering for loaded receipts
 */
export function filterReceiptsByDateRange(
  receipts: FirebaseReceipt[],
  startDate: Date,
  endDate: Date
): FirebaseReceipt[] {
  return receipts.filter(receipt => {
    const receiptDate = receipt.createdAt?.toDate?.() || receipt.date?.toDate?.();
    if (!receiptDate) return false;

    return receiptDate >= startDate && receiptDate <= endDate;
  });
}

/**
 * Sort receipts by specified field and order
 */
export function sortReceipts(
  receipts: FirebaseReceipt[],
  sortBy: 'date' | 'customer' | 'total',
  sortOrder: 'asc' | 'desc'
): FirebaseReceipt[] {
  const sorted = [...receipts].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
        const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
        comparison = dateA.getTime() - dateB.getTime();
        break;
      case 'customer':
        const customerA = (a.customerName || 'Walk-in Customer').toLowerCase();
        const customerB = (b.customerName || 'Walk-in Customer').toLowerCase();
        comparison = customerA.localeCompare(customerB);
        break;
      case 'total':
        comparison = (a.total || 0) - (b.total || 0);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Search receipts by query string
 * Searches in customer name, receipt number, company name, and item names
 */
export function searchReceipts(receipts: FirebaseReceipt[], query: string): FirebaseReceipt[] {
  if (!query || !query.trim()) return receipts;

  const lowerQuery = query.toLowerCase().trim();

  return receipts.filter(receipt =>
    receipt.customerName?.toLowerCase().includes(lowerQuery) ||
    receipt.receiptNumber?.toLowerCase().includes(lowerQuery) ||
    receipt.companyName?.toLowerCase().includes(lowerQuery) ||
    receipt.items.some(item => item.name?.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Filter receipts by status
 */
export function filterReceiptsByStatus(
  receipts: FirebaseReceipt[],
  status: string
): FirebaseReceipt[] {
  if (status === 'all') return receipts;
  return receipts.filter(receipt => receipt.status === status);
}

/**
 * Combined filter, search, and sort operation
 * Optimized for chaining operations efficiently
 */
export function processReceipts(
  receipts: FirebaseReceipt[],
  options: {
    searchQuery?: string;
    statusFilter?: string;
    sortBy?: 'date' | 'customer' | 'total';
    sortOrder?: 'asc' | 'desc';
    startDate?: Date;
    endDate?: Date;
  }
): FirebaseReceipt[] {
  let processed = receipts;

  // Filter by date range first (most restrictive)
  if (options.startDate && options.endDate) {
    processed = filterReceiptsByDateRange(processed, options.startDate, options.endDate);
  }

  // Then filter by status
  if (options.statusFilter && options.statusFilter !== 'all') {
    processed = filterReceiptsByStatus(processed, options.statusFilter);
  }

  // Then search
  if (options.searchQuery) {
    processed = searchReceipts(processed, options.searchQuery);
  }

  // Finally sort
  if (options.sortBy) {
    processed = sortReceipts(processed, options.sortBy, options.sortOrder || 'desc');
  }

  return processed;
}
