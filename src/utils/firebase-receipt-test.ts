/**
 * Demo/Test utilities for Firebase receipt functionality
 * 
 * This file contains helper functions to test and demonstrate
 * the Firebase receipt saving feature.
 */

import ReceiptFirebaseService from '../services/ReceiptFirebaseService';
import { Receipt, ReceiptItem } from '../types';
import { generateId, generateReceiptNumber } from '../utils';

/**
 * Create a sample receipt for testing
 */
export const createSampleReceipt = (): Receipt => {
  const sampleItems: ReceiptItem[] = [
    {
      id: generateId(),
      name: 'Sample Item 1',
      price: 19.99,
      quantity: 2
    },
    {
      id: generateId(),
      name: 'Sample Item 2', 
      price: 5.50,
      quantity: 1
    }
  ];

  const subtotal = sampleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  return {
    id: generateId(),
    items: sampleItems,
    subtotal,
    tax,
    total,
    date: new Date(),
    receiptNumber: generateReceiptNumber(),
    companyName: 'Test Store',
    companyAddress: '123 Test St, Test City, TS 12345',
    footerMessage: 'Thank you for testing!',
    customerName: 'Test Customer'
  };
};

/**
 * Test saving a receipt to Firebase
 */
export const testFirebaseReceiptSave = async (): Promise<void> => {
  try {
    const sampleReceipt = createSampleReceipt();
    console.log('Testing Firebase receipt save with sample data:', sampleReceipt);
    
    const result = await ReceiptFirebaseService.saveReceipt(
      sampleReceipt,
      'pdf',
      '/path/to/test/receipt.pdf'
    );
    
    if (result.success) {
      console.log('✅ Firebase receipt save test successful!');
      console.log('Document ID:', result.documentId);
      
      // Test retrieving the saved receipt
      const retrievedReceipt = await ReceiptFirebaseService.getReceipt(sampleReceipt.id);
      if (retrievedReceipt) {
        console.log('✅ Firebase receipt retrieval test successful!');
        console.log('Retrieved receipt:', retrievedReceipt);
      } else {
        console.log('❌ Failed to retrieve saved receipt');
      }
    } else {
      console.log('❌ Firebase receipt save test failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Firebase receipt test error:', error);
  }
};

/**
 * Test getting all receipts from Firebase
 */
export const testGetAllReceipts = async (): Promise<void> => {
  try {
    console.log('Testing Firebase get all receipts...');
    const receipts = await ReceiptFirebaseService.getAllReceipts();
    console.log('✅ Retrieved', receipts.length, 'receipts from Firebase');
    
    // Log receipt summaries
    receipts.forEach((receipt, index) => {
      console.log(`Receipt ${index + 1}:`, {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        total: receipt.total,
        status: receipt.status,
        printMethod: receipt.printMethod
      });
    });
  } catch (error) {
    console.error('❌ Get all receipts test error:', error);
  }
};

/**
 * Console commands for testing Firebase functionality
 * 
 * You can run these in the browser console or add them to your app:
 * 
 * // Test saving a receipt
 * import { testFirebaseReceiptSave } from './utils/firebase-receipt-test';
 * testFirebaseReceiptSave();
 * 
 * // Test getting all receipts  
 * import { testGetAllReceipts } from './utils/firebase-receipt-test';
 * testGetAllReceipts();
 */
