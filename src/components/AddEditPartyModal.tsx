import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PersonDetailsService, { PersonDetail, CreatePersonDetailData } from '../services/PersonDetailsService';
import ContactImportModal from './ContactImportModal';

interface AddEditPartyModalProps {
  visible: boolean;
  editingPerson?: PersonDetail | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddEditPartyModal: React.FC<AddEditPartyModalProps> = ({
  visible,
  editingPerson,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CreatePersonDetailData>({
    personName: '',
    businessName: '',
    phoneNumber: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showContactImport, setShowContactImport] = useState(false);

  const isEditing = !!editingPerson;

  // Reset form when modal opens/closes or editing person changes
  useEffect(() => {
    if (visible) {
      if (editingPerson) {
        setFormData({
          personName: editingPerson.personName,
          businessName: editingPerson.businessName,
          phoneNumber: editingPerson.phoneNumber,
        });
      } else {
        setFormData({
          personName: '',
          businessName: '',
          phoneNumber: '',
        });
      }
      setErrors([]);
    }
  }, [visible, editingPerson]);

  const handleInputChange = (field: keyof CreatePersonDetailData, value: string) => {
    // Special handling for phone number formatting
    if (field === 'phoneNumber') {
      // Remove non-digits
      const cleaned = value.replace(/\D/g, '');
      
      // Limit to 10 digits for Indian mobile numbers
      const limited = cleaned.slice(0, 10);
      
      // Format as user types: XXXXX XXXXX
      let formatted = limited;
      if (limited.length > 5) {
        formatted = limited.slice(0, 5) + ' ' + limited.slice(5);
      }
      
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else if (field === 'personName') {
      // Capitalize first letter of each word for person name
      const capitalizedValue = value
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      setFormData(prev => ({ ...prev, [field]: capitalizedValue }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validate form data
      const validation = PersonDetailsService.validatePersonDetail(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      let result;
      if (isEditing && editingPerson) {
        result = await PersonDetailsService.updatePersonDetail(editingPerson.id, formData);
      } else {
        result = await PersonDetailsService.createPersonDetail(formData);
      }

      if (result.success) {
        Alert.alert(
          'Success',
          `Party ${isEditing ? 'updated' : 'created'} successfully!`,
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                onSuccess?.();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || `Failed to ${isEditing ? 'update' : 'create'} party`);
      }
    } catch (error) {
      console.error('Error saving party:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  const hasUnsavedChanges = (): boolean => {
    if (!isEditing) {
      return formData.personName.trim() !== '' || 
             formData.businessName.trim() !== '' || 
             formData.phoneNumber.trim() !== '';
    }

    return editingPerson?.personName !== formData.personName ||
           editingPerson?.businessName !== formData.businessName ||
           editingPerson?.phoneNumber !== formData.phoneNumber;
  };

  const renderError = () => {
    if (errors.length === 0) return null;
    
    return (
      <View style={styles.errorContainer}>
        {errors.map((error, index) => (
          <View key={index} style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Party' : 'Add Party'}
          </Text>
          
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Error Messages */}
          {renderError()}

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Person Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                Person Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={formData.personName}
                  onChangeText={(value) => handleInputChange('personName', value)}
                  placeholder="Enter person name"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Business Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                Business Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={formData.businessName}
                  onChangeText={(value) => handleInputChange('businessName', value)}
                  placeholder="Enter business name"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                Phone Number <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.phoneInput]}
                  value={formData.phoneNumber}
                  onChangeText={(value) => handleInputChange('phoneNumber', value)}
                  placeholder="Enter 10-digit mobile number"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  maxLength={15} // Allow for formatted input
                  onSubmitEditing={handleSave}
                />
              </View>
              <Text style={styles.phoneHint}>
                Enter mobile number starting with 6, 7, 8, or 9 (e.g., 9876543210)
              </Text>
            </View>

            {/* Import from Contacts Button */}
            {!isEditing && (
              <View style={styles.importContainer}>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={() => setShowContactImport(true)}
                >
                  <Ionicons name="people-outline" size={20} color="#3b82f6" />
                  <Text style={styles.importButtonText}>Import from Contacts</Text>
                </TouchableOpacity>
                <Text style={styles.importHintText}>
                  Quickly add party details from your phone's contacts
                </Text>
              </View>
            )}

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
              <Text style={styles.helpText}>
                All fields are required. Enter a valid Indian mobile number (10 digits starting with 6, 7, 8, or 9).
              </Text>
            </View>
          </View>
        </ScrollView>
        
        {/* Contact Import Modal */}
        <ContactImportModal
          visible={showContactImport}
          onClose={() => setShowContactImport(false)}
          onImportComplete={(results) => {
            // Show success message and refresh
            let message = 'Contacts imported successfully!';
            if (results.imported > 0) {
              message = `${results.imported} contact${results.imported === 1 ? '' : 's'} imported successfully!`;
              if (results.skipped > 0) {
                message += ` ${results.skipped} duplicate${results.skipped === 1 ? '' : 's'} skipped.`;
              }
            }
            
            Alert.alert('Import Complete', message, [
              {
                text: 'OK',
                onPress: () => {
                  onSuccess?.(); // Refresh the party list
                }
              }
            ]);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 8,
    flex: 1,
  },
  formContainer: {
    paddingTop: 16,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  phonePrefix: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  phoneInput: {
    flex: 1,
    marginLeft: 0,
  },
  phoneHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  importContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    marginLeft: 8,
  },
  importHintText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AddEditPartyModal;
