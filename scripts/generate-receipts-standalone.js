#!/usr/bin/env node

/**
 * Standalone script to generate 1500 test receipts
 * Run with: node scripts/generate-receipts-standalone.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
  authDomain: "bill-printing-21ea4.firebaseapp.com",
  projectId: "bill-printing-21ea4",
  storageBucket: "bill-printing-21ea4.firebasestorage.app",
  messagingSenderId: "890975566565",
  appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};

// Sample data
const CUSTOMER_NAMES = [
  'Aishwarya', 'John Smith', 'Maria Garcia', 'Ahmed Khan', 'Li Wei',
  'Emma Johnson', 'Carlos Rodriguez', 'Yuki Tanaka', 'Sarah Miller', 'David Brown',
  'Priya Sharma', 'Michael Chen', 'Anna Kowalski', 'Omar Hassan', 'Sofia Martinez',
  'Kevin Wilson', 'Fatima Ali', 'James Taylor', 'Nina Patel', 'Robert Anderson'
];

const ITEM_NAMES = [
  'Coffee', 'Tea', 'Sandwich', 'Burger', 'Pizza',
  'Salad', 'Pasta', 'Soup', 'Juice', 'Water',
  'Cake', 'Cookie', 'Muffin', 'Bagel', 'Croissant',
  'Fries', 'Nachos', 'Chips', 'Soda', 'Smoothie'
];

const COMPANIES = [
  'Test Store', 'Sample Cafe', 'Demo Restaurant', 'Quick Mart', 'Food Corner'
];

// Helper functions
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (array) => array[Math.floor(Math.random() * array.length)];

const generateReceiptId = (index) => {
  const timestamp = Date.now() - (1500 - index) * 60000;
  return `receipt_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateReceiptNumber = (index) => {
  return `#REC-${String(20251106).padStart(8, '0')}-${String(6585 + index).padStart(4, '0')}`;
};

const generateItems = () => {
  const itemCount = randomBetween(1, 5);
  const items = [];
  
  for (let i = 0; i < itemCount; i++) {
    const price = randomBetween(5, 50) + (Math.random() * 0.99);
    const quantity = randomBetween(1, 3);
    
    items.push({
      id: `item_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      name: randomElement(ITEM_NAMES),
      price: parseFloat(price.toFixed(2)),
      quantity
    });
  }
  
  return items;
};

const generateReceipt = (index) => {
  const items = generateItems();
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  
  const daysAgo = randomBetween(0, 30);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(randomBetween(8, 22), randomBetween(0, 59), randomBetween(0, 59));
  
  const isPaid = Math.random() > 0.2;
  const oldBalance = randomBetween(0, 500);
  const amountPaid = isPaid ? total : randomBetween(0, total);
  const newBalance = oldBalance + total - amountPaid;
  
  return {
    id: generateReceiptId(index),
    items,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    date,
    receiptNumber: generateReceiptNumber(index),
    companyName: randomElement(COMPANIES),
    companyAddress: `${randomBetween(1, 999)} Main St, City ${randomBetween(1, 50)}, State ${randomBetween(10000, 99999)}`,
    footerMessage: 'Thank you for your business!',
    customerName: randomElement(CUSTOMER_NAMES),
    customerPhone: `+1${randomBetween(200, 999)}${randomBetween(100, 999)}${randomBetween(1000, 9999)}`,
    paymentMethod: randomElement(['cash', 'card', 'digital']),
    isPaid,
    oldBalance: parseFloat(oldBalance.toFixed(2)),
    amountPaid: parseFloat(amountPaid.toFixed(2)),
    newBalance: parseFloat(newBalance.toFixed(2))
  };
};

const saveReceipt = async (db, receipt, printMethod, pdfPath) => {
  try {
    const now = serverTimestamp();
    const receiptDate = receipt.date instanceof Date ? receipt.date : new Date();
    
    const firebaseReceipt = {
      ...receipt,
      receiptNumber: receipt.receiptNumber || `R-${Date.now()}`,
      customerName: receipt.customerName || 'Walk-in Customer',
      items: receipt.items || [],
      subtotal: receipt.subtotal || 0,
      tax: receipt.tax || 0,
      total: receipt.total || 0,
      date: Timestamp.fromDate(receiptDate),
      createdAt: now,
      updatedAt: now,
      printMethod,
      printed: printMethod === 'thermal',
      status: printMethod === 'pdf' ? 'exported' : 'printed',
      oldBalance: receipt.oldBalance !== undefined ? receipt.oldBalance : 0,
      isPaid: receipt.isPaid !== undefined ? receipt.isPaid : false,
      amountPaid: receipt.amountPaid !== undefined ? receipt.amountPaid : 0,
      newBalance: receipt.newBalance !== undefined ? receipt.newBalance : 0,
    };
    
    if (printMethod === 'thermal') {
      firebaseReceipt.printedAt = now;
    }
    
    if (pdfPath && typeof pdfPath === 'string' && pdfPath.trim()) {
      firebaseReceipt.pdfPath = pdfPath.trim();
    }
    
    const docRef = doc(db, 'receipts', receipt.id);
    await setDoc(docRef, firebaseReceipt, { merge: false });
    
    return { success: true, documentId: receipt.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const generateTestReceipts = async (count = 1500) => {
  console.log(`🚀 Starting generation of ${count} test receipts...\n`);
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  
  const BATCH_SIZE = 50;
  const totalBatches = Math.ceil(count / BATCH_SIZE);
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
    const batchSize = batchEnd - batchStart;
    
    console.log(`\n📦 Batch ${batch + 1}/${totalBatches}: Processing receipts ${batchStart + 1}-${batchEnd}...`);
    
    const receipts = Array.from({ length: batchSize }, (_, i) => 
      generateReceipt(batchStart + i)
    );
    
    const savePromises = receipts.map(async (receipt, i) => {
      try {
        const result = await saveReceipt(
          db,
          receipt,
          Math.random() > 0.5 ? 'pdf' : 'thermal',
          Math.random() > 0.5 ? `/receipts/${receipt.id}.pdf` : undefined
        );
        
        if (result.success) {
          successCount++;
          if ((batchStart + i + 1) % 100 === 0) {
            console.log(`✅ Progress: ${successCount}/${count} receipts saved`);
          }
        } else {
          failCount++;
          console.error(`❌ Failed to save receipt ${batchStart + i + 1}: ${result.error}`);
        }
      } catch (error) {
        failCount++;
        console.error(`❌ Error saving receipt ${batchStart + i + 1}: ${error.message}`);
      }
    });
    
    await Promise.all(savePromises);
    
    // Small delay between batches
    if (batch < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 GENERATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Successfully saved: ${successCount} receipts`);
  console.log(`❌ Failed: ${failCount} receipts`);
  console.log(`⏱️  Total time: ${duration} seconds`);
  console.log(`⚡ Average: ${(successCount / parseFloat(duration)).toFixed(2)} receipts/second`);
  console.log('='.repeat(60));
  
  process.exit(0);
};

// Run the script
generateTestReceipts(1500).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

