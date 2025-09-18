import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Alert, ReceiptAlerts } from './common';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { PrintOptionsScreen } from './PrintOptionsScreen';
import SearchableDropdown from './SearchableDropdown';
import PartyManagementScreen from '../screens/PartyManagementScreen';
import { ItemDetails } from '../types';
import ItemService from '../services/ItemService';
import CustomerService, { UniqueCustomer } from '../services/CustomerService';
import { useReceiptStore } from '../stores/receiptStore';
import { useReceiptIntegration } from '../hooks/useReceiptIntegration';
import {
  formatCurrency,
  validateCustomerInfo,
} from '../utils/index';

interface ReceiptCreationScreenProps {
  onClose: () => void;
  visible: boolean;
}

const ReceiptCreationScreen: React.FC<ReceiptCreationScreenProps> = ({
  onClose,
  visible,
}) => {
  // Use integration hook for better organization
  const { store, cartCompatibility } = useReceiptIntegration(visible);
  
  // Destructure store values for easier access
  const {
    formItems,
    customer,
    availableItems,
    isLoadingItems,
    itemsError,
    isProcessing,
    errors,
    receiptTotals,
    addFormItem,
    removeFormItem,
    updateFormItem,
    selectItem,
    updateCustomerInfo,
    setItemsLoading,
    setItemsError,
    validateForm,
    createReceipt,
    clearForm,
    setError,
    clearError
  } = store;
  
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  
  // Customer search state
  const [customerSearchResults, setCustomerSearchResults] = useState<UniqueCustomer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Calculate totals whenever form items change
  useEffect(() => {
    store.calculateTotals();
  }, [formItems, store]);
  

  // Items subscription is now handled by the integration hook

  // Form item functions are now handled by the store
  const addNewItemForm = addFormItem;
  const removeItemForm = removeFormItem;

  // Form item update is now handled by the store with better validation
  const handleUpdateFormItem = (id: string, field: string, value: string) => {
    updateFormItem(id, field as any, value);
  };

  // Item selection is now handled by the store with better error handling
  const handleItemSelect = async (formId: string, itemId: string) => {
    console.log('handleItemSelect called with:', formId, itemId);
    await selectItem(formId, itemId);
  };

  // Clear form function now handled by store
  const handleClearForm = () => {
    clearForm();
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
  };

  // Quantity changes are handled through the store now

  const handleCustomerNameChange = (text: string) => {
    updateCustomerInfo({ customerName: text });
    clearError('customer'); // Clear error when typing
  };

  const handleCustomerSearch = async (query: string) => {
    console.log('Searching for customers with query:', query);
    
    if (!query.trim()) {
      setIsSearchingCustomers(true);
      try {
        const recentCustomers = await CustomerService.getRecentCustomers(10);
        setCustomerSearchResults(Array.isArray(recentCustomers) ? recentCustomers : []);
        updateCustomerInfo({ isNewCustomer: false });
      } catch (error) {
        console.error('Error loading recent customers:', error);
        setCustomerSearchResults([]);
        updateCustomerInfo({ isNewCustomer: false });
      } finally {
        setIsSearchingCustomers(false);
      }
      return;
    }

    setIsSearchingCustomers(true);
    try {
      // Use immediate search for short queries (1-3 characters) for better responsiveness
      let results;
      if (query.trim().length <= 3) {
        results = await CustomerService.searchCustomersImmediate(query);
      } else {
        results = await CustomerService.searchCustomers(query);
      }
      
      const safeResults = Array.isArray(results) ? results : [];
      console.log(`Search returned ${safeResults.length} results for query: '${query}'`);
      setCustomerSearchResults(safeResults);
      
      // Check if this is a new customer (case-insensitive comparison)
      const trimmedQuery = query.trim().toLowerCase();
      const existingCustomer = safeResults.find(
        (customer: UniqueCustomer) => customer.customerName.toLowerCase().trim() === trimmedQuery
      );
      updateCustomerInfo({ isNewCustomer: !existingCustomer });
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerSearchResults([]);
      updateCustomerInfo({ isNewCustomer: !!query.trim() });
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleCustomerSelect = (customer: UniqueCustomer) => {
    // Set customer information
    updateCustomerInfo({
      customerName: customer.customerName,
      isNewCustomer: false
    });
    
    // Clear any errors
    clearError('customer');
    
    // Hide dropdown
    setShowCustomerDropdown(false);
  };

  const handleCustomerFocus = async () => {
    setShowCustomerDropdown(true);
    // Don't clear auto-filled flags here - only clear when manually typing
    
    // Force refresh customer data when focused to ensure we have latest data
    try {
      await CustomerService.forceRefresh();
    } catch (error) {
      console.error('Error refreshing customer data on focus:', error);
    }
  };

  const handleCustomerBlur = () => {
    // Delay hiding to allow for selection
    setTimeout(() => {
      setShowCustomerDropdown(false);
    }, 200);
  };

  const handleAddParty = () => {
    setShowPartyManagement(true);
    setShowCustomerDropdown(false);
  };

  // Validation is now handled by the store

  // Form validation is now handled by the store

  // Totals calculation is now handled by the store

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      // Keep real-time listener active for better UX across screen transitions
      // CustomerService.stopRealtimeListener(); // Uncomment if you want to stop on unmount
    };
  }, []);

  const handleCreateReceipt = async () => {
    try {
      const result = await createReceipt();
      
      if (result.success && result.receipt) {
        if (customer.isNewCustomer) {
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${result.receipt.receiptNumber} created successfully!\n\n✨ New customer "${customer.customerName}" has been added to your customer database.\n📦 Stock levels updated automatically.`
          );
          // Clear customer cache to include the new customer in future searches
          CustomerService.clearCache();
        } else {
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${result.receipt.receiptNumber} created successfully!\n\n📦 Stock levels updated automatically.`
          );
        }
        
        handleClearForm();
        onClose();
      } else {
        ReceiptAlerts.receiptSaveError(result.error || 'Failed to create receipt');
      }
    } catch (error) {
      console.error('Error creating receipt:', error);
      ReceiptAlerts.receiptSaveError('Failed to create receipt. Please try again.');
    }
  };

  const handlePrint = async () => {
    // Validate form first
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    const validItems = formItems.filter(item => 
      item.selectedItemId && 
      parseFloat(item.price) > 0 && 
      parseInt(item.quantity) > 0
    );

    if (validItems.length === 0) {
      ReceiptAlerts.validationError('Items Selection', 'Please select at least one valid item');
      return;
    }

    setShowPrintOptions(true);
  };

  const handlePrintComplete = () => {
    handleClearForm();
    onClose();
  };

  // Return PrintOptionsScreen if showing print options
  if (showPrintOptions) {
    const validItems = formItems.filter(item => 
      item.selectedItemId && 
      parseFloat(item.price) > 0 && 
      parseInt(item.quantity) > 0
    );
    
    const cartItems = validItems.map(formItem => {
      const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
      return {
        id: formItem.id,
        name: selectedItem?.item_name || '',
        price: parseFloat(formItem.price),
        quantity: parseInt(formItem.quantity),
      };
    });

    return (
      <PrintOptionsScreen
        onClose={() => setShowPrintOptions(false)}
        cartItems={cartCompatibility.items}
        customerName={cartCompatibility.customerName}
        onPrintComplete={handlePrintComplete}
      />
    );
  }

  const renderItemForm = (formItem: any, index: number) => (
    <View key={formItem.id} className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-200 overflow-visible">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-900">Item {index + 1}</Text>
        {formItems.length > 1 && (
          <TouchableOpacity
            onPress={() => {
              removeItemForm(formItem.id);
            }}
            className="p-1"
          >
            <Ionicons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Single row layout for Item Name, Per Kg, Kg, Gms */}
      <View className="flex-row items-start">
        {/* Item Name Dropdown - Using react-native-element-dropdown */}
        <View className="flex-1 mr-2">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Item Name <Text className="text-red-500">*</Text>
          </Text>
          <Dropdown
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 12,
              backgroundColor: 'white',
              minHeight: 44
            }}
            placeholderStyle={{
              fontSize: 16,
              color: '#9ca3af'
            }}
            selectedTextStyle={{
              fontSize: 16,
              color: '#1f2937',
              fontWeight: '500'
            }}
            inputSearchStyle={{
              height: 40,
              fontSize: 16,
              borderRadius: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb'
            }}
            iconStyle={{
              width: 20,
              height: 20
            }}
            data={availableItems.map(item => ({
              label: item.item_name,
              value: item.id,
              price: item.price,
              stocks: item.stocks || 0,
              disabled: (item.stocks || 0) <= 0
            }))}
            search
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select an item"
            searchPlaceholder="Search items..."
            value={formItem.selectedItemId}
            onChange={(item) => {
              console.log('Item selected:', item.label, 'for form:', formItem.id);
              handleItemSelect(formItem.id, item.value);
            }}
            renderRightIcon={() => (
              <Ionicons
                name="chevron-down"
                size={20}
                color="#9ca3af"
              />
            )}
            renderItem={(item) => (
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: item.disabled ? '#fef2f2' : 'white',
                opacity: item.disabled ? 0.6 : 1
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: item.disabled ? '#9ca3af' : '#1f2937',
                  marginBottom: 6
                }}>
                  {item.label}
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
                    ${item.price?.toFixed(2)}
                  </Text>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                    backgroundColor: item.stocks <= 10 ? '#fee2e2' : item.stocks <= 50 ? '#fef3c7' : '#ecfdf5'
                  }}>
                    <Text style={{
                      fontSize: 12,
                      color: item.stocks <= 10 ? '#dc2626' : item.stocks <= 50 ? '#d97706' : '#059669',
                      fontWeight: '600'
                    }}>
                      Stock: {item.stocks}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        </View>

        {/* Per Kg Price Field - Auto-populated from Firebase */}
        <View style={{ width: 80 }} className="mr-2">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Per Kg
          </Text>
          <View className="relative">
            <Text className="absolute left-3 top-3 text-gray-500 text-base z-10">$</Text>
            <TextInput
              value={formItem.pricePerKg || '0.00'}
              placeholder="0.00"
              editable={false}
              className="border border-gray-300 rounded-lg pl-8 pr-3 py-3 text-base bg-gray-50"
            />
          </View>
        </View>

        {/* Kg Field */}
        <View style={{ width: 60 }} className="mr-2">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Kg <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={formItem.kg || '0'}
            onChangeText={(value) => handleUpdateFormItem(formItem.id, 'kg', value)}
            placeholder="0"
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg px-3 py-3 text-base text-center"
          />
        </View>

        {/* Gms Field */}
        <View style={{ width: 60 }}>
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Gms
          </Text>
          <TextInput
            value={formItem.gms || '0'}
            onChangeText={(value) => handleUpdateFormItem(formItem.id, 'gms', value)}
            placeholder="0"
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg px-3 py-3 text-base text-center"
          />
        </View>
      </View>

      {/* Show stock error for this form item - below all fields */}
      {formItem.stockError && (
        <Text className="text-red-500 text-sm mt-2">{formItem.stockError}</Text>
      )}
    </View>
  );

  if (!visible) {
    return null;
  }

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'white',
      zIndex: 9999,
    }}>
      {/* Header */}
      <SafeAreaView style={{
        backgroundColor: 'white',
      }}>
        <View style={{
          backgroundColor: 'white',
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 16,
        }}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={onClose} style={{
            padding: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: 8,
          }}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={{
            color: '#374151',
            fontSize: 20,
            fontWeight: 'bold',
          }}>Create Receipt</Text>
          <TouchableOpacity 
            onPress={addNewItemForm}
            style={{
              padding: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: 8,
            }}
          >
            <Ionicons name="add" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
        </View>
      </SafeAreaView>

          <ScrollView 
            className="flex-1 p-4"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            style={{ zIndex: 1 }}
          >
            {/* Customer Information Section */}
            <View className="mb-6" style={{ zIndex: 10000 }}>
              <Text className="text-lg font-semibold text-gray-900 mb-2">Customer Information</Text>
              <Text className="text-gray-600 text-sm mb-4">
                Customer information is required for the Receipt. Start typing to search existing customers or add a new one.
              </Text>
              
              <View className="bg-white rounded-lg p-4 shadow-sm border border-gray-200" style={{ overflow: 'visible' }}>
                {/* Customer Name with Search */}
                <View className="mb-4" style={{ zIndex: 10001, position: 'relative' }}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-gray-700">
                      Customer Name <Text className="text-red-500">*</Text>
                    </Text>
                    {customer.isNewCustomer && (
                      <View className="px-2 py-1 bg-blue-100 rounded-full">
                        <Text className="text-xs text-blue-600 font-medium">✨ New Customer</Text>
                      </View>
                    )}
                  </View>
                  <SearchableDropdown
                    value={customer.customerName || ''}
                    onChangeText={handleCustomerNameChange}
                    onSelectCustomer={handleCustomerSelect}
                    placeholder="Enter customer name"
                    error={errors.customer}
                    searchResults={customerSearchResults}
                    isSearching={isSearchingCustomers}
                    showDropdown={showCustomerDropdown}
                    onFocus={handleCustomerFocus}
                    onBlur={handleCustomerBlur}
                    onSearch={handleCustomerSearch}
                    onAddParty={handleAddParty}
                  />
                </View>
              </View>
            </View>

            {/* Items Form Section */}
            <View className="mb-6">
              {/* Form-level errors */}
              {errors.form && (
                <View className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <Text className="text-red-700 text-sm font-medium">{errors.form}</Text>
                </View>
              )}
              
              {isLoadingItems ? (
                <View className="bg-white rounded-lg p-8 items-center">
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text className="text-gray-500 mt-2">Loading items...</Text>
                </View>
              ) : itemsError ? (
                <View className="bg-red-50 border border-red-200 rounded-lg p-8 items-center">
                  <Text className="text-red-600 text-center">{itemsError}</Text>
                  <TouchableOpacity 
                    onPress={() => setItemsLoading(true)}
                    className="mt-4 px-4 py-2 bg-red-100 rounded-lg"
                  >
                    <Text className="text-red-600 font-medium">Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                formItems.map((formItem, index) => renderItemForm(formItem, index))
              )}
            </View>

            {/* Total Section */}
            <View className="mb-6">
              <View className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <Text className="text-lg font-semibold text-gray-900 mb-4">Total</Text>
                
                {/* Subtotal */}
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base text-gray-700">Subtotal:</Text>
                  <Text className="text-base font-medium text-gray-900">
                    ${receiptTotals.subtotal.toFixed(2)}
                  </Text>
                </View>
                
                {/* Tax */}
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base text-gray-700">Tax (10%):</Text>
                  <Text className="text-base font-medium text-gray-900">
                    ${receiptTotals.tax.toFixed(2)}
                  </Text>
                </View>
                
                {/* Divider */}
                <View className="border-t border-gray-200 my-3" />
                
                {/* Total */}
                <View className="flex-row justify-between items-center">
                  <Text className="text-lg font-bold text-gray-900">Total:</Text>
                  <Text className="text-lg font-bold text-blue-600">
                    ${receiptTotals.total.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

      {/* Bottom Actions */}
      <View style={{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
      }}>
        <View style={{
          flexDirection: 'row',
          gap: 8,
        }}>
          <TouchableOpacity
            onPress={handleClearForm}
            style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: '#374151',
              fontWeight: '600',
              fontSize: 14,
            }}>Clear</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => Alert.dialog(
              'Are you sure you want to cancel?',
              '❓ Confirm Cancel',
              [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', onPress: onClose, style: 'destructive' }
              ]
            )}
            style={{
              backgroundColor: '#d1d5db',
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: '#374151',
              fontWeight: '600',
              fontSize: 14,
            }}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleCreateReceipt}
            disabled={isProcessing}
            style={{
              flex: 1,
              backgroundColor: '#10b981',
              borderRadius: 8,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing && (
              <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
            )}
            <Ionicons name="save-outline" size={16} color="white" style={{ marginRight: 4 }} />
            <Text style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 14,
            }}>
              Create Receipt
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handlePrint}
            disabled={isProcessing}
            style={{
              flex: 1,
              backgroundColor: '#3b82f6',
              borderRadius: 8,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing && (
              <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
            )}
            <Ionicons name="print-outline" size={16} color="white" style={{ marginRight: 4 }} />
            <Text style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 14,
            }}>
              Print
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Party Management Modal */}
      <Modal
        visible={showPartyManagement}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPartyManagement(false)}
      >
        <PartyManagementScreen onBack={() => setShowPartyManagement(false)} />
      </Modal>
    </View>
  );
};

export default ReceiptCreationScreen;
