import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useCart } from '../context/CartContext';
import { ReceiptPreviewScreen } from './ReceiptPreviewScreen';
import { Receipt, PrintMethod } from '../types';
import { PrintService } from '../services/PrintService';
import { StorageService } from '../services/StorageService';
import { DirectFileSystemService } from '../services/DirectFileSystemService';
import ReceiptFirebaseService from '../services/ReceiptFirebaseService';
import StockService from '../services/StockService';
import { Alert, ReceiptAlerts } from './common';
import {
  formatCurrency,
  generateId,
  generateReceiptNumber,
  validateCustomerInfo,
} from '../utils';

interface PrintOptionsScreenProps {
  onClose: () => void;
  cartItems?: any[];
  customerName?: string;
  onPrintComplete?: () => void;
}

export const PrintOptionsScreen: React.FC<PrintOptionsScreenProps> = ({
  onClose,
  cartItems,
  customerName,
  onPrintComplete,
}) => {
  const navigation = useNavigation();
  const { state: cartState, clearCart } = useCart();
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Use provided cart items or fall back to cart state
  const items = cartItems || cartState.items;
  const customer = customerName || cartState.customerName;
  
  // Calculate totals for provided items or use cart state
  const subtotal = cartItems 
    ? cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : cartState.subtotal;
  const tax = subtotal * 0.08; // 8% tax rate
  const total = subtotal + tax;

  // Mock company settings
  const companySettings = {
    name: 'My Store',
    address: '123 Business St, City, State 12345',
    phone: '(555) 123-4567',
    email: 'info@mystore.com',
    taxRate: 0.08,
  };

  const handleBackPress = () => {
    console.log('Back button pressed - attempting to navigate to Home tab');
    
    try {
      // Close the screen first
      onClose();
      
      // Multiple attempts to navigate to the Home tab
      setTimeout(() => {
        try {
          // Method 1: Try using CommonActions to reset to Home tab
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'index' as never }],
            })
          );
          console.log('Navigation attempt 1: CommonActions.reset');
        } catch (error1) {
          console.log('Method 1 failed, trying method 2:', error1);
          
          try {
            // Method 2: Try parent navigation
            const tabNavigation = navigation.getParent();
            if (tabNavigation) {
              (tabNavigation as any).jumpTo('index');
              console.log('Navigation attempt 2: parent.jumpTo');
            } else {
              throw new Error('No parent navigation found');
            }
          } catch (error2) {
            console.log('Method 2 failed, trying method 3:', error2);
            
            try {
              // Method 3: Direct navigation
              navigation.navigate('index' as never);
              console.log('Navigation attempt 3: direct navigate');
            } catch (error3) {
              console.log('All navigation methods failed:', error3);
            }
          }
        }
      }, 100);
    } catch (error) {
      console.log('Back press handler error:', error);
      // Just close if everything fails
      onClose();
    }
  };

  const validateData = (): boolean => {
    if (items.length === 0) {
      Alert.warning('No items to print', '🛒 Empty Cart');
      return false;
    }

    // Validate customer information
    const customerErrors = validateCustomerInfo({
      customerName: customer?.trim(),
    });

    if (customerErrors.length > 0) {
      ReceiptAlerts.validationError('Customer Information', customerErrors[0].message);
      return false;
    }

    return true;
  };

  const createReceipt = (): Receipt => {
    return {
      id: generateId(),
      items: items,
      subtotal: subtotal,
      tax: tax,
      total: total,
      date: new Date(),
      receiptNumber: generateReceiptNumber(),
      companyName: companySettings.name,
      companyAddress: companySettings.address,
      footerMessage: 'Thank you for your business!',
      customerName: customer,
    };
  };

  const subtractStockForItems = async (receiptItems: any[]) => {
    try {
      for (const item of receiptItems) {
        // For items from cart, we need to find the corresponding item in Firebase by name
        // This assumes item.name matches the item_name in Firebase
        await StockService.subtractStock(item.id, item.quantity);
        console.log(`Subtracted ${item.quantity} from stock for item: ${item.name}`);
      }
      console.log('Stock levels updated successfully for all items');
      return true;
    } catch (error) {
      console.error('Error updating stock levels:', error);
      return false;
    }
  };

  const handleReceiptPreview = () => {
    if (!validateData()) return;
    setShowReceiptPreview(true);
  };

  const handleDirectFileSystemPrint = async () => {
    if (!validateData()) return;

    setIsLoading(true);
    setLoadingMessage('Saving PDF to file system...');

    try {
      const receipt = createReceipt();
      
      // Use direct file system access with options
      const result = await PrintService.printPDFWithDirectAccess(receipt, companySettings, {
        useDirectFileAccess: true,
        showDirectoryDialog: true, // Let user choose directory
        includeCompanyInFilename: true,
        createYearMonthFolders: true,
        shareAfterSave: false // Don't show share dialog
      });

      if (result.success) {
        // Save receipt to Firebase (primary storage)
        const firebaseResult = await ReceiptFirebaseService.saveReceipt(
          receipt, 
          'pdf', 
          result.publicPath || result.filePath
        );
        
        if (firebaseResult.success) {
          console.log('Receipt saved to Firebase successfully:', firebaseResult.documentId);
        } else {
          console.error('Failed to save receipt to Firebase:', firebaseResult.error);
        }

        // Subtract stock for all items
        const stockSuccess = await subtractStockForItems(receipt.items);
        
        const stockMessage = stockSuccess ? '\n\n📦 Stock levels updated automatically.' : '\n\n⚠️ Note: There was an issue updating stock levels.';
        
        if (result.publicPath) {
          ReceiptAlerts.directFileAccessSuccess(result.publicPath + stockMessage);
        } else {
          ReceiptAlerts.receiptSaveSuccess(receipt.receiptNumber + stockMessage);
        }

        // Clear cart after successful print
        clearCart();
        
        // Notify parent component
        if (onPrintComplete) {
          onPrintComplete();
        }
        
        onClose();
      } else if (result.needsPermission) {
        ReceiptAlerts.permissionRequired('Storage permission is required to save files directly to your device. Please grant permission and try again.');
      } else {
        ReceiptAlerts.receiptSaveError(result.error || 'Failed to save PDF');
      }
    } catch (error) {
      console.error('Direct file system print error:', error);
      ReceiptAlerts.receiptSaveError('An error occurred while saving the PDF');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDirectPrint = async (printMethod: PrintMethod) => {
    if (!validateData()) return;

    setIsLoading(true);
    setLoadingMessage(
      printMethod === 'pdf' ? 'Exporting PDF...' : 'Printing to thermal printer...'
    );

    try {
      const receipt = createReceipt();
      
      const printOptions = {
        method: printMethod,
        device: undefined,
        copies: 1,
      };

      const result = await PrintService.print(receipt, companySettings, printOptions);

      if (result.success) {
        // Save receipt to Firebase (primary storage)
        const firebaseResult = await ReceiptFirebaseService.saveReceipt(
          receipt, 
          printMethod, 
          result.filePath
        );
        
        if (firebaseResult.success) {
          console.log('Receipt saved to Firebase successfully:', firebaseResult.documentId);
        } else {
          console.error('Failed to save receipt to Firebase:', firebaseResult.error);
          // Don't fail the operation since PDF was generated successfully
        }

        // Subtract stock for all items
        const stockSuccess = await subtractStockForItems(receipt.items);
        
        if (printMethod === 'pdf' && result.filePath) {
          // Extract folder information for user-friendly message
          const pathParts = result.filePath.split('/');
          const fileName = pathParts[pathParts.length - 1];
          const isOrganized = result.filePath.includes('/Receipts/');
          
          if (isOrganized) {
            // Find the date folder structure (YYYY/MM)
            const receiptIndex = pathParts.findIndex(part => part === 'Receipts');
            const year = pathParts[receiptIndex + 1];
            const month = pathParts[receiptIndex + 2];
            
            const stockMsg = stockSuccess ? '\n\n📦 Stock levels updated automatically.' : '\n\n⚠️ Note: There was an issue updating stock levels.';
            ReceiptAlerts.pdfExportSuccess(
              `File: ${fileName}\n` +
              `Organized in: Receipts/${year}/${month}/\n\n` +
              `Full path: ${result.filePath}\n\n` +
              `Your receipts are automatically organized by date for easy access.` +
              stockMsg
            );
          } else {
            const stockMsg = stockSuccess ? '\n\n📦 Stock levels updated automatically.' : '\n\n⚠️ Note: There was an issue updating stock levels.';
            ReceiptAlerts.pdfExportSuccess(
              `File: ${fileName}\n` +
              `Saved to: ${result.filePath}\n\n` +
              `You can find it in the sharing dialog or your app documents.` +
              stockMsg
            );
          }
        } else {
          const stockMsg = stockSuccess ? '\n\n📦 Stock levels updated automatically.' : '\n\n⚠️ Note: There was an issue updating stock levels.';
          if (printMethod === 'pdf') {
            ReceiptAlerts.pdfExportSuccess('Receipt exported as PDF successfully!' + stockMsg);
          } else {
            ReceiptAlerts.receiptPrintSuccess();
          }
        }

        // Clear cart after successful print
        clearCart();
        
        // Notify parent component
        if (onPrintComplete) {
          onPrintComplete();
        }
        
        onClose();
      } else {
        ReceiptAlerts.receiptSaveError(result.error || 'Print failed');
      }
    } catch (error) {
      console.error('Print error:', error);
      ReceiptAlerts.receiptSaveError('An error occurred while printing');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  if (isLoading) {
    return (
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#3b82f6',
        zIndex: 9999,
      }}>
        <StatusBar backgroundColor="#3B82F6" barStyle="light-content" />
        <View style={{
          flex: 1,
          backgroundColor: '#f9fafb',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
            padding: 32,
            marginHorizontal: 16,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginRight: 16 }} />
              <Text style={{ color: '#6b7280', fontSize: 18 }}>{loadingMessage}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Handle receipt preview as overlay modal
  const renderReceiptPreview = () => {
    if (!showReceiptPreview) return null;
    
    const receipt = createReceipt();
    
    return (
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 10000,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
      }}>
        <View style={{
          backgroundColor: 'white',
          borderRadius: 16,
          width: '100%',
          maxWidth: 400,
          maxHeight: '90%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 20,
        }}>
          {/* Modal Header */}
          <View style={{
            backgroundColor: '#3b82f6',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <View>
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: 'bold',
              }}>Receipt Preview</Text>
              <Text style={{
                color: '#bfdbfe',
                fontSize: 14,
              }}>Review before printing</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowReceiptPreview(false)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: 'bold',
              }}>×</Text>
            </TouchableOpacity>
          </View>
          
          {/* Modal Content */}
          <ScrollView style={{
            flex: 1,
            padding: 20,
          }}>
            <View style={{
              backgroundColor: '#f9fafb',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: '#374151',
                textAlign: 'center',
                marginBottom: 12,
              }}>{receipt.companyName}</Text>
              
              <View style={{
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
                paddingBottom: 12,
                marginBottom: 12,
              }}>
                <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>Receipt #: {receipt.receiptNumber}</Text>
                <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>Date: {receipt.date.toLocaleDateString()}</Text>
                {receipt.customerName && (
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Customer: {receipt.customerName}</Text>
                )}
              </View>
              
              {receipt.items.map((item, index) => (
                <View key={index} style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: '#374151' }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                      {item.quantity} × {formatCurrency(item.price)}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '600', color: '#374151' }}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
              
              <View style={{
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                paddingTop: 12,
                marginTop: 12,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: '#6b7280' }}>Subtotal:</Text>
                  <Text style={{ color: '#374151' }}>{formatCurrency(receipt.subtotal)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#6b7280' }}>Tax:</Text>
                  <Text style={{ color: '#374151' }}>{formatCurrency(receipt.tax)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#374151' }}>Total:</Text>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#3b82f6' }}>
                    {formatCurrency(receipt.total)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
          
          {/* Modal Actions */}
          <View style={{
            padding: 20,
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            flexDirection: 'row',
            gap: 12,
          }}>
            <TouchableOpacity
              onPress={() => setShowReceiptPreview(false)}
              style={{
                flex: 1,
                backgroundColor: '#f3f4f6',
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: '#374151',
                fontWeight: '600',
              }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                setShowReceiptPreview(false);
                await handleDirectPrint('pdf');
              }}
              style={{
                flex: 1,
                backgroundColor: '#10b981',
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: 'white',
                fontWeight: '600',
              }}>Export PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                setShowReceiptPreview(false);
                await handleDirectPrint('thermal');
              }}
              style={{
                flex: 1,
                backgroundColor: '#8b5cf6',
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: 'white',
                fontWeight: '600',
              }}>Print</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'white',
      zIndex: 9999,
    }}>
      <StatusBar backgroundColor="white" barStyle="dark-content" />
      
      {/* Header */}
      <SafeAreaView style={{
        backgroundColor: 'white',
      }}>
        <View style={{
          backgroundColor: 'white',
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 16,
        }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={{
              position: 'absolute',
              left: 0,
              padding: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: 8,
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={{
            color: '#374151',
            fontSize: 20,
            fontWeight: 'bold',
            textAlign: 'center',
          }}>Print Options</Text>
        </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{
        flex: 1,
        backgroundColor: '#f9fafb',
      }}>
        {/* Welcome Section */}
        <View className="px-6 py-8">
          <View className="items-center mb-8">
            <View className="bg-blue-100 rounded-full p-6 mb-4">
              <Ionicons name="print" size={48} color="#3B82F6" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Ready to Print</Text>
            <Text className="text-gray-600 text-center text-base">
              Choose how you'd like to print your receipt
            </Text>
          </View>

          {/* Print Options */}
          <View className="space-y-4">
            {/* Receipt Preview Option */}
            <TouchableOpacity
              onPress={handleReceiptPreview}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-sm"
              activeOpacity={0.7}
            >
              <View className="flex flex-row items-center">
                <View className="bg-blue-500 rounded-full p-4 mr-4">
                  <Ionicons name="eye" size={28} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900 mb-1">Receipt Preview</Text>
                  <Text className="text-base text-gray-600">Preview before printing or exporting</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </TouchableOpacity>

            {/* Export PDF Option */}
            <TouchableOpacity
              onPress={() => handleDirectPrint('pdf')}
              className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-sm"
              activeOpacity={0.7}
            >
              <View className="flex flex-row items-center">
                <View className="bg-green-500 rounded-full p-4 mr-4">
                  <Ionicons name="document" size={28} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900 mb-1">Export PDF</Text>
                  <Text className="text-base text-gray-600">Save receipt as PDF file</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </TouchableOpacity>

            {/* Direct File System Access Option */}
            <TouchableOpacity
              onPress={handleDirectFileSystemPrint}
              className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-6 shadow-sm"
              activeOpacity={0.7}
            >
              <View className="flex flex-row items-center">
                <View className="bg-orange-500 rounded-full p-4 mr-4">
                  <Ionicons name="folder-open" size={28} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900 mb-1">Save to File Manager</Text>
                  <Text className="text-base text-gray-600">Direct access via device file manager</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </TouchableOpacity>

            {/* Thermal Printer Option */}
            <TouchableOpacity
              onPress={() => handleDirectPrint('thermal')}
              className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 shadow-sm"
              activeOpacity={0.7}
            >
              <View className="flex flex-row items-center">
                <View className="bg-purple-500 rounded-full p-4 mr-4">
                  <Ionicons name="print" size={28} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900 mb-1">Thermal Printer</Text>
                  <Text className="text-base text-gray-600">Print directly to thermal printer</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Summary Card */}
          <View className="bg-white rounded-2xl p-6 mt-8 shadow-sm border border-gray-100">
            <View className="flex flex-row items-center mb-4">
              <Ionicons name="receipt" size={24} color="#3B82F6" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Receipt Summary</Text>
            </View>
            
            <View className="space-y-3">
              <View className="flex flex-row justify-between items-center py-2">
                <Text className="text-base text-gray-600">Items:</Text>
                <Text className="text-base font-semibold text-gray-900">{items.length}</Text>
              </View>
              <View className="flex flex-row justify-between items-center py-2">
                <Text className="text-base text-gray-600">Customer:</Text>
                <Text className="text-base font-semibold text-gray-900">{customer || 'Not specified'}</Text>
              </View>
              <View className="flex flex-row justify-between items-center py-2">
                <Text className="text-base text-gray-600">Subtotal:</Text>
                <Text className="text-base font-semibold text-gray-900">{formatCurrency(subtotal)}</Text>
              </View>
              <View className="flex flex-row justify-between items-center py-2">
                <Text className="text-base text-gray-600">Tax:</Text>
                <Text className="text-base font-semibold text-gray-900">{formatCurrency(tax)}</Text>
              </View>
              <View className="border-t border-gray-200 pt-3">
                <View className="flex flex-row justify-between items-center">
                  <Text className="text-xl font-bold text-gray-900">Total:</Text>
                  <Text className="text-xl font-bold text-blue-600">{formatCurrency(total)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Receipt Preview Modal */}
      {renderReceiptPreview()}
      
    </View>
  );
};
