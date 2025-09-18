#!/usr/bin/env node

/**
 * Add a test item to Firebase to help debug refresh issues
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
  authDomain: "bill-printing-21ea4.firebaseapp.com",
  projectId: "bill-printing-21ea4",
  storageBucket: "bill-printing-21ea4.firebasestorage.app",
  messagingSenderId: "890975566565",
  appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};

async function addTestItem() {
  console.log('🧪 Adding test item to Firebase...\n');
  
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Create test item data
    const testItem = {
      item_name: `Test Item ${new Date().getTime()}`,
      price: Math.floor(Math.random() * 100) + 10,
      stocks: Math.floor(Math.random() * 50) + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('📝 Test item data:', testItem);
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'item_details'), testItem);
    
    console.log('✅ Test item added successfully!');
    console.log('🆔 Document ID:', docRef.id);
    
    console.log('\n🔄 Now try refreshing your app - this item should appear!');
    
  } catch (error) {
    console.error('❌ Failed to add test item:', error.message);
    console.error('Full error:', error);
  }
}

addTestItem();
