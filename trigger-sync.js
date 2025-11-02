/**
 * Trigger Manual Sync Script
 * 
 * This script helps diagnose why customers are not syncing
 */

import { collection, getDocs } from 'firebase/firestore';
import { db, isFirebaseInitialized } from './src/config/firebase';
import AutoSyncService from './src/services/AutoSyncService';
import MobileAuthService from './src/services/MobileAuthService';

export async function checkFirebaseCollections() {
  console.log('\n========================================');
  console.log('🔍 FIREBASE COLLECTIONS CHECKER');
  console.log('========================================\n');

  if (!isFirebaseInitialized() || !db) {
    console.log('❌ Firebase is not initialized');
    console.log('   Make sure you are logged in and online');
    return;
  }

  try {
    // Check item_details collection
    console.log('📦 Checking item_details collection...');
    const itemsRef = collection(db, 'item_details');
    const itemsSnapshot = await getDocs(itemsRef);
    console.log(`✅ Found ${itemsSnapshot.size} items in Firebase`);
    
    if (itemsSnapshot.size > 0) {
      itemsSnapshot.docs.slice(0, 3).forEach((doc, index) => {
        console.log(`   Item ${index + 1}: ${doc.data().item_name || 'Unnamed'}`);
      });
    }

    // Check customers collection
    console.log('\n👥 Checking customers collection...');
    const customersRef = collection(db, 'customers');
    const customersSnapshot = await getDocs(customersRef);
    console.log(`${customersSnapshot.size > 0 ? '✅' : '⚠️'} Found ${customersSnapshot.size} customers in Firebase`);
    
    if (customersSnapshot.size > 0) {
      customersSnapshot.docs.slice(0, 3).forEach((doc, index) => {
        console.log(`   Customer ${index + 1}: ${doc.data().name || 'Unnamed'}`);
      });
    } else {
      console.log('   ℹ️ No customers in Firebase - this is why SQLite is empty');
      console.log('   → Add customers through "Party Management" in Settings');
    }

    // Check receipts collection
    console.log('\n📋 Checking receipts collection...');
    const receiptsRef = collection(db, 'receipts');
    const receiptsSnapshot = await getDocs(receiptsRef);
    console.log(`✅ Found ${receiptsSnapshot.size} receipts in Firebase`);
    
    if (receiptsSnapshot.size > 0) {
      receiptsSnapshot.docs.slice(0, 3).forEach((doc, index) => {
        const data = doc.data();
        console.log(`   Receipt ${index + 1}: ${data.receiptNumber || data.receipt_number || 'N/A'} - ${data.customerName || data.customer_name || 'No customer'}`);
      });
    }

    console.log('\n========================================');
    console.log('Summary:');
    console.log(`  Items in Firebase: ${itemsSnapshot.size}`);
    console.log(`  Customers in Firebase: ${customersSnapshot.size}`);
    console.log(`  Receipts in Firebase: ${receiptsSnapshot.size}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error checking Firebase collections:', error);
  }
}

export async function triggerManualSync() {
  console.log('\n========================================');
  console.log('🔄 MANUAL SYNC TRIGGER');
  console.log('========================================\n');

  const currentUser = MobileAuthService.getCurrentUser();
  
  if (!currentUser) {
    console.log('❌ No user logged in');
    console.log('   Please login first to trigger sync');
    return;
  }

  console.log(`✅ User logged in: ${currentUser.email}`);
  console.log('🔄 Starting manual sync...\n');

  try {
    await AutoSyncService.syncOnLogin(currentUser.uid, { forceFullSync: true });
    console.log('\n✅ Sync completed!');
    console.log('   Run viewDatabase() again to see the synced data');
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

export default {
  checkFirebaseCollections,
  triggerManualSync,
};
