import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useCart } from '../context/CartContext';
import { Alert } from './common';
import { ReceiptItem, ItemDetails } from '../types';
import { useItemDetails } from '../hooks/useItemDetails';
import { formatCurrency, validateReceiptItem, validateCustomerInfo } from '../utils';

interface ItemFormData {
  selectedItemId: string;
  name: string;
  price: string;
  quantity: string;
}

interface CustomerFormData {
  customerName: string;
}

interface ItemEntry {
  id: string;
  selectedItemId: string;
  name: string;
  price: string;
  quantity: string;
  isValid: boolean;
}

interface AddItemScreenProps {
  onClose: () => void;
}

export const AddItemScreen: React.FC<AddItemScreenProps> = ({ onClose }) => {
  const { state: cartState, addItem, updateCustomerInfo } = useCart();
  const { itemDetails, isLoading: isLoadingItems, error: itemsError } = useItemDetails();
  
  const [itemEntries, setItemEntries] = useState<ItemEntry[]>([
    {
      id: '1',
      selectedItemId: '',
      name: '',
      price: '',
      quantity: '1',
      isValid: false,
    }
  ]);
  
  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({
    customerName: cartState.customerName || '',
  });
  
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update customer form when cart state changes
  useEffect(() => {
    setCustomerFormData({
      customerName: cartState.customerName || '',
    });
  }, [cartState.customerName]);

  // Add new item entry
  const addNewItemEntry = () => {
    const newEntry: ItemEntry = {
      id: Date.now().toString(),
      selectedItemId: '',
      name: '',
      price: '',
      quantity: '1',
      isValid: false,
    };
    setItemEntries([...itemEntries, newEntry]);
  };

  // Remove item entry
  const removeItemEntry = (id: string) => {
    if (itemEntries.length > 1) {
      setItemEntries(itemEntries.filter(entry => entry.id !== id));
      // Clear errors for removed item
      const newErrors = { ...formErrors };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`item_${id}_`)) {
          delete newErrors[key];
        }
      });
      setFormErrors(newErrors);
    }
  };

  // Update item entry
  const updateItemEntry = (id: string, updates: Partial<ItemFormData>) => {
    setItemEntries(itemEntries.map(entry => 
      entry.id === id 
        ? { ...entry, ...updates }
        : entry
    ));
  };

  // Handle item selection from dropdown
  const handleItemSelect = (entryId: string, selectedItemId: string) => {
    const selectedItem = itemDetails.find(item => item.id === selectedItemId);
    if (selectedItem) {
      updateItemEntry(entryId, {
        selectedItemId: selectedItemId,
        name: selectedItem.item_name,
        price: selectedItem.price.toString(),
      });
    }
  };

  const validateForm = (): boolean => {
    const errorMap: { [key: string]: string } = {};
    
    // Validate customer information
    const customerErrors = validateCustomerInfo({
      customerName: customerFormData.customerName.trim(),
    });
    customerErrors.forEach(error => {
      errorMap[error.field] = error.message;
    });
    
    // Validate each item entry
    itemEntries.forEach(entry => {
      const item = {
        name: entry.name,
        price: parseFloat(entry.price) || 0,
        quantity: parseInt(entry.quantity) || 0,
      };

      const errors = validateReceiptItem(item);
      errors.forEach(error => {
        errorMap[`item_${entry.id}_${error.field}`] = error.message;
      });
    });

    setFormErrors(errorMap);
    return Object.keys(errorMap).length === 0;
  };

  const handleAddItems = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      // Update customer information
      const customerInfo = {
        customerName: customerFormData.customerName.trim() || undefined,
      };
      updateCustomerInfo(customerInfo);

      // Add all items to cart
      const validEntries = itemEntries.filter(entry => entry.name && entry.price);
      let addedCount = 0;
      
      for (const entry of validEntries) {
        const item = {
          name: entry.name.trim(),
          price: parseFloat(entry.price),
          quantity: parseInt(entry.quantity),
        };
        addItem(item);
        addedCount++;
      }

      // Show success message and close
      Alert.success(
        `${addedCount} item(s) have been added to your cart!`,
        '🛒 Items Added'
      );
      
      onClose();

    } catch (error) {
      console.error('Error adding items:', error);
      Alert.error(
        'Failed to add items. Please try again.',
        '❌ Error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setItemEntries([
      {
        id: '1',
        selectedItemId: '',
        name: '',
        price: '',
        quantity: '1',
        isValid: false,
      }
    ]);
    setCustomerFormData({
      customerName: '',
    });
    setFormErrors({});
  };

  if (isLoadingItems) {
    return (
      <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <View className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90%] overflow-hidden mx-4">
          <View className="p-8 flex flex-col items-center justify-center h-64">
            <ActivityIndicator size="large" color="#3B82F6" className="mb-4" />
            <Text className="text-gray-600 text-lg">Loading items...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (itemsError) {
    return (
      <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <View className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90%] overflow-hidden mx-4">
          <View className="p-8 flex flex-col items-center justify-center h-64">
            <View className="text-red-500 mb-4">
              <Text className="text-4xl text-red-500">⚠️</Text>
            </View>
            <Text className="text-red-600 text-lg font-medium mb-4">Error loading items</Text>
            <Text className="text-gray-600 mb-6">{itemsError}</Text>
            <View className="flex flex-row space-x-3">
              <TouchableOpacity
                onPress={onClose}
                className="px-4 py-2 bg-gray-200 rounded-lg"
              >
                <Text className="text-gray-700">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
      <View className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90%] overflow-hidden mx-4">
        {/* Header */}
        <View className="bg-blue-500 px-6 py-4 flex flex-row items-center justify-between">
          <Text className="text-xl font-bold text-white">Add Receipt to Cart</Text>
          <View className="flex flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={addNewItemEntry}
              disabled={isSubmitting}
              className="p-2 bg-white/20 rounded-lg"
            >
              <Text className="text-white text-lg">+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 bg-white/20 rounded-lg"
            >
              <Text className="text-white text-lg">×</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView className="p-6 max-h-[calc(90%-140px)]">
          {/* Customer Information Section */}
          <View className="bg-gray-50 rounded-xl p-6 mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Customer Information</Text>
            <Text className="text-gray-600 mb-4">Customer name is required for the Receipt</Text>
            
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Customer Name <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                placeholder="Enter customer name"
                value={customerFormData.customerName}
                onChangeText={(text) => setCustomerFormData({ ...customerFormData, customerName: text })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
              />
              {formErrors.customerName && (
                <Text className="text-red-500 text-sm mt-1">{formErrors.customerName}</Text>
              )}
            </View>
          </View>

          {/* Items Section */}
          <View className="space-y-6">
            {itemEntries.map((entry, index) => (
              <View key={entry.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <View className="flex flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-semibold text-gray-900">Item {index + 1}</Text>
                  {itemEntries.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeItemEntry(entry.id)}
                      className="p-2 bg-red-50 rounded-lg"
                    >
                      <Text className="text-red-500">🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <View className="space-y-4">
                  {/* Item Selection */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Item Name <Text className="text-red-500">*</Text>
                    </Text>
                    {/* Note: In React Native, you'd use a Picker or custom dropdown */}
                    <TextInput
                      placeholder="Select an item"
                      value={entry.name}
                      onChangeText={(text) => updateItemEntry(entry.id, { name: text })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                    />
                    {formErrors[`item_${entry.id}_name`] && (
                      <Text className="text-red-500 text-sm mt-1">{formErrors[`item_${entry.id}_name`]}</Text>
                    )}
                  </View>

                  {/* Price */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Price <Text className="text-red-500">*</Text>
                    </Text>
                    <View className="relative">
                      <TextInput
                        placeholder="0.00"
                        value={entry.price}
                        onChangeText={(text) => updateItemEntry(entry.id, { price: text })}
                        keyboardType="numeric"
                        editable={false}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </View>
                    {formErrors[`item_${entry.id}_price`] && (
                      <Text className="text-red-500 text-sm mt-1">{formErrors[`item_${entry.id}_price`]}</Text>
                    )}
                  </View>

                  {/* Quantity */}
                  <View>
                    <Text className="text-sm font-medium text-gray-700 mb-2">
                      Quantity <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      placeholder="1"
                      value={entry.quantity}
                      onChangeText={(text) => updateItemEntry(entry.id, { quantity: text })}
                      keyboardType="numeric"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                    />
                    {formErrors[`item_${entry.id}_quantity`] && (
                      <Text className="text-red-500 text-sm mt-1">{formErrors[`item_${entry.id}_quantity`]}</Text>
                    )}
                  </View>
                </View>

                {/* Item Total Preview */}
                {entry.price && entry.quantity && (
                  <View className="mt-4 pt-4 border-t border-gray-200">
                    <View className="flex flex-row justify-between items-center">
                      <Text className="font-medium text-gray-700">Item Total:</Text>
                      <Text className="text-xl font-bold text-blue-600">
                        {formatCurrency(parseFloat(entry.price) * parseInt(entry.quantity || '1'))}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Total Summary */}
          {itemEntries.some(entry => entry.price && entry.quantity) && (
            <View className="bg-blue-50 rounded-xl p-6 mt-6">
              <Text className="text-lg font-semibold text-gray-900 mb-4">Order Summary</Text>
              <View className="flex flex-row justify-between items-center">
                <Text className="text-lg font-semibold text-gray-700">Total Amount:</Text>
                <Text className="text-2xl font-bold text-blue-600">
                  {formatCurrency(
                    itemEntries.reduce((total, entry) => {
                      if (entry.price && entry.quantity) {
                        return total + (parseFloat(entry.price) * parseInt(entry.quantity));
                      }
                      return total;
                    }, 0)
                  )}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View className="bg-gray-50 px-6 py-4 flex flex-row items-center justify-between border-t border-gray-200">
          <TouchableOpacity
            onPress={resetForm}
            disabled={isSubmitting}
            className="px-6 py-3 bg-white border border-gray-300 rounded-lg"
          >
            <Text className="text-gray-700">Clear Form</Text>
          </TouchableOpacity>
          
          <View className="flex flex-row space-x-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 bg-gray-200 rounded-lg"
            >
              <Text className="text-gray-700">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAddItems}
              disabled={isSubmitting || !itemEntries.some(entry => entry.name && entry.price)}
              className="px-6 py-3 bg-blue-500 rounded-lg flex flex-row items-center space-x-2"
            >
              {isSubmitting && (
                <ActivityIndicator size="small" color="#FFFFFF" />
              )}
              <Text className="text-white">{isSubmitting ? 'Adding Items...' : 'Add All Items to Cart'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};
