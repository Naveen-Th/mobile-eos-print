#!/usr/bin/env node

/**
 * Test Firebase Connection and Data
 * Run this to check if Firebase is connected and has data
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
  authDomain: "bill-printing-21ea4.firebaseapp.com",
  projectId: "bill-printing-21ea4",
  storageBucket: "bill-printing-21ea4.firebasestorage.app",
  messagingSenderId: "890975566565",
  appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};

async function testFirebaseConnection() {
  console.log('🔥 Testing Firebase connection...\n');
  
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialized successfully');
    
    // Test connection by fetching items
    console.log('📄 Fetching items from Firestore...');
    
    const itemsCollection = collection(db, 'item_details');
    const snapshot = await getDocs(itemsCollection);
    
    console.log(`📊 Found ${snapshot.docs.length} items in Firestore`);
    
    if (snapshot.docs.length > 0) {
      console.log('\n🏷️  Items found:');
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log(`  • ${data.item_name || 'Unnamed Item'} (ID: ${doc.id})`);
        console.log(`    - Price: $${data.price || 0}`);
        console.log(`    - Stock: ${data.stocks || 0}`);
        console.log(`    - Created: ${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}`);
      });
    } else {
      console.log('\n📝 No items found in Firestore');
      console.log('This explains why the refresh shows no items!');
      console.log('\nTo fix this, you can:');
      console.log('1. Add some items using the "Add Your First Item" button');
      console.log('2. Or import existing data if you have it elsewhere');
    }
    
    // Test receipts collection too
    console.log('\n📄 Checking receipts collection...');
    const receiptsCollection = collection(db, 'receipts');
    const receiptsSnapshot = await getDocs(receiptsCollection);
    console.log(`📊 Found ${receiptsSnapshot.docs.length} receipts in Firestore`);
    
    console.log('\n✅ Firebase connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testFirebaseConnection();
