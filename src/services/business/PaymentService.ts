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
import BalanceTrackingService from '../business/BalanceTrackingService';
import PersonDetailsService from '../data/PersonDetailsService';

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

      // Calculate current balance for THIS receipt only
      const receiptTotal = receipt.total || 0;
      const currentAmountPaid = receipt.amountPaid || 0;
      const receiptBalance = receiptTotal - currentAmountPaid;
      const oldBalance = receipt.oldBalance || 0;
      
      // ✅ CRITICAL FIX: The "Previous Balance" (oldBalance) on this receipt is PART OF THIS RECEIPT
      // The current receipt can consume payment up to (receiptBalance + oldBalance)
      const totalReceiptDebt = receiptBalance + oldBalance;
      const currentBalance = totalReceiptDebt;

      let remainingPayment = paymentData.amount;
      const affectedReceipts: Array<{ receipt: FirebaseReceipt; ref: any; payment: number }> = [];
      let paymentAppliedToCurrent = 0; // track items payment
      let totalCascadedToOlder = 0; // track cascade sum

      if (__DEV__) {
        console.log(`💵 [PAYMENT] Receipt ${receipt.receiptNumber}: total=₹${receiptTotal}, paid=₹${currentAmountPaid}, receiptBalance=₹${receiptBalance}, oldBalance=₹${oldBalance}, totalDebt=₹${totalReceiptDebt}`);
      }

      // Step 1: Apply payment to current receipt first (up to its total debt including oldBalance)
      // ✅ Only apply up to the receipt balance (the actual amount owed on THIS receipt's items)
      // The oldBalance portion doesn't add to amountPaid, it just prevents cascading
      const paymentForCurrentReceipt = Math.min(remainingPayment, receiptBalance);
      if (paymentForCurrentReceipt > 0) {
        affectedReceipts.push({
          receipt: receipt,
          ref: receiptRef,
          payment: paymentForCurrentReceipt,
        });
        remainingPayment -= paymentForCurrentReceipt;
        paymentAppliedToCurrent = paymentForCurrentReceipt;
        
        if (__DEV__) {
          console.log(`💰 Payment of ₹${paymentForCurrentReceipt.toFixed(2)} applied to current receipt ${receipt.receiptNumber}`);
        }
      }
      
      // ✅ CRITICAL FIX: Don't consume oldBalance - let it cascade to real older receipts!
      // The oldBalance represents debt on OLDER receipts that still exist in the system.
      // If we "consume" it here, those older receipts remain unpaid (duplicate accounting).
      // Instead, let the remaining payment cascade to actually pay those older receipts.
      
      if (__DEV__ && oldBalance > 0 && remainingPayment > 0) {
        console.log(`🔄 Receipt has ₹${oldBalance} oldBalance. Remaining ₹${remainingPayment} will cascade to older receipts to pay them.`);
      }

      // Step 2: If there's remaining payment, cascade to older unpaid receipts
      // ✅ Use 0.01 threshold to avoid cascading tiny amounts due to floating-point precision
      if (remainingPayment > 0.01 && receipt.customerName) {
        if (__DEV__) {
          console.log(`💸 Remaining payment ₹${remainingPayment.toFixed(2)} will cascade to older receipts`);
        }

        try {
          // Get all receipts for this customer (without isPaid filter to avoid index requirement)
          const receiptsRef = collection(db, this.RECEIPTS_COLLECTION);
          const olderReceiptsQuery = query(
            receiptsRef,
            where('customerName', '==', receipt.customerName)
          );

          const olderReceiptsSnapshot = await getDocs(olderReceiptsQuery);
          
          // Filter unpaid receipts and sort by date in memory
          const unpaidReceipts = olderReceiptsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() as FirebaseReceipt }))
            .filter(r => {
              const balance = (r.total || 0) - (r.amountPaid || 0);
              return balance > 0.01 && r.id !== receipt.id; // Exclude current receipt
            })
            .sort((a, b) => {
              const dateA = a.createdAt?.toDate?.() || new Date(0);
              const dateB = b.createdAt?.toDate?.() || new Date(0);
              return dateA.getTime() - dateB.getTime(); // Oldest first
            });
          
          for (const olderReceipt of unpaidReceipts) {
            // ✅ Use 0.01 threshold to avoid floating-point precision issues
            if (remainingPayment < 0.01) break;

            const olderReceiptBalance = (olderReceipt.total || 0) - (olderReceipt.amountPaid || 0);

            // Apply remaining payment to this older receipt
            const paymentForOlderReceipt = Math.min(remainingPayment, olderReceiptBalance);
            
            // ✅ Only add if payment is meaningful (> 1 paisa)
            if (paymentForOlderReceipt < 0.01) continue;
            
            affectedReceipts.push({
              receipt: olderReceipt,
              ref: doc(db, this.RECEIPTS_COLLECTION, olderReceipt.id),
              payment: paymentForOlderReceipt,
            });
            
            remainingPayment -= paymentForOlderReceipt;
            totalCascadedToOlder += paymentForOlderReceipt;
            
            if (__DEV__) {
              console.log(`💸 Cascaded ₹${paymentForOlderReceipt.toFixed(2)} to older receipt ${olderReceipt.receiptNumber}`);
            }
          }
        } catch (cascadeError) {
          console.error('Error during payment cascade:', cascadeError);
          // Continue without cascade if there's an error
        }
      }

      // Use batch write for atomic operation
      const batch = writeBatch(db);

      // Update all affected receipts
      let finalNewBalance = receiptBalance - paymentForCurrentReceipt;
      
      for (const affected of affectedReceipts) {
        const newAmountPaid = (affected.receipt.amountPaid || 0) + affected.payment;
        const newReceiptBalance = (affected.receipt.total || 0) - newAmountPaid;
        const isPaid = newReceiptBalance <= 0.01;
        
        // ✅ Prepare update object
        const updateData: any = {
          amountPaid: newAmountPaid,
          newBalance: newReceiptBalance,
          isPaid: isPaid,
          status: isPaid ? 'printed' : affected.receipt.status,
          updatedAt: serverTimestamp(),
        };
        
        // ✅ CRITICAL: If this is the primary receipt and payment cascaded, clear oldBalance
        // The oldBalance is being "paid" by the cascade to older receipts
        if (affected.receipt.id === receipt.id) {
          const currentOldBalance = affected.receipt.oldBalance || 0;
          if (currentOldBalance > 0) {
            // Determine leftover after items + cascade
            const leftoverAfterCascade = Math.max(0, (paymentData.amount - paymentAppliedToCurrent) - totalCascadedToOlder);

            // If cascade happened, reduce by cascaded amount
            // Also reduce by any leftover (no older receipts left)
            const oldBalanceConsumed = Math.min(currentOldBalance, totalCascadedToOlder + leftoverAfterCascade);
            const newOldBalance = Math.max(0, currentOldBalance - oldBalanceConsumed);

            updateData.oldBalance = newOldBalance;
            updateData.oldBalanceCleared = oldBalanceConsumed; // for UI display of 'cleared'

            if (__DEV__) {
              console.log(`✅ Clearing oldBalance using cascade + leftover: current ₹${currentOldBalance}, cascaded ₹${totalCascadedToOlder}, leftover ₹${leftoverAfterCascade} → new oldBalance ₹${newOldBalance}`);
            }
          }
        }

        batch.update(affected.ref, updateData);
      }
      
      // Calculate final balance for the primary receipt after all updates
      const primaryAffected = affectedReceipts.find(ar => ar.receipt.id === receipt.id);
      if (primaryAffected) {
        const primaryNewAmountPaid = (receipt.amountPaid || 0) + primaryAffected.payment;
        finalNewBalance = (receipt.total || 0) - primaryNewAmountPaid;
      }
      
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

      // CRITICAL: Invalidate balance cache immediately after payment
      // This ensures the next balance fetch gets updated data including this payment
      if (receipt.customerName) {
        BalanceTrackingService.invalidateCache(receipt.customerName);
        if (__DEV__) {
          console.log(`✅ Balance cache invalidated for "${receipt.customerName}"`);
        }
      }

      if (__DEV__) {
        console.log(`✅ Payment of ₹${paymentData.amount} recorded successfully`);
        console.log(`   Total receipts updated: ${affectedReceipts.length}`);
        console.log(`   Previous customer balance: ₹${currentBalance.toFixed(2)} → New balance: ₹${finalNewBalance.toFixed(2)}`);
        if (affectedReceipts.length > 1) {
          console.log(`   💸 Payment distributed across ${affectedReceipts.length} receipt(s)`);
        }
      }

      // Sync customer balance in person_details from all receipts (in background)
      // This recalculates total from all unpaid receipts after this payment
      // Run asynchronously without blocking the response
      if (receipt.customerName) {
        // Don't await - let it run in background
        BalanceTrackingService.syncCustomerBalance(receipt.customerName)
          .then((balanceSyncResult) => {
            if (__DEV__) {
              if (balanceSyncResult.success) {
                console.log(`✅ Customer balance synced in person_details: ${receipt.customerName} - ₹${balanceSyncResult.totalBalance}`);
              } else {
                console.warn(`⚠️ Failed to sync customer balance in person_details: ${balanceSyncResult.error}`);
              }
            }
          })
          .catch((error) => {
            console.error('Error syncing customer balance:', error);
            // Don't fail the payment if balance sync fails
          });
      }

      // Prepare updated receipt for return (primary receipt that was clicked)
      // primaryAffected is already declared above on line 208
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
