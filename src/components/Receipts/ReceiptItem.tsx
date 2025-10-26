import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseReceipt } from '../../services/ReceiptFirebaseService';
import { formatCurrency } from '../../utils';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ThermalPrinterService from '../../services/ThermalPrinterService';

interface ReceiptItemProps {
  item: FirebaseReceipt;
  isSelected: boolean;
  isSelectionMode: boolean;
  isPendingDeletion?: boolean;
  formatReceiptDate: (date: any) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
  onLongPress: () => void;
  onPress: () => void;
  onToggleSelection: (receiptId: string) => void;
  onViewReceipt: (receipt: FirebaseReceipt) => void;
  onDeleteReceipt: (receiptId: string) => void;
  onSavePDF?: (receipt: FirebaseReceipt) => Promise<void>;
}

const ReceiptItem: React.FC<ReceiptItemProps> = ({
  item,
  isSelected,
  isSelectionMode,
  isPendingDeletion = false,
  formatReceiptDate,
  getStatusColor,
  getStatusIcon,
  onLongPress,
  onPress,
  onToggleSelection,
  onViewReceipt,
  onDeleteReceipt,
  onSavePDF,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const printerService = ThermalPrinterService.getInstance();

  const handleSavePDF = async () => {
    if (isGeneratingPDF || !onSavePDF) return;
    
    setShowMenu(false);
    setIsGeneratingPDF(true);
    try {
      await onSavePDF(item);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = async () => {
    setShowMenu(false);
    
    // Check if printer is connected
    if (!printerService.isConnected()) {
      Alert.alert(
        'No Printer Connected',
        'Please connect to a thermal printer first.\n\nGo to Settings → Printer Setup',
        [
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    setIsPrinting(true);
    try {
      // Convert receipt to printer format
      const receiptData = {
        storeInfo: {
          name: item.companyName,
          address: item.companyAddress || '',
          phone: item.businessPhone || '',
        },
        items: item.items.map(receiptItem => ({
          name: receiptItem.name,
          price: Number(receiptItem.price) || 0,
          quantity: Number(receiptItem.quantity) || 0,
          total: (Number(receiptItem.price) || 0) * (Number(receiptItem.quantity) || 0),
        })),
        subtotal: Number(item.subtotal) || 0,
        tax: Number(item.tax) || 0,
        total: Number(item.total) || 0,
        paymentMethod: 'Cash', // Default
        receiptNumber: item.receiptNumber,
        timestamp: item.date.toDate ? item.date.toDate() : new Date(item.date),
      };

      await printerService.printReceipt(receiptData);
      Alert.alert('Success', '✓ Receipt printed successfully!');
    } catch (error: any) {
      console.error('Print error:', error);
      Alert.alert(
        'Print Failed',
        error.message || 'Failed to print receipt. Check printer connection.'
      );
    } finally {
      setIsPrinting(false);
    }
  };
  return (
    <View style={{ zIndex: showMenu ? 1000 : 1 }}>
      <Card
        className={`mx-4 mb-4 ${isSelected ? 'border-2 border-primary-500 bg-primary-50' : ''} ${
          isSelectionMode ? 'ml-4' : ''
        } ${isPendingDeletion ? 'border-danger-200 bg-danger-50 opacity-60' : ''}`}
      >
      <TouchableOpacity
        onPress={isPendingDeletion ? undefined : isSelectionMode ? onPress : () => onViewReceipt(item)}
        onLongPress={isPendingDeletion ? undefined : onLongPress}
        activeOpacity={isPendingDeletion ? 1 : 0.7}
        disabled={isPendingDeletion}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <View className="absolute left-3 top-3 z-10">
            <TouchableOpacity
              className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                isSelected ? 'border-primary-600 bg-primary-600' : 'border-secondary-300 bg-white'
              }`}
              onPress={() => onToggleSelection(item.id)}
            >
              {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
            </TouchableOpacity>
          </View>
        )}

        <View className={`px-4 py-3 ${isSelectionMode ? 'pl-11' : ''}`}>
          {/* Header */}
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 flex-row items-center">
              <View style={{ backgroundColor: getStatusColor(item.status) }} className="mr-2 h-2.5 w-2.5 rounded-full" />
              <Text numberOfLines={1} className="flex-1 text-base font-bold text-secondary-900">
                {item.customerName || 'Walk-in Customer'}
              </Text>
            </View>

            {/* Total Amount */}
            <View className="ml-3 items-end">
              <Text className="text-xs text-secondary-500 mb-0.5">Total</Text>
              <Text className="text-lg font-bold text-primary-600">{formatCurrency(item.total)}</Text>
            </View>
          </View>
          
          {/* Receipt Info */}
          <View className="mb-2">
            <Text className="text-sm text-secondary-600">{formatReceiptDate(item.date)}</Text>
            <Text className="mt-1 text-xs font-medium text-secondary-400">
              #{item.receiptNumber}
              {isPendingDeletion ? ' (Deleting...)' : ''}
            </Text>
          </View>
            
          {/* Balance and Status Information */}
          <View className="mb-3 flex-row items-center flex-wrap gap-2">
            {/* Paid/Unpaid Badge */}
            {item.isPaid === false && (
              <View className="px-2.5 py-1 bg-red-100 rounded-md">
                <Text className="text-xs font-bold text-red-600">UNPAID</Text>
              </View>
            )}
            
            {item.isPaid !== undefined && item.isPaid && (
              <View className={`px-2.5 py-1 rounded-md ${
                item.newBalance === undefined || item.newBalance <= 0 
                  ? 'bg-green-100' 
                  : item.newBalance > 0
                    ? 'bg-yellow-100'
                    : 'bg-orange-100'
              }`}>
                <Text className={`text-xs font-semibold ${
                  item.newBalance === undefined || item.newBalance <= 0
                    ? 'text-green-700'
                    : item.newBalance > 0
                      ? 'text-yellow-700'
                      : 'text-orange-700'
                }`}>
                  {item.newBalance === undefined || item.newBalance <= 0
                    ? '⌛ Partial'
                    : '⌛ Pending'}
                </Text>
              </View>
            )}
            
            {/* Balance Information */}
            {item.oldBalance !== undefined && item.oldBalance !== 0 && (
              <View className="flex-row items-center">
                <Text className="text-xs text-gray-500">Old Bal: </Text>
                <Text className="text-xs font-semibold text-gray-700">{formatCurrency(item.oldBalance)}</Text>
              </View>
            )}
            
            {item.newBalance !== undefined && item.newBalance !== 0 && (
              <View className="flex-row items-center">
                <Text className="text-xs text-gray-500">New Bal: </Text>
                <Text className={`text-xs font-bold ${item.newBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(item.newBalance)}
                </Text>
              </View>
            )}
          </View>

          {/* Actions - Three Dot Menu */}
          {!isSelectionMode && (
            <View className="flex-row items-center justify-end mt-1">
              <TouchableOpacity
                onPress={() => setShowMenu(!showMenu)}
                disabled={isPendingDeletion}
                className="p-2"
              >
                <Ionicons name="ellipsis-horizontal" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
      </Card>

      {/* Dropdown Menu Modal */}
      {showMenu && (
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity
            style={styles.transparentOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={styles.dropdownMenu}>
              {/* Print Option */}
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handlePrint}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <Ionicons name="print-outline" size={18} color="#10b981" />
                )}
                <Text style={styles.dropdownText}>
                  {isPrinting ? 'Printing...' : 'Print'}
                </Text>
              </TouchableOpacity>

              {/* Save PDF Option */}
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleSavePDF}
                disabled={isGeneratingPDF || !onSavePDF}
              >
                {isGeneratingPDF ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Ionicons name="document-outline" size={18} color="#3b82f6" />
                )}
                <Text style={[styles.dropdownText, { color: '#3b82f6' }]}>
                  {isGeneratingPDF ? 'Saving...' : 'Save PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  transparentOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 4,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#10b981',
  },
});

export default ReceiptItem;
