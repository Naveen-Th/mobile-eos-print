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
  affectedReceipts?: string[];
  cascadedReceipts?: string[];
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
 * 
 * TODO: Rebuild payment recording logic from scratch
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
   * TODO: Implement payment recording logic from scratch
   */
  public async recordPayment(paymentData: RecordPaymentData): Promise<PaymentResult> {
    // TODO: Implement payment recording logic
    // This should:
    // 1. Validate input
    // 2. Get the receipt
    // 3. Calculate payment distribution (cascade if needed)
    // 4. Update receipt(s) with payment
    // 5. Create payment transaction record
    // 6. Update customer balance
    
    return {
      success: false,
      error: 'Payment recording not implemented - rebuild in progress',
    };
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
        if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
          console.warn('⚠️ Firebase index not found for payment history. Using fallback query.');
          
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
          
          payments.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
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
   * TODO: Implement proper validation
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

      // TODO: Implement proper validation logic
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
