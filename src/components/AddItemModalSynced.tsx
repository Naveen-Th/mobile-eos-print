import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateItem } from '../hooks/useSyncManager';
import { ItemDetails } from '../types';

interface AddItemModalSyncedProps {
  visible: boolean;
  onClose: () => void;
}

interface FormData {
  item_name: string;
  price: string;
  stocks: string;
}

interface FormErrors {
  item_name?: string;
  price?: string;
  stocks?: string;
}

const AddItemModalSynced: React.FC<AddItemModalSyncedProps> = ({ 
  visible, 
  onClose 
}) => {
  const [formData, setFormData] = useState<FormData>({
    item_name: '',
    price: '',
    stocks: '0'
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createItemMutation = useCreateItem();

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

    setIsSubmitting(true);
    try {
      const itemData = {
        item_name: formData.item_name.trim(),
        price: parseFloat(formData.price),
        stocks: parseInt(formData.stocks)
      };

      await createItemMutation.mutateAsync(itemData);
      
      // Reset form and close modal on success
      setFormData({
        item_name: '',
        price: '',
        stocks: '0'
      });
      setErrors({});
      onClose();
      
      Alert.alert('Success', 'Item added successfully!');
    } catch (error: any) {
      console.error('Error creating item:', error);
      Alert.alert('Error', error.message || 'Failed to add item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      item_name: '',
      price: '',
      stocks: '0'
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}>
        <View style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 400
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              Add New Item
            </Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: '#f3f4f6'
              }}
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={{ gap: 20 }}>
            {/* Item Name */}
            <View>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8
              }}>
                Item Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                value={formData.item_name}
                onChangeText={(value) => handleInputChange('item_name', value)}
                placeholder="Enter item name"
                style={{
                  borderWidth: 1,
                  borderColor: errors.item_name ? '#ef4444' : '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  backgroundColor: errors.item_name ? '#fef2f2' : 'white'
                }}
                editable={!isSubmitting}
                maxLength={100}
              />
              {errors.item_name && (
                <Text style={{
                  color: '#ef4444',
                  fontSize: 12,
                  marginTop: 4
                }}>
                  {errors.item_name}
                </Text>
              )}
            </View>

            {/* Price */}
            <View>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8
              }}>
                Price <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View style={{ position: 'relative' }}>
                <Text style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  fontSize: 16,
                  color: '#6b7280',
                  zIndex: 1
                }}>
                  ₹
                </Text>
                <TextInput
                  value={formData.price}
                  onChangeText={(value) => handleInputChange('price', value)}
                  placeholder="0.00"
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1,
                    borderColor: errors.price ? '#ef4444' : '#d1d5db',
                    borderRadius: 8,
                    paddingLeft: 32,
                    paddingRight: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                    backgroundColor: errors.price ? '#fef2f2' : 'white'
                  }}
                  editable={!isSubmitting}
                />
              </View>
              {errors.price && (
                <Text style={{
                  color: '#ef4444',
                  fontSize: 12,
                  marginTop: 4
                }}>
                  {errors.price}
                </Text>
              )}
            </View>

            {/* Stock Quantity */}
            <View>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8
              }}>
                Stock Quantity <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                value={formData.stocks}
                onChangeText={(value) => handleInputChange('stocks', value)}
                placeholder="0"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: errors.stocks ? '#ef4444' : '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  backgroundColor: errors.stocks ? '#fef2f2' : 'white'
                }}
                editable={!isSubmitting}
              />
              {errors.stocks && (
                <Text style={{
                  color: '#ef4444',
                  fontSize: 12,
                  marginTop: 4
                }}>
                  {errors.stocks}
                </Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{
            flexDirection: 'row',
            gap: 12,
            marginTop: 32
          }}>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={isSubmitting}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#d1d5db',
                backgroundColor: 'white',
                alignItems: 'center',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#374151'
              }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 8,
                backgroundColor: '#3b82f6',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting && (
                <ActivityIndicator
                  size="small"
                  color="white"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: 'white'
              }}>
                {isSubmitting ? 'Adding...' : 'Add Item'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AddItemModalSynced;
