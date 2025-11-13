import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  getDoc,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseInitialized } from '../../config/firebase';
import { getDatabase, isDatabaseReady } from '../../database';
import FirebaseService from '../auth/FirebaseService';
import PersonDetailsService from '../data/PersonDetailsService';
import ReceiptFirebaseService, { FirebaseReceipt } from '../business/ReceiptFirebaseService';

export interface PendingBill {
  id: string;
  customerId: string;
  customerName: string;
  businessName?: string;
  businessPhone?: string;
  amount: number;
  oldBalance?: number; // Previous balance from earlier transactions
  paidAmount: number;
  remainingBalance: number;
  receiptId?: string;
  receiptNumber?: string;
  notes?: string;
  dueDate?: Date;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  paymentMethod?: 'cash' | 'card' | 'digital' | 'other';
  notes?: string;
  receiptId?: string;
  receiptNumber?: string;
  createdAt: Date;
}

export interface CreateBillData {
  customerId: string;
  customerName: string;
  businessName?: string;
  businessPhone?: string;
  amount: number;
  paidAmount?: number;
  receiptId?: string;
  receiptNumber?: string;
  notes?: string;
  dueDate?: Date;
}

export interface RecordPaymentData {
  billId: string;
  amount: number;
  paymentMethod?: 'cash' | 'card' | 'digital' | 'other';
  notes?: string;
  receiptId?: string;
  receiptNumber?: string;
}

class PendingBillsService {
  private static instance: PendingBillsService;
  private firebaseService: typeof FirebaseService;
  private readonly BILLS_COLLECTION = 'pending_bills';
  private readonly PAYMENTS_COLLECTION = 'bill_payments';

  private constructor() {
    this.firebaseService = FirebaseService;
  }

  public static getInstance(): PendingBillsService {
    if (!PendingBillsService.instance) {
      PendingBillsService.instance = new PendingBillsService();
    }
    return PendingBillsService.instance;
  }

  /**
   * Create a new pending bill
   */
  async createBill(billData: CreateBillData): Promise<PendingBill> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      
      const paidAmount = billData.paidAmount || 0;
      const remainingBalance = billData.amount - paidAmount;
      const status = this.calculateBillStatus(billData.amount, paidAmount);

      const billsRef = collection(db, this.BILLS_COLLECTION);
      const docRef = await addDoc(billsRef, {
        customerId: billData.customerId,
        customerName: billData.customerName,
        businessName: billData.businessName,
        businessPhone: billData.businessPhone,
        amount: billData.amount,
        paidAmount,
        remainingBalance,
        receiptId: billData.receiptId,
        receiptNumber: billData.receiptNumber,
        notes: billData.notes,
        dueDate: billData.dueDate,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update customer balance in person_details
      await this.updateCustomerBalance(billData.customerId, remainingBalance);

      const newBill: PendingBill = {
        id: docRef.id,
        ...billData,
        paidAmount,
        remainingBalance,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return newBill;
    } catch (error) {
      console.error('Error creating pending bill:', error);
      throw error;
    }
  }

  /**
   * Record a payment for a bill
   */
  async recordPayment(paymentData: RecordPaymentData): Promise<void> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      
      // Check if this is a receipt-based bill (has receiptId or no customerId)
      const billRef = doc(db, this.BILLS_COLLECTION, paymentData.billId);
      const billDoc = await getDoc(billRef);
      
      let isReceiptBill = false;
      let bill: any = null;
      
      if (!billDoc.exists()) {
        // This might be a receipt ID, try to get it from receipts collection
        const receiptRef = doc(db, 'receipts', paymentData.billId);
        const receiptDoc = await getDoc(receiptRef);
        
        if (receiptDoc.exists()) {
          isReceiptBill = true;
          const receipt = receiptDoc.data() as FirebaseReceipt;
          
          // Calculate remaining balance
          const oldBalance = receipt.oldBalance || 0;
          const total = receipt.total || 0;
          const currentPaidAmount = receipt.amountPaid || 0;
          const remainingBalance = receipt.newBalance || (oldBalance + total - currentPaidAmount);
          
          // Validate payment amount
          if (paymentData.amount > remainingBalance) {
            throw new Error('Payment amount exceeds remaining balance');
          }
          
          // Update receipt with payment
          const newAmountPaid = currentPaidAmount + paymentData.amount;
          const newBalance = oldBalance + total - newAmountPaid;
          const isPaid = newBalance <= 0;
          
          await updateDoc(receiptRef, {
            amountPaid: newAmountPaid,
            newBalance: newBalance,
            isPaid: isPaid,
            updatedAt: serverTimestamp(),
          });
          
          console.log(`Receipt ${paymentData.billId} updated: paid ${paymentData.amount}, new balance: ${newBalance}`);
          return;
        } else {
          throw new Error('Bill or receipt not found');
        }
      }

      // Handle regular pending bill
      const batch = writeBatch(db);
      bill = billDoc.data() as PendingBill;

      // Validate payment amount
      if (paymentData.amount > bill.remainingBalance) {
        throw new Error('Payment amount exceeds remaining balance');
      }

      // Record payment
      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        billId: paymentData.billId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        notes: paymentData.notes,
        receiptId: paymentData.receiptId,
        receiptNumber: paymentData.receiptNumber,
        createdAt: serverTimestamp(),
      });

      // Update bill
      const newPaidAmount = bill.paidAmount + paymentData.amount;
      const newRemainingBalance = bill.amount - newPaidAmount;
      const newStatus = this.calculateBillStatus(bill.amount, newPaidAmount);

      batch.update(billRef, {
        paidAmount: newPaidAmount,
        remainingBalance: newRemainingBalance,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      // Sync customer balance from all receipts after payment
      if (bill.customerId || bill.customerName) {
        try {
          const { default: BalanceTrackingService } = await import('./BalanceTrackingService');
          const syncResult = await BalanceTrackingService.syncCustomerBalance(bill.customerName);
          if (syncResult.success) {
            console.log(`✅ Balance synced for ${bill.customerName}: ₹${syncResult.totalBalance}`);
          }
        } catch (error) {
          console.error('Error syncing balance after payment:', error);
        }
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Get all pending bills
   * Includes both manual pending bills and unpaid receipts
   */
  async getAllPendingBills(): Promise<PendingBill[]> {
    try {
      // Check if Firebase is initialized (offline check)
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        console.log('📴 Firebase not initialized - using offline data for pending bills');
        return this.getAllPendingBillsOffline();
      }
      
      await this.firebaseService.initialize();

      const bills: PendingBill[] = [];
      
      // Get manual pending bills (if any exist)
      try {
        console.log('Fetching manual pending bills...');
        const billsRef = collection(db, this.BILLS_COLLECTION);
        // Simplified query without orderBy to avoid index issues
        const q = query(
          billsRef,
          where('status', 'in', ['pending', 'partial', 'overdue'])
        );
        const querySnapshot = await getDocs(q);
        console.log(`Found ${querySnapshot.size} manual pending bills`);
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          bills.push({
            id: doc.id,
            customerId: data.customerId,
            customerName: data.customerName,
            businessName: data.businessName,
            businessPhone: data.businessPhone,
            amount: data.amount,
            paidAmount: data.paidAmount,
            remainingBalance: data.remainingBalance,
            receiptId: data.receiptId,
            receiptNumber: data.receiptNumber,
            notes: data.notes,
            dueDate: data.dueDate?.toDate(),
            status: data.status,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        });
      } catch (billsError) {
        console.error('Error fetching manual bills (continuing with receipts):', billsError);
      }

      // Get unpaid receipts from receipts collection
      // Strategy: Get all receipts and filter client-side since we need to handle:
      // 1. isPaid === false (explicitly unpaid)
      // 2. isPaid === undefined (old receipts without the field)
      // 3. Receipts with positive newBalance
      const receiptsRef = collection(db, 'receipts');
      
      console.log('Fetching all receipts to find unpaid ones...');
      const receiptsSnapshot = await getDocs(receiptsRef);
      console.log(`Retrieved ${receiptsSnapshot.size} total receipts for filtering`);

      // Convert unpaid receipts to PendingBill format
      let processedCount = 0;
      let skippedCount = 0;
      let addedCount = 0;
      
      receiptsSnapshot.forEach(doc => {
        processedCount++;
        const receipt = doc.data() as FirebaseReceipt;
        
        console.log(`\n--- Receipt ${processedCount}/${receiptsSnapshot.size} ---`);
        console.log('Receipt ID:', doc.id);
        console.log('Receipt Number:', receipt.receiptNumber);
        console.log('Customer:', receipt.customerName);
        
        // Calculate balance first to determine if it should be included
        const oldBalance = receipt.oldBalance || 0;
        const total = receipt.total || 0;
        const amountPaid = receipt.amountPaid || 0;
        const remainingBalance = receipt.newBalance !== undefined ? receipt.newBalance : (oldBalance + total - amountPaid);
        
        console.log('Balance Calculation:');
        console.log('  oldBalance:', oldBalance);
        console.log('  total:', total);
        console.log('  amountPaid:', amountPaid);
        console.log('  newBalance (from DB):', receipt.newBalance);
        console.log('  remainingBalance (calculated):', remainingBalance);
        console.log('  isPaid:', receipt.isPaid);
        
        // Filter: Include receipts with remaining balance
        // A receipt should be in pending bills if:
        // 1. remainingBalance > 0 (most important - there's money owed)
        // This covers:
        //   - Unpaid receipts (isPaid: false, balance > 0)
        //   - Partially paid (isPaid: true, but balance > 0)
        //   - Old receipts without isPaid field
        const hasOutstandingBalance = remainingBalance > 0;
        const isUnpaid = hasOutstandingBalance;
        
        console.log('Decision Logic:');
        console.log('  remainingBalance > 0?', remainingBalance > 0);
        console.log('  FINAL: Should include in pending bills?', isUnpaid);
        if (isUnpaid) {
          console.log('  Reason: Outstanding balance exists');
        }
        
        if (!isUnpaid) {
          console.log('❌ SKIPPED - Marked as paid or no balance');
          skippedCount++;
          return; // Skip paid receipts
        }
        
        // Only add if there's actually a balance remaining
        if (remainingBalance > 0) {
          console.log('✅ ADDING TO PENDING BILLS');
          addedCount++;
          
          // Determine status: partial if some payment made but not full, pending if no payment
          let status: 'pending' | 'partial' | 'paid' | 'overdue' = 'pending';
          if (amountPaid > 0 && remainingBalance > 0) {
            status = 'partial'; // Some payment made, but still owed
          } else if (amountPaid === 0) {
            status = 'pending'; // No payment made
          }
          // Note: remainingBalance <= 0 means fully paid, but those are filtered out above
          
          bills.push({
            id: doc.id,
            customerId: '', // Receipts don't have customerId, use name for grouping
            customerName: receipt.customerName || 'Walk-in Customer',
            businessName: receipt.businessName,
            businessPhone: receipt.businessPhone,
            amount: total,
            oldBalance: oldBalance, // Include previous balance
            paidAmount: amountPaid,
            remainingBalance: remainingBalance,
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            notes: undefined,
            dueDate: undefined,
            status: status,
            createdAt: receipt.createdAt?.toDate() || receipt.date.toDate(),
            updatedAt: receipt.updatedAt?.toDate() || receipt.date.toDate(),
          });
        } else {
          console.log('❌ SKIPPED - Zero or negative balance');
          skippedCount++;
        }
      });

      // Sort by creation date (most recent first)
      bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('\n=== SUMMARY ===');
      console.log(`Total receipts processed: ${processedCount}`);
      console.log(`Receipts added to pending bills: ${addedCount}`);
      console.log(`Receipts skipped: ${skippedCount}`);
      console.log(`Total pending bills (manual + receipts): ${bills.length}`);
      console.log('===============\n');

      return bills;
    } catch (error) {
      console.error('Error getting pending bills:', error);
      throw error;
    }
  }

  /**
   * Get bills for a specific customer
   */
  async getCustomerBills(customerId: string): Promise<PendingBill[]> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');

      const billsRef = collection(db, this.BILLS_COLLECTION);
      const q = query(
        billsRef,
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const bills: PendingBill[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        bills.push({
          id: doc.id,
          customerId: data.customerId,
          customerName: data.customerName,
          businessName: data.businessName,
          businessPhone: data.businessPhone,
          amount: data.amount,
          paidAmount: data.paidAmount,
          remainingBalance: data.remainingBalance,
          receiptId: data.receiptId,
          receiptNumber: data.receiptNumber,
          notes: data.notes,
          dueDate: data.dueDate?.toDate(),
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      return bills;
    } catch (error) {
      console.error('Error getting customer bills:', error);
      throw error;
    }
  }

  /**
   * Get customer total balance
   */
  async getCustomerBalance(customerId: string): Promise<number> {
    try {
      const bills = await this.getCustomerBills(customerId);
      return bills
        .filter(bill => bill.status !== 'paid')
        .reduce((sum, bill) => sum + bill.remainingBalance, 0);
    } catch (error) {
      console.error('Error getting customer balance:', error);
      return 0;
    }
  }

  /**
   * Get customer balance by name (for receipt creation)
   */
  async getCustomerBalanceByName(customerName: string): Promise<number> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');

      const billsRef = collection(db, this.BILLS_COLLECTION);
      const q = query(
        billsRef,
        where('customerName', '==', customerName),
        where('status', 'in', ['pending', 'partial', 'overdue'])
      );
      const querySnapshot = await getDocs(q);

      let totalBalance = 0;
      querySnapshot.forEach(doc => {
        const data = doc.data();
        totalBalance += data.remainingBalance || 0;
      });

      return totalBalance;
    } catch (error) {
      console.error('Error getting customer balance by name:', error);
      return 0;
    }
  }

  /**
   * Get payment history for a bill
   */
  async getBillPayments(billId: string): Promise<Payment[]> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');

      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      const q = query(
        paymentsRef,
        where('billId', '==', billId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const payments: Payment[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        payments.push({
          id: doc.id,
          billId: data.billId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          receiptId: data.receiptId,
          receiptNumber: data.receiptNumber,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      return payments;
    } catch (error) {
      console.error('Error getting bill payments:', error);
      throw error;
    }
  }

  /**
   * Delete a bill
   */
  async deleteBill(billId: string): Promise<void> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');

      // Get bill first to update customer balance
      const billRef = doc(db, this.BILLS_COLLECTION, billId);
      const billDoc = await getDoc(billRef);

      if (!billDoc.exists()) {
        throw new Error('Bill not found');
      }

      const bill = billDoc.data() as PendingBill;

      // Delete associated payments
      const paymentsRef = collection(db, this.PAYMENTS_COLLECTION);
      const paymentsQuery = query(paymentsRef, where('billId', '==', billId));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      const batch = writeBatch(db);
      paymentsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      batch.delete(billRef);
      await batch.commit();

      // Update customer balance
      await this.updateCustomerBalance(bill.customerId, -bill.remainingBalance);
    } catch (error) {
      console.error('Error deleting bill:', error);
      throw error;
    }
  }

  /**
   * Calculate bill status based on payment
   */
  private calculateBillStatus(amount: number, paidAmount: number): PendingBill['status'] {
    if (paidAmount === 0) return 'pending';
    if (paidAmount >= amount) return 'paid';
    return 'partial';
  }

  /**
   * Update customer balance in person_details
   */
  private async updateCustomerBalance(customerId: string, amountChange: number): Promise<void> {
    try {
      const db = getFirebaseDb();
      if (!db) return; // Skip if Firebase not initialized

      const personDetailsService = PersonDetailsService.getInstance();
      const customerRef = doc(db, 'person_details', customerId);
      const customerDoc = await getDoc(customerRef);

      if (customerDoc.exists()) {
        await updateDoc(customerRef, {
          balanceDue: increment(amountChange),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating customer balance:', error);
    }
  }

  /**
   * Get overdue bills
   */
  async getOverdueBills(): Promise<PendingBill[]> {
    try {
      const allBills = await this.getAllPendingBills();
      const now = new Date();

      return allBills.filter(bill => {
        if (!bill.dueDate) return false;
        return bill.dueDate < now && bill.status !== 'paid';
      }).map(bill => ({
        ...bill,
        status: 'overdue' as const,
      }));
    } catch (error) {
      console.error('Error getting overdue bills:', error);
      return [];
    }
  }

  /**
   * Get pending bills statistics
   */
  async getBillsStatistics() {
    try {
      const bills = await this.getAllPendingBills();
      
      const totalPending = bills.reduce((sum, bill) => sum + bill.remainingBalance, 0);
      const totalBills = bills.length;
      const overdueCount = bills.filter(bill => bill.status === 'overdue').length;
      const partialPaymentCount = bills.filter(bill => bill.status === 'partial').length;

      return {
        totalPending,
        totalBills,
        overdueCount,
        partialPaymentCount,
      };
    } catch (error) {
      console.error('Error getting bills statistics:', error);
      return {
        totalPending: 0,
        totalBills: 0,
        overdueCount: 0,
        partialPaymentCount: 0,
      };
    }
  }

  /**
   * Get pending bills from local SQLite (offline mode)
   */
  private async getAllPendingBillsOffline(): Promise<PendingBill[]> {
    try {
      const database = getDatabase();
      if (!database || !isDatabaseReady()) {
        console.log('⚠️ Database not initialized');
        return [];
      }

      console.log('💾 Loading pending bills from SQLite...');
      
      // Query receipts with unpaid balances
      // Check both new schema (new_balance) and old schema (status)
      const receipts = database.getAllSync(
        `SELECT * FROM receipts 
         WHERE (is_paid = 0 OR is_paid IS NULL OR new_balance > 0)
         ORDER BY date DESC`
      );
      
      console.log(`Found ${receipts.length} receipts in SQLite`);
      
      const bills: PendingBill[] = [];
      
      for (const receipt of receipts) {
        // Calculate balance from new schema if available
        const oldBalance = receipt.old_balance || 0;
        const amountPaid = receipt.amount_paid || 0;
        const newBalance = receipt.new_balance;
        
        const subtotal = receipt.subtotal || 0;
        const tax = receipt.tax || 0;
        const total = receipt.total || (subtotal + tax);
        
        // Use new_balance if available, otherwise calculate from total
        const remainingBalance = newBalance !== null && newBalance !== undefined 
          ? newBalance 
          : (total - amountPaid);
        
        // Skip if no balance
        if (remainingBalance <= 0) continue;
        
        bills.push({
          id: receipt.id || receipt.firebase_id || String(receipt.receipt_number),
          customerId: '',
          customerName: receipt.customer_name || 'Walk-in Customer',
          businessName: undefined,
          businessPhone: undefined,
          amount: total,
          oldBalance: oldBalance,
          paidAmount: amountPaid,
          remainingBalance: remainingBalance,
          receiptId: receipt.id,
          receiptNumber: receipt.receipt_number,
          notes: receipt.notes,
          dueDate: undefined,
          status: amountPaid > 0 && remainingBalance > 0 ? 'partial' : 'pending',
          createdAt: new Date(receipt.date || Date.now()),
          updatedAt: new Date(receipt.updated_at || receipt.date || Date.now()),
        });
      }
      
      console.log(`💾 Loaded ${bills.length} pending bills from SQLite`);
      return bills;
    } catch (error) {
      console.error('❌ Error getting offline pending bills:', error);
      return [];
    }
  }
}

export default PendingBillsService;
