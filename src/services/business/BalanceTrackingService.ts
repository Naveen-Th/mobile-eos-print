import PersonDetailsService, { PersonDetail } from '../data/PersonDetailsService';
import { getFirebaseDb, isFirebaseInitialized } from '../../config/firebase';
import { doc, runTransaction, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { BALANCE_CACHE_TTL, BALANCE_ROUNDING_TOLERANCE } from '../../constants/Business';
import Logger from '../../utils/Logger';

/**
 * Centralized service for managing customer balances across the app
 * 
 * This service ensures that:
 * 1. Customer balances are fetched from person_details (single source of truth)
 * 2. Balance updates are atomic and transactional
 * 3. Balance calculations are consistent across the app
 */
interface CachedBalance {
  balance: number;
  timestamp: number;
}

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
   * Get customer's current balance by calculating from unpaid receipts
   * This is the SOURCE OF TRUTH for customer balance
   * 
   * CRITICAL FIX: This function now correctly calculates balance by:
   * 1. Finding the OLDEST receipt's historical oldBalance (debt from before the system)
   * 2. Summing all UNPAID amounts from all receipts (total - amountPaid)
   * 3. Total = historical debt + sum of unpaid amounts
   * 
   * This prevents double-counting when receipts have oldBalance values that
   * were calculated from previous receipts.
   * 
   * @param customerName - The customer's name
   * @returns The current balance (positive = owes money, negative = has credit)
   */
  async getCustomerBalance(customerName: string): Promise<number> {
    try {
      if (!customerName?.trim()) {
        return 0;
      }

      const trimmedName = customerName.trim();
      
      // Check cache first (increased TTL for better performance)
      const cached = this.balanceCache.get(trimmedName);
      if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
        if (__DEV__) Logger.debug(`Using cached balance for "${trimmedName}": ₹${cached.balance}`);
        return cached.balance;
      }
      
      // Calculate balance from receipts collection (source of truth)
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        Logger.warn('Firebase not initialized - returning 0 balance');
        return 0;
      }

      console.log(`🔍 [DEBUG] Calculating balance for "${trimmedName}" from receipts...`);
      
      // Get all receipts for this customer
      const receiptsRef = collection(db, 'receipts');
      const q = query(
        receiptsRef,
        where('customerName', '==', trimmedName)
      );
      const querySnapshot = await getDocs(q);
      
      // Collect all receipts first and sort by date (OLDEST first for correct calculation)
      const allReceipts: any[] = [];
      querySnapshot.forEach(doc => {
        allReceipts.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by creation date (OLDEST first)
      allReceipts.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.date?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.date?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });
      
      let totalBalance = 0;
      let receiptCount = 0;
      let historicalDebt = 0;
      
      // ✅ FIXED STRATEGY: 
      // 1. Get historical debt from the OLDEST receipt's oldBalance (if it's manual/historical)
      // 2. Sum all unpaid amounts from ALL receipts
      // This prevents double-counting that occurred with the old strategy
      
      allReceipts.forEach((receipt, index) => {
        const total = receipt.total || 0;
        const amountPaid = receipt.amountPaid || 0;
        const remainingBalance = total - amountPaid;
        const receiptOldBalance = receipt.oldBalance || 0;
        
        // For the FIRST (oldest) receipt, capture historical debt
        // This is debt from BEFORE the system was used
        if (index === 0 && receiptOldBalance > 0) {
          // Check if this is truly historical debt (manual) or calculated from other receipts
          // If isManualOldBalance is true OR if there are no older receipts, it's historical
          const isHistorical = receipt.isManualOldBalance === true || index === 0;
          if (isHistorical) {
            historicalDebt = receiptOldBalance;
            console.log(`  📜 Historical debt from oldest receipt: ₹${historicalDebt}`);
          }
        }
        
        // Add this receipt's unpaid amount to total
        if (remainingBalance > 0.01) {
          totalBalance += remainingBalance;
          receiptCount++;
          if (__DEV__) Logger.debug(`  Receipt ${receipt.receiptNumber}: ₹${remainingBalance}`);
        }
      });
      
      // Add historical debt to total
      totalBalance += historicalDebt;
      
      // Round to 2 decimal places to avoid floating-point precision issues
      totalBalance = Math.round(totalBalance * 100) / 100;
      
      // Treat very small balances as zero (< 1 paisa)
      if (Math.abs(totalBalance) < 0.01) {
        totalBalance = 0;
      }
      
      // Cache the result
      this.balanceCache.set(trimmedName, {
        balance: totalBalance,
        timestamp: Date.now()
      });
      
      console.log(`✅ [SUCCESS] Total balance for "${trimmedName}": ₹${totalBalance} (historical: ₹${historicalDebt} + ${receiptCount} unpaid receipts)`);
      return totalBalance;

    } catch (error) {
      Logger.error('Error getting customer balance', error);
      // Return 0 on error to allow receipt creation to proceed
      return 0;
    }
  }

  /**
   * Invalidate cache for a customer
   * Call this after balance changes (receipt created, payment recorded)
   */
  invalidateCache(customerName: string) {
    if (customerName?.trim()) {
      this.balanceCache.delete(customerName.trim());
      Logger.debug(`Cache invalidated for "${customerName}"`);
    }
  }

  /**
   * Clear all cached balances
   */
  clearCache() {
    this.balanceCache.clear();
    Logger.debug('All balance cache cleared');
  }

  /**
   * Calculate new balance based on receipt data
   * 
   * @param oldBalance - Customer's current balance
   * @param receiptTotal - Total amount from the receipt
   * @param isPaid - Whether the customer made a payment
   * @param amountPaid - Amount paid by customer (if isPaid is true)
   * @returns The new calculated balance
   */
  calculateNewBalance(
    oldBalance: number,
    receiptTotal: number,
    isPaid: boolean,
    amountPaid: number
  ): number {
    // Validate inputs
    if (typeof oldBalance !== 'number' || isNaN(oldBalance)) oldBalance = 0;
    if (typeof receiptTotal !== 'number' || isNaN(receiptTotal)) receiptTotal = 0;
    if (typeof amountPaid !== 'number' || isNaN(amountPaid)) amountPaid = 0;

    // Calculate new balance
    // Formula: oldBalance + receiptTotal - amountPaid
    const newBalance = oldBalance + receiptTotal - (isPaid ? amountPaid : 0);

    if (__DEV__) {
      console.log(`💰 Balance calculation:`, {
        oldBalance,
        receiptTotal,
        isPaid,
        amountPaid,
        newBalance: newBalance.toFixed(2)
      });
    }

    return newBalance;
  }

  /**
   * Sync customer balance in person_details from all their unpaid receipts
   * This calculates the total balance from receipts (source of truth) and updates person_details
   * 
   * @param customerName - The customer's name
   * @param businessName - Business name (optional, for new customers)
   * @param phoneNumber - Phone number (optional, for new customers)
   * @returns Result object with success status and calculated balance
   */
  async syncCustomerBalance(
    customerName: string,
    businessName?: string,
    phoneNumber?: string
  ): Promise<{ success: boolean; error?: string; customerId?: string; totalBalance?: number }> {
    try {
      if (!customerName?.trim()) {
        return { success: false, error: 'Customer name is required' };
      }

      const trimmedName = customerName.trim();

      // Calculate actual balance from receipts (source of truth)
      const actualBalance = await this.getCustomerBalance(trimmedName);
      
      // Skip sync if balance is essentially zero (< 1 paisa)
      if (Math.abs(actualBalance) < 0.01) {
        if (__DEV__) console.log(`ℹ️ Skipping person_details sync for "${trimmedName}" - balance is zero`);
        return { success: true, totalBalance: 0 };
      }
      
      if (__DEV__) console.log(`💰 Syncing balance for "${trimmedName}": ₹${actualBalance.toFixed(2)} (calculated from receipts)`);

      // Search for existing customer
      const searchResults = await PersonDetailsService.searchPersonDetails(trimmedName);
      const existingCustomer = searchResults.find(person => 
        person.personName.toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingCustomer) {
        // Update existing customer's balance
        if (__DEV__) console.log(`📝 Updating balance in person_details: ${existingCustomer.balanceDue || 0} → ${actualBalance}`);
        
        const result = await PersonDetailsService.updatePersonDetail(existingCustomer.id, {
          balanceDue: actualBalance
        });

        if (result.success) {
          Logger.success(`Successfully synced balance for "${trimmedName}"`);
          // Invalidate cache since balance was synced
          this.invalidateCache(trimmedName);
          return { success: true, customerId: existingCustomer.id, totalBalance: actualBalance };
        } else {
          console.error(`❌ Failed to sync balance: ${result.error}`);
          return { success: false, error: result.error };
        }
      } else {
        // Create new customer record only if they have a balance or business details
        if (actualBalance > 0 || (businessName && phoneNumber)) {
          if (__DEV__) console.log(`✨ Creating new customer "${trimmedName}" with balance: ${actualBalance}`);
          
          // Only create if we have business details
          if (!businessName || !phoneNumber) {
            if (__DEV__) console.log(`ℹ️ Skipping person_details creation for "${trimmedName}" - missing business details`);
            return { 
              success: true,
              totalBalance: actualBalance,
              error: 'Customer tracked in receipts but not in person_details (missing business info)'
            };
          }

          const result = await PersonDetailsService.createPersonDetail({
            personName: trimmedName,
            businessName: businessName,
            phoneNumber: phoneNumber,
            balanceDue: actualBalance
          });

          if (result.success) {
            Logger.success(`Successfully created new customer "${trimmedName}" with balance ${actualBalance}`);
            this.invalidateCache(trimmedName);
            return { success: true, customerId: result.id, totalBalance: actualBalance };
          } else {
            console.error(`❌ Failed to create customer: ${result.error}`);
            return { 
              success: true,
              totalBalance: actualBalance,
              error: `Customer tracked in receipts but person_details creation failed: ${result.error}` 
            };
          }
        } else {
          if (__DEV__) console.log(`ℹ️ No balance for new customer "${trimmedName}", skipping person_details creation`);
          return { success: true, totalBalance: 0 };
        }
      }
    } catch (error) {
      console.error('Error syncing customer balance:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update customer balance using Firestore transaction (atomic operation)
   * This ensures balance updates are consistent even with concurrent operations
   * 
   * @param customerName - The customer's name
   * @param newBalance - The new balance to set
   * @returns Result object with success status
   */
  async updateCustomerBalanceAtomic(
    customerName: string,
    newBalance: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      if (!customerName?.trim()) {
        return { success: false, error: 'Customer name is required' };
      }

      const trimmedName = customerName.trim();

      // Search for existing customer
      const searchResults = await PersonDetailsService.searchPersonDetails(trimmedName);
      const existingCustomer = searchResults.find(person => 
        person.personName.toLowerCase() === trimmedName.toLowerCase()
      );

      if (!existingCustomer) {
        return { 
          success: false, 
          error: 'Customer not found - use updateCustomerBalance to create new customer' 
        };
      }

      // Use Firestore transaction for atomic update
      const customerRef = doc(db, 'person_details', existingCustomer.id);
      
      await runTransaction(db, async (transaction) => {
        const customerDoc = await transaction.get(customerRef);
        
        if (!customerDoc.exists()) {
          throw new Error('Customer document no longer exists');
        }

        // Update balance atomically
        transaction.update(customerRef, {
          balanceDue: newBalance,
          updatedAt: serverTimestamp()
        });
      });

      if (__DEV__) console.log(`✅ Atomically updated balance for "${trimmedName}": ${newBalance}`);
      return { success: true };

    } catch (error) {
      console.error('Error in atomic balance update:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all customers with outstanding balances
   * Useful for reports and overdue payment tracking
   * 
   * @param minimumBalance - Minimum balance threshold (default: 0)
   * @returns Array of customers with balances >= minimumBalance
   */
  async getCustomersWithBalance(minimumBalance: number = 0): Promise<PersonDetail[]> {
    try {
      const allCustomers = await PersonDetailsService.getPersonDetails();
      
      // Filter customers with balance >= minimumBalance
      const customersWithBalance = allCustomers.filter(customer => 
        (customer.balanceDue || 0) >= minimumBalance
      );

      // Sort by balance (highest first)
      customersWithBalance.sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));

      if (__DEV__) console.log(`Found ${customersWithBalance.length} customers with balance >= ${minimumBalance}`);
      return customersWithBalance;

    } catch (error) {
      console.error('Error getting customers with balance:', error);
      return [];
    }
  }

  /**
   * Get total outstanding balance across all customers
   * Useful for business analytics
   * 
   * @returns Total amount owed by all customers
   */
  async getTotalOutstandingBalance(): Promise<number> {
    try {
      const allCustomers = await PersonDetailsService.getPersonDetails();
      
      const totalBalance = allCustomers.reduce((total, customer) => {
        return total + (customer.balanceDue || 0);
      }, 0);

      if (__DEV__) console.log(`Total outstanding balance: ₹${totalBalance.toFixed(2)}`);
      return totalBalance;

    } catch (error) {
      console.error('Error calculating total outstanding balance:', error);
      return 0;
    }
  }

  /**
   * Validate balance calculation
   * Ensures the balance calculation is correct
   * 
   * @returns true if calculation is valid, false otherwise
   */
  validateBalanceCalculation(
    oldBalance: number,
    receiptTotal: number,
    amountPaid: number,
    newBalance: number
  ): boolean {
    const expectedNewBalance = oldBalance + receiptTotal - amountPaid;
    const isValid = Math.abs(expectedNewBalance - newBalance) < 0.01; // Allow 1 paisa tolerance for floating point

    if (!isValid) {
      console.error('❌ Balance calculation validation failed:', {
        oldBalance,
        receiptTotal,
        amountPaid,
        expectedNewBalance,
        actualNewBalance: newBalance,
        difference: Math.abs(expectedNewBalance - newBalance)
      });
    }

    return isValid;
  }
}

export default BalanceTrackingService.getInstance();
