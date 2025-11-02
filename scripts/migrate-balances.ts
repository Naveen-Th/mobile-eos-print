/**
 * Balance Migration Script
 * 
 * This script migrates customer balances from the old system (stored in receipts)
 * to the new system (stored in person_details.balanceDue)
 * 
 * Run this script ONCE after deploying the new balance tracking system
 * 
 * Usage:
 * npx ts-node scripts/migrate-balances.ts
 */

import PersonDetailsService from '../src/services/PersonDetailsService';
import ReceiptFirebaseService from '../src/services/ReceiptFirebaseService';
import { initializeFirebase } from '../src/config/firebase';

interface MigrationResult {
  totalCustomers: number;
  successfulMigrations: number;
  failedMigrations: number;
  skippedCustomers: number;
  errors: Array<{ customerName: string; error: string }>;
}

async function migrateCustomerBalances(): Promise<MigrationResult> {
  console.log('🚀 Starting balance migration...\n');

  const result: MigrationResult = {
    totalCustomers: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    skippedCustomers: 0,
    errors: []
  };

  try {
    // Initialize Firebase
    console.log('📱 Initializing Firebase...');
    const initialized = initializeFirebase();
    if (!initialized) {
      throw new Error('Failed to initialize Firebase');
    }
    console.log('✅ Firebase initialized\n');

    // Get all customers from person_details
    console.log('📋 Fetching all customers from person_details...');
    const allCustomers = await PersonDetailsService.getPersonDetails();
    result.totalCustomers = allCustomers.length;
    console.log(`✅ Found ${allCustomers.length} customers\n`);

    if (allCustomers.length === 0) {
      console.log('ℹ️  No customers found. Migration complete.');
      return result;
    }

    console.log('🔄 Starting migration for each customer...\n');
    console.log('─'.repeat(80));

    // Process each customer
    for (let i = 0; i < allCustomers.length; i++) {
      const customer = allCustomers[i];
      const customerNum = i + 1;
      
      console.log(`\n[${customerNum}/${allCustomers.length}] Processing: ${customer.personName}`);
      console.log('  Current balanceDue:', customer.balanceDue || 0);

      try {
        // Get latest balance from receipts (old system)
        console.log('  Fetching balance from receipts...');
        const balanceFromReceipts = await ReceiptFirebaseService.getCustomerLatestBalance(
          customer.personName
        );

        console.log('  Balance from receipts:', balanceFromReceipts);

        // Check if migration is needed
        const currentBalance = customer.balanceDue || 0;
        
        if (currentBalance === balanceFromReceipts) {
          console.log('  ℹ️  Balance already correct, skipping');
          result.skippedCustomers++;
          continue;
        }

        // Update person_details with correct balance
        console.log('  Updating person_details...');
        const updateResult = await PersonDetailsService.updatePersonDetail(customer.id, {
          balanceDue: balanceFromReceipts
        });

        if (updateResult.success) {
          console.log(`  ✅ Successfully migrated: ${currentBalance} → ${balanceFromReceipts}`);
          result.successfulMigrations++;
        } else {
          console.log(`  ❌ Failed to update: ${updateResult.error}`);
          result.failedMigrations++;
          result.errors.push({
            customerName: customer.personName,
            error: updateResult.error || 'Unknown error'
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ❌ Error: ${errorMessage}`);
        result.failedMigrations++;
        result.errors.push({
          customerName: customer.personName,
          error: errorMessage
        });
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('\n✨ Migration Complete!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }

  return result;
}

async function printMigrationSummary(result: MigrationResult) {
  console.log('📊 Migration Summary');
  console.log('═'.repeat(80));
  console.log(`Total Customers:        ${result.totalCustomers}`);
  console.log(`Successful Migrations:  ${result.successfulMigrations} ✅`);
  console.log(`Skipped (Already OK):   ${result.skippedCustomers} ℹ️`);
  console.log(`Failed Migrations:      ${result.failedMigrations} ❌`);
  console.log('═'.repeat(80));

  if (result.errors.length > 0) {
    console.log('\n⚠️  Errors During Migration:');
    console.log('─'.repeat(80));
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.customerName}`);
      console.log(`   Error: ${error.error}`);
    });
    console.log('─'.repeat(80));
  }

  if (result.successfulMigrations > 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('   All customer balances have been migrated to person_details.');
    console.log('   You can now use the new BalanceTrackingService for all balance operations.');
  }

  if (result.failedMigrations > 0) {
    console.log('\n⚠️  Some migrations failed.');
    console.log('   Please review the errors above and fix manually in Firebase Console.');
  }

  console.log('\n💡 Next Steps:');
  console.log('   1. Verify balances in Firebase Console (person_details collection)');
  console.log('   2. Test receipt creation with existing customers');
  console.log('   3. Monitor app logs for any balance-related issues');
  console.log('');
}

// Dry run mode - preview what would be migrated without making changes
async function dryRun(): Promise<void> {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');

  try {
    // Initialize Firebase
    const initialized = initializeFirebase();
    if (!initialized) {
      throw new Error('Failed to initialize Firebase');
    }

    // Get all customers
    const allCustomers = await PersonDetailsService.getPersonDetails();
    console.log(`Found ${allCustomers.length} customers\n`);

    console.log('Preview of changes:');
    console.log('═'.repeat(80));

    let changesNeeded = 0;

    for (const customer of allCustomers) {
      const balanceFromReceipts = await ReceiptFirebaseService.getCustomerLatestBalance(
        customer.personName
      );
      const currentBalance = customer.balanceDue || 0;

      if (currentBalance !== balanceFromReceipts) {
        changesNeeded++;
        console.log(`\n${customer.personName}:`);
        console.log(`  Current: ₹${currentBalance}`);
        console.log(`  From Receipts: ₹${balanceFromReceipts}`);
        console.log(`  Change: ${currentBalance} → ${balanceFromReceipts}`);
      }
    }

    console.log('\n═'.repeat(80));
    console.log(`\nTotal changes needed: ${changesNeeded} out of ${allCustomers.length} customers`);
    
    if (changesNeeded > 0) {
      console.log('\n💡 To apply these changes, run: npx ts-node scripts/migrate-balances.ts --execute');
    } else {
      console.log('\n✅ All balances are already correct! No migration needed.');
    }

  } catch (error) {
    console.error('Error during dry run:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const executeMode = args.includes('--execute');
  const dryRunMode = args.includes('--dry-run') || !executeMode;

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         Customer Balance Migration Script                    ║');
  console.log('║         Thermal Receipt Printer App                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (dryRunMode) {
    await dryRun();
  } else if (executeMode) {
    console.log('⚠️  EXECUTE MODE - Changes will be applied to Firebase\n');
    console.log('   This will update all customer balances in person_details');
    console.log('   based on the latest receipts.\n');
    
    // Add a 3-second delay for user to cancel if needed
    console.log('   Starting in 3 seconds... (Press Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   2...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   1...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');

    const result = await migrateCustomerBalances();
    await printMigrationSummary(result);
  }

  console.log('\n✨ Done!\n');
  process.exit(0);
}

// Run the script
main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

export { migrateCustomerBalances, dryRun };
