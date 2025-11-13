import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReceiptItem from './ReceiptItem';
import ItemsLoadingSkeleton from '../ItemsLoadingSkeleton';
import { ItemDetails } from '../../types';

interface FormItem {
  id: string;
  selectedItemId: string;
  itemName: string;
  price: string;
  quantity: string;
  qty_200g: string;
  qty_100g: string;
  qty_50g: string;
  totalKg: string;
  pricePerKg: string;
  calculatedPrice: string;
  stockError?: string;
}

interface ItemsStepProps {
  customerName: string;
  formItems: FormItem[];
  availableItems: ItemDetails[];
  isLoadingItems: boolean;
  itemsError: string | null;
  amountPaid: number;
  receiptTotal: number;
  onItemSelect: (formId: string, itemId: string) => void;
  onUpdateField: (id: string, field: string, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onTogglePaymentStatus: () => void;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  setItemsLoading: (loading: boolean) => void;
  setItemsError: (error: string | null) => void;
}

const ItemsStep: React.FC<ItemsStepProps> = ({
  customerName,
  formItems,
  availableItems,
  isLoadingItems,
  itemsError,
  amountPaid,
  receiptTotal,
  onItemSelect,
  onUpdateField,
  onAddItem,
  onRemoveItem,
  onTogglePaymentStatus,
  onBack,
  onNext,
  canProceed,
  setItemsLoading,
  setItemsError,
}) => {
  const isPaid = amountPaid >= receiptTotal;
  
  // Debug logging
  console.log('📦 ItemsStep render:', {
    isLoadingItems,
    availableItemsCount: availableItems.length,
    itemsError,
    formItemsCount: formItems.length
  });
  
  // Ensure loading state is triggered when component mounts with no items
  useEffect(() => {
    console.log('🔄 ItemsStep mounted/updated', {
      isLoadingItems,
      availableItemsLength: availableItems.length,
      itemsError
    });
    
    // Only trigger loading on initial mount if items are empty
    // Don't trigger if already loading to avoid infinite loop
    if (availableItems.length === 0 && !isLoadingItems && !itemsError) {
      console.log('⚠️ Triggering items reload - items empty but not loading');
      // Use setTimeout to avoid calling setState during render
      setTimeout(() => setItemsLoading(true), 0);
    }
  }, [availableItems.length, isLoadingItems, itemsError, setItemsLoading]);

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
        enabled={true}
      >
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 300 : 100 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            {/* Customer Header */}
            <View style={{
              backgroundColor: 'white',
              padding: 14,
              borderRadius: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#111827',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="person" size={18} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600', marginBottom: 3, letterSpacing: 0.5 }}>
                    CUSTOMER
                  </Text>
                  <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600' }}>{customerName}</Text>
                </View>
              </View>
              
              {/* Payment Status Toggle */}
              <TouchableOpacity
                onPress={onTogglePaymentStatus}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: isPaid ? '#10b981' : '#fef3c7',
                  borderWidth: 1,
                  borderColor: isPaid ? '#10b981' : '#fcd34d',
                }}
              >
                <Ionicons 
                  name={isPaid ? 'checkmark-circle' : 'alert-circle'} 
                  size={16} 
                  color={isPaid ? 'white' : '#92400e'} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isPaid ? 'white' : '#92400e',
                }}>
                  {isPaid ? '✓ PAID RECEIPT' : 'UNPAID RECEIPT'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Items Loading/Error States */}
            {isLoadingItems ? (
              <ItemsLoadingSkeleton />
            ) : itemsError ? (
              <View style={{
                backgroundColor: '#fef2f2',
                borderWidth: 1,
                borderColor: '#fecaca',
                borderRadius: 12,
                padding: 40,
                alignItems: 'center',
              }}>
                <Ionicons name="alert-circle" size={48} color="#dc2626" />
                <Text style={{ color: '#991b1b', textAlign: 'center', marginTop: 12, fontWeight: '500' }}>
                  {itemsError}
                </Text>
                <TouchableOpacity 
                  onPress={() => {
                    setItemsError(null);
                    setItemsLoading(true);
                  }}
                  activeOpacity={0.9}
                  style={{
                    marginTop: 16,
                    backgroundColor: '#dc2626',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : availableItems.length === 0 ? (
              <View style={{
                backgroundColor: '#fffbeb',
                borderWidth: 1,
                borderColor: '#fcd34d',
                borderRadius: 12,
                padding: 40,
                alignItems: 'center',
              }}>
                <Ionicons name="cube-outline" size={48} color="#d97706" />
                <Text style={{ color: '#92400e', textAlign: 'center', marginTop: 12, fontWeight: '600', fontSize: 16 }}>
                  No Items Available
                </Text>
                <Text style={{ color: '#92400e', textAlign: 'center', marginTop: 8, fontSize: 14 }}>
                  Please add items to your inventory first from the Items tab.
                </Text>
              </View>
            ) : (
              <>
                {/* Receipt Items */}
                {formItems.map((item, index) => (
                  <ReceiptItem
                    key={item.id}
                    item={item}
                    index={index}
                    availableItems={availableItems}
                    canRemove={formItems.length > 1}
                    onItemSelect={onItemSelect}
                    onUpdateField={onUpdateField}
                    onRemove={onRemoveItem}
                  />
                ))}

                {/* Add Item Button */}
                <TouchableOpacity
                  onPress={onAddItem}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'white',
                    borderWidth: 2,
                    borderColor: '#111827',
                    borderStyle: 'dashed',
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#111827" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    Add Another Item
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Action Buttons - Fixed Position */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
      }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.9}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 18,
              backgroundColor: 'white',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#111827" style={{ marginRight: 6 }} />
            <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNext}
            disabled={!canProceed}
            activeOpacity={0.9}
            style={{
              flex: 1,
              backgroundColor: canProceed ? '#111827' : '#f3f4f6',
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: canProceed ? 0.15 : 0,
              shadowRadius: 4,
              elevation: canProceed ? 3 : 0,
              borderWidth: canProceed ? 0 : 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text style={{
              color: canProceed ? 'white' : '#9ca3af',
              fontWeight: '600',
              fontSize: 15,
              marginRight: 6,
              letterSpacing: 0.5,
            }}>
              Review & Total
            </Text>
            <Ionicons name="arrow-forward" size={18} color={canProceed ? 'white' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ItemsStep;
