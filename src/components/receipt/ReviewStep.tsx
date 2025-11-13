import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ItemDetails } from '../../types';
import ReceiptSummary from './ReceiptSummary';
import { formatCurrency } from '../../utils';

interface FormItem {
  id: string;
  selectedItemId: string;
  price: string;
  quantity: string;
  qty_200g: string;
  qty_100g: string;
  qty_50g: string;
  totalKg: string;
  pricePerKg: string;
  calculatedPrice: string;
}

interface ReviewStepProps {
  customerName: string;
  formItems: FormItem[];
  availableItems: ItemDetails[];
  subtotal: number;
  tax: number;
  total: number;
  taxRate: number;
  amountPaid: number;
  oldBalance: number;
  newBalance: number;
  onEditTax: () => void;
  onBack: () => void;
  onClear: () => void;
  onSave: () => void;
  onPrint: () => void;
  isProcessing: boolean;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  customerName,
  formItems,
  availableItems,
  subtotal,
  tax,
  total,
  taxRate,
  amountPaid,
  oldBalance,
  newBalance,
  onEditTax,
  onBack,
  onClear,
  onSave,
  onPrint,
  isProcessing,
}) => {
  const validItems = formItems.filter(item => item.selectedItemId && parseFloat(item.price) > 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Customer Details */}
          <View style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 1 }}>
              CUSTOMER DETAILS
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Name:</Text>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>{customerName}</Text>
            </View>
            {oldBalance > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>Old Balance:</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#dc2626' }}>{formatCurrency(oldBalance)}</Text>
              </View>
            )}
            {amountPaid > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>Amount Paid:</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#10b981' }}>{formatCurrency(amountPaid)}</Text>
              </View>
            )}
          </View>

          {/* Items Summary */}
          <View style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 1 }}>
              ITEMS ({validItems.length})
            </Text>
            {validItems.map((formItem, index) => {
              const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
              return (
                <View key={formItem.id} style={{
                  paddingVertical: 10,
                  borderBottomWidth: index < validItems.length - 1 ? 1 : 0,
                  borderBottomColor: '#f3f4f6',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937', flex: 1 }}>
                      {selectedItem?.item_name || 'Unknown Item'}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }}>
                      {formatCurrency(parseFloat(formItem.calculatedPrice || formItem.price || '0') || 0)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                    {formItem.totalKg || '0'}kg @ {formatCurrency(parseFloat(formItem.pricePerKg || '0'))}/kg
                    {formItem.qty_200g !== '0' && ` (${formItem.qty_200g}×200g`}
                    {formItem.qty_100g !== '0' && ` ${formItem.qty_100g}×100g`}
                    {formItem.qty_50g !== '0' && ` ${formItem.qty_50g}×50g`}
                    {(formItem.qty_200g !== '0' || formItem.qty_100g !== '0' || formItem.qty_50g !== '0') && ')'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Totals */}
          <ReceiptSummary
            subtotal={subtotal}
            tax={tax}
            taxRate={taxRate}
            total={total}
            oldBalance={oldBalance}
            amountPaid={amountPaid}
            newBalance={newBalance}
            isPaid={amountPaid >= total}
            onEditTax={onEditTax}
          />
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
      }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.9}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: 'white',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={16} color="#111827" style={{ marginRight: 6 }} />
            <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClear}
            activeOpacity={0.9}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: 'white',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={onSave}
            disabled={isProcessing}
            activeOpacity={0.9}
            style={{
              flex: 1,
              backgroundColor: '#10b981',
              borderRadius: 12,
              paddingVertical: 14,
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
            {isProcessing && (
              <Text style={{ color: 'white', marginRight: 6 }}>...</Text>
            )}
            <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 14,
              letterSpacing: 0.5,
            }}>
              Save
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPrint}
            disabled={isProcessing}
            activeOpacity={0.9}
            style={{
              flex: 1,
              backgroundColor: '#111827',
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isProcessing ? 0.7 : 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {isProcessing && (
              <Text style={{ color: 'white', marginRight: 6 }}>...</Text>
            )}
            <Ionicons name="print-outline" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 14,
              letterSpacing: 0.5,
            }}>
              Print
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ReviewStep;
