import React, { useState, useEffect } from 'react';
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
import { FirebaseReceipt } from '../services/ReceiptFirebaseService';
import PaymentService, { PaymentTransaction } from '../services/PaymentService';
import { formatCurrency } from '../utils';

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

const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  visible,
  receipt,
  onClose,
  onPaymentRecorded,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Calculate balance information
  const balance = receipt
    ? {
        oldBalance: receipt.oldBalance || 0,
        receiptTotal: receipt.total || 0,
        amountPaid: receipt.amountPaid || 0,
        remainingBalance: receipt.newBalance || 0,
      }
    : null;

  // Load payment history when modal opens
  useEffect(() => {
    if (visible && receipt?.id) {
      loadPaymentHistory();
    } else {
      // Reset form when modal closes
      setAmount('');
      setPaymentMethod('cash');
      setNotes('');
      setError('');
      setPaymentHistory([]);
    }
  }, [visible, receipt?.id]);

  const loadPaymentHistory = async () => {
    if (!receipt?.id) return;

    setLoadingHistory(true);
    try {
      const history = await PaymentService.getReceiptPaymentHistory(receipt.id);
      setPaymentHistory(history);
    } catch (error) {
      console.error('Error loading payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAmountChange = (text: string) => {
    // Allow only numbers and decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
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

    // Allow overpayment - it will cascade to other unpaid receipts

    return true;
  };

  const handleRecordPayment = async () => {
    if (!validateForm() || !receipt) return;

    setIsProcessing(true);
    setError('');

    try {
      const result = await PaymentService.recordPayment({
        receiptId: receipt.id,
        amount: parseFloat(amount),
        paymentMethod,
        notes: notes.trim() || undefined,
      });

      if (result.success && result.paymentTransaction) {
        let message = `Payment of ${formatCurrency(parseFloat(amount))} recorded successfully!\n\nNew balance: ${formatCurrency(result.paymentTransaction.newBalance)}`;
        
        // Show information if payment was applied to multiple receipts
        if (result.paymentTransaction.affectedReceipts && result.paymentTransaction.affectedReceipts.length > 1) {
          message += `\n\n💸 Payment distributed across ${result.paymentTransaction.affectedReceipts.length} receipt(s):\n${result.paymentTransaction.affectedReceipts.join(', ')}`;
        } else if (result.paymentTransaction.cascadedReceipts && result.paymentTransaction.cascadedReceipts.length > 0) {
          message += `\n\n💸 Excess payment applied to ${result.paymentTransaction.cascadedReceipts.length} other receipt(s):\n${result.paymentTransaction.cascadedReceipts.join(', ')}`;
        }
        
        Alert.alert(
          'Payment Recorded',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                if (onPaymentRecorded && result.paymentTransaction) {
                  onPaymentRecorded(result.paymentTransaction);
                }
                onClose();
              },
            },
          ]
        );
      } else {
        setError(result.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
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
              style={{
                padding: 8,
                backgroundColor: '#f3f4f6',
                borderRadius: 8,
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
                
                {balance.oldBalance > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>Previous Balance:</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#dc2626' }}>
                      {formatCurrency(balance.oldBalance)}
                    </Text>
                  </View>
                )}
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Receipt Total:</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {formatCurrency(balance.receiptTotal)}
                  </Text>
                </View>
                
                {balance.amountPaid > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>Already Paid:</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#10b981' }}>
                      {formatCurrency(balance.amountPaid)}
                    </Text>
                  </View>
                )}
                
                <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Remaining Balance:</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#dc2626' }}>
                    {formatCurrency(balance.remainingBalance)}
                  </Text>
                </View>
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

          {/* Payment History */}
          {paymentHistory.length > 0 && (
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
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 0.5 }}>
                PAYMENT HISTORY
              </Text>
              
              {paymentHistory.map((payment, index) => (
                <View
                  key={payment.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: index < paymentHistory.length - 1 ? 1 : 0,
                    borderBottomColor: '#f3f4f6',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#10b981' }}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                      {payment.timestamp && new Date(payment.timestamp.seconds * 1000).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                    via {payment.paymentMethod.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
            disabled={isProcessing}
            style={{
              backgroundColor: '#10b981',
              borderRadius: 16,
              paddingVertical: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isProcessing ? 0.7 : 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
            )}
            <Text
              style={{
                color: 'white',
                fontWeight: '600',
                fontSize: 16,
                letterSpacing: 0.5,
              }}
            >
              {isProcessing ? 'Recording Payment...' : 'Record Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default RecordPaymentModal;
