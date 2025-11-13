/**
 * Generate Test Receipts Component
 * 
 * Add this to your app temporarily to generate test receipts
 * Usage: Import and render this component, then press the button
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import ReceiptFirebaseService from '../services/business/ReceiptFirebaseService';
import { Receipt, ReceiptItem } from '../types';

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

const randomBetween = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomElement = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateReceiptId = (index: number): string => {
  const timestamp = Date.now() - (1500 - index) * 60000;
  return `receipt_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateReceiptNumber = (index: number): string => {
  return `#REC-${String(20251106).padStart(8, '0')}-${String(6585 + index).padStart(4, '0')}`;
};

const generateItems = (): ReceiptItem[] => {
  const itemCount = randomBetween(1, 5);
  const items: ReceiptItem[] = [];
  
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

const generateReceipt = (index: number): Receipt => {
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
    paymentMethod: randomElement(['cash', 'card', 'digital'] as const),
    isPaid,
    oldBalance: parseFloat(oldBalance.toFixed(2)),
    amountPaid: parseFloat(amountPaid.toFixed(2)),
    newBalance: parseFloat(newBalance.toFixed(2))
  };
};

export default function GenerateTestReceipts() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({ success: 0, failed: 0, total: 0 });

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-20), message]); // Keep last 20 logs
    console.log(message);
  };

  const generateReceipts = async (count: number = 1500) => {
    setIsGenerating(true);
    setLogs([]);
    setStats({ success: 0, failed: 0, total: count });
    
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    
    addLog(`🚀 Starting generation of ${count} test receipts...`);
    
    const receiptService = ReceiptFirebaseService.getInstance();
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(count / BATCH_SIZE);
    
    try {
      for (let batch = 0; batch < totalBatches; batch++) {
        const batchStart = batch * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
        const batchSize = batchEnd - batchStart;
        
        addLog(`📦 Batch ${batch + 1}/${totalBatches}: Processing ${batchStart + 1}-${batchEnd}...`);
        setProgress(`Batch ${batch + 1}/${totalBatches}`);
        
        const receipts = Array.from({ length: batchSize }, (_, i) => 
          generateReceipt(batchStart + i)
        );
        
        const savePromises = receipts.map(async (receipt, i) => {
          try {
            const result = await receiptService.saveReceipt(
              receipt,
              Math.random() > 0.5 ? 'pdf' : 'thermal',
              Math.random() > 0.5 ? `/receipts/${receipt.id}.pdf` : undefined
            );
            
            if (result.success) {
              successCount++;
              setStats(prev => ({ ...prev, success: successCount }));
              if ((batchStart + i + 1) % 100 === 0) {
                addLog(`✅ Progress: ${successCount}/${count} receipts saved`);
              }
            } else {
              failCount++;
              setStats(prev => ({ ...prev, failed: failCount }));
              addLog(`❌ Failed ${batchStart + i + 1}: ${result.error}`);
            }
          } catch (error: any) {
            failCount++;
            setStats(prev => ({ ...prev, failed: failCount }));
            addLog(`❌ Error ${batchStart + i + 1}: ${error.message}`);
          }
        });
        
        await Promise.all(savePromises);
        
        if (batch < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      addLog('='.repeat(60));
      addLog('📊 GENERATION COMPLETE');
      addLog(`✅ Successfully saved: ${successCount} receipts`);
      addLog(`❌ Failed: ${failCount} receipts`);
      addLog(`⏱️  Total time: ${duration} seconds`);
      addLog(`⚡ Average: ${(successCount / parseFloat(duration)).toFixed(2)} receipts/second`);
      addLog('='.repeat(60));
      
      setProgress('Complete!');
    } catch (error: any) {
      addLog(`💥 Fatal error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Test Receipts Generator
      </Text>
      
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => generateReceipts(1500)}
          disabled={isGenerating}
          style={{
            backgroundColor: isGenerating ? '#ccc' : '#4CAF50',
            padding: 15,
            borderRadius: 8,
            flex: 1,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            Generate 1500
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => generateReceipts(100)}
          disabled={isGenerating}
          style={{
            backgroundColor: isGenerating ? '#ccc' : '#2196F3',
            padding: 15,
            borderRadius: 8,
            flex: 1,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            Generate 100
          </Text>
        </TouchableOpacity>
      </View>
      
      {isGenerating && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <ActivityIndicator size="small" color="#4CAF50" />
          <Text style={{ marginLeft: 10, fontSize: 16 }}>{progress}</Text>
        </View>
      )}
      
      <View style={{ 
        backgroundColor: '#f5f5f5', 
        padding: 15, 
        borderRadius: 8,
        marginBottom: 15 
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>
          Stats
        </Text>
        <Text>✅ Success: {stats.success}</Text>
        <Text>❌ Failed: {stats.failed}</Text>
        <Text>📊 Total: {stats.total}</Text>
      </View>
      
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Console Logs:
      </Text>
      
      <ScrollView style={{ 
        flex: 1, 
        backgroundColor: '#000', 
        padding: 10, 
        borderRadius: 8 
      }}>
        {logs.map((log, index) => (
          <Text key={index} style={{ 
            color: '#0f0', 
            fontFamily: 'monospace', 
            fontSize: 12,
            marginBottom: 2
          }}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

