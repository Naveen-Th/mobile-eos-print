import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import PaymentService, { PaymentTransaction } from '../services/business/PaymentService';
import { formatCurrency } from '../utils';
import {
  usePaymentStore,
  useIsPaymentProcessing,
  usePaymentCascadePreview,
  usePaymentError,
} from '../stores/paymentStore';
import { useBalanceStore } from '../stores/balanceStore';
import {
  calculateReceiptBalance,
  calculateCustomerTotalBalance,
  formatPaymentCurrency,
} from '../utils/paymentCalculations';

interface RecordPaymentModalProps {
  visible: boolean;
  receipt: FirebaseReceipt | null;
  onClose: () => void;
  onPaymentRecorded?: (transaction: PaymentTransaction) => void;
}

type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'card', label: 'Card', icon: 'card-outline' },
  { value: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  { value: 'bank_transfer', label: 'Bank', icon: 'business-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

/**
 * Record Payment Modal Component
 * Handles payment recording with cascade support
 */
const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  visible,
  receipt,
  onClose,
  onPaymentRecorded,
}) => {
  const queryClient = useQueryClient();
  
  // Local form state
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  
  // Zustand store
  const {
    setCurrentReceipt,
    loadCustomerReceipts,
    previewCascade,
    recordPayment,
    clearPayment,
    customerReceipts,
  } = usePaymentStore();
  
  const isProcessing = useIsPaymentProcessing();
  const cascadePreview = usePaymentCascadePreview();
  const storeError = usePaymentError();
  const invalidateBalance = useBalanceStore(state => state.invalidateBalance);

  // Calculate balance information
  const balanceInfo = useMemo(() => {
    if (!receipt) return null;
    
    const receiptBalance = calculateReceiptBalance(receipt);
    const oldBalance = receipt.oldBalance || 0;
    const totalOwed = oldBalance + receiptBalance;
    
    // Calculate customer total balance
    // If customerReceipts is empty or doesn't include current receipt, use current receipt data
    let customerTotalBalance: number;
    
    if (customerReceipts.length === 0) {
      // No receipts loaded yet - use current receipt's total owed
      customerTotalBalance = totalOwed;
    } else if (!customerReceipts.find(r => r.id === receipt.id)) {
      // Current receipt not in list - add it to calculation
      customerTotalBalance = calculateCustomerTotalBalance([...customerReceipts, receipt]);
    } else {
      // Normal case - calculate from all customer receipts
      customerTotalBalance = calculateCustomerTotalBalance(customerReceipts);
    }
    
    return {
      receiptTotal: receipt.total || 0,
      amountPaid: receipt.amountPaid || 0,
      receiptBalance,
      oldBalance,
      totalOwed,
      customerTotalBalance,
    };
  }, [receipt, customerReceipts]);

  // Count other unpaid receipts
  const otherUnpaidCount = useMemo(() => {
    if (!receipt) return 0;
    return customerReceipts.filter(r => 
      r.id !== receipt.id && calculateReceiptBalance(r) > 0.01
    ).length;
  }, [receipt, customerReceipts]);

  // Initialize when modal opens
  useEffect(() => {
    if (visible && receipt) {
      setCurrentReceipt(receipt);
      loadCustomerReceipts(receipt.customerName || '');
      // Reset form
      setAmount('');
      setPaymentMethod('cash');
      setNotes('');
      setFormError('');
    } else if (!visible) {
      clearPayment();
    }
  }, [visible, receipt?.id]);

  // Update cascade preview when amount changes
  useEffect(() => {
    if (!receipt || !amount) return;
    
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) return;
    
    // Debounce preview calculation
    const timer = setTimeout(() => {
      previewCascade(receipt.id, paymentAmount);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [amount, receipt?.id, previewCascade]);

  const handleAmountChange = (text: string) => {
    // Allow only numbers and one decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    const parts = cleanText.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return; // Max 2 decimal places
    
    setAmount(cleanText);
    setFormError('');
  };

  const handleSetFullAmount = () => {
    if (balanceInfo) {
      // Set to customer's total balance (all unpaid receipts)
      // Use totalOwed as fallback if customerTotalBalance is 0 (receipts not loaded yet)
      const fullAmount = balanceInfo.customerTotalBalance > 0 
        ? balanceInfo.customerTotalBalance 
        : balanceInfo.totalOwed;
      setAmount(fullAmount.toFixed(2));
      setFormError('');
    }
  };

  const handleSetReceiptAmount = () => {
    if (balanceInfo) {
      // Set to just this receipt's balance
      setAmount(balanceInfo.receiptBalance.toFixed(2));
      setFormError('');
    }
  };

  const validateForm = (): boolean => {
    if (!receipt) {
      setFormError('Receipt not found');
      return false;
    }

    const paymentAmount = parseFloat(amount);
    
    if (!amount || isNaN(paymentAmount)) {
      setFormError('Please enter a valid payment amount');
      return false;
    }

    if (paymentAmount <= 0) {
      setFormError('Payment amount must be greater than zero');
      return false;
    }

    return true;
  };

  const handleRecordPayment = async () => {
    if (!validateForm() || !receipt) return;

    const paymentAmount = parseFloat(amount);

    try {
      const result = await recordPayment({
        receiptId: receipt.id,
        amount: paymentAmount,
        method: paymentMethod,
        notes: notes.trim() || undefined,
      });

      if (result.success && result.transaction) {
        // Invalidate balance cache for this customer
        invalidateBalance(receipt.customerName || '');
        
        // Invalidate React Query cache
        queryClient.invalidateQueries({ queryKey: ['firebase', 'collections', 'receipts'] });
        
        // Notify parent
        onPaymentRecorded?.(result.transaction);
        
        // Close modal
        onClose();
      } else {
        setFormError(result.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      setFormError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      clearPayment();
      onClose();
    }
  };

  if (!visible || !receipt) return null;

  const displayError = formError || storeError;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.headerTitle}>Record Payment</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isProcessing}
              style={[styles.closeButton, isProcessing && { opacity: 0.5 }]}
            >
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Receipt Information */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>RECEIPT DETAILS</Text>
            
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Receipt No:</Text>
              <Text style={styles.rowValue}>{receipt.receiptNumber}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Customer:</Text>
              <Text style={styles.rowValue}>{receipt.customerName || 'Walk-in Customer'}</Text>
            </View>

            {balanceInfo && (
              <>
                <View style={styles.divider} />
                
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Receipt Total:</Text>
                  <Text style={styles.rowValue}>{formatCurrency(balanceInfo.receiptTotal)}</Text>
                </View>
                
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Amount Paid:</Text>
                  <Text style={[styles.rowValue, { color: '#10b981' }]}>
                    {formatCurrency(balanceInfo.amountPaid)}
                  </Text>
                </View>
                
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Receipt Balance:</Text>
                  <Text style={[styles.rowValue, { color: '#dc2626', fontWeight: '700' }]}>
                    {formatCurrency(balanceInfo.receiptBalance)}
                  </Text>
                </View>

                {balanceInfo.oldBalance > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Previous Balance:</Text>
                    <Text style={[styles.rowValue, { color: '#f59e0b' }]}>
                      {formatCurrency(balanceInfo.oldBalance)}
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />
                
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { fontWeight: '700', fontSize: 16 }]}>
                    Total Outstanding:
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#dc2626' }}>
                    {formatCurrency(balanceInfo.customerTotalBalance > 0 ? balanceInfo.customerTotalBalance : balanceInfo.totalOwed)}
                  </Text>
                </View>

                {otherUnpaidCount > 0 && (
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={16} color="#92400e" />
                    <Text style={styles.infoText}>
                      Customer has {otherUnpaidCount} other unpaid receipt{otherUnpaidCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Payment Amount */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.inputLabel}>
                Payment Amount <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {balanceInfo && balanceInfo.receiptBalance !== balanceInfo.customerTotalBalance && (
                  <TouchableOpacity
                    onPress={handleSetReceiptAmount}
                    style={styles.quickAmountButton}
                  >
                    <Text style={styles.quickAmountText}>This Receipt</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSetFullAmount}
                  style={[styles.quickAmountButton, { backgroundColor: '#dbeafe' }]}
                >
                  <Text style={[styles.quickAmountText, { color: '#1e40af' }]}>Full Amount</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#6b7280', marginRight: 4 }}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                editable={!isProcessing}
                style={[
                  styles.amountInput,
                  displayError ? { borderColor: '#ef4444', borderWidth: 2 } : undefined
                ]}
              />
            </View>
            
            {displayError ? (
              <Text style={styles.errorText}>{displayError}</Text>
            ) : null}
          </View>

          {/* Cascade Preview */}
          {cascadePreview && cascadePreview.totalReceipts > 0 && (
            <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#10b981' }]}>
              <Text style={[styles.cardLabel, { color: '#166534' }]}>PAYMENT DISTRIBUTION</Text>
              
              {cascadePreview.receiptsAffected.map((item, index) => (
                <View key={item.receipt.id} style={[styles.row, { paddingVertical: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                      {item.receipt.receiptNumber}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                      Balance: {formatCurrency(item.currentBalance)} → {formatCurrency(item.newBalance)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#10b981' }}>
                      -{formatCurrency(item.paymentToApply)}
                    </Text>
                    {item.willBeFullyPaid && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                        <Text style={{ fontSize: 10, color: '#10b981', marginLeft: 2 }}>Paid</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              
              <View style={styles.divider} />
              
              <View style={styles.row}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#166534' }}>
                  New Balance:
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#166534' }}>
                  {formatCurrency(cascadePreview.newCustomerBalance)}
                </Text>
              </View>
            </View>
          )}

          {/* Payment Method */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>
              Payment Method <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  onPress={() => setPaymentMethod(method.value)}
                  disabled={isProcessing}
                  style={[
                    styles.methodButton,
                    paymentMethod === method.value && styles.methodButtonActive,
                    isProcessing && { opacity: 0.5 },
                  ]}
                >
                  <Ionicons
                    name={method.icon as any}
                    size={20}
                    color={paymentMethod === method.value ? '#111827' : '#6b7280'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      paymentMethod === method.value && styles.methodTextActive,
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isProcessing}
              style={styles.notesInput}
            />
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleRecordPayment}
            disabled={isProcessing || !amount || parseFloat(amount) <= 0}
            style={[
              styles.submitButton,
              (isProcessing || !amount || parseFloat(amount) <= 0) && { opacity: 0.6 },
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>
                  Record Payment {amount && parseFloat(amount) > 0 ? `(${formatPaymentCurrency(parseFloat(amount))})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#6b7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  infoBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600' as const,
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  quickAmountButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  quickAmountText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600' as const,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700' as const,
    backgroundColor: 'white',
    color: '#111827',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
  },
  methodButton: {
    flex: 1,
    minWidth: '45%' as any,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  methodButtonActive: {
    borderColor: '#111827',
    backgroundColor: '#f3f4f6',
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6b7280',
  },
  methodTextActive: {
    fontWeight: '600' as const,
    color: '#111827',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#111827',
    minHeight: 80,
    marginTop: 12,
  },
  footer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 24,
  },
  submitButton: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600' as const,
    fontSize: 16,
    letterSpacing: 0.5,
  },
};

export default RecordPaymentModal;
