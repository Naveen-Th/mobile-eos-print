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
import { getFirebaseDb } from '../config/firebase';
import ReceiptFirebaseService, { FirebaseReceipt } from './ReceiptFirebaseService';
import BalanceTrackingService from './BalanceTrackingService';
import PersonDetailsService from './PersonDetailsService';

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
  affectedReceipts?: string[]; // All receipt numbers that received payment
  cascadedReceipts?: string[]; // Receipt numbers where excess payment was applied (excluding primary)
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
  updatedReceipt?: FirebaseReceipt;
}

/**
 * Service to handle payment operations for receipts
 */
class PaymentService {
  private static instance: PaymentService;
  private readonly PAYMENTS_COLLECTION = 'payment_transactions';
  private readonly RECEIPTS_COLLECTION = 'receipts';

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Record a payment against a receipt
   * This updates the receipt's payment information and creates a payment transaction record
   */
  public async recordPayment(paymentData: RecordPaymentData): Promise<PaymentResult> {
    try {
      // Validate input
      if (!paymentData.receiptId || !paymentData.receiptId.trim()) {
        return {
          success: false,
          error: 'Receipt ID is required',
        };
      }

      if (!paymentData.amount || paymentData.amount <= 0) {
        return {
          success: false,
          error: 'Payment amount must be greater than zero',
        };
      }

      const db = getFirebaseDb();
      if (!db) {
        return {
          success: false,
          error: 'Firestore not initialized',
        };
      }

      // Get the receipt
      const receiptRef = doc(db, this.RECEIPTS_COLLECTION, paymentData.receiptId);
      const receiptDoc = await getDoc(receiptRef);

      if (!receiptDoc.exists()) {
        return {
          success: false,
          error: 'Receipt not found',
        };
      }

      const receipt = receiptDoc.data() as FirebaseReceipt;

      // Calculate current balance
      const oldBalance = receipt.oldBalance || 0;
      const receiptTotal = receipt.total || 0;
      const currentAmountPaid = receipt.amountPaid || 0;
      const currentBalance = receipt.newBalance || (oldBalance + receiptTotal - currentAmountPaid);

      // Allow overpayment - cascade to other unpaid receipts
      let remainingPayment = paymentData.amount;
      const affectedReceipts: { receipt: FirebaseReceipt; ref: any; payment: number }[] = [];
      
      // Get all unpaid receipts for this customer, ordered by date (oldest first)
      let allUnpaidReceipts: Array<{ id: string; receipt: FirebaseReceipt; ref: any }> = [];
      
      if (receipt.customerName) {
        const receiptsRef = collection(db, this.RECEIPTS_COLLECTION);
        
        try {
          // Try with orderBy (requires composite index)
          const unpaidQuery = query(
            receiptsRef,
            where('customerName', '==', receipt.customerName),
            where('isPaid', '==', false),
            orderBy('createdAt', 'asc')
          );
          
          const unpaidSnapshot = await getDocs(unpaidQuery);
          
          unpaidSnapshot.forEach((unpaidDoc) => {
            const unpaidReceipt = unpaidDoc.data() as FirebaseReceipt;
            // Calculate balance for THIS receipt only (ignore oldBalance which may be stale)
            const receiptOnlyBalance = (unpaidReceipt.total || 0) - (unpaidReceipt.amountPaid || 0);
            
            if (receiptOnlyBalance > 0) {
              allUnpaidReceipts.push({
                id: unpaidDoc.id,
                receipt: unpaidReceipt,
                ref: doc(db, this.RECEIPTS_COLLECTION, unpaidDoc.id),
              });
            }
          });
        } catch (indexError: any) {
          // Fallback: Query without orderBy if index doesn't exist
          if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
            console.warn('⚠️ Firebase composite index not found. Using fallback query.');
            console.warn('📝 Create the index here:', indexError.message?.match(/https:\/\/[^\s]+/)?.[0] || 'Check Firebase console');
            
            const fallbackQuery = query(
              receiptsRef,
              where('customerName', '==', receipt.customerName),
              where('isPaid', '==', false)
            );
            
            const unpaidSnapshot = await getDocs(fallbackQuery);
            
            unpaidSnapshot.forEach((unpaidDoc) => {
              const unpaidReceipt = unpaidDoc.data() as FirebaseReceipt;
              // Calculate balance for THIS receipt only (ignore oldBalance which may be stale)
              const receiptOnlyBalance = (unpaidReceipt.total || 0) - (unpaidReceipt.amountPaid || 0);
              
              if (receiptOnlyBalance > 0) {
                allUnpaidReceipts.push({
                  id: unpaidDoc.id,
                  receipt: unpaidReceipt,
                  ref: doc(db, this.RECEIPTS_COLLECTION, unpaidDoc.id),
                });
              }
            });
            
            // Sort in memory by createdAt (oldest first)
            allUnpaidReceipts.sort((a, b) => {
              const timeA = a.receipt.createdAt?.seconds || 0;
              const timeB = b.receipt.createdAt?.seconds || 0;
              return timeA - timeB;
            });
          } else {
            throw indexError;
          }
        }
      }
      
      // Apply payment to all unpaid receipts in chronological order
      for (const { id, receipt: unpaidReceipt, ref: unpaidRef } of allUnpaidReceipts) {
        if (remainingPayment <= 0.01) break;
        
        // Calculate balance for THIS receipt only (total - amountPaid)
        // Ignore oldBalance as it may include paid receipts
        const receiptTotal = unpaidReceipt.total || 0;
        const receiptCurrentAmountPaid = unpaidReceipt.amountPaid || 0;
        const receiptBalance = receiptTotal - receiptCurrentAmountPaid;
        
        if (receiptBalance > 0) {
          const paymentForThisReceipt = Math.min(remainingPayment, receiptBalance);
          remainingPayment -= paymentForThisReceipt;
          
          affectedReceipts.push({
            receipt: unpaidReceipt,
            ref: unpaidRef,
            payment: paymentForThisReceipt,
          });
          
          console.log(`  ✓ Applied ₹${paymentForThisReceipt.toFixed(2)} to receipt ${unpaidReceipt.receiptNumber}`);
        }
      }

      // Log summary
      if (affectedReceipts.length > 0) {
        console.log(`💰 Payment of ₹${paymentData.amount} applied to ${affectedReceipts.length} receipt(s)`);
        affectedReceipts.forEach(ar => {
          console.log(`  • ${ar.receipt.receiptNumber}: ₹${ar.payment.toFixed(2)}`);
        });
      }
      
      if (remainingPayment > 0.01) {
        console.log(`⚠️ Excess payment remaining: ₹${remainingPayment.toFixed(2)} (customer has credit)`);
      }

      // Use batch write for atomic operation
      const batch = writeBatch(db);

      // Update all affected receipts
      for (const { receipt: r, ref, payment } of affectedReceipts) {
        // Calculate balance for THIS receipt only (ignore oldBalance)
        const receiptTotal = r.total || 0;
        const receiptCurrentAmountPaid = r.amountPaid || 0;
        const receiptNewAmountPaid = receiptCurrentAmountPaid + payment;
        const receiptNewBalance = receiptTotal - receiptNewAmountPaid;
        const receiptIsPaid = receiptNewBalance <= 0.01;
        
        batch.update(ref, {
          amountPaid: receiptNewAmountPaid,
          newBalance: receiptNewBalance,
          isPaid: receiptIsPaid,
          status: receiptIsPaid ? 'paid' : r.status,
          updatedAt: serverTimestamp(),
        });
      }

      // Calculate final balance - sum of all remaining unpaid amounts
      const finalNewBalance = affectedReceipts.reduce((sum, ar) => {
        const receiptTotal = ar.receipt.total || 0;
        const receiptAmountPaid = (ar.receipt.amountPaid || 0) + ar.payment;
        const remaining = receiptTotal - receiptAmountPaid;
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);
      
      // Create payment transaction record for the original receipt
      const paymentTransactionRef = doc(collection(db, this.PAYMENTS_COLLECTION));
      const paymentTransaction: any = {
        receiptId: paymentData.receiptId,
        receiptNumber: receipt.receiptNumber,
        customerName: receipt.customerName || 'Walk-in Customer',
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        previousBalance: currentBalance,
        newBalance: finalNewBalance,
        timestamp: serverTimestamp(),
      };
      
      // Add all affected receipt numbers
      if (affectedReceipts.length > 0) {
        paymentTransaction.affectedReceipts = affectedReceipts.map(ar => ar.receipt.receiptNumber);
        if (affectedReceipts.length > 1) {
          paymentTransaction.cascadedReceipts = affectedReceipts.slice(1).map(ar => ar.receipt.receiptNumber);
        }
      }
      
      // Only add notes if provided (avoid undefined)
      if (paymentData.notes && paymentData.notes.trim()) {
        paymentTransaction.notes = paymentData.notes.trim();
      }

      batch.set(paymentTransactionRef, paymentTransaction);

      // Commit the batch
      await batch.commit();

      console.log(`✅ Payment of ₹${paymentData.amount} recorded successfully`);
      console.log(`   Total receipts updated: ${affectedReceipts.length}`);
      console.log(`   Previous customer balance: ₹${currentBalance.toFixed(2)} → New balance: ₹${finalNewBalance.toFixed(2)}`);
      if (affectedReceipts.length > 1) {
        console.log(`   💸 Payment distributed across ${affectedReceipts.length} receipt(s)`);
      }

      // Sync customer balance in person_details from all receipts
      // This recalculates total from all unpaid receipts after this payment
      if (receipt.customerName) {
        try {
          const balanceSyncResult = await BalanceTrackingService.syncCustomerBalance(
            receipt.customerName
          );

          if (balanceSyncResult.success) {
            console.log(`✅ Customer balance synced in person_details: ${receipt.customerName} - ₹${balanceSyncResult.totalBalance}`);
          } else {
            console.warn(`⚠️ Failed to sync customer balance in person_details: ${balanceSyncResult.error}`);
          }
        } catch (error) {
          console.error('Error syncing customer balance:', error);
          // Don't fail the payment if balance sync fails
        }
      }

      // Prepare updated receipt for return (primary receipt that was clicked)
      const primaryAffected = affectedReceipts.find(ar => ar.receipt.id === receipt.id);
      const updatedReceipt: FirebaseReceipt = {
        ...receipt,
        amountPaid: (receipt.amountPaid || 0) + (primaryAffected?.payment || 0),
        newBalance: primaryAffected 
          ? (receipt.total || 0) - ((receipt.amountPaid || 0) + primaryAffected.payment)
          : (receipt.total || 0) - (receipt.amountPaid || 0),
        isPaid: primaryAffected 
          ? ((receipt.total || 0) - ((receipt.amountPaid || 0) + primaryAffected.payment)) <= 0.01
          : ((receipt.total || 0) - (receipt.amountPaid || 0)) <= 0.01,
        updatedAt: serverTimestamp() as Timestamp,
      };

      return {
        success: true,
        paymentTransaction: {
          id: paymentTransactionRef.id,
          ...paymentTransaction,
          timestamp: Timestamp.now(),
        } as PaymentTransaction,
        updatedReceipt,
      };
    } catch (error) {
      console.error('Error recording payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get payment history for a receipt
   */
  public async getReceiptPaymentHistory(receiptId: string): Promise<PaymentTransaction[]> {
    try {
      if (!receiptId || !receiptId.trim()) {
        return [];
      }

      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      
      try {
        // Try with orderBy (requires index)
        const q = query(
          paymentsRef,
          where('receiptId', '==', receiptId),
          orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const payments: PaymentTransaction[] = [];

        querySnapshot.forEach((doc) => {
          payments.push({
            id: doc.id,
            ...doc.data(),
          } as PaymentTransaction);
        });

        return payments;
      } catch (indexError: any) {
        // If index not found, fall back to query without orderBy
        if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
          console.warn('⚠️ Firebase index not found for payment history. Using fallback query.');
          console.warn('📝 Create the index here:', indexError.message?.match(/https:\/\/[^\s]+/)?.[0] || 'Check Firebase console');
          
          // Fallback: Query without orderBy
          const fallbackQuery = query(
            paymentsRef,
            where('receiptId', '==', receiptId)
          );
          
          const querySnapshot = await getDocs(fallbackQuery);
          const payments: PaymentTransaction[] = [];

          querySnapshot.forEach((doc) => {
            payments.push({
              id: doc.id,
              ...doc.data(),
            } as PaymentTransaction);
          });
          
          // Sort in memory
          payments.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA; // Descending order
          });

          return payments;
        }
        throw indexError;
      }
    } catch (error) {
      console.error('Error getting receipt payment history:', error);
      return [];
    }
  }

  /**
   * Get all payment transactions for a customer
   */
  public async getCustomerPaymentHistory(customerName: string): Promise<PaymentTransaction[]> {
    try {
      if (!customerName || !customerName.trim()) {
        return [];
      }

      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      const q = query(
        paymentsRef,
        where('customerName', '==', customerName.trim()),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const payments: PaymentTransaction[] = [];

      querySnapshot.forEach((doc) => {
        payments.push({
          id: doc.id,
          ...doc.data(),
        } as PaymentTransaction);
      });

      return payments;
    } catch (error) {
      console.error('Error getting customer payment history:', error);
      return [];
    }
  }

  /**
   * Get receipt with current balance information
   */
  public async getReceiptWithBalance(receiptId: string): Promise<{
    receipt: FirebaseReceipt | null;
    balance: {
      oldBalance: number;
      receiptTotal: number;
      amountPaid: number;
      remainingBalance: number;
      isPaid: boolean;
    } | null;
  }> {
    try {
      if (!receiptId || !receiptId.trim()) {
        return { receipt: null, balance: null };
      }

      const receipt = await ReceiptFirebaseService.getReceipt(receiptId);

      if (!receipt) {
        return { receipt: null, balance: null };
      }

      const oldBalance = receipt.oldBalance || 0;
      const receiptTotal = receipt.total || 0;
      const amountPaid = receipt.amountPaid || 0;
      const remainingBalance = receipt.newBalance || (oldBalance + receiptTotal - amountPaid);
      const isPaid = remainingBalance <= 0.01;

      return {
        receipt,
        balance: {
          oldBalance,
          receiptTotal,
          amountPaid,
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
   * Get all unpaid receipts for a customer
   */
  public async getCustomerUnpaidReceipts(customerName: string): Promise<FirebaseReceipt[]> {
    try {
      if (!customerName || !customerName.trim()) {
        return [];
      }

      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const receiptsRef = collection(db, this.RECEIPTS_COLLECTION);
      const q = query(
        receiptsRef,
        where('customerName', '==', customerName.trim()),
        where('isPaid', '==', false),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const receipts: FirebaseReceipt[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirebaseReceipt;
        // Only include receipts with remaining balance > 0
        if ((data.newBalance || 0) > 0) {
          receipts.push({
            id: doc.id,
            ...data,
          });
        }
      });

      return receipts;
    } catch (error) {
      console.error('Error getting customer unpaid receipts:', error);
      return [];
    }
  }

  /**
   * Get payment statistics
   */
  public async getPaymentStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalPayments: number;
    totalAmount: number;
    paymentsByMethod: Record<string, { count: number; amount: number }>;
    averagePayment: number;
  }> {
    try {
      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      let q = query(paymentsRef, orderBy('timestamp', 'desc'));

      // Apply date filters if provided
      if (startDate) {
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(endDate)));
      }

      const querySnapshot = await getDocs(q);
      
      let totalPayments = 0;
      let totalAmount = 0;
      const paymentsByMethod: Record<string, { count: number; amount: number }> = {};

      querySnapshot.forEach((doc) => {
        const payment = doc.data() as PaymentTransaction;
        totalPayments++;
        totalAmount += payment.amount;

        if (!paymentsByMethod[payment.paymentMethod]) {
          paymentsByMethod[payment.paymentMethod] = { count: 0, amount: 0 };
        }
        paymentsByMethod[payment.paymentMethod].count++;
        paymentsByMethod[payment.paymentMethod].amount += payment.amount;
      });

      const averagePayment = totalPayments > 0 ? totalAmount / totalPayments : 0;

      return {
        totalPayments,
        totalAmount,
        paymentsByMethod,
        averagePayment,
      };
    } catch (error) {
      console.error('Error getting payment statistics:', error);
      return {
        totalPayments: 0,
        totalAmount: 0,
        paymentsByMethod: {},
        averagePayment: 0,
      };
    }
  }

  /**
   * Validate payment amount against receipt balance
   */
  public async validatePaymentAmount(
    receiptId: string,
    amount: number
  ): Promise<{ valid: boolean; error?: string; maxAmount?: number }> {
    try {
      const { receipt, balance } = await this.getReceiptWithBalance(receiptId);

      if (!receipt || !balance) {
        return {
          valid: false,
          error: 'Receipt not found',
        };
      }

      if (balance.isPaid) {
        return {
          valid: false,
          error: 'Receipt is already fully paid',
        };
      }

      if (amount <= 0) {
        return {
          valid: false,
          error: 'Payment amount must be greater than zero',
        };
      }

      if (amount > balance.remainingBalance) {
        return {
          valid: false,
          error: `Payment amount exceeds remaining balance of ₹${balance.remainingBalance.toFixed(2)}`,
          maxAmount: balance.remainingBalance,
        };
      }

      return {
        valid: true,
        maxAmount: balance.remainingBalance,
      };
    } catch (error) {
      console.error('Error validating payment amount:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation error',
      };
    }
  }
}

export default PaymentService.getInstance();
