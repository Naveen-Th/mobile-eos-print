import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ItemDetails } from '../../types';

interface EditItemModalProps {
  visible: boolean;
  item: ItemDetails | null;
  onClose: () => void;
  onSave: (itemData: Omit<ItemDetails, 'id'>) => Promise<void>;
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

const EditItemModal: React.FC<EditItemModalProps> = ({
  visible,
  item,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<FormData>({
    item_name: '',
    price: '',
    stocks: '0',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item && visible) {
      setFormData({
        item_name: item.item_name,
        price: item.price.toString(),
        stocks: (item.stocks || 0).toString(),
      });
      setErrors({});
    }
  }, [item, visible]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate item name
    if (!formData.item_name.trim()) {
      newErrors.item_name = 'Item name is required';
    } else if (formData.item_name.trim().length < 2) {
      newErrors.item_name = 'Item name must be at least 2 characters';
    } else if (formData.item_name.trim().length > 100) {
      newErrors.item_name = 'Item name must be less than 100 characters';
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
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      
      const itemData: Omit<ItemDetails, 'id'> = {
        item_name: formData.item_name.trim(),
        price: parseFloat(formData.price),
        stocks: parseInt(formData.stocks),
      };

      await onSave(itemData);
      
      Alert.alert('Success', 'Item updated successfully!');
      onClose();
      
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    setErrors({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="pencil" size={20} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Edit Item</Text>
                  <Text style={styles.modalSubtitle}>Update item details</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleClose} 
                style={styles.closeButton}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              {/* Item Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Item Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.item_name && styles.inputError,
                  ]}
                  value={formData.item_name}
                  onChangeText={(value) => handleInputChange('item_name', value)}
                  placeholder="Enter item name"
                  placeholderTextColor="#9ca3af"
                  editable={!isSubmitting}
                  maxLength={100}
                />
                {errors.item_name && (
                  <Text style={styles.errorText}>{errors.item_name}</Text>
                )}
              </View>

              {/* Price */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Price <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={[
                      styles.priceInput,
                      errors.price && styles.inputError,
                    ]}
                    value={formData.price}
                    onChangeText={(value) => handleInputChange('price', value)}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    editable={!isSubmitting}
                  />
                </View>
                {errors.price && (
                  <Text style={styles.errorText}>{errors.price}</Text>
                )}
              </View>

              {/* Stock */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Stock Quantity <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.stockInputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.stocks && styles.inputError,
                      styles.stockInput,
                    ]}
                    value={formData.stocks}
                    onChangeText={(value) => handleInputChange('stocks', value)}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    editable={!isSubmitting}
                  />
                  <Text style={styles.stockUnit}>kg</Text>
                </View>
                {errors.stocks && (
                  <Text style={styles.errorText}>{errors.stocks}</Text>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isSubmitting && styles.saveButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="white" />
                )}
                <Text style={styles.saveButtonText}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  currencySymbol: {
    paddingLeft: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 0,
  },
  stockInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockInput: {
    flex: 1,
    marginRight: 12,
  },
  stockUnit: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 6,
    fontSize: 14,
    color: '#ef4444',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    marginLeft: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginLeft: 6,
  },
});

export default EditItemModal;
