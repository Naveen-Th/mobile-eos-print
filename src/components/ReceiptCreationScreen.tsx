import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Alert, ReceiptAlerts } from './common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { PrintOptionsScreen } from './PrintOptionsScreen';
import SearchableDropdown from './SearchableDropdown';
import PartyManagementScreen from '../screens/PartyManagementScreen';
import { ItemDetails } from '../types';
import TaxSettingsModal from './TaxSettingsModal';
import ItemService from '../services/ItemService';
import CustomerService, { UniqueCustomer } from '../services/CustomerService';
import { useReceiptStore } from '../stores/receiptStore';
import { useReceiptIntegration } from '../hooks/useReceiptIntegration';
import ReceiptFirebaseService from '../services/ReceiptFirebaseService';
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
  
  // Safe area insets to fine-tune top spacing on devices with notches/status bar
  const insets = useSafeAreaInsets();

  // Destructure store values for easier access
  const {
    formItems,
    customer,
    balance,
    availableItems,
    isLoadingItems,
    itemsError,
    isProcessing,
    errors,
    receiptTotals,
    taxRate,
    addFormItem,
    removeFormItem,
    updateFormItem,
    selectItem,
    updateCustomerInfo,
    updateBalanceInfo,
    setItemsLoading,
    setItemsError,
    validateForm,
    createReceipt,
    clearForm,
    setError,
    clearError,
    loadTaxRate
  } = store;
  
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  
  // Customer search state
  const [customerSearchResults, setCustomerSearchResults] = useState<UniqueCustomer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Note: Totals are automatically calculated by the useReceiptIntegration hook
  // No need to duplicate the calculation here
  

  // Items subscription is now handled by the integration hook

  // Form item functions are now handled by the store
  const addNewItemForm = addFormItem;
  const removeItemForm = removeFormItem;

  // Form item update is now handled by the store with better validation
  const handleUpdateFormItem = (id: string, field: string, value: string) => {
    // Remove leading zeros for numeric fields like kg, gms, and pricePerKg
    if (field === 'kg' || field === 'gms' || field === 'pricePerKg') {
      // Remove leading zeros but keep single zero and decimal values
      if (value && value !== '0' && !value.includes('.')) {
        value = value.replace(/^0+/, '') || '0';
      }
    }
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

  const handleCustomerNameChange = async (text: string) => {
    updateCustomerInfo({ customerName: text });
    clearError('customer'); // Clear error when typing
    
    // If user clears the name, reset balance
    if (!text.trim()) {
      updateBalanceInfo({ oldBalance: 0, isPaid: false, amountPaid: 0 });
      return;
    }
    
    // Debounce balance fetch to avoid too many queries
    // Only fetch if customer name is at least 3 characters
    if (text.trim().length >= 3) {
      try {
        const oldBalance = await ReceiptFirebaseService.getCustomerLatestBalance(text);
        if (oldBalance > 0) {
          updateBalanceInfo({ oldBalance });
          console.log(`Auto-loaded balance for ${text}: ${oldBalance}`);
        }
      } catch (error) {
        console.error('Error fetching customer balance on name change:', error);
      }
    }
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

  const handleCustomerSelect = async (customer: UniqueCustomer) => {
    // Set customer information
    updateCustomerInfo({
      customerName: customer.customerName,
      isNewCustomer: false
    });
    
    // Clear any errors
    clearError('customer');
    
    // Hide dropdown
    setShowCustomerDropdown(false);
    
    // Fetch and set old balance for this customer
    try {
      const oldBalance = await ReceiptFirebaseService.getCustomerLatestBalance(customer.customerName);
      updateBalanceInfo({ oldBalance });
      console.log(`Auto-loaded balance for ${customer.customerName}: ${oldBalance}`);
    } catch (error) {
      console.error('Error fetching customer balance:', error);
    }
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
    <View key={formItem.id} className="mb-3">
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
              borderRadius: 0,
              paddingHorizontal: 12,
              borderWidth: 0,
              backgroundColor: '#f9fafb',
              color: '#374151'
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
                    {formatCurrency(item.price || 0)}
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

        {/* Per Kg Price Field - Editable */}
        <View style={{ width: 80 }} className="mr-2">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Per Kg
          </Text>
          <TextInput
            value={formItem.pricePerKg || '0.00'}
            onChangeText={(value) => handleUpdateFormItem(formItem.id, 'pricePerKg', value)}
            placeholder="0.00"
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg px-3 py-3 text-base text-center"
          />
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

        {/* Gms Field - Dropdown with fixed options */}
        <View style={{ width: 80 }}>
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Gms
          </Text>
          <Dropdown
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 12,
              backgroundColor: 'white',
              minHeight: 44
            }}
            placeholderStyle={{
              fontSize: 16,
              color: '#1f2937',
              textAlign: 'center'
            }}
            selectedTextStyle={{
              fontSize: 16,
              color: '#1f2937',
              fontWeight: '500',
              textAlign: 'center'
            }}
            iconStyle={{
              width: 16,
              height: 16
            }}
            data={[50, 100, 150, 200].map(v => ({ label: String(v), value: String(v) }))}
            labelField="label"
            valueField="value"
            placeholder="0"
            value={['50','100','150','200'].includes(formItem.gms) ? formItem.gms : null}
            onChange={(item) => handleUpdateFormItem(formItem.id, 'gms', item.value)}
            renderRightIcon={() => (
              <Ionicons
                name="chevron-down"
                size={16}
                color="#9ca3af"
              />
            )}
          />
        </View>
      </View>

      {/* Per-line total */}
      <View className="mt-1 flex-row justify-between items-center">
        <Text className="text-sm text-gray-600">Item Total:</Text>
        <Text className="text-sm font-semibold text-gray-900">
{formatCurrency(parseFloat(formItem.calculatedPrice || formItem.price || '0') || 0)}
        </Text>
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
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      {/* Header */}
      <View
        // Reduce top space while staying safely below the status bar / notch
        style={{
          backgroundColor: 'white',
          paddingTop: Math.max((insets?.top || 0) - 20, 0),
        }}
      >
        <View style={{
          backgroundColor: 'white',
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 4,
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
      </View>

          <ScrollView 
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16, paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
            style={{ zIndex: 1 }}
          >
            {/* Customer Information Section */}
            <View className="mb-6" style={{ zIndex: showCustomerDropdown ? 20000 : 1000 }}>
              <Text className="text-lg font-semibold text-gray-900 mb-3">Customer Information</Text>
              
              {/* Customer Name with Search */}
              <View style={{ zIndex: showCustomerDropdown ? 20001 : 1001, position: 'relative', marginBottom: showCustomerDropdown ? 200 : 0 }}>
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
                
                {/* Balance Information */}
                <View className="mt-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-medium text-gray-700">Old Balance</Text>
                    <View className="flex-row items-center">
                      <Text className="text-xs text-gray-600 mr-2">{balance.isPaid ? 'Paid' : 'Not Paid'}</Text>
                      <TouchableOpacity
                        onPress={() => updateBalanceInfo({ isPaid: !balance.isPaid })}
                        style={{
                          width: 50,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: balance.isPaid ? '#10b981' : '#d1d5db',
                          justifyContent: 'center',
                          paddingHorizontal: 3,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: 'white',
                            transform: [{ translateX: balance.isPaid ? 22 : 0 }],
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    value={balance.oldBalance === 0 ? '' : balance.oldBalance.toString()}
                    onChangeText={(value) => {
                      // Allow empty string to show placeholder
                      if (!value) {
                        updateBalanceInfo({ oldBalance: 0 });
                        return;
                      }
                      // Parse the number, removing any non-numeric characters except decimal point
                      const cleanValue = value.replace(/[^0-9.]/g, '');
                      const numValue = parseFloat(cleanValue) || 0;
                      updateBalanceInfo({ oldBalance: numValue });
                    }}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-3 text-base bg-white"
                  />
                  
                  {/* Amount Paid - Only show when isPaid is true */}
                  {balance.isPaid && (
                    <View className="mt-3">
                      <Text className="text-sm font-medium text-gray-700 mb-2">Amount Paid</Text>
                      <TextInput
                        value={balance.amountPaid === 0 ? '' : balance.amountPaid.toString()}
                        onChangeText={(value) => {
                          // Allow empty string to show placeholder
                          if (!value) {
                            updateBalanceInfo({ amountPaid: 0 });
                            return;
                          }
                          // Parse the number, removing any non-numeric characters except decimal point
                          const cleanValue = value.replace(/[^0-9.]/g, '');
                          const numValue = parseFloat(cleanValue) || 0;
                          updateBalanceInfo({ amountPaid: numValue });
                        }}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        className="border border-gray-300 rounded-lg px-3 py-3 text-base bg-white"
                      />
                    </View>
                  )}
                  
                  {/* New Balance Display */}
                  <View className="mt-3 flex-row justify-between items-center bg-gray-50 rounded-lg p-3">
                    <Text className="text-sm font-medium text-gray-700">New Balance:</Text>
                    <Text className="text-base font-bold text-blue-600">
{formatCurrency(balance.newBalance)}
                    </Text>
                  </View>
                </View>
            </View>

            {/* Items Form Section */}
            <View className="mb-3">
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
            <View className="mb-3">
              <View>
                <Text className="text-lg font-semibold text-gray-900 mb-2">Total</Text>
                
                {/* Subtotal */}
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-base text-gray-700">Subtotal:</Text>
                  <Text className="text-base font-medium text-gray-900">
{formatCurrency(receiptTotals.subtotal)}
                  </Text>
                </View>
                
                {/* Tax */}
                <View className="flex-row justify-between items-center mb-1">
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text className="text-base text-gray-700">Tax ({taxRate}%):</Text>
                    <TouchableOpacity
                      onPress={() => setShowTaxSettings(true)}
                      style={{ marginLeft: 6, padding: 4 }}
                      accessibilityLabel="Edit tax rate"
                    >
                      <Ionicons name="pencil" size={14} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-base font-medium text-gray-900">
{formatCurrency(receiptTotals.tax)}
                  </Text>
                </View>
                
                {/* Divider */}
                <View className="border-t border-gray-200 my-2" />
                
                {/* Total */}
                <View className="flex-row justify-between items-center">
                  <Text className="text-lg font-bold text-gray-900">Total:</Text>
                  <Text className="text-lg font-bold text-blue-600">
{formatCurrency(receiptTotals.total)}
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

      {/* Quick Tax Settings Modal */}
      <TaxSettingsModal
        visible={showTaxSettings}
        onClose={() => setShowTaxSettings(false)}
        onTaxRateUpdated={async () => {
          try {
            await loadTaxRate();
          } catch (e) {
            console.log('Failed to refresh tax rate after update', e);
          } finally {
            setShowTaxSettings(false);
          }
        }}
      />
    </View>
  );
};

export default ReceiptCreationScreen;
