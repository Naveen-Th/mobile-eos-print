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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Cascade preview state
  const [unpaidReceipts, setUnpaidReceipts] = useState<FirebaseReceipt[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);
  const [showCascadePreview, setShowCascadePreview] = useState(false);
  const [cascadePreview, setCascadePreview] = useState<CascadePreview[]>([]);
  
  // Progress tracking for cascade updates
  const [cascadeProgress, setCascadeProgress] = useState<{
    visible: boolean;
    current: number;
    total: number;
    message: string;
  }>({ visible: false, current: 0, total: 0, message: '' });
  
  // Animation for progress
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Calculate balance information (memoized to prevent infinite loops)
  const balance = useMemo(() => {
    if (!receipt) return null;
    
    const total = receipt.total || 0;
    const paid = receipt.amountPaid || 0;
    const oldBalance = receipt.oldBalance || 0;
    
    // ✅ receiptBalance = just this receipt's items
    // ✅ totalBalance = receipt + oldBalance (oldBalance will be paid via cascade to older receipts)
    const receiptBalance = total - paid;
    const totalBalance = receiptBalance + oldBalance;
    
    console.log(`💰 [MODAL BALANCE] Receipt ${receipt.receiptNumber}: total=₹${total}, paid=₹${paid}, oldBalance=₹${oldBalance}, receiptBalance=₹${receiptBalance}, totalBalance=₹${totalBalance}`);
    
    return {
      oldBalance,
      receiptTotal: total,
      amountPaid: paid,
      receiptBalance, // Just this receipt
      remainingBalance: totalBalance, // Total to pay (may cascade)
    };
  }, [receipt?.oldBalance, receipt?.total, receipt?.amountPaid]);

  // Load unpaid receipts for cascade preview
  useEffect(() => {
    if (visible && receipt?.customerName) {
      loadUnpaidReceipts();
    } else {
      // Reset form when modal closes
      setAmount('');
      setPaymentMethod('cash');
      setNotes('');
      setError('');
      setUnpaidReceipts([]);
      setCascadePreview([]);
      setShowCascadePreview(false);
      setIsProcessing(false);
    }
  }, [visible, receipt?.id]);

  const loadUnpaidReceipts = async () => {
    if (!receipt?.customerName) return;

    setLoadingUnpaid(true);
    try {
      const receipts = await PaymentService.getCustomerUnpaidReceipts(receipt.customerName);
      // Filter out current receipt and sort by date (oldest first)
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

  // Calculate cascade preview function (memoized to prevent recreation)
  const calculateCascadePreview = useCallback((paymentAmount: number) => {
    if (!balance) return;

    const preview: CascadePreview[] = [];
    let remaining = paymentAmount;

    // Calculate balances
    const receiptBalance = balance.receiptTotal - balance.amountPaid;
    const oldBalance = balance.oldBalance;
    
    // ✅ CRITICAL FIX: The "Previous Balance" on this receipt is PART OF THIS RECEIPT
    // Only cascade if payment exceeds (receiptBalance + oldBalance)
    const totalReceiptDebt = receiptBalance + oldBalance;
    
    console.log(`💵 [CASCADE PREVIEW] Payment: ₹${paymentAmount}, Receipt balance: ₹${receiptBalance}, Old balance: ₹${oldBalance}, Total debt on this receipt: ₹${totalReceiptDebt}`);

    // Apply to current receipt first - only up to the receipt balance (not oldBalance)
    // ✅ oldBalance represents debt on OLDER receipts, so payment should cascade to them
    const currentReceiptPayment = Math.min(remaining, receiptBalance);
    if (currentReceiptPayment > 0.01) {
      const newReceiptBalance = receiptBalance - currentReceiptPayment;
      const isPaid = newReceiptBalance <= 0.01;
      
      console.log(`  ✅ Current receipt ${receipt?.receiptNumber}: ₹${currentReceiptPayment} applied to items, new receipt balance: ₹${newReceiptBalance}, isPaid: ${isPaid}`);
      if (oldBalance > 0) {
        console.log(`    ℹ️ Receipt has ₹${oldBalance} oldBalance - remaining payment will cascade to older receipts`);
      }
      
      preview.push({
        receiptNumber: receipt?.receiptNumber || '',
        currentBalance: receiptBalance, // ✅ Show only THIS receipt's balance
        paymentToApply: currentReceiptPayment,
        newBalance: newReceiptBalance,
      });
      remaining -= currentReceiptPayment;
    } else {
      console.log(`  ⚠️ Current receipt already paid, cascading full amount`);
    }

    // ✅ Only cascade if payment EXCEEDS the current receipt's total debt
    // If there's remaining payment after paying this receipt (including its oldBalance), cascade to older receipts
    if (remaining > 0.01 && unpaidReceipts.length > 0) {
      console.log(`  🔄 Payment exceeds current receipt debt. Cascading ₹${remaining} to older receipts...`);
      
      for (const oldReceipt of unpaidReceipts) {
        if (remaining <= 0.01) break;

        // ✅ Calculate only THIS older receipt's balance (not cumulative)
        const oldReceiptTotal = oldReceipt.total || 0;
        const oldReceiptPaid = oldReceipt.amountPaid || 0;
        const oldReceiptBalance = oldReceiptTotal - oldReceiptPaid;
        const payment = Math.min(remaining, oldReceiptBalance);

        console.log(`    📦 Cascading ₹${payment} to ${oldReceipt.receiptNumber}`);
        
        preview.push({
          receiptNumber: oldReceipt.receiptNumber,
          currentBalance: oldReceiptBalance, // ✅ Only this receipt's balance
          paymentToApply: payment,
          newBalance: oldReceiptBalance - payment, // ✅ Only this receipt's remaining
        });

        remaining -= payment;
      }

      setShowCascadePreview(true);
    } else {
      if (remaining > 0.01) {
        console.log(`  ℹ️ No older receipts to cascade to. Excess payment: ₹${remaining}`);
      } else {
        console.log(`  ✅ Payment fully consumed by current receipt. No cascade needed.`);
      }
      setShowCascadePreview(false);
    }

    setCascadePreview(preview);
  }, [balance, unpaidReceipts, receipt?.receiptNumber]);

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

  const willCascade = useMemo(() => {
    return cascadePreview.length > 1;
  }, [cascadePreview]);

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

    return true;
  };

  const handleRecordPayment = async () => {
    if (!validateForm() || !receipt) return;

    const paymentAmount = parseFloat(amount);
    const currentBalance = balance?.remainingBalance || 0;
    const receiptsToUpdate = cascadePreview.length;

    // Optimistic transaction for callback
    const optimisticTransaction = {
      id: 'temp-' + Date.now(),
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      customerName: receipt.customerName || 'Walk-in Customer',
      amount: paymentAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
      previousBalance: currentBalance,
      newBalance: Math.max(0, currentBalance - paymentAmount),
      timestamp: { seconds: Date.now() / 1000 } as any,
      affectedReceipts: cascadePreview.map(p => p.receiptNumber),
    };

    try {
      console.log(`🔄 [PAYMENT] Processing payment of ₹${paymentAmount} across ${receiptsToUpdate} receipt(s)`);
      console.log(`📋 [PAYMENT] Cascade preview:`, cascadePreview);
      
      // Show progress modal BEFORE starting if cascade
      if (receiptsToUpdate > 1) {
        setCascadeProgress({
          visible: true,
          current: 0,
          total: receiptsToUpdate,
          message: `Preparing to update ${receiptsToUpdate} receipts...`,
        });
        
        // Reset animation
        progressAnim.setValue(0);
        
        // Small delay to ensure modal renders
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        setIsProcessing(true);
      }

      // Start progress animation WHILE processing
      if (receiptsToUpdate > 1) {
        // Simulate incremental progress during Firebase operation
        const progressInterval = setInterval(() => {
          setCascadeProgress(prev => {
            if (prev.current < prev.total) {
              const newCurrent = Math.min(prev.current + 1, prev.total);
              const percentage = (newCurrent / prev.total) * 100;
              
              // Animate progress bar
              Animated.timing(progressAnim, {
                toValue: percentage,
                duration: 150,
                useNativeDriver: false,
              }).start();
              
              return {
                ...prev,
                current: newCurrent,
                message: newCurrent === prev.total
                  ? 'Finalizing payment...'
                  : `Updating receipt ${newCurrent} of ${prev.total}...`,
              };
            }
            return prev;
          });
        }, 200); // Update every 200ms

        // Process payment (Firebase batch write is atomic but takes time)
        const result = await PaymentService.recordPayment({
          receiptId: receipt.id,
          amount: paymentAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
        });

        // Clear interval and complete progress
        clearInterval(progressInterval);
        
        // Ensure we reach 100%
        setCascadeProgress(prev => ({
          ...prev,
          current: prev.total,
          message: 'Payment completed!',
        }));
        
        progressAnim.setValue(100);
        
        // Brief pause to show completion
        await new Promise(resolve => setTimeout(resolve, 500));

        // Close progress modal
        setCascadeProgress({ visible: false, current: 0, total: 0, message: '' });

        if (result.success) {
          // ✅ SKIP OPTIMISTIC UPDATE for cascade - Firebase realtime listener will update the cache
          // Optimistic updates cause double-counting when Firebase beats us to the update
          console.log('✅ [CASCADE SUCCESS] Payment distributed across ${receiptsToUpdate} receipts. Firebase will update cache via realtime listener.');
          
          // Invalidate queries to force refetch if needed
          queryClient.invalidateQueries({ queryKey: ['firebase', 'collections', 'receipts'] });
          
          /*
          // OLD CODE: Optimistic update (causes double-counting)
          queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
            if (!oldData) return oldData;
            
            let updated = false;
            const updatedData = oldData.map(receipt => {
              // Find the affected receipt in cascade preview
              const cascadeItem = cascadePreview.find(p => p.receiptNumber === receipt.receiptNumber);
              if (!cascadeItem) return receipt;
              
              console.log(`  💳 Updating ${receipt.receiptNumber}: paid ${cascadeItem.paymentToApply}, new balance ${cascadeItem.newBalance}`);
              updated = true;
              
              // Update with new balance from cascade preview
              const isPaid = cascadeItem.newBalance <= 0.01;
              return {
                ...receipt,
                newBalance: cascadeItem.newBalance,
                amountPaid: (receipt.amountPaid || 0) + cascadeItem.paymentToApply,
                isPaid, // ✅ Update isPaid flag
                status: isPaid ? 'printed' as const : receipt.status,
              };
            });
            
            // Add missing receipts to cache if not found
            if (!updated) {
              console.log('  ⚠️ [CACHE] No receipts updated in cascade - adding manually');
              const newReceipts = cascadePreview.map(cascadeItem => {
                const isPaid = cascadeItem.newBalance <= 0.01;
                return {
                  ...receipt,
                  receiptNumber: cascadeItem.receiptNumber,
                  newBalance: cascadeItem.newBalance,
                  amountPaid: (receipt.amountPaid || 0) + cascadeItem.paymentToApply,
                  isPaid,
                  status: isPaid ? 'printed' as const : receipt.status,
                };
              });
              return [...newReceipts, ...updatedData];
            }
            
            return updatedData;
          });
          */
          
          // Trigger callback for receipts screen to refresh
          if (onPaymentRecorded) {
            onPaymentRecorded(optimisticTransaction);
          }

          // Show success message
          Alert.alert(
            '✅ Payment Recorded',
            `₹${paymentAmount.toFixed(2)} distributed across ${receiptsToUpdate} receipt(s)`,
            [{ text: 'OK', onPress: onClose }]
          );
        } else {
          Alert.alert(
            'Payment Failed',
            result.error || 'Failed to record payment. Please try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Single receipt - instant processing (receiptsToUpdate === 0 or 1)
        console.log('⚡ [SINGLE RECEIPT PATH] Processing single receipt payment');
        setIsProcessing(true);
        
        const result = await PaymentService.recordPayment({
          receiptId: receipt.id,
          amount: paymentAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
        });

        setIsProcessing(false);

        if (result.success) {
          // ✅ INSTANT UI UPDATE: Update cache with new payment data using cascade preview
          console.log('🔄 [OPTIMISTIC UPDATE - SINGLE] Applying cascade preview:', cascadePreview);
          
          queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
            if (!oldData) {
              console.log('  ⚠️ [CACHE] oldData is null/undefined!');
              return oldData;
            }
            
            console.log(`  📊 [CACHE] Found ${oldData.length} receipts in cache`);
            console.log(`  🔍 [CACHE] Looking for receipt numbers:`, cascadePreview.map(p => p.receiptNumber));
            console.log(`  🆔 [CACHE] Looking for receipt ID:`, receipt.id);
            console.log(`  📋 [CACHE] First 5 receipt numbers in cache:`, oldData.slice(0, 5).map(r => r.receiptNumber));
            console.log(`  🆔 [CACHE] First 5 receipt IDs in cache:`, oldData.slice(0, 5).map(r => r.id));
            
            // Check if the current receipt exists in cache
            const currentReceiptInCache = oldData.find(r => r.receiptNumber === cascadePreview[0]?.receiptNumber);
            const currentReceiptByIdInCache = oldData.find(r => r.id === receipt.id);
            console.log(`  🎯 [CACHE] Current receipt ${cascadePreview[0]?.receiptNumber} in cache by receiptNumber?`, currentReceiptInCache ? 'YES' : 'NO');
            console.log(`  🎯 [CACHE] Current receipt ${receipt.id} in cache by ID?`, currentReceiptByIdInCache ? 'YES' : 'NO');
            if (!currentReceiptInCache && !currentReceiptByIdInCache) {
              console.log(`  ⚠️ [CACHE] Receipt not found by either receiptNumber or ID! Receipt definitely not in cache.`);
              console.log(`  🔍 [CACHE] This receipt was likely just created and hasn't synced to cache yet.`);
            }
            
            let updated = false;
            const updatedData = oldData.map(r => {
              // Use cascade preview if available (more accurate)
              const cascadeItem = cascadePreview.find(p => p.receiptNumber === r.receiptNumber);
              
              if (cascadeItem) {
                console.log(`  💳 [CASCADE] ✅ FOUND & UPDATING ${r.receiptNumber}: paid ${cascadeItem.paymentToApply}, new balance ${cascadeItem.newBalance}`);
                updated = true;
                const isPaid = cascadeItem.newBalance <= 0.01;
                
                // ✅ Check if Firebase already updated this receipt (to avoid double-counting)
                const originalAmountPaid = r.id === receipt.id ? (balance?.amountPaid || 0) : (r.amountPaid || 0);
                const currentAmountPaid = r.amountPaid || 0;
                const alreadyUpdated = currentAmountPaid > originalAmountPaid;
                
                if (alreadyUpdated) {
                  console.log(`    ℹ️ Receipt ${r.receiptNumber} already updated by Firebase (amountPaid: ₹${currentAmountPaid}), skipping optimistic update`);
                  return r; // Already updated by Firebase, don't double-count
                }
                
                // ✅ Calculate new oldBalance / cleared amount for the current receipt
                const currentOldBalance = r.oldBalance || 0;
                let newOldBalance = currentOldBalance;
                let oldBalanceCleared = 0;
                
                if (r.id === receipt.id && currentOldBalance > 0) {
                  if (cascadePreview.length > 1) {
                    // Payment cascaded to older receipts - clear by cascaded amount
                    const totalCascaded = cascadePreview
                      .filter(p => p.receiptNumber !== receipt.receiptNumber)
                      .reduce((sum, p) => sum + p.paymentToApply, 0);
                    oldBalanceCleared = Math.min(totalCascaded, currentOldBalance);
                    newOldBalance = Math.max(0, currentOldBalance - oldBalanceCleared);
                    console.log(`    ✅ Cascaded ₹${totalCascaded} to older receipts, clearing oldBalance: ₹${currentOldBalance} - ₹${oldBalanceCleared} = ₹${newOldBalance}`);
                  } else {
                    // Single receipt path: leftover reduces oldBalance
                    const leftover = Math.max(0, paymentAmount - cascadeItem.paymentToApply);
                    oldBalanceCleared = Math.min(leftover, currentOldBalance);
                    newOldBalance = Math.max(0, currentOldBalance - oldBalanceCleared);
                    console.log(`    ✅ Leftover ₹${leftover} cleared from oldBalance: ₹${currentOldBalance} - ₹${oldBalanceCleared} = ₹${newOldBalance}`);
                  }
                }
                
                return {
                  ...r,
                  newBalance: cascadeItem.newBalance,
                  amountPaid: originalAmountPaid + cascadeItem.paymentToApply, // ✅ Use original, not current
                  oldBalance: newOldBalance,
                  // expose for UI chip
                  oldBalanceCleared,
                  isPaid,
                  status: isPaid ? 'printed' as const : r.status,
                };
              }
              
              // Fallback: update by receipt ID (for receipts not yet synced by receiptNumber)
              if (r.id === receipt.id) {
                const cascadeItem = cascadePreview[0]; // Current receipt should be first
                if (cascadeItem) {
                  console.log(`  💳 [CASCADE] ✅ FOUND BY ID & UPDATING ${r.receiptNumber || r.id}: paid ${cascadeItem.paymentToApply}, new balance ${cascadeItem.newBalance}`);
                  updated = true;
                  const isPaid = cascadeItem.newBalance <= 0.01;
                  
                  // ✅ Check if Firebase already updated this receipt
                  const originalAmountPaid = balance?.amountPaid || 0;
                  const currentAmountPaid = r.amountPaid || 0;
                  const alreadyUpdated = currentAmountPaid > originalAmountPaid;
                  
                  if (alreadyUpdated) {
                    console.log(`    ℹ️ Receipt ${r.receiptNumber || r.id} already updated by Firebase (amountPaid: ₹${currentAmountPaid}), skipping optimistic update`);
                    return r; // Already updated, don't double-count
                  }
                  
                  // ✅ Calculate new oldBalance
                  const currentOldBalance = r.oldBalance || 0;
                  let newOldBalance = currentOldBalance;
                  
                  if (currentOldBalance > 0 && cascadePreview.length > 1) {
                    // Payment cascaded - clear oldBalance
                    const totalCascaded = cascadePreview
                      .filter(p => p.receiptNumber !== receipt.receiptNumber)
                      .reduce((sum, p) => sum + p.paymentToApply, 0);
                    
                    const oldBalanceConsumed = Math.min(totalCascaded, currentOldBalance);
                    newOldBalance = Math.max(0, currentOldBalance - oldBalanceConsumed);
                    console.log(`    ✅ Cascaded ₹${totalCascaded}, clearing oldBalance: ₹${currentOldBalance} - ₹${oldBalanceConsumed} = ₹${newOldBalance}`);
                  } else if (currentOldBalance > 0) {
                    console.log(`    ℹ️ oldBalance ₹${currentOldBalance} remains (no cascade)`);
                  }
                  
                  return {
                    ...r,
                    newBalance: cascadeItem.newBalance,
                    amountPaid: originalAmountPaid + cascadeItem.paymentToApply, // ✅ Use original
                    oldBalance: newOldBalance, // ✅ Update oldBalance
                    isPaid,
                    status: isPaid ? 'printed' as const : r.status,
                  };
                }
              }
              
              return r;
            });
            
            // If receipt wasn't found in cache, add it manually (newly created receipt)
              if (!updated) {
              console.log('  ⚠️ [CACHE] Receipt not in cache - adding it manually with payment data');
              const cascadeItem = cascadePreview[0];
              if (cascadeItem && receipt) {
                const isPaid = cascadeItem.newBalance <= 0.01;
                // Compute oldBalance cleared using leftover (single path)
                const currentOld = receipt.oldBalance || 0;
                const leftover = Math.max(0, paymentAmount - cascadeItem.paymentToApply);
                const oldBalanceCleared = Math.min(leftover, currentOld);
                const newReceipt = {
                  ...receipt,
                  newBalance: cascadeItem.newBalance,
                  amountPaid: (receipt.amountPaid || 0) + cascadeItem.paymentToApply,
                  oldBalance: Math.max(0, currentOld - oldBalanceCleared),
                  oldBalanceCleared,
                  isPaid,
                  status: isPaid ? 'printed' as const : receipt.status,
                };
                console.log(`  ✅ [CACHE] Added receipt ${receipt.receiptNumber} to cache with updated payment data`);
                return [newReceipt, ...updatedData]; // Add to beginning (most recent)
              }
            }
            
            return updatedData;
          });
          
          // Trigger callback for receipts screen to refresh
          if (onPaymentRecorded) {
            onPaymentRecorded(optimisticTransaction);
          }

          // Close immediately for single receipt
          onClose();
        } else {
          Alert.alert(
            'Payment Failed',
            result.error || 'Failed to record payment. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      setCascadeProgress({ visible: false, current: 0, total: 0, message: '' });
      setIsProcessing(false);
      
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

                {/* Show other unpaid receipts count */}
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
                    <Text style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
                      Excess payment will cascade to older receipts
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
                borderColor: error ? '#ef4444' : willCascade ? '#f59e0b' : '#d1d5db',
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

          {/* Cascade Preview */}
          {showCascadePreview && cascadePreview.length > 1 && (
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="git-network-outline" size={20} color="#f59e0b" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e', marginLeft: 8 }}>
                  PAYMENT CASCADE PREVIEW
                </Text>
              </View>
              
              <Text style={{ fontSize: 12, color: '#92400e', marginBottom: 16 }}>
                This payment will be distributed across {cascadePreview.length} receipt(s):
              </Text>

              <ScrollView 
                style={{ maxHeight: 200 }}
                nestedScrollViewEnabled
              >
                {cascadePreview.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: 'white',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: index === 0 ? '#10b981' : '#f59e0b',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
                        {index === 0 ? '📄 Current Receipt' : `📄 Receipt #${item.receiptNumber}`}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>
                        -{formatCurrency(item.paymentToApply)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>
                        {formatCurrency(item.currentBalance)} → {formatCurrency(item.newBalance)}
                      </Text>
                      {item.newBalance === 0 && (
                        <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '600' }}>✓ PAID</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={{ 
                marginTop: 12, 
                padding: 8, 
                backgroundColor: '#fef3c7', 
                borderRadius: 6 
              }}>
                <Text style={{ fontSize: 11, color: '#92400e', textAlign: 'center' }}>
                  ⚡ Updates will take {cascadePreview.length > 5 ? 'a few seconds' : '~1 second'}
                </Text>
              </View>
            </View>
          )}

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
              backgroundColor: '#10b981',
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
            {(isProcessing || cascadeProgress.visible) ? (
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
              {isProcessing || cascadeProgress.visible ? 'Recording Payment...' : 'Record Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cascade Progress Modal */}
      <Modal
        visible={cascadeProgress.visible}
        transparent
        animationType="fade"
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 32,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}>
            {/* Progress Icon */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#dbeafe',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Ionicons name="git-network" size={32} color="#3b82f6" />
              </View>
            </View>

            {/* Title */}
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              Distributing Payment
            </Text>

            {/* Message */}
            <Text style={{
              fontSize: 14,
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              {cascadeProgress.message}
            </Text>

            {/* Progress Bar */}
            <View style={{
              height: 8,
              backgroundColor: '#e5e7eb',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 12,
            }}>
              <Animated.View style={{
                height: '100%',
                backgroundColor: '#10b981',
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              }} />
            </View>

            {/* Counter */}
            <Text style={{
              fontSize: 13,
              color: '#6b7280',
              textAlign: 'center',
              fontWeight: '600',
            }}>
              {cascadeProgress.current} of {cascadeProgress.total} receipts updated
            </Text>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default RecordPaymentModal;

