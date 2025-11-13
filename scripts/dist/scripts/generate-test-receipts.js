"use strict";
/**
 * Generate 1000 Test Receipts for Firebase
 *
 * This script creates 1000 receipts and automatically saves them to Firebase
 * for testing database performance and UI rendering.
 *
 * Usage:
 * Run this from your React Native app or Node.js environment with Firebase initialized.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuickTest = exports.generateTestReceipts = void 0;
const ReceiptFirebaseService_1 = __importDefault(require("../src/services/business/ReceiptFirebaseService"));
// Sample data for generating receipts
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
/**
 * Generate a random number between min and max
 */
const randomBetween = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
/**
 * Generate a random element from an array
 */
const randomElement = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};
/**
 * Generate a unique receipt ID
 */
const generateReceiptId = (index) => {
    const timestamp = Date.now() - (1000 - index) * 60000; // Spread over time
    return `receipt_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
};
/**
 * Generate a receipt number
 */
const generateReceiptNumber = (index) => {
    return `#REC-${String(20251106).padStart(8, '0')}-${String(6585 + index).padStart(4, '0')}`;
};
/**
 * Generate random receipt items
 */
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
/**
 * Generate a single test receipt
 */
const generateReceipt = (index) => {
    const items = generateItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;
    // Random date within the last 30 days
    const daysAgo = randomBetween(0, 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(randomBetween(8, 22), randomBetween(0, 59), randomBetween(0, 59));
    // Random payment status
    const isPaid = Math.random() > 0.2; // 80% paid
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
/**
 * Generate and save receipts to Firebase
 */
const generateTestReceipts = async (count = 1000) => {
    console.log(`🚀 Starting generation of ${count} test receipts...`);
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    const receiptService = ReceiptFirebaseService_1.default.getInstance();
    // Process in batches to avoid overwhelming Firebase
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(count / BATCH_SIZE);
    for (let batch = 0; batch < totalBatches; batch++) {
        const batchStart = batch * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
        const batchSize = batchEnd - batchStart;
        console.log(`\n📦 Batch ${batch + 1}/${totalBatches}: Processing receipts ${batchStart + 1}-${batchEnd}...`);
        // Generate receipts for this batch
        const receipts = Array.from({ length: batchSize }, (_, i) => generateReceipt(batchStart + i));
        // Save all receipts in parallel (within batch)
        const savePromises = receipts.map(async (receipt, i) => {
            try {
                const result = await receiptService.saveReceipt(receipt, Math.random() > 0.5 ? 'pdf' : 'thermal', Math.random() > 0.5 ? `/receipts/${receipt.id}.pdf` : undefined);
                if (result.success) {
                    successCount++;
                    if ((batchStart + i + 1) % 100 === 0) {
                        console.log(`✅ Progress: ${successCount}/${count} receipts saved`);
                    }
                }
                else {
                    failCount++;
                    console.error(`❌ Failed to save receipt ${batchStart + i + 1}:`, result.error);
                }
            }
            catch (error) {
                failCount++;
                console.error(`❌ Error saving receipt ${batchStart + i + 1}:`, error);
            }
        });
        // Wait for batch to complete
        await Promise.all(savePromises);
        // Small delay between batches to avoid rate limiting
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
};
exports.generateTestReceipts = generateTestReceipts;
/**
 * Quick test function - generates only 10 receipts for quick testing
 */
const generateQuickTest = async () => {
    console.log('🧪 Running quick test with 10 receipts...');
    await (0, exports.generateTestReceipts)(10);
};
exports.generateQuickTest = generateQuickTest;
// Export for direct use
exports.default = {
    generate1000: () => (0, exports.generateTestReceipts)(1000),
    generate500: () => (0, exports.generateTestReceipts)(500),
    generate100: () => (0, exports.generateTestReceipts)(100),
    generateQuickTest: exports.generateQuickTest,
    generateTestReceipts: exports.generateTestReceipts
};
