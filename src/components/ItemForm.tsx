import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ItemDetails } from '../types';

interface ItemFormProps {
  item?: ItemDetails | null; // For editing existing items
  onSubmit: (itemData: Omit<ItemDetails, 'id'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormData {
  item_name: string;
  price: string; // Keep as string for form input, convert to number on submit
  stocks: string; // Keep as string for form input, convert to number on submit
}

interface FormErrors {
  item_name?: string;
  price?: string;
  stocks?: string;
}

const ItemForm: React.FC<ItemFormProps> = ({ item, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState<FormData>({
    item_name: '',
    price: '',
    stocks: '0'
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (item) {
      setFormData({
        item_name: item.item_name,
        price: item.price.toString(),
        stocks: (item.stocks || 0).toString()
      });
    } else {
      setFormData({
        item_name: '',
        price: '',
        stocks: '0'
      });
    }
  }, [item]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate item name
    if (!formData.item_name.trim()) {
      newErrors.item_name = 'Item name is required';
    } else if (formData.item_name.trim().length < 2) {
      newErrors.item_name = 'Item name must be at least 2 characters';
    }

    // Validate price
    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    } else {
      const priceValue = parseFloat(formData.price);
      if (isNaN(priceValue)) {
        newErrors.price = 'Price must be a valid number';
      } else if (priceValue <= 0) {
        newErrors.price = 'Price must be greater than 0';
      } else if (priceValue > 999999) {
        newErrors.price = 'Price must be less than 1,000,000';
      }
    }

    // Validate stocks
    if (!formData.stocks.trim()) {
      newErrors.stocks = 'Stock quantity is required';
    } else {
      const stockValue = parseInt(formData.stocks);
      if (isNaN(stockValue)) {
        newErrors.stocks = 'Stock must be a valid number';
      } else if (stockValue < 0) {
        newErrors.stocks = 'Stock cannot be negative';
      } else if (stockValue > 999999) {
        newErrors.stocks = 'Stock must be less than 1,000,000';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const itemData = {
        item_name: formData.item_name.trim(),
        price: parseFloat(formData.price),
        stocks: parseInt(formData.stocks)
      };

      await onSubmit(itemData);
      
      // Reset form if it's a new item (not editing)
      if (!item) {
        setFormData({
          item_name: '',
          price: '',
          stocks: '0'
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', 'Failed to submit form. Please try again.');
    }
  };

  return (
    <View className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
      <View className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto">
        {/* Header */}
        <View className="px-6 py-4 border-b border-gray-200">
          <Text className="text-xl font-semibold text-gray-900">
            {item ? 'Edit Item' : 'Add New Item'}
          </Text>
          <Text className="text-sm text-gray-600 mt-1">
            {item ? 'Update the item details below' : 'Enter the details for the new item'}
          </Text>
        </View>

        {/* Form */}
        <View className="p-6 space-y-4">
          {/* Item Name Field */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Item Name <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={formData.item_name}
              onChangeText={(value) => handleInputChange('item_name', value)}
              placeholder="Enter item name"
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                errors.item_name ? 'border-red-300' : 'border-gray-300'
              }`}
              editable={!isLoading}
              maxLength={100}
            />
            {errors.item_name && (
              <Text className="text-red-500 text-sm mt-1">{errors.item_name}</Text>
            )}
          </View>

          {/* Price Field */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Price <Text className="text-red-500">*</Text>
            </Text>
            <View className="relative">
              <Text className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm z-10">
                $
              </Text>
              <TextInput
                value={formData.price}
                onChangeText={(value) => handleInputChange('price', value)}
                placeholder="0.00"
                keyboardType="numeric"
                className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm ${
                  errors.price ? 'border-red-300' : 'border-gray-300'
                }`}
                editable={!isLoading}
              />
            </View>
            {errors.price && (
              <Text className="text-red-500 text-sm mt-1">{errors.price}</Text>
            )}
          </View>

          {/* Stock Field */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Stock Quantity <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={formData.stocks}
              onChangeText={(value) => handleInputChange('stocks', value)}
              placeholder="0"
              keyboardType="numeric"
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                errors.stocks ? 'border-red-300' : 'border-gray-300'
              }`}
              editable={!isLoading}
            />
            {errors.stocks && (
              <Text className="text-red-500 text-sm mt-1">{errors.stocks}</Text>
            )}
          </View>

          {/* Form Actions */}
          <View className="flex flex-row space-x-3 pt-4">
            <TouchableOpacity
              onPress={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-100 rounded-lg"
            >
              <Text className="text-gray-700 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-500 rounded-lg flex flex-row items-center justify-center"
            >
              {isLoading && (
                <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
              )}
              <Text className="text-white font-medium">
                {isLoading ? (item ? 'Updating...' : 'Creating...') : (item ? 'Update Item' : 'Create Item')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ItemForm;
