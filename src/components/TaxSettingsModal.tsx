import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTaxRate, setTaxRate } from '../services/utilities/TaxSettings';

interface TaxSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onTaxRateUpdated: (newRate: number) => void;
}

const TaxSettingsModal: React.FC<TaxSettingsModalProps> = ({
  visible,
  onClose,
  onTaxRateUpdated,
}) => {
  const [currentRate, setCurrentRate] = useState<string>('8');
  const [inputRate, setInputRate] = useState<string>('8');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Load current tax rate when modal opens
  useEffect(() => {
    if (visible) {
      loadCurrentRate();
    }
  }, [visible]);

  const loadCurrentRate = async () => {
    setIsLoading(true);
    try {
      const rate = await getTaxRate();
      const rateStr = rate.toString();
      setCurrentRate(rateStr);
      setInputRate(rateStr);
      setValidationError('');
    } catch (error) {
      console.error('Error loading tax rate:', error);
      Alert.alert('Error', 'Failed to load current tax rate');
    } finally {
      setIsLoading(false);
    }
  };

  const validateTaxRate = (rateStr: string): { isValid: boolean; error: string; rate: number } => {
    // Remove whitespace
    const trimmed = rateStr.trim();
    
    if (!trimmed) {
      return { isValid: false, error: 'Tax rate is required', rate: 0 };
    }

    const rate = parseFloat(trimmed);
    
    if (isNaN(rate)) {
      return { isValid: false, error: 'Please enter a valid number', rate: 0 };
    }

    if (rate < 0) {
      return { isValid: false, error: 'Tax rate cannot be negative', rate: 0 };
    }

    if (rate > 100) {
      return { isValid: false, error: 'Tax rate cannot exceed 100%', rate: 0 };
    }

    // Allow up to 3 decimal places for precision
    const decimalPlaces = (trimmed.split('.')[1] || '').length;
    if (decimalPlaces > 3) {
      return { isValid: false, error: 'Maximum 3 decimal places allowed', rate: 0 };
    }

    return { isValid: true, error: '', rate };
  };

  const handleInputChange = (text: string) => {
    setInputRate(text);
    const validation = validateTaxRate(text);
    setValidationError(validation.error);
  };

  const handleSave = async () => {
    const validation = validateTaxRate(inputRate);
    
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    setIsSaving(true);
    try {
      await setTaxRate(validation.rate);
      setCurrentRate(validation.rate.toString());
      
      // Notify parent component
      onTaxRateUpdated(validation.rate);
      
      Alert.alert(
        'Success',
        `Tax rate updated to ${validation.rate}%`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error saving tax rate:', error);
      Alert.alert('Error', 'Failed to save tax rate. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset input to current rate
    setInputRate(currentRate);
    setValidationError('');
    onClose();
  };

  const hasChanges = inputRate !== currentRate;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Header */}
          <View style={{
            backgroundColor: 'white',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={{
                  padding: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: 8,
                }}
              >
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
              
              <Text style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: '#111827',
              }}>
                Tax Settings
              </Text>
              
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasChanges || !!validationError || isSaving}
                style={{
                  padding: 8,
                  backgroundColor: hasChanges && !validationError && !isSaving 
                    ? '#10b981' 
                    : 'rgba(0, 0, 0, 0.1)',
                  borderRadius: 8,
                  opacity: hasChanges && !validationError && !isSaving ? 1 : 0.6,
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons 
                    name="checkmark" 
                    size={20} 
                    color={hasChanges && !validationError ? 'white' : '#374151'} 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View style={{ flex: 1, padding: 20 }}>
            {isLoading ? (
              <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{
                  color: '#6b7280',
                  fontSize: 16,
                  marginTop: 12,
                }}>
                  Loading current settings...
                </Text>
              </View>
            ) : (
              <>
                {/* Info Card */}
                <View style={{
                  backgroundColor: '#dbeafe',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  borderLeftWidth: 4,
                  borderLeftColor: '#3b82f6',
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="information-circle" size={20} color="#3b82f6" />
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#1e40af',
                      marginLeft: 8,
                    }}>
                      Tax Rate Configuration
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 14,
                    color: '#3730a3',
                    lineHeight: 20,
                  }}>
                    Set the tax percentage that will be applied to all receipts. 
                    This rate will be automatically calculated on subtotals.
                  </Text>
                </View>

                {/* Tax Rate Input */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                  marginBottom: 20,
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: 12,
                  }}>
                    Tax Rate (%)
                  </Text>
                  
                  <View style={{
                    position: 'relative',
                  }}>
                    <TextInput
                      value={inputRate}
                      onChangeText={handleInputChange}
                      placeholder="Enter tax rate"
                      keyboardType="decimal-pad"
                      style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#111827',
                        backgroundColor: '#f9fafb',
                        borderWidth: 2,
                        borderColor: validationError ? '#ef4444' : '#e5e7eb',
                        borderRadius: 8,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        paddingRight: 48, // Space for % symbol
                      }}
                      selectTextOnFocus
                      autoFocus={false}
                    />
                    <Text style={{
                      position: 'absolute',
                      right: 16,
                      top: 16,
                      fontSize: 18,
                      fontWeight: '600',
                      color: '#6b7280',
                    }}>
                      %
                    </Text>
                  </View>

                  {validationError ? (
                    <Text style={{
                      fontSize: 14,
                      color: '#ef4444',
                      marginTop: 8,
                      marginLeft: 4,
                    }}>
                      {validationError}
                    </Text>
                  ) : null}
                </View>

                {/* Preview Card */}
                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: 12,
                  }}>
                    Preview
                  </Text>
                  
                  <View style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: 8,
                    padding: 16,
                  }}>
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <Text style={{ color: '#6b7280', fontSize: 14 }}>Subtotal:</Text>
                      <Text style={{ color: '#374151', fontSize: 14 }}>₹100.00</Text>
                    </View>
                    
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <Text style={{ color: '#6b7280', fontSize: 14 }}>
                        Tax ({inputRate || '0'}%):
                      </Text>
                      <Text style={{ color: '#374151', fontSize: 14 }}>
                        ₹{((parseFloat(inputRate) || 0) * 100 / 100).toFixed(2)}
                      </Text>
                    </View>
                    
                    <View style={{
                      borderTopWidth: 1,
                      borderTopColor: '#e5e7eb',
                      paddingTop: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}>
                      <Text style={{ 
                        fontWeight: '600', 
                        color: '#111827', 
                        fontSize: 16 
                      }}>
                        Total:
                      </Text>
                      <Text style={{ 
                        fontWeight: '600', 
                        color: '#10b981', 
                        fontSize: 16 
                      }}>
                        ₹{(100 + ((parseFloat(inputRate) || 0) * 100 / 100)).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Help Text */}
                <View style={{
                  marginTop: 24,
                  paddingHorizontal: 4,
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: '#6b7280',
                    textAlign: 'center',
                    lineHeight: 18,
                  }}>
                    This tax rate will apply to all new receipts. 
                    Changes will take effect immediately for new transactions.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default TaxSettingsModal;
