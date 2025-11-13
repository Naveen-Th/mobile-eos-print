import React, { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseReceipt } from '../../services/business/ReceiptFirebaseService';
import { formatCurrency } from '../../utils';
import ThermalPrinterService from '../../services/printing/ThermalPrinterService';

interface ReceiptItemProps {
  item: FirebaseReceipt;
  isSelected: boolean;
  isSelectionMode: boolean;
  isPendingDeletion?: boolean;
  formatReceiptDate: (date: any) => string;
  getStatusColor: (status: string) => string;
  onLongPress: () => void;
  onPress: () => void;
  onToggleSelection: (receiptId: string) => void;
  onViewReceipt: (receipt: FirebaseReceipt) => void;
  onPayClick?: (receipt: FirebaseReceipt) => void;
  onPrintReceipt?: (receipt: FirebaseReceipt) => void;
}

// Memoized component to prevent unnecessary re-renders
const ReceiptItemOptimized = memo<ReceiptItemProps>((
  {
    item,
    isSelected,
    isSelectionMode,
    isPendingDeletion = false,
    formatReceiptDate,
    getStatusColor,
    onLongPress,
    onPress,
    onToggleSelection,
    onViewReceipt,
    onPayClick,
    onPrintReceipt,
  }
) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const printerService = useMemo(() => ThermalPrinterService.getInstance(), []);
  // Memoize balance calculations (only recalculates when item changes)
  const balanceInfo = useMemo(() => {
    const total = item.total || 0;
    const paid = item.amountPaid || 0;
    
    // ✅ Calculate THIS receipt's remaining balance
    const receiptBalance = total - paid;
    const oldBalance = item.oldBalance || 0;
    const isPaid = receiptBalance <= 0.01;
    
    // ✅ CRITICAL FIX: If receipt is PAID, totalBalance should be 0
    // oldBalance doesn't get cleared when paid (it's historical), but it's "consumed"
    // So we can't just add receiptBalance + oldBalance for paid receipts
    const totalBalance = isPaid ? 0 : (receiptBalance + oldBalance);
    const paymentPercent = total > 0 ? Math.round((paid / total) * 100) : 0;
    
    // Debug: Log for customer "Ga"
    if (item.customerName === 'Ga') {
      console.log(`💳 [ReceiptItemOpt ${item.receiptNumber}] oldBalance: ${oldBalance === 0 && !item.oldBalance ? 'UNDEFINED/0' : '₹' + oldBalance}, receiptBal: ₹${receiptBalance}, isPaid: ${isPaid}, totalBalance: ₹${totalBalance}`);
    }
    
    return {
      receiptBalance,
      totalBalance,
      isPaid,
      paymentPercent,
      hasOldBalance: oldBalance > 0,
      oldBalance,
    };
  }, [item.total, item.amountPaid, item.oldBalance, item.receiptNumber, item.customerName]);

  // Memoize status badge
  const statusBadge = useMemo(() => {
    if (balanceInfo.isPaid) return { text: 'PAID', color: '#10b981', bg: '#dcfce7' };
    if (item.amountPaid && item.amountPaid > 0) return { text: 'PARTIAL', color: '#2563eb', bg: '#dbeafe' };
    return { text: 'UNPAID', color: '#dc2626', bg: '#fee2e2' };
  }, [balanceInfo.isPaid, item.amountPaid]);

  // Optimized handlers
  const handlePress = useCallback(() => {
    if (!isPendingDeletion) onPress();
  }, [isPendingDeletion, onPress]);

  const handleLongPress = useCallback(() => {
    if (!isPendingDeletion) onLongPress();
  }, [isPendingDeletion, onLongPress]);

  const handleToggle = useCallback(() => {
    onToggleSelection(item.id);
  }, [onToggleSelection, item.id]);

  const handleViewDetails = useCallback(() => {
    onViewReceipt(item);
  }, [onViewReceipt, item]);

  const handlePay = useCallback(() => {
    onPayClick?.(item);
  }, [onPayClick, item]);

  // Optimized print handler with printer check
  const handlePrint = useCallback(async () => {
    if (isPrinting || isPendingDeletion) return;

    // Check printer connection first
    if (!printerService.isConnected()) {
      Alert.alert(
        'Printer Not Connected',
        'Please connect to a thermal printer first.\n\nGo to Settings → Printer Setup',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    setIsPrinting(true);
    try {
      // Convert date safely
      const convertDate = (date: any): Date => {
        try {
          if (date && typeof date.toDate === 'function') return date.toDate();
          if (date instanceof Date) return date;
          if (typeof date === 'string' || typeof date === 'number') return new Date(date);
          return new Date();
        } catch {
          return new Date();
        }
      };

      // Prepare receipt data for thermal printer
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
        items: item.items.map(lineItem => ({
          name: lineItem.name || 'Item',
          price: Number(lineItem.price) || 0,
          quantity: Number(lineItem.quantity) || 0,
          total: (Number(lineItem.price) || 0) * (Number(lineItem.quantity) || 0),
        })),
        subtotal: Number(item.subtotal) || 0,
        tax: Number(item.tax) || 0,
        total: Number(item.total) || 0,
        paymentMethod: 'Cash',
        receiptNumber: item.receiptNumber || 'N/A',
        timestamp: convertDate(item.date || item.createdAt),
        isPaid: balanceInfo.isPaid,
      };

      await printerService.printReceipt(receiptData);
      
      // Optional: callback for status update
      onPrintReceipt?.(item);
      
      // Success feedback - keep it subtle
      Alert.alert('✓ Printed', 'Receipt printed successfully', [{ text: 'OK' }]);
    } catch (error: any) {
      console.error('Print error:', error);
      Alert.alert(
        'Print Failed',
        error.message || 'Failed to print receipt. Check printer connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsPrinting(false);
    }
  }, [item, isPrinting, isPendingDeletion, printerService, balanceInfo.isPaid, onPrintReceipt]);

  // Style memoization
  const cardStyle = useMemo(() => [
    styles.card,
    isSelected && styles.cardSelected,
    isPendingDeletion && styles.cardPending,
  ], [isSelected, isPendingDeletion]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={isPendingDeletion}
      style={cardStyle}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          {/* Selection Checkbox */}
          {isSelectionMode && (
            <Pressable onPress={handleToggle} style={styles.checkbox}>
              <View style={[
                styles.checkboxInner,
                isSelected && styles.checkboxSelected
              ]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </Pressable>
          )}

          {/* Customer & Receipt Info */}
          <View style={styles.headerInfo}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customerName || 'Walk-in Customer'}
            </Text>
            <Text style={styles.receiptNumber} numberOfLines={1}>
              #{item.receiptNumber} • {formatReceiptDate(item.createdAt || item.date)}
            </Text>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>

          {/* Print Button - Floating in top-right */}
          {!isSelectionMode && (
            <Pressable
              onPress={handlePrint}
              disabled={isPrinting || isPendingDeletion}
              style={[styles.printButton, isPrinting && styles.printButtonActive]}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <Ionicons name="print" size={20} color="#059669" />
              )}
            </Pressable>
          )}
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentSummary}>
          {/* Receipt Total */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Receipt Total</Text>
            <Text style={styles.summaryValue}>{formatCurrency(item.total)}</Text>
          </View>

          {/* Amount Paid */}
          <View style={[styles.summaryRow, styles.summaryHighlight]}>
            <Text style={styles.summaryLabel}>Amount Paid</Text>
            <Text style={[styles.summaryValue, { color: statusBadge.color }]}>
              {formatCurrency(item.amountPaid || 0)}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${balanceInfo.paymentPercent}%`,
              backgroundColor: statusBadge.color
            }]} />
          </View>

          {/* Previous Balance - only show if receipt is NOT paid */}
          {balanceInfo.hasOldBalance && !balanceInfo.isPaid && (
            <View style={styles.oldBalanceRow}>
              <Ionicons name="time-outline" size={14} color="#d97706" />
              <Text style={styles.oldBalanceLabel}>Previous Balance</Text>
              <Text style={styles.oldBalanceValue}>
                {formatCurrency(balanceInfo.oldBalance)}
              </Text>
            </View>
          )}

          {/* Previous Balance (cleared state) - only show if we know how much was cleared */}
          {item.isPaid && (item as any).oldBalanceCleared > 0 && (
            <View style={[styles.oldBalanceRow, { opacity: 0.95, borderLeftColor: '#10b981' }] }>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={[styles.oldBalanceLabel, { color: '#065f46' }]}>Previous Balance Cleared</Text>
              <Text style={[styles.oldBalanceValue, { color: '#065f46' }]}> 
                {formatCurrency((item as any).oldBalanceCleared)}
              </Text>
            </View>
          )}
        </View>
        
        {/* Action Buttons */}
        {!isSelectionMode && (
          <View style={styles.actions}>
            {/* Pay Button */}
            {onPayClick && balanceInfo.totalBalance > 0 && (
              <Pressable
                onPress={handlePay}
                disabled={isPendingDeletion}
                style={[styles.payButton, isPendingDeletion && styles.buttonDisabled]}
              >
                <Ionicons name="cash" size={16} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay {formatCurrency(balanceInfo.totalBalance)}
                </Text>
              </Pressable>
            )}

            {/* Details Button */}
            <Pressable
              onPress={handleViewDetails}
              disabled={isPendingDeletion}
              style={[styles.detailsButton, isPendingDeletion && styles.buttonDisabled]}
            >
              <Text style={styles.detailsButtonText}>Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#6b7280" />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // ✅ OPTIMIZED: Check newBalance for instant payment updates
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.amountPaid === nextProps.item.amountPaid &&
    prevProps.item.total === nextProps.item.total &&
    prevProps.item.oldBalance === nextProps.item.oldBalance &&
    prevProps.item.newBalance === nextProps.item.newBalance &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isPendingDeletion === nextProps.isPendingDeletion
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  cardSelected: {
    borderColor: '#3b82f6',
    borderLeftColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  cardPending: {
    opacity: 0.5,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  checkbox: {
    padding: 4,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  headerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  receiptNumber: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  paymentSummary: {
    gap: 8,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  summaryHighlight: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  oldBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    gap: 6,
  },
  oldBalanceLabel: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  oldBalanceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b45309',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  payButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  detailsButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailsButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  printButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1.5,
    borderColor: '#10b981',
    // Modern shadow for depth
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  printButtonActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
});

ReceiptItemOptimized.displayName = 'ReceiptItemOptimized';

export default ReceiptItemOptimized;

