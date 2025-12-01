import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import PaymentService, { PaymentTransaction } from '../services/business/PaymentService';
import { formatCurrency } from '../utils';
import { CacheInvalidation } from '../utils/cacheInvalidation';
import { usePaymentStore, useIsPaymentProcessing, usePaymentCascadePreview } from '../stores/paymentStore';
import { useBalanceStore } from '../stores/balanceStore';

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
  { value: 'bank_transfer', label: 'Bank Transfer', icon: 'business-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

interface CascadePreview {
  receiptNumber: string;
  currentBalance: number;
  paymentToApply: number;
  newBalance: number;
}

/**
 * Record Payment Modal Component
 * 
 * TODO: Rebuild payment recording and cascade calculation logic from scratch
 */
const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  visible,
  receipt,
  onClose,
  onPaymentRecorded,
}) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Zustand stores
  const recordPayment = usePaymentStore(state => state.recordPayment);
  const clearPayment = usePaymentStore(state => state.clearPayment);
  const isProcessing = useIsPaymentProcessing();
  const updateBalance = useBalanceStore(state => state.calculateBalance);
  
  // State
  const [unpaidReceipts, setUnpaidReceipts] = useState<FirebaseReceipt[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);
  const [showCascadePreview, setShowCascadePreview] = useState(false);
  const [cascadePreview, setCascadePreview] = useState<CascadePreview[]>([]);
  
  // Progress tracking
  const [cascadeProgress, setCascadeProgress] = useState<{
    visible: boolean;
    current: number;
    total: number;
    message: string;
  }>({ visible: false, current: 0, total: 0, message: '' });
  
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Calculate balance information
  // TODO: Implement proper balance calculation
  const balance = useMemo(() => {
    if (!receipt) return null;
    
    const total = receipt.total || 0;
    const paid = receipt.amountPaid || 0;
    const oldBalance = receipt.oldBalance || 0;
    
    const receiptBalance = total - paid;
    const totalBalance = receiptBalance + oldBalance;
    
    return {
      oldBalance,
      receiptTotal: total,
      amountPaid: paid,
      receiptBalance,
      remainingBalance: totalBalance,
    };
  }, [receipt?.oldBalance, receipt?.total, receipt?.amountPaid]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible && receipt?.customerName) {
      loadUnpaidReceipts();
      clearPayment();
    } else {
      setAmount('');
      setPaymentMethod('cash');
      setNotes('');
      setError('');
      setUnpaidReceipts([]);
      setCascadePreview([]);
      setShowCascadePreview(false);
      clearPayment();
    }
  }, [visible, receipt?.id, clearPayment]);

  const loadUnpaidReceipts = async () => {
    if (!receipt?.customerName) return;

    setLoadingUnpaid(true);
    try {
      const receipts = await PaymentService.getCustomerUnpaidReceipts(receipt.customerName);
      const otherUnpaid = receipts
        .filter(r => r.id !== receipt.id)
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });
      setUnpaidReceipts(otherUnpaid);
    } catch (error) {
      console.error('Error loading unpaid receipts:', error);
    } finally {
      setLoadingUnpaid(false);
    }
  };

  /**
   * Calculate cascade preview
   * TODO: Implement proper cascade calculation logic
   */
  const calculateCascadePreview = useCallback((paymentAmount: number) => {
    if (!balance) return;

    // TODO: Implement cascade preview calculation
    // For now, just show the current receipt
    const preview: CascadePreview[] = [];
    
    if (receipt) {
      preview.push({
        receiptNumber: receipt.receiptNumber || '',
        currentBalance: balance.receiptBalance,
        paymentToApply: Math.min(paymentAmount, balance.receiptBalance),
        newBalance: Math.max(0, balance.receiptBalance - paymentAmount),
      });
    }

    setCascadePreview(preview);
    setShowCascadePreview(false); // Disable cascade preview until logic is rebuilt
  }, [balance, receipt]);

  // Calculate cascade preview when amount changes
  useEffect(() => {
    if (!amount || !balance) {
      setCascadePreview([]);
      setShowCascadePreview(false);
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setCascadePreview([]);
      setShowCascadePreview(false);
      return;
    }

    calculateCascadePreview(paymentAmount);
  }, [amount, balance, calculateCascadePreview]);

  const handleAmountChange = (text: string) => {
    const cleanText = text.replace(/[^0-9.]/g, '');
    const parts = cleanText.split('.');
    if (parts.length > 2) return;
    
    setAmount(cleanText);
    setError('');
  };

  const handleSetFullAmount = () => {
    if (balance) {
      setAmount(balance.remainingBalance.toFixed(2));
      setError('');
    }
  };

  const validateForm = (): boolean => {
    if (!receipt) {
      setError('Receipt not found');
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid payment amount');
      return false;
    }

    return true;
  };

  /**
   * Handle payment recording
   * TODO: Implement proper payment recording logic
   */
  const handleRecordPayment = async () => {
    if (!validateForm() || !receipt) return;

    const paymentAmount = parseFloat(amount);

    try {
      // TODO: Implement payment recording
      // For now, show a message that the feature is being rebuilt
      Alert.alert(
        '🚧 Feature Under Reconstruction',
        'Payment recording logic is being rebuilt from scratch. Please wait for the new implementation.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Error recording payment:', error);
      setCascadeProgress({ visible: false, current: 0, total: 0, message: '' });
      
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'An error occurred',
        [{ text: 'OK' }]
      );
    }
  };

  if (!visible || !receipt) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <View
          style={{
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
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Record Payment</Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={isProcessing || cascadeProgress.visible}
              style={{
                padding: 8,
                backgroundColor: '#f3f4f6',
                borderRadius: 8,
                opacity: (isProcessing || cascadeProgress.visible) ? 0.5 : 1,
              }}
            >
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Rebuild Notice */}
          <View
            style={{
              backgroundColor: '#fef3c7',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: '#f59e0b',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="construct-outline" size={24} color="#f59e0b" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#92400e', marginLeft: 8 }}>
                Under Reconstruction
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#92400e' }}>
              Payment recording and calculation logic is being rebuilt from scratch to fix logic issues.
            </Text>
          </View>

          {/* Receipt Information */}
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 0.5 }}>
              RECEIPT DETAILS
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>Receipt No:</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                {receipt.receiptNumber}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>Customer:</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                {receipt.customerName || 'Walk-in Customer'}
              </Text>
            </View>

            {balance && (
              <>
                <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Remaining Balance:</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#dc2626' }}>
                    {formatCurrency(balance.remainingBalance)}
                  </Text>
                </View>

                {unpaidReceipts.length > 0 && (
                  <View style={{ 
                    marginTop: 12, 
                    padding: 12, 
                    backgroundColor: '#fef3c7', 
                    borderRadius: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: '#f59e0b',
                  }}>
                    <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>
                      ℹ️ Customer has {unpaidReceipts.length} other unpaid receipt{unpaidReceipts.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Payment Amount */}
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                Payment Amount <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={handleSetFullAmount}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: '#dbeafe',
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: '#1e40af', fontWeight: '600' }}>Full Amount</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!isProcessing && !cascadeProgress.visible}
              style={{
                borderWidth: error ? 2 : 1,
                borderColor: error ? '#ef4444' : '#d1d5db',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 24,
                fontWeight: '700',
                backgroundColor: 'white',
                color: '#111827',
              }}
            />
            
            {error ? (
              <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</Text>
            ) : null}
          </View>

          {/* Payment Method */}
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
              Payment Method <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  onPress={() => setPaymentMethod(method.value)}
                  disabled={isProcessing || cascadeProgress.visible}
                  style={{
                    flex: 1,
                    minWidth: '45%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: paymentMethod === method.value ? '#111827' : '#e5e7eb',
                    backgroundColor: paymentMethod === method.value ? '#f3f4f6' : 'white',
                    opacity: (isProcessing || cascadeProgress.visible) ? 0.5 : 1,
                  }}
                >
                  <Ionicons
                    name={method.icon as any}
                    size={20}
                    color={paymentMethod === method.value ? '#111827' : '#6b7280'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: paymentMethod === method.value ? '600' : '500',
                      color: paymentMethod === method.value ? '#111827' : '#6b7280',
                    }}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
              Notes (Optional)
            </Text>
            
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isProcessing && !cascadeProgress.visible}
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                backgroundColor: 'white',
                color: '#111827',
                minHeight: 80,
              }}
            />
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={{
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            padding: 24,
          }}
        >
          <TouchableOpacity
            onPress={handleRecordPayment}
            disabled={isProcessing || cascadeProgress.visible}
            style={{
              backgroundColor: '#9ca3af', // Gray to indicate disabled
              borderRadius: 16,
              paddingVertical: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (isProcessing || cascadeProgress.visible) ? 0.7 : 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons name="construct" size={20} color="white" style={{ marginRight: 8 }} />
            <Text
              style={{
                color: 'white',
                fontWeight: '600',
                fontSize: 16,
                letterSpacing: 0.5,
              }}
            >
              Feature Being Rebuilt
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default RecordPaymentModal;
