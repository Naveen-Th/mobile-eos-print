import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../../utils';

interface ReceiptSummaryProps {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  oldBalance?: number;
  amountPaid?: number;
  newBalance?: number;
  isPaid?: boolean;
  onEditTax?: () => void;
}

const ReceiptSummary: React.FC<ReceiptSummaryProps> = ({
  subtotal,
  tax,
  taxRate,
  total,
  oldBalance = 0,
  amountPaid = 0,
  newBalance = 0,
  isPaid = false,
  onEditTax,
}) => {
  return (
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
        TOTAL BREAKDOWN
      </Text>
      
      {/* Subtotal */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: '#6b7280' }}>Subtotal:</Text>
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>
          {formatCurrency(subtotal)}
        </Text>
      </View>
      
      {/* Tax */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Tax ({taxRate}%):</Text>
          {onEditTax && (
            <TouchableOpacity
              onPress={onEditTax}
              style={{ marginLeft: 6, padding: 3 }}
            >
              <Ionicons name="pencil" size={13} color="#2563eb" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>
          {formatCurrency(tax)}
        </Text>
      </View>
      
      {/* Total */}
      <View style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#111827',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Total:</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>
          {formatCurrency(total)}
        </Text>
      </View>

      {/* New Balance if applicable */}
      {newBalance !== total && (
        <View style={{
          marginTop: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: newBalance > 0 ? '#fef2f2' : '#ecfdf5',
          borderWidth: 1,
          borderColor: newBalance > 0 ? '#fecaca' : '#a7f3d0',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: newBalance > 0 ? '#991b1b' : '#065f46' }}>
            New Balance:
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: newBalance > 0 ? '#dc2626' : '#10b981' }}>
            {formatCurrency(newBalance)}
          </Text>
        </View>
      )}
    </View>
  );
};

export default ReceiptSummary;
