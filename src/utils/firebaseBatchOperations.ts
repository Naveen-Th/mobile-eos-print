import { 
  writeBatch, 
  doc, 
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import BalanceTrackingService from '../services/business/BalanceTrackingService';

/**
 * Optimized Firebase batch operations utility
 * Reduces multiple round trips to a single batch write
 */

export interface BatchReceiptUpdate {
  receiptId: string;
  amountPaid: number;
  newBalance: number;
  isPaid: boolean;
}

/**
 * Update multiple old receipts with payment in a single batch operation
 * Much faster than individual updateDoc calls
 */
export async function batchUpdateOldReceipts(
  customerName: string,
  currentReceiptId: string,
  amountForOldReceipts: number,
  oldBalance: number
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const db = getFirebaseDb();
    if (!db) throw new Error('Firestore not initialized');

    // Get all unpaid receipts for this customer
    const receiptsRef = collection(db, 'receipts');
    const q = query(
      receiptsRef,
      where('customerName', '==', customerName.trim())
    );
    const querySnapshot = await getDocs(q);

    // Collect old receipts that need updates
    const oldReceipts: any[] = [];
    querySnapshot.forEach(docSnap => {
      const receiptData = docSnap.data();
      // Skip the current receipt we just created
      if (docSnap.id !== currentReceiptId) {
        const remainingBalance = receiptData.newBalance || 
          (receiptData.oldBalance + receiptData.total - (receiptData.amountPaid || 0));
        if (remainingBalance > 0) {
          oldReceipts.push({ 
            id: docSnap.id, 
            ...receiptData, 
            remainingBalance 
          });
        }
      }
    });

    if (oldReceipts.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    // Sort by date (oldest first)
    oldReceipts.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    // Create a batch for all updates
    const batch = writeBatch(db);
    let remainingPayment = Math.min(amountForOldReceipts, oldBalance);
    let updatedCount = 0;
    const now = serverTimestamp();

    // Apply payment to old receipts in batch
    for (const oldReceipt of oldReceipts) {
      if (remainingPayment <= 0) break;

      const paymentToApply = Math.min(remainingPayment, oldReceipt.remainingBalance);
      const newAmountPaid = (oldReceipt.amountPaid || 0) + paymentToApply;
      const newBalance = oldReceipt.oldBalance + oldReceipt.total - newAmountPaid;
      const isPaid = newBalance <= 0.01; // Allow small rounding

      const receiptRef = doc(db, 'receipts', oldReceipt.id);
      batch.update(receiptRef, {
        amountPaid: newAmountPaid,
        newBalance: Math.max(0, newBalance),
        isPaid: isPaid,
        updatedAt: now
      });

      remainingPayment -= paymentToApply;
      updatedCount++;
    }

    // Commit all updates in a single batch
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Batch updated ${updatedCount} old receipts in single operation`);
      
      // Invalidate balance cache after batch update
      BalanceTrackingService.invalidateCache(customerName);
      console.log(`✅ Balance cache invalidated for "${customerName}" after batch update`);
    }

    return { success: true, updatedCount };
  } catch (error) {
    console.error('Error in batch update of old receipts:', error);
    return { 
      success: false, 
      updatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Queue an operation to run in the background without blocking UI
 */
export function queueBackgroundOperation(
  operation: () => Promise<void>,
  operationName: string
): void {
  // Use setTimeout to defer to next tick, allowing UI to update first
  setTimeout(async () => {
    try {
      console.log(`🔄 Running background operation: ${operationName}`);
      await operation();
      console.log(`✅ Completed background operation: ${operationName}`);
    } catch (error) {
      console.error(`❌ Background operation failed: ${operationName}`, error);
    }
  }, 0);
}
