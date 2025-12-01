import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from '../../config/firebase';
import ReceiptFirebaseService, { FirebaseReceipt } from '../business/ReceiptFirebaseService';
import {
  calculateReceiptBalance,
  calculatePaymentCascade,
  calculateCustomerTotalBalance,
  getUnpaidReceipts,
  sortReceiptsByDateAsc,
  CascadeResult,
} from '../../utils/paymentCalculations';

/**
 * Payment transaction interface
 */
export interface PaymentTransaction {
  id: string;
  receiptId: string;
  receiptNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
  previousBalance: number;
  newBalance: number;
  timestamp: Timestamp;
  createdBy?: string;
  affectedReceipts: string[];      // IDs of all receipts affected
  cascadeDetails: CascadeDetail[]; // Details of each receipt update
}

/**
 * Cascade detail for each affected receipt
 */
export interface CascadeDetail {
  receiptId: string;
  receiptNumber: string;
  amountApplied: number;
  previousBalance: number;
  newBalance: number;
  isFullyPaid: boolean;
}

/**
 * Payment recording data
 */
export interface RecordPaymentData {
  receiptId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
}

/**
 * Payment result interface
 */
export interface PaymentResult {
  success: boolean;
  error?: string;
  paymentTransaction?: PaymentTransaction;
  cascadeResult?: CascadeResult;
}

/**
 * Service to handle payment operations for receipts
 */
class PaymentService {
  private static instance: PaymentService;
  private readonly PAYMENTS_COLLECTION = 'payment_transactions';
  private readonly RECEIPTS_COLLECTION = 'receipts';
  private readonly PERSON_DETAILS_COLLECTION = 'person_details';

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Record a payment against a receipt with cascade support
   */
  public async recordPayment(paymentData: RecordPaymentData): Promise<PaymentResult> {
    const { receiptId, amount, paymentMethod, notes } = paymentData;

    try {
      // Validate input
      if (!receiptId?.trim()) {
        return { success: false, error: 'Receipt ID is required' };
      }
      if (amount <= 0) {
        return { success: false, error: 'Payment amount must be greater than zero' };
      }

      const db = getFirebaseDb();
      if (!db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      // Get the current receipt
      const receipt = await ReceiptFirebaseService.getReceipt(receiptId);
      if (!receipt) {
        return { success: false, error: 'Receipt not found' };
      }

      // Get all customer receipts for cascade calculation
      const customerReceipts = await this.getCustomerAllReceipts(receipt.customerName || '');
      
      // Calculate cascade
      const cascadeResult = calculatePaymentCascade(receipt, amount, customerReceipts);
      
      if (cascadeResult.affectedReceipts.length === 0) {
        return { success: false, error: 'No receipts to apply payment to' };
      }

      // Calculate previous total balance
      const previousTotalBalance = calculateCustomerTotalBalance(customerReceipts);
      const newTotalBalance = Math.max(0, previousTotalBalance - cascadeResult.totalApplied);

      // Prepare batch write
      const batch = writeBatch(db);
      const cascadeDetails: CascadeDetail[] = [];
      const affectedReceiptIds: string[] = [];

      // Find the oldest receipt to handle historical debt clearing
      // IMPORTANT: Always include current receipt in the list
      const allReceipts = customerReceipts.find(r => r.id === receipt.id) 
        ? customerReceipts 
        : [...customerReceipts, receipt];
      
      // If no receipts found, use current receipt as the only one
      const receiptsToProcess = allReceipts.length > 0 ? allReceipts : [receipt];
      const sortedReceipts = sortReceiptsByDateAsc(receiptsToProcess);
      const oldestReceipt = sortedReceipts[0];
      const originalHistoricalDebt = oldestReceipt?.oldBalance || 0;
      
      // Calculate how much historical debt is being cleared
      // Payment first goes to historical debt, then to receipt balances
      let historicalDebtCleared = 0;
      if (originalHistoricalDebt > 0) {
        historicalDebtCleared = Math.min(cascadeResult.totalApplied, originalHistoricalDebt);
      }

      if (__DEV__) {
        console.log(`💰 [PaymentService] Processing payment:`);
        console.log(`   - Total applied: ₹${cascadeResult.totalApplied}`);
        console.log(`   - Historical debt: ₹${originalHistoricalDebt}`);
        console.log(`   - Historical debt cleared: ₹${historicalDebtCleared}`);
        console.log(`   - Oldest receipt ID: ${oldestReceipt?.id}`);
        console.log(`   - Current receipt ID: ${receipt.id}`);
      }

      // Track if we've updated the oldest receipt's oldBalance
      let oldBalanceUpdated = false;

      // Update each affected receipt
      for (const cascadeReceipt of cascadeResult.affectedReceipts) {
        const receiptRef = doc(db, this.RECEIPTS_COLLECTION, cascadeReceipt.receipt.id);
        const isOldestReceipt = cascadeReceipt.receipt.id === oldestReceipt?.id;
        const isCurrentReceipt = cascadeReceipt.receipt.id === receipt.id;
        
        // Build update object
        const updateData: any = {
          amountPaid: cascadeReceipt.newAmountPaid,
          newBalance: cascadeReceipt.newBalance,
          isPaid: cascadeReceipt.willBeFullyPaid,
          updatedAt: serverTimestamp(),
        };
        
        // If this is the oldest receipt (or current receipt if it's the only one) and we're clearing historical debt
        const shouldUpdateOldBalance = (isOldestReceipt || (isCurrentReceipt && receiptsToProcess.length === 1)) 
          && historicalDebtCleared > 0 
          && !oldBalanceUpdated;
          
        if (shouldUpdateOldBalance) {
          const newOldBalance = Math.max(0, originalHistoricalDebt - historicalDebtCleared);
          updateData.oldBalance = newOldBalance;
          oldBalanceUpdated = true;
          
          if (__DEV__) {
            console.log(`   - Updating oldBalance for ${cascadeReceipt.receipt.id}: ${originalHistoricalDebt} → ${newOldBalance}`);
          }
        }
        
        batch.update(receiptRef, updateData);

        cascadeDetails.push({
          receiptId: cascadeReceipt.receipt.id,
          receiptNumber: cascadeReceipt.receipt.receiptNumber || '',
          amountApplied: cascadeReceipt.paymentToApply,
          previousBalance: cascadeReceipt.currentBalance,
          newBalance: cascadeReceipt.newBalance,
          isFullyPaid: cascadeReceipt.willBeFullyPaid,
        });

        affectedReceiptIds.push(cascadeReceipt.receipt.id);
      }

      // Create payment transaction record
      const transactionData = {
        receiptId,
        receiptNumber: receipt.receiptNumber || '',
        customerName: receipt.customerName || 'Walk-in Customer',
        amount: cascadeResult.totalApplied,
        paymentMethod,
        notes: notes || '',
        previousBalance: previousTotalBalance,
        newBalance: newTotalBalance,
        timestamp: serverTimestamp(),
        affectedReceipts: affectedReceiptIds,
        cascadeDetails,
      };

      const transactionRef = doc(collection(db, this.PAYMENTS_COLLECTION));
      batch.set(transactionRef, transactionData);

      // Update customer balance in person_details if customer exists
      await this.updateCustomerBalance(db, batch, receipt.customerName || '', newTotalBalance);

      // Commit all changes atomically
      await batch.commit();

      if (__DEV__) {
        console.log(`✅ Payment recorded: ₹${cascadeResult.totalApplied} for ${receipt.customerName}`);
        console.log(`   Affected ${cascadeDetails.length} receipt(s)`);
      }

      return {
        success: true,
        paymentTransaction: {
          id: transactionRef.id,
          ...transactionData,
          timestamp: Timestamp.now(),
        } as PaymentTransaction,
        cascadeResult,
      };
    } catch (error) {
      console.error('Error recording payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record payment',
      };
    }
  }

  /**
   * Update customer balance in person_details
   */
  private async updateCustomerBalance(
    db: any,
    batch: any,
    customerName: string,
    newBalance: number
  ): Promise<void> {
    if (!customerName?.trim()) return;

    try {
      const personRef = collection(db, this.PERSON_DETAILS_COLLECTION);
      const q = query(personRef, where('name', '==', customerName.trim()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const personDoc = snapshot.docs[0];
        batch.update(personDoc.ref, {
          balanceDue: newBalance,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.warn('Could not update person_details balance:', error);
      // Don't fail the payment if person_details update fails
    }
  }

  /**
   * Get all receipts for a customer
   */
  public async getCustomerAllReceipts(customerName: string): Promise<FirebaseReceipt[]> {
    try {
      if (!customerName?.trim()) return [];

      const db = getFirebaseDb();
      if (!db) return [];

      const receiptsRef = collection(db, this.RECEIPTS_COLLECTION);
      const q = query(
        receiptsRef,
        where('customerName', '==', customerName.trim()),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const receipts: FirebaseReceipt[] = [];

      snapshot.forEach((doc) => {
        receipts.push({ id: doc.id, ...doc.data() } as FirebaseReceipt);
      });

      return receipts;
    } catch (error) {
      console.error('Error getting customer receipts:', error);
      return [];
    }
  }

  /**
   * Get all unpaid receipts for a customer
   */
  public async getCustomerUnpaidReceipts(customerName: string): Promise<FirebaseReceipt[]> {
    const allReceipts = await this.getCustomerAllReceipts(customerName);
    return getUnpaidReceipts(allReceipts);
  }

  /**
   * Preview cascade before recording payment
   */
  public async previewPaymentCascade(
    receiptId: string,
    amount: number
  ): Promise<{ success: boolean; cascade?: CascadeResult; error?: string }> {
    try {
      if (!receiptId?.trim()) {
        return { success: false, error: 'Receipt ID is required' };
      }
      if (amount <= 0) {
        return { success: false, error: 'Amount must be greater than zero' };
      }

      const receipt = await ReceiptFirebaseService.getReceipt(receiptId);
      if (!receipt) {
        return { success: false, error: 'Receipt not found' };
      }

      const customerReceipts = await this.getCustomerAllReceipts(receipt.customerName || '');
      const cascade = calculatePaymentCascade(receipt, amount, customerReceipts);

      return { success: true, cascade };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to preview cascade',
      };
    }
  }

  /**
   * Get payment history for a receipt
   */
  public async getReceiptPaymentHistory(receiptId: string): Promise<PaymentTransaction[]> {
    try {
      if (!receiptId?.trim()) return [];

      const db = getFirebaseDb();
      if (!db) return [];

      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      
      // Try with compound query first
      try {
        const q = query(
          paymentsRef,
          where('affectedReceipts', 'array-contains', receiptId),
          orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentTransaction));
      } catch (indexError: any) {
        // Fallback without orderBy if index doesn't exist
        if (indexError.code === 'failed-precondition') {
          const q = query(paymentsRef, where('affectedReceipts', 'array-contains', receiptId));
          const snapshot = await getDocs(q);
          const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentTransaction));
          return payments.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        }
        throw indexError;
      }
    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  }

  /**
   * Get customer payment history
   */
  public async getCustomerPaymentHistory(customerName: string): Promise<PaymentTransaction[]> {
    try {
      if (!customerName?.trim()) return [];

      const db = getFirebaseDb();
      if (!db) return [];

      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      const q = query(
        paymentsRef,
        where('customerName', '==', customerName.trim()),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentTransaction));
    } catch (error) {
      console.error('Error getting customer payment history:', error);
      return [];
    }
  }

  /**
   * Get receipt with balance information
   */
  public async getReceiptWithBalance(receiptId: string): Promise<{
    receipt: FirebaseReceipt | null;
    balance: {
      oldBalance: number;
      receiptTotal: number;
      amountPaid: number;
      receiptBalance: number;
      remainingBalance: number;
      isPaid: boolean;
    } | null;
  }> {
    try {
      const receipt = await ReceiptFirebaseService.getReceipt(receiptId);
      if (!receipt) {
        return { receipt: null, balance: null };
      }

      const oldBalance = receipt.oldBalance || 0;
      const receiptTotal = receipt.total || 0;
      const amountPaid = receipt.amountPaid || 0;
      const receiptBalance = calculateReceiptBalance(receipt);
      const remainingBalance = oldBalance + receiptBalance;
      const isPaid = receiptBalance <= 0.01;

      return {
        receipt,
        balance: {
          oldBalance,
          receiptTotal,
          amountPaid,
          receiptBalance,
          remainingBalance,
          isPaid,
        },
      };
    } catch (error) {
      console.error('Error getting receipt with balance:', error);
      return { receipt: null, balance: null };
    }
  }

  /**
   * Validate payment amount
   */
  public async validatePaymentAmount(
    receiptId: string,
    amount: number
  ): Promise<{ valid: boolean; error?: string; maxAmount?: number }> {
    try {
      const { receipt, balance } = await this.getReceiptWithBalance(receiptId);

      if (!receipt || !balance) {
        return { valid: false, error: 'Receipt not found' };
      }

      if (balance.isPaid) {
        return { valid: false, error: 'Receipt is already fully paid' };
      }

      if (amount <= 0) {
        return { valid: false, error: 'Payment amount must be greater than zero' };
      }

      // Get total customer balance for max amount
      const customerReceipts = await this.getCustomerAllReceipts(receipt.customerName || '');
      const totalBalance = calculateCustomerTotalBalance(customerReceipts);

      return {
        valid: true,
        maxAmount: totalBalance,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation error',
      };
    }
  }
}

export default PaymentService.getInstance();
