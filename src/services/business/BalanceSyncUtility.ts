import { getFirebaseDb, isFirebaseInitialized } from '../../config/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import BalanceTrackingService from '../business/BalanceTrackingService';
import PersonDetailsService from '../data/PersonDetailsService';

/**
 * Utility to synchronize all customer balances between receipts and person_details
 * Run this to fix any discrepancies in your database
 */
export class BalanceSyncUtility {
  private static instance: BalanceSyncUtility;

  private constructor() {}

  public static getInstance(): BalanceSyncUtility {
    if (!BalanceSyncUtility.instance) {
      BalanceSyncUtility.instance = new BalanceSyncUtility();
    }
    return BalanceSyncUtility.instance;
  }

  /**
   * Sync all customer balances from receipts to person_details
   * This is the nuclear option to fix all balance discrepancies
   */
  async syncAllCustomerBalances(): Promise<{
    success: boolean;
    totalCustomers: number;
    syncedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    console.log('🔄 Starting balance synchronization for all customers...');
    
    const errors: string[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        return {
          success: false,
          totalCustomers: 0,
          syncedCount: 0,
          failedCount: 0,
          errors: ['Firebase not initialized']
        };
      }

      // Get all unique customer names from receipts
      const receiptsRef = collection(db, 'receipts');
      const receiptsSnapshot = await getDocs(receiptsRef);
      
      const customerNames = new Set<string>();
      receiptsSnapshot.forEach(doc => {
        const receipt = doc.data();
        if (receipt.customerName && receipt.customerName.trim()) {
          customerNames.add(receipt.customerName.trim());
        }
      });

      console.log(`📊 Found ${customerNames.size} unique customers in receipts`);

      // Sync balance for each customer
      for (const customerName of customerNames) {
        try {
          console.log(`\n🔄 Syncing ${customerName}...`);
          
          const result = await BalanceTrackingService.syncCustomerBalance(customerName);
          
          if (result.success) {
            console.log(`✅ ${customerName}: ₹${result.totalBalance}`);
            syncedCount++;
          } else {
            console.warn(`⚠️ ${customerName}: ${result.error}`);
            failedCount++;
            errors.push(`${customerName}: ${result.error}`);
          }
        } catch (error) {
          console.error(`❌ Error syncing ${customerName}:`, error);
          failedCount++;
          errors.push(`${customerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log('\n' + '='.repeat(50));
      console.log('📊 Balance Synchronization Complete');
      console.log('='.repeat(50));
      console.log(`Total customers: ${customerNames.size}`);
      console.log(`✅ Successfully synced: ${syncedCount}`);
      console.log(`❌ Failed: ${failedCount}`);
      
      if (errors.length > 0) {
        console.log('\n⚠️ Errors:');
        errors.forEach(err => console.log(`  - ${err}`));
      }

      return {
        success: failedCount === 0,
        totalCustomers: customerNames.size,
        syncedCount,
        failedCount,
        errors
      };

    } catch (error) {
      console.error('❌ Fatal error in balance synchronization:', error);
      return {
        success: false,
        totalCustomers: 0,
        syncedCount,
        failedCount,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Generate a balance report comparing receipts vs person_details
   * Useful for debugging balance discrepancies
   */
  async generateBalanceReport(): Promise<{
    customers: Array<{
      name: string;
      receiptsBalance: number;
      personDetailsBalance: number;
      discrepancy: number;
      hasDiscrepancy: boolean;
    }>;
    totalReceiptsBalance: number;
    totalPersonDetailsBalance: number;
    totalDiscrepancy: number;
  }> {
    console.log('📊 Generating balance report...');

    try {
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        throw new Error('Firebase not initialized');
      }

      // Get all unique customer names from receipts
      const receiptsRef = collection(db, 'receipts');
      const receiptsSnapshot = await getDocs(receiptsRef);
      
      const customerNames = new Set<string>();
      receiptsSnapshot.forEach(doc => {
        const receipt = doc.data();
        if (receipt.customerName && receipt.customerName.trim()) {
          customerNames.add(receipt.customerName.trim());
        }
      });

      const customers = [];
      let totalReceiptsBalance = 0;
      let totalPersonDetailsBalance = 0;

      // Get all person details
      const allPersons = await PersonDetailsService.getPersonDetails();

      for (const customerName of customerNames) {
        // Get balance from receipts
        const receiptsBalance = await BalanceTrackingService.getCustomerBalance(customerName);
        
        // Get balance from person_details
        const personDetail = allPersons.find(p => 
          p.personName.toLowerCase() === customerName.toLowerCase()
        );
        const personDetailsBalance = personDetail?.balanceDue || 0;

        const discrepancy = Math.abs(receiptsBalance - personDetailsBalance);
        const hasDiscrepancy = discrepancy > 0.01; // More than 1 paisa difference

        customers.push({
          name: customerName,
          receiptsBalance,
          personDetailsBalance,
          discrepancy,
          hasDiscrepancy
        });

        totalReceiptsBalance += receiptsBalance;
        totalPersonDetailsBalance += personDetailsBalance;
      }

      const totalDiscrepancy = Math.abs(totalReceiptsBalance - totalPersonDetailsBalance);

      // Sort by discrepancy (largest first)
      customers.sort((a, b) => b.discrepancy - a.discrepancy);

      console.log('\n' + '='.repeat(70));
      console.log('📊 BALANCE REPORT');
      console.log('='.repeat(70));
      console.log(`Total customers: ${customers.length}`);
      console.log(`Total balance (receipts): ₹${totalReceiptsBalance.toFixed(2)}`);
      console.log(`Total balance (person_details): ₹${totalPersonDetailsBalance.toFixed(2)}`);
      console.log(`Total discrepancy: ₹${totalDiscrepancy.toFixed(2)}`);
      
      const customersWithDiscrepancies = customers.filter(c => c.hasDiscrepancy);
      if (customersWithDiscrepancies.length > 0) {
        console.log(`\n⚠️ Customers with discrepancies: ${customersWithDiscrepancies.length}`);
        console.log('\nTop discrepancies:');
        customersWithDiscrepancies.slice(0, 10).forEach(c => {
          console.log(`  ${c.name}:`);
          console.log(`    Receipts: ₹${c.receiptsBalance.toFixed(2)}`);
          console.log(`    Person Details: ₹${c.personDetailsBalance.toFixed(2)}`);
          console.log(`    Difference: ₹${c.discrepancy.toFixed(2)}`);
        });
      } else {
        console.log('\n✅ No discrepancies found! All balances are in sync.');
      }
      console.log('='.repeat(70) + '\n');

      return {
        customers,
        totalReceiptsBalance,
        totalPersonDetailsBalance,
        totalDiscrepancy
      };

    } catch (error) {
      console.error('❌ Error generating balance report:', error);
      throw error;
    }
  }

  /**
   * Sync a single customer's balance
   * Useful for fixing individual customer balance issues
   */
  async syncSingleCustomer(customerName: string): Promise<{
    success: boolean;
    error?: string;
    oldBalance?: number;
    newBalance?: number;
  }> {
    try {
      console.log(`🔄 Syncing balance for ${customerName}...`);

      // Get current balance from person_details
      const allPersons = await PersonDetailsService.getPersonDetails();
      const personDetail = allPersons.find(p => 
        p.personName.toLowerCase() === customerName.toLowerCase()
      );
      const oldBalance = personDetail?.balanceDue || 0;

      // Sync from receipts
      const result = await BalanceTrackingService.syncCustomerBalance(customerName);

      if (result.success) {
        console.log(`✅ Balance synced successfully`);
        console.log(`   Old balance: ₹${oldBalance.toFixed(2)}`);
        console.log(`   New balance: ₹${result.totalBalance?.toFixed(2) || '0.00'}`);
        
        return {
          success: true,
          oldBalance,
          newBalance: result.totalBalance || 0
        };
      } else {
        return {
          success: false,
          error: result.error,
          oldBalance,
          newBalance: 0
        };
      }
    } catch (error) {
      console.error(`❌ Error syncing ${customerName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default BalanceSyncUtility.getInstance();
