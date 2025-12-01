import PersonDetailsService, { PersonDetail } from '../data/PersonDetailsService';
import { getFirebaseDb, isFirebaseInitialized } from '../../config/firebase';
import { doc, runTransaction, serverTimestamp, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { FirebaseReceipt } from './ReceiptFirebaseService';
import {
  calculateReceiptBalance,
  calculateCustomerTotalBalance,
  getUnpaidReceipts,
} from '../../utils/paymentCalculations';

/**
 * Centralized service for managing customer balances across the app
 */
interface CachedBalance {
  balance: number;
  timestamp: number;
}

// Cache TTL: 5 minutes
const BALANCE_CACHE_TTL = 5 * 60 * 1000;

class BalanceTrackingService {
  private static instance: BalanceTrackingService;
  private balanceCache: Map<string, CachedBalance> = new Map();

  private constructor() {}

  public static getInstance(): BalanceTrackingService {
    if (!BalanceTrackingService.instance) {
      BalanceTrackingService.instance = new BalanceTrackingService();
    }
    return BalanceTrackingService.instance;
  }

  /**
   * Get customer's current balance by calculating from all their receipts
   */
  async getCustomerBalance(customerName: string): Promise<number> {
    if (!customerName?.trim()) return 0;

    const trimmedName = customerName.trim();

    // Check cache first
    const cached = this.balanceCache.get(trimmedName);
    if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
      return cached.balance;
    }

    try {
      const db = getFirebaseDb();
      if (!db) {
        console.warn('Firebase not initialized');
        return 0;
      }

      // Fetch all receipts for this customer
      const receiptsRef = collection(db, 'receipts');
      const q = query(receiptsRef, where('customerName', '==', trimmedName));
      const querySnapshot = await getDocs(q);

      const receipts: FirebaseReceipt[] = [];
      querySnapshot.forEach((doc) => {
        receipts.push({ id: doc.id, ...doc.data() } as FirebaseReceipt);
      });

      // Calculate total balance using pure function
      const balance = calculateCustomerTotalBalance(receipts);

      // Cache the result
      this.balanceCache.set(trimmedName, {
        balance,
        timestamp: Date.now(),
      });

      if (__DEV__) {
        console.log(`💰 [BalanceTracking] ${trimmedName}: ₹${balance}`);
      }

      return balance;
    } catch (error) {
      console.error('Error getting customer balance:', error);
      return 0;
    }
  }

  /**
   * Get customer balance from provided receipts (no Firebase call)
   */
  calculateBalanceFromReceipts(receipts: FirebaseReceipt[]): number {
    return calculateCustomerTotalBalance(receipts);
  }

  /**
   * Invalidate cache for a customer
   */
  invalidateCache(customerName: string) {
    if (customerName?.trim()) {
      this.balanceCache.delete(customerName.trim());
      if (__DEV__) {
        console.log(`🗑️ [BalanceTracking] Cache invalidated for "${customerName}"`);
      }
    }
  }

  /**
   * Clear all cached balances
   */
  clearCache() {
    this.balanceCache.clear();
    if (__DEV__) {
      console.log('🗑️ [BalanceTracking] All cache cleared');
    }
  }

  /**
   * Calculate new balance based on receipt data
   * newBalance = oldBalance + (total - amountPaid)
   */
  calculateNewBalance(
    oldBalance: number,
    receiptTotal: number,
    isPaid: boolean,
    amountPaid: number
  ): number {
    if (isPaid) {
      // If fully paid, new balance is just the old balance
      return Math.max(0, oldBalance);
    }
    
    const receiptBalance = receiptTotal - amountPaid;
    const newBalance = oldBalance + receiptBalance;
    return Math.round(Math.max(0, newBalance) * 100) / 100;
  }

  /**
   * Sync customer balance in person_details
   */
  async syncCustomerBalance(
    customerName: string,
    businessName?: string,
    phoneNumber?: string
  ): Promise<{ success: boolean; error?: string; customerId?: string; totalBalance?: number }> {
    if (!customerName?.trim()) {
      return { success: false, error: 'Customer name is required' };
    }

    try {
      const db = getFirebaseDb();
      if (!db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      // Calculate current balance from receipts
      const totalBalance = await this.getCustomerBalance(customerName);

      // Find or create person_details record
      const personRef = collection(db, 'person_details');
      const q = query(personRef, where('name', '==', customerName.trim()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Update existing record
        const personDoc = snapshot.docs[0];
        await runTransaction(db, async (transaction) => {
          transaction.update(personDoc.ref, {
            balanceDue: totalBalance,
            updatedAt: serverTimestamp(),
          });
        });

        return {
          success: true,
          customerId: personDoc.id,
          totalBalance,
        };
      } else {
        // Create new record if customer doesn't exist
        const newPersonRef = doc(collection(db, 'person_details'));
        await runTransaction(db, async (transaction) => {
          transaction.set(newPersonRef, {
            name: customerName.trim(),
            businessName: businessName || '',
            phoneNumber: phoneNumber || '',
            balanceDue: totalBalance,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        return {
          success: true,
          customerId: newPersonRef.id,
          totalBalance,
        };
      }
    } catch (error) {
      console.error('Error syncing customer balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync balance',
      };
    }
  }

  /**
   * Update customer balance using Firestore transaction
   */
  async updateCustomerBalanceAtomic(
    customerName: string,
    newBalance: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!customerName?.trim()) {
      return { success: false, error: 'Customer name is required' };
    }

    try {
      const db = getFirebaseDb();
      if (!db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      const personRef = collection(db, 'person_details');
      const q = query(personRef, where('name', '==', customerName.trim()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const personDoc = snapshot.docs[0];
        await runTransaction(db, async (transaction) => {
          transaction.update(personDoc.ref, {
            balanceDue: Math.round(newBalance * 100) / 100,
            updatedAt: serverTimestamp(),
          });
        });

        // Invalidate cache
        this.invalidateCache(customerName);

        return { success: true };
      }

      return { success: false, error: 'Customer not found' };
    } catch (error) {
      console.error('Error updating customer balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update balance',
      };
    }
  }

  /**
   * Get all customers with outstanding balances
   */
  async getCustomersWithBalance(minimumBalance: number = 0): Promise<PersonDetail[]> {
    try {
      const allCustomers = await PersonDetailsService.getPersonDetails();
      
      const customersWithBalance = allCustomers.filter(customer => 
        (customer.balanceDue || 0) >= minimumBalance
      );

      customersWithBalance.sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));

      return customersWithBalance;
    } catch (error) {
      console.error('Error getting customers with balance:', error);
      return [];
    }
  }

  /**
   * Get total outstanding balance across all customers
   */
  async getTotalOutstandingBalance(): Promise<number> {
    try {
      const allCustomers = await PersonDetailsService.getPersonDetails();
      
      const totalBalance = allCustomers.reduce((total, customer) => {
        return total + (customer.balanceDue || 0);
      }, 0);

      return Math.round(totalBalance * 100) / 100;
    } catch (error) {
      console.error('Error calculating total outstanding balance:', error);
      return 0;
    }
  }

  /**
   * Validate balance calculation
   */
  validateBalanceCalculation(
    oldBalance: number,
    receiptTotal: number,
    amountPaid: number,
    newBalance: number
  ): boolean {
    const expectedBalance = oldBalance + (receiptTotal - amountPaid);
    const tolerance = 0.01; // Allow for floating point errors
    return Math.abs(expectedBalance - newBalance) <= tolerance;
  }

  /**
   * Get unpaid receipts for a customer
   */
  async getCustomerUnpaidReceipts(customerName: string): Promise<FirebaseReceipt[]> {
    if (!customerName?.trim()) return [];

    try {
      const db = getFirebaseDb();
      if (!db) return [];

      const receiptsRef = collection(db, 'receipts');
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

      return getUnpaidReceipts(receipts);
    } catch (error) {
      console.error('Error getting unpaid receipts:', error);
      return [];
    }
  }
}

export default BalanceTrackingService.getInstance();
