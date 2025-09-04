import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useCart } from '../context/CartContext';
import { Receipt, PrintMethod } from '../types';
import { QRCode } from './QRCode';
import {
  formatCurrency,
  formatReceiptDate,
  generateId,
  generateReceiptNumber,
} from '../utils';
import { PrintService } from '../services/PrintService';
import { StorageService } from '../services/StorageService';
import { QRCodeService } from '../services/QRCodeService';
import ReceiptFirebaseService from '../services/ReceiptFirebaseService';

interface ReceiptPreviewScreenProps {
  onClose: () => void;
  onReceiptProcessed?: () => void;
}

export const ReceiptPreviewScreen: React.FC<ReceiptPreviewScreenProps> = ({ 
  onClose, 
  onReceiptProcessed 
}) => {
  const { state: cartState, clearCart } = useCart();
  
  const [printMethod, setPrintMethod] = useState<PrintMethod>('pdf');
  const [isLoading, setIsLoading] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  // Mock company settings - in production, this would come from app context or settings
  const companySettings = {
    name: 'My Store',
    address: '123 Business St, City, State 12345',
    phone: '(555) 123-4567',
    email: 'info@mystore.com',
    taxRate: 0.08,
  };

  useEffect(() => {
    createReceipt();
  }, [cartState]);

  const createReceipt = () => {
    if (cartState.items.length === 0) {
      onClose();
      return;
    }

    const newReceipt: Receipt = {
      id: generateId(),
      items: cartState.items,
      subtotal: cartState.subtotal,
      tax: cartState.tax,
      total: cartState.total,
      date: new Date(),
      receiptNumber: generateReceiptNumber(),
      companyName: companySettings.name,
      companyAddress: companySettings.address,
      footerMessage: 'Thank you for your business!',
      customerName: cartState.customerName,
    };

    setReceipt(newReceipt);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePrint = async () => {
    if (!receipt) return;

    if (printMethod === 'thermal') {
      // For thermal printing, you might want to check for available printers
      const availablePrinters = window.electronAPI?.getPrinters ? await window.electronAPI.getPrinters() : [];
      if (availablePrinters.length === 0) {
        showNotification('No thermal printers found. Please check your printer connections.', 'error');
        return;
      }
    }

    setIsLoading(true);

    try {
      const printOptions = {
        method: printMethod,
        device: undefined, // You can implement printer selection here
        copies: 1,
      };

      const result = await PrintService.print(receipt, companySettings, printOptions);

      if (result.success) {
        // Store receipt locally
        await StorageService.storeReceipt(receipt, result.filePath);
        
        // Save receipt to Firebase
        const firebaseResult = await ReceiptFirebaseService.saveReceipt(
          receipt, 
          printMethod, 
          result.filePath
        );
        
        if (firebaseResult.success) {
          console.log('Receipt saved to Firebase successfully:', firebaseResult.documentId);
        } else {
          console.error('Failed to save receipt to Firebase:', firebaseResult.error);
          // Don't show error to user as local storage still worked
        }
        
        // Mark as printed if it was a thermal print
        if (printMethod === 'thermal') {
          await StorageService.markReceiptAsPrinted(receipt.id);
        }

        showNotification(
          printMethod === 'pdf' ? 'Receipt exported as PDF and saved' : 'Receipt printed successfully and saved'
        );

        // Clear cart after successful print
        clearCart();
        
        // Notify parent component
        if (onReceiptProcessed) {
          onReceiptProcessed();
        }
        
        // Close the preview after a short delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        showNotification(result.error || 'Unknown error occurred', 'error');
      }
    } catch (error) {
      console.error('Print error:', error);
      showNotification('An unexpected error occurred while printing.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!receipt) {
    return (
      <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <View className="bg-white rounded-2xl shadow-2xl p-8">
          <View className="flex flex-row items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" className="mr-4" />
            <Text className="text-gray-600 text-lg">Preparing receipt...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <View className="bg-white rounded-2xl shadow-2xl p-8">
          <View className="flex flex-row items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" className="mr-4" />
            <Text className="text-gray-600 text-lg">
              {printMethod === 'pdf' ? 'Generating PDF...' : 'Printing receipt...'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
      <View className="bg-white rounded-2xl shadow-2xl w-full max-h-[95%] overflow-hidden">
        {/* Header */}
        <View className="bg-blue-500 px-6 py-4 flex flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-white">Receipt Preview</Text>
            <Text className="text-blue-100 text-sm">Review before printing</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="p-2 bg-white/20 rounded-lg"
          >
            <Text className="text-white text-lg">×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Enhanced Receipt Preview */}
          <View className="p-6">
            <View className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg mx-auto max-w-sm">
              <View className="p-8">
                {/* Enhanced Header */}
                <View className="items-center mb-8">
                  <Text className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                    {receipt.companyName}
                  </Text>
                  {receipt.companyAddress && (
                    <Text className="text-sm text-gray-600 text-center leading-relaxed px-2">
                      {receipt.companyAddress}
                    </Text>
                  )}
                  <View className="w-16 h-px bg-gray-300 mt-4" />
                </View>

                {/* Enhanced Receipt Info */}
                <View className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-6">
                  <View className="space-y-3">
                    <View className="flex flex-row justify-between items-center">
                      <Text className="text-sm font-semibold text-gray-700">Receipt #:</Text>
                      <Text className="text-sm font-bold text-gray-900 font-mono bg-white px-2 py-1 rounded">
                        {receipt.receiptNumber}
                      </Text>
                    </View>
                    <View className="flex flex-row justify-between items-center">
                      <Text className="text-sm font-semibold text-gray-700">Date:</Text>
                      <Text className="text-sm text-gray-900">{formatReceiptDate(receipt.date)}</Text>
                    </View>
                    {receipt.customerName && (
                      <View className="flex flex-row justify-between items-center">
                        <Text className="text-sm font-semibold text-gray-700">Customer:</Text>
                        <Text className="text-sm font-medium text-blue-700">{receipt.customerName}</Text>
                      </View>
                    )}
                    <View className="flex flex-row justify-between items-center">
                      <Text className="text-sm font-semibold text-gray-700">Items:</Text>
                      <Text className="text-sm font-medium text-gray-900">
                        {receipt.items.length} ({receipt.items.reduce((sum, item) => sum + item.quantity, 0)} qty)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Enhanced Items Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-gray-900 mb-4 text-center">
                    🛒 Order Details
                  </Text>
                  <View className="bg-gray-50 rounded-xl overflow-hidden">
                    {receipt.items.map((item, index) => {
                      const itemTotal = item.price * item.quantity;
                      return (
                        <View key={index} className={`p-4 ${index < receipt.items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                          <View className="flex flex-row justify-between items-start">
                            <View className="flex-1 mr-3">
                              <Text className="text-base font-semibold text-gray-900 mb-1">{item.name}</Text>
                              <Text className="text-sm text-gray-600 bg-white px-2 py-1 rounded inline-flex">
                                {item.quantity} × {formatCurrency(item.price)}
                              </Text>
                            </View>
                            <Text className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded">
                              {formatCurrency(itemTotal)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Enhanced Totals Section */}
                <View className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 rounded-xl p-6 mb-6">
                  <Text className="text-lg font-bold text-gray-900 mb-4 text-center">
                    💰 Payment Summary
                  </Text>
                  <View className="space-y-4">
                    <View className="flex flex-row justify-between items-center py-2 border-b border-green-200">
                      <Text className="text-base font-medium text-gray-600">Subtotal:</Text>
                      <Text className="text-base font-semibold text-gray-900">{formatCurrency(receipt.subtotal)}</Text>
                    </View>
                    <View className="flex flex-row justify-between items-center py-2 border-b border-green-200">
                      <Text className="text-base font-medium text-gray-600">Tax:</Text>
                      <Text className="text-base font-semibold text-gray-900">{formatCurrency(receipt.tax)}</Text>
                    </View>
                    <View className="flex flex-row justify-between items-center py-4 bg-white/70 rounded-xl px-4">
                      <Text className="text-xl font-black text-gray-900">TOTAL:</Text>
                      <Text className="text-2xl font-black text-green-700">{formatCurrency(receipt.total)}</Text>
                    </View>
                  </View>
                </View>

                {/* Enhanced QR Code Section */}
                <View className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                  <Text className="text-center text-sm font-medium text-gray-700 mb-4">
                    📱 Scan for Receipt Verification
                  </Text>
                  <View className="items-center">
                    <View className="bg-white p-4 rounded-xl shadow-sm">
                      <QRCode 
                        data={QRCodeService.generateReceiptQRData(receipt)}
                        size={100}
                      />
                    </View>
                  </View>
                </View>
                
                {/* Enhanced Footer */}
                {receipt.footerMessage && (
                  <View className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-4">
                    <Text className="text-center font-medium text-gray-700 text-base leading-relaxed">
                      💬 {receipt.footerMessage}
                    </Text>
                  </View>
                )}

                {/* Thank You Message */}
                <View className="mt-6 pt-4 border-t border-dashed border-gray-300">
                  <Text className="text-center text-lg font-bold text-gray-900 mb-2">
                    Thank You! 🙏
                  </Text>
                  <Text className="text-center text-sm text-gray-600">
                    Have a great day!
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Print Options */}
          <View className="bg-gray-50 p-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">Print Options</Text>
            
            {/* Print Method Selection */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-3">Print Method</Text>
              <View className="space-y-2">
                <TouchableOpacity 
                  onPress={() => setPrintMethod('pdf')}
                  className={`p-3 border rounded-lg ${
                    printMethod === 'pdf' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <View className="flex flex-row items-center">
                    <Text className="mr-3">{printMethod === 'pdf' ? '✓' : '○'}</Text>
                    <View>
                      <Text className="font-medium">PDF Export</Text>
                      <Text className="text-xs text-gray-500">Save as PDF file</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setPrintMethod('thermal')}
                  className={`p-3 border rounded-lg ${
                    printMethod === 'thermal' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <View className="flex flex-row items-center">
                    <Text className="mr-3">{printMethod === 'thermal' ? '✓' : '○'}</Text>
                    <View>
                      <Text className="font-medium">Thermal Print</Text>
                      <Text className="text-xs text-gray-500">Print to thermal printer</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="space-y-3">
              <TouchableOpacity
                onPress={onClose}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-700 text-center font-medium">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePrint}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-500 rounded-lg flex flex-row items-center justify-center space-x-2"
              >
                {isLoading && (
                  <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
                )}
                <Text className="text-white font-medium">{printMethod === 'pdf' ? 'Export PDF' : 'Print'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Notification */}
        {notification && (
          <View className={`absolute top-4 right-4 p-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            <View className="flex flex-row items-center space-x-2">
              <Text className="text-white">
                {notification.type === 'success' ? '✓' : '×'}
              </Text>
              <Text className="text-white">{notification.message}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};
