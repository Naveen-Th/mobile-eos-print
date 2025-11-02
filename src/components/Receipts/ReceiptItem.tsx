import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseReceipt } from '../../services/ReceiptFirebaseService';
import { formatCurrency } from '../../utils';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ThermalPrinterService from '../../services/ThermalPrinterService';
import BalanceTrackingService from '../../services/BalanceTrackingService';

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
  onPayClick?: (receipt: FirebaseReceipt) => void;
  customerTotalBalance?: number; // Total outstanding balance for the customer
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
  onPayClick,
  customerTotalBalance,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuButtonRef = useRef<TouchableOpacity>(null);
  
  // Expandable card state
  const [isExpanded, setIsExpanded] = useState(false);
  const expandAnimation = useRef(new Animated.Value(0)).current;
  
  // Payment badge animation
  const badgeScale = useRef(new Animated.Value(1)).current;
  
  const printerService = ThermalPrinterService.getInstance();
  
  // Toggle expand/collapse with animation
  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    Animated.spring(expandAnimation, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };
  
  // Animate badge on payment status change
  React.useEffect(() => {
    if (isPaidReceipt) {
      Animated.sequence([
        Animated.spring(badgeScale, {
          toValue: 1.1,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isPaidReceipt]);
  
  // Use the dynamically calculated balance from parent (includes Previous Balance)
  // If newBalance is provided and defined, use it; otherwise calculate from total - amountPaid
  const actualBalance = item.newBalance !== undefined 
    ? item.newBalance 
    : (item.total || 0) - (item.amountPaid || 0);
  const isPaidReceipt = actualBalance <= 0.01;
  
  // Debug: Log payment button visibility conditions
  if (actualBalance > 0 && !isPaidReceipt) {
    console.log(`💳 [ReceiptItem] Payment button visibility for ${item.receiptNumber}:`, {
      customerName: item.customerName,
      customerTotalBalance,
      actualBalance,
      onPayClickExists: !!onPayClick,
      shouldShow: customerTotalBalance !== undefined && customerTotalBalance > 0 && !!onPayClick && actualBalance > 0
    });
  }

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
      console.log('🖨️ [ReceiptItem] Starting print process...');
      console.log('🖨️ [ReceiptItem] Receipt data from Firebase:', {
        id: item.id,
        receiptNumber: item.receiptNumber,
        companyName: item.companyName,
        customerName: item.customerName,
        itemCount: item.items?.length,
        total: item.total,
      });
      
      // Convert receipt to printer format
      // Safely convert date to Date object
      let timestamp: Date;
      try {
        if (item.date && typeof item.date.toDate === 'function') {
          // Firebase Timestamp
          timestamp = item.date.toDate();
        } else if (item.date instanceof Date) {
          // Already a Date object
          timestamp = item.date;
        } else if (typeof item.date === 'string' || typeof item.date === 'number') {
          // String or number timestamp
          timestamp = new Date(item.date);
        } else {
          // Fallback to current date
          console.warn('Invalid date format in receipt:', item.date);
          timestamp = new Date();
        }
      } catch (error) {
        console.error('Error converting receipt date:', error);
        timestamp = new Date();
      }

      const receiptData = {
        storeInfo: {
          name: item.companyName || 'Store',
          address: item.companyAddress || '',
          phone: item.businessPhone || '',
        },
        customerInfo: {
          name: item.customerName || undefined,
          phone: item.businessPhone || undefined,
        },
        items: item.items.map(receiptItem => ({
          name: receiptItem.name || 'Item',
          price: Number(receiptItem.price) || 0,
          quantity: Number(receiptItem.quantity) || 0,
          total: (Number(receiptItem.price) || 0) * (Number(receiptItem.quantity) || 0),
        })),
        subtotal: Number(item.subtotal) || 0,
        tax: Number(item.tax) || 0,
        total: Number(item.total) || 0,
        paymentMethod: 'Cash', // Default
        receiptNumber: item.receiptNumber || 'N/A',
        timestamp: timestamp,
        isPaid: item.isPaid !== undefined ? item.isPaid : true,
      };

      console.log('🖨️ [ReceiptItem] Formatted receipt data:', {
        storeName: receiptData.storeInfo.name,
        itemCount: receiptData.items.length,
        total: receiptData.total,
      });

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
  // Get smart badge text with time context
  const getSmartBadge = () => {
    const now = new Date();
    const receiptDate = item.date?.toDate ? item.date.toDate() : new Date(item.date);
    const hoursDiff = (now.getTime() - receiptDate.getTime()) / (1000 * 60 * 60);
    
    if ((item.amountPaid ?? 0) >= (item.total || 0)) {
      return hoursDiff < 24 ? 'PAID TODAY' : 'PAID';
    }
    if ((item.amountPaid ?? 0) > 0) {
      return 'PARTIAL';
    }
    return hoursDiff > 48 ? 'OVERDUE' : 'UNPAID';
  };
  
  // Get status color for left border
  const getStatusBorderColor = () => {
    if ((item.amountPaid ?? 0) >= (item.total || 0)) return '#22c55e'; // Green
    if ((item.amountPaid ?? 0) > 0) return '#3b82f6'; // Blue
    const receiptDate = item.date?.toDate ? item.date.toDate() : new Date(item.date);
    const hoursDiff = (new Date().getTime() - receiptDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff > 48 ? '#ef4444' : '#f59e0b'; // Red if overdue, amber if unpaid
  };
  
  return (
    <View style={{ zIndex: showMenu ? 1000 : 1, marginHorizontal: 16, marginBottom: 12 }}>
      {/* Color-coded left border indicator */}
      <View style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: getStatusBorderColor(),
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
        zIndex: 1,
      }} />
      
      <TouchableOpacity
        onPress={isPendingDeletion ? undefined : isSelectionMode ? onPress : toggleExpand}
        onLongPress={isPendingDeletion ? undefined : onLongPress}
        activeOpacity={isPendingDeletion ? 1 : 0.95}
        disabled={isPendingDeletion}
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? '#3b82f6' : '#e5e7eb',
          opacity: isPendingDeletion ? 0.5 : 1,
        }}
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

        {/* Card Stack Design */}
        <View style={{ paddingLeft: isSelectionMode ? 36 : 12, paddingRight: 12, paddingVertical: 12 }}>
          {/* Header with Smart Badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 }} numberOfLines={1}>
                {item.customerName || 'Walk-in Customer'}
              </Text>
              <Text style={{ fontSize: 10, color: '#6b7280' }}>
                #{item.receiptNumber} • {formatReceiptDate(item.date).split(' at ')[0]}
              </Text>
            </View>
            
            {/* Animated Smart Badge */}
            <Animated.View style={{
              transform: [{ scale: badgeScale }],
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: (item.amountPaid ?? 0) >= (item.total || 0)
                ? '#dcfce7'
                : (item.amountPaid ?? 0) > 0
                  ? '#dbeafe'
                  : '#fee2e2',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}>
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: (item.amountPaid ?? 0) >= (item.total || 0)
                  ? '#16a34a'
                  : (item.amountPaid ?? 0) > 0
                    ? '#2563eb'
                    : '#dc2626',
              }} />
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: (item.amountPaid ?? 0) >= (item.total || 0)
                  ? '#15803d'
                  : (item.amountPaid ?? 0) > 0
                    ? '#1e40af'
                    : '#991b1b',
                letterSpacing: 0.5,
              }}>
                {getSmartBadge()}
              </Text>
            </Animated.View>
          </View>
          
          {/* Card Stack: Payment Layers */}
          <View style={{ marginBottom: 8, gap: 8 }}>
            {/* Layer 1: Receipt Total */}
            <View style={{
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '500' }}>Receipt Total</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                {formatCurrency(item.total)}
              </Text>
            </View>
            
            {/* Layer 2: Amount Paid with Progress Bar */}
            <View style={{
              backgroundColor: (item.amountPaid ?? 0) >= (item.total || 0) ? '#f0fdf4' : '#fef3c7',
              borderRadius: 8,
              padding: 12,
              borderWidth: 1,
              borderColor: (item.amountPaid ?? 0) >= (item.total || 0) ? '#bbf7d0' : '#fde68a',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '600' }}>Amount Paid</Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: (item.amountPaid ?? 0) >= (item.total || 0) ? '#15803d' : '#92400e',
                }}>
                  {formatCurrency(item.amountPaid ?? 0)}
                </Text>
              </View>
              {/* Progress Bar */}
              <View style={{
                height: 6,
                backgroundColor: '#ffffff',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <View style={{
                  height: '100%',
                  width: `${Math.min(((item.amountPaid ?? 0) / (item.total || 1)) * 100, 100)}%`,
                  backgroundColor: (item.amountPaid ?? 0) >= (item.total || 0) ? '#22c55e' : '#f59e0b',
                  borderRadius: 3,
                }} />
              </View>
              <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'right' }}>
                {Math.round(((item.amountPaid ?? 0) / (item.total || 1)) * 100)}% paid
              </Text>
            </View>
            
            {/* Layer 3: Previous Balance (Timeline) */}
            {item.oldBalance !== undefined && item.oldBalance > 0 && (
              <View style={{
                backgroundColor: '#fffbeb',
                borderRadius: 8,
                padding: 12,
                borderWidth: 1,
                borderLeftWidth: 3,
                borderColor: '#fde68a',
                borderLeftColor: '#f59e0b',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="time-outline" size={16} color="#d97706" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600', flex: 1 }}>
                    Previous Balance
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#b45309' }}>
                    {formatCurrency(item.oldBalance)}
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: '#92400e', fontStyle: 'italic' }}>
                  Outstanding from earlier transactions
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {!isSelectionMode && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* Pay Button */}
              {customerTotalBalance !== undefined && customerTotalBalance > 0 && onPayClick && actualBalance > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setShowMenu(false);
                    onPayClick(item);
                  }}
                  disabled={isPendingDeletion}
                  style={{
                    flex: 1,
                    backgroundColor: '#22c55e',
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="cash" size={16} color="white" />
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
                    Pay {formatCurrency(actualBalance)}
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* Details Button */}
              <TouchableOpacity
                onPress={() => onViewReceipt(item)}
                disabled={isPendingDeletion}
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 13 }}>Details</Text>
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              </TouchableOpacity>
              
              {/* Menu Button */}
              <TouchableOpacity
                ref={menuButtonRef}
                onPress={(event) => {
                  menuButtonRef.current?.measure((fx, fy, width, height, px, py) => {
                    setMenuPosition({
                      top: py + height,
                      right: 16,
                    });
                    setShowMenu(!showMenu);
                  });
                }}
                disabled={isPendingDeletion}
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>

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
            <View style={[
              styles.dropdownMenu,
              {
                position: 'absolute',
                top: menuPosition.top,
                right: menuPosition.right,
              }
            ]}>
              {/* Pay Option - only show if this receipt has unpaid balance */}
              {customerTotalBalance !== undefined && customerTotalBalance > 0 && onPayClick && actualBalance > 0 && (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setShowMenu(false);
                    onPayClick(item);
                  }}
                >
                  <Ionicons name="cash" size={18} color="#10b981" />
                  <Text style={styles.dropdownText}>Record Payment</Text>
                </TouchableOpacity>
              )}
              
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
  },
  dropdownMenu: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
});

export default ReceiptItem;
