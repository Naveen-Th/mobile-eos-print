import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { ItemDetails } from '../../types';
import { formatCurrency } from '../../utils';

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

interface ReceiptItemProps {
  item: FormItem;
  index: number;
  availableItems: ItemDetails[];
  canRemove: boolean;
  onItemSelect: (formId: string, itemId: string) => void;
  onUpdateField: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
}

const ReceiptItem: React.FC<ReceiptItemProps> = ({
  item,
  index,
  availableItems,
  canRemove,
  onItemSelect,
  onUpdateField,
  onRemove,
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
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 1 }}>
          ITEM {index + 1}
        </Text>
        {canRemove && (
          <TouchableOpacity
            onPress={() => onRemove(item.id)}
            activeOpacity={0.7}
            style={{
              padding: 5,
              backgroundColor: '#fef2f2',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#fecaca',
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
          </TouchableOpacity>
        )}
      </View>

      {/* Item Dropdown */}
      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>
          Item Name <Text style={{ color: '#ef4444' }}>*</Text>
        </Text>
        <Dropdown
          style={{
            borderWidth: 1,
            borderColor: '#d1d5db',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 14,
            backgroundColor: 'white',
          }}
          placeholderStyle={{ fontSize: 16, color: '#9ca3af' }}
          selectedTextStyle={{ fontSize: 16, color: '#1f2937', fontWeight: '500' }}
          inputSearchStyle={{
            height: 40,
            fontSize: 16,
            borderRadius: 0,
            paddingHorizontal: 12,
            borderWidth: 0,
            backgroundColor: '#f9fafb',
            color: '#374151'
          }}
          iconStyle={{ width: 20, height: 20 }}
          data={availableItems.map(availableItem => ({
            label: availableItem.item_name,
            value: availableItem.id,
            price: availableItem.price,
            stocks: availableItem.stocks || 0,
            disabled: (availableItem.stocks || 0) <= 0
          }))}
          search
          maxHeight={300}
          searchPlaceholder="Search items"
          containerStyle={{
            borderRadius: 12,
            backgroundColor: 'white',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3
          }}
          labelField="label"
          valueField="value"
          placeholder="Select an item"
          value={item.selectedItemId}
          onChange={(dropdownItem) => onItemSelect(item.id, dropdownItem.value)}
          renderRightIcon={() => (
            <Ionicons name="chevron-down" size={20} color="#9ca3af" />
          )}
          renderItem={(dropdownItem) => (
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: dropdownItem.disabled ? '#fef2f2' : 'white',
              opacity: dropdownItem.disabled ? 0.6 : 1
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: dropdownItem.disabled ? '#9ca3af' : '#1f2937',
                marginBottom: 6
              }}>
                {dropdownItem.label}
              </Text>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Text style={{
                  fontSize: 14,
                  color: '#10b981',
                  fontWeight: '600'
                }}>
                  {formatCurrency(dropdownItem.price || 0)}
                </Text>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                  backgroundColor: dropdownItem.stocks <= 10 ? '#fee2e2' : dropdownItem.stocks <= 50 ? '#fef3c7' : '#ecfdf5'
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: dropdownItem.stocks <= 10 ? '#dc2626' : dropdownItem.stocks <= 50 ? '#d97706' : '#059669',
                    fontWeight: '600'
                  }}>
                    Stock: {dropdownItem.stocks}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      </View>

      {/* Quantity Inputs Table */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
      }}>
        <View style={{ flex: 1.2, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>200G</Text>
        </View>
        <View style={{ flex: 1.2, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>100G</Text>
        </View>
        <View style={{ flex: 1.2, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>50G</Text>
        </View>
        <View style={{ flex: 1.5, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>Total Kg</Text>
        </View>
        <View style={{ flex: 1.8, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>Per Kg</Text>
        </View>
      </View>

      {/* Input Row */}
      <View style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'center' }}>
        {/* 200G */}
        <View style={{ flex: 1.2, paddingHorizontal: 2 }}>
          <TextInput
            value={item.qty_200g || '0'}
            onChangeText={(value) => onUpdateField(item.id, 'qty_200g', value)}
            placeholder="0"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 10,
              fontSize: 15,
              textAlign: 'center',
              backgroundColor: 'white',
            }}
          />
        </View>

        {/* 100G */}
        <View style={{ flex: 1.2, paddingHorizontal: 2 }}>
          <TextInput
            value={item.qty_100g || '0'}
            onChangeText={(value) => onUpdateField(item.id, 'qty_100g', value)}
            placeholder="0"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 10,
              fontSize: 15,
              textAlign: 'center',
              backgroundColor: 'white',
            }}
          />
        </View>

        {/* 50G */}
        <View style={{ flex: 1.2, paddingHorizontal: 2 }}>
          <TextInput
            value={item.qty_50g || '0'}
            onChangeText={(value) => onUpdateField(item.id, 'qty_50g', value)}
            placeholder="0"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 10,
              fontSize: 15,
              textAlign: 'center',
              backgroundColor: 'white',
            }}
          />
        </View>

        {/* Total KG (Read-only) */}
        <View style={{ flex: 1.5, paddingHorizontal: 2 }}>
          <View style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 10,
            backgroundColor: '#f9fafb',
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', textAlign: 'center', color: '#111827' }}>
              {item.totalKg || '0'}
            </Text>
          </View>
        </View>

        {/* Price Per KG */}
        <View style={{ flex: 1.8, paddingHorizontal: 2 }}>
          <TextInput
            value={item.pricePerKg || '0'}
            onChangeText={(value) => onUpdateField(item.id, 'pricePerKg', value)}
            placeholder="0.00"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 10,
              fontSize: 15,
              textAlign: 'center',
              backgroundColor: 'white',
            }}
          />
        </View>
      </View>

      {/* Item Total */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginTop: 4,
      }}>
        <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500' }}>Item Total</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
          {formatCurrency(parseFloat(item.calculatedPrice || item.price || '0') || 0)}
        </Text>
      </View>

      {/* Stock Error */}
      {item.stockError && (
        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 8, fontWeight: '600' }}>
          {item.stockError}
        </Text>
      )}
    </View>
  );
};

export default ReceiptItem;
