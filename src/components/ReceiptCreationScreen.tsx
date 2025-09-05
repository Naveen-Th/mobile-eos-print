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
import { PrintOptionsScreen } from './PrintOptionsScreen';
import SearchableDropdown from './SearchableDropdown';
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
    setAutoFilledFields,
    setItemsLoading,
    setItemsError,
    validateForm,
    createReceipt,
    clearForm,
    setError,
    clearError
  } = store;
  
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  
  // Customer search state
  const [customerSearchResults, setCustomerSearchResults] = useState<UniqueCustomer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    
    // Clear auto-filled flags when customer name is manually changed
    // This indicates the user is typing, not selecting from dropdown
    setAutoFilledFields({ businessName: false, businessPhone: false });
  };

  const handleCustomerSearch = async (query: string) => {
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
      const results = await CustomerService.searchCustomers(query);
      const safeResults = Array.isArray(results) ? results : [];
      setCustomerSearchResults(safeResults);
      
      // Check if this is a new customer
      const trimmedQuery = query.trim().toLowerCase();
      const existingCustomer = safeResults.find(
        (customer: UniqueCustomer) => customer.customerName.toLowerCase() === trimmedQuery
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
    // Auto-fill all customer information
    updateCustomerInfo({
      customerName: customer.customerName,
      businessName: customer.businessName || '',
      businessPhone: customer.businessPhone || '',
      isNewCustomer: false
    });
    
    // Track which fields were actually auto-filled
    setAutoFilledFields({
      businessName: !!(customer.businessName && customer.businessName.trim()),
      businessPhone: !!(customer.businessPhone && customer.businessPhone.trim())
    });
    
    // Clear any errors
    clearError('customer');
    clearError('businessName');
    clearError('businessPhone');
    
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
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-gray-900">Item {index + 1}</Text>
        {formItems.length > 1 && (
          <TouchableOpacity
            onPress={() => {
              removeItemForm(formItem.id);
              // Close any active dropdown when removing form
              setActiveDropdown(null);
            }}
            className="p-1"
          >
            <Ionicons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
      
      <View className="space-y-6">
        {/* Item Name Dropdown */}
        <View className="relative z-10">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Item Name <Text className="text-red-500">*</Text>
          </Text>
          <View className="border border-gray-300 rounded-lg bg-white">
            <TouchableOpacity 
              className="flex-row items-center justify-between p-4"
              onPress={() => {
                setActiveDropdown(activeDropdown === formItem.id ? null : formItem.id);
                setSearchQuery('');
              }}
            >
              <Text className={`text-base flex-1 ${
                formItem.selectedItemId 
                  ? 'text-gray-900' 
                  : 'text-gray-400'
              }`}>
                {formItem.selectedItemId 
                  ? availableItems.find(item => item.id === formItem.selectedItemId)?.item_name 
                  : 'Select an item'
                }
              </Text>
              <Ionicons 
                name={activeDropdown === formItem.id ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#6b7280" 
              />
            </TouchableOpacity>
          </View>
          
          {/* Dropdown Menu */}
          {activeDropdown === formItem.id && (
            <View className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-2xl z-50 mt-1">
              {/* Search Input */}
              <View className="p-3 border-b border-gray-200">
                <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2">
                  <Ionicons name="search" size={16} color="#9ca3af" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search items..."
                    className="flex-1 ml-2 text-base text-gray-700"
                    placeholderTextColor="#9ca3af"
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              
              {/* Items List - Fixed Height with Scrolling */}
              <View style={{ maxHeight: 200 }}>
                <ScrollView 
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  scrollEnabled={true}
                  bounces={true}
                >
                  {availableItems
                    .filter(item => {
                      const searchTerm = searchQuery.toLowerCase().trim();
                      return item.item_name.toLowerCase().includes(searchTerm);
                    })
                    .map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={{ 
                          paddingHorizontal: 16, 
                          paddingVertical: 12, 
                          borderBottomWidth: 1, 
                          borderBottomColor: '#f3f4f6',
                          opacity: (item.stocks || 0) <= 0 ? 0.5 : 1,
                          backgroundColor: (item.stocks || 0) <= 0 ? '#fef2f2' : 'transparent'
                        }}
                        onPress={() => {
                          console.log('Item selected:', item.item_name, 'for form:', formItem.id);
                          handleItemSelect(formItem.id, item.id);
                          setActiveDropdown(null);
                          setSearchQuery('');
                        }}
                        activeOpacity={0.7}
                        disabled={(item.stocks || 0) <= 0}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#2563eb', marginBottom: 4 }}>
                          {item.item_name.toUpperCase()}
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, color: '#6b7280' }}>
                            ${item.price.toFixed(2)}
                          </Text>
                          <Text style={{ 
                            fontSize: 12, 
                            color: item.stocks <= 10 ? '#ef4444' : item.stocks <= 50 ? '#f59e0b' : '#10b981',
                            fontWeight: '600',
                            backgroundColor: item.stocks <= 10 ? '#fef2f2' : item.stocks <= 50 ? '#fef3c7' : '#f0fdf4',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4
                          }}>
                            Stock: {item.stocks || 0}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  }
                  
                  {/* No items found */}
                  {availableItems.filter(item => 
                    item.item_name.toLowerCase().includes(searchQuery.toLowerCase().trim())
                  ).length === 0 && (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: '#6b7280', fontSize: 16 }}>No items found</Text>
                      <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>Try a different search term</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        <View className="flex-row space-x-4">
          {/* Price Field */}
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Price <Text className="text-red-500">*</Text>
            </Text>
            <View className="relative">
              <Text className="absolute left-3 top-3 text-gray-500 text-base z-10">$</Text>
              <TextInput
                value={formItem.price}
                onChangeText={(value) => handleUpdateFormItem(formItem.id, 'price', value)}
                placeholder="0.00"
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-3 text-base"
              />
            </View>
          </View>

          {/* Quantity Field */}
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Quantity <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={formItem.quantity}
              onChangeText={(value) => handleUpdateFormItem(formItem.id, 'quantity', value)}
              placeholder="1"
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
            {/* Show stock error for this form item */}
            {formItem.stockError && (
              <Text className="text-red-500 text-sm mt-1">{formItem.stockError}</Text>
            )}
          </View>
        </View>
      </View>
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
            style={{ zIndex: 1 }}
          >
            {/* Customer Information Section */}
            <View className="mb-6" style={{ zIndex: 100 }}>
              <Text className="text-lg font-semibold text-gray-900 mb-2">Customer & Business Information</Text>
              <Text className="text-gray-600 text-sm mb-4">
                Customer information is required for the Receipt. Start typing to search existing customers or add a new one.
              </Text>
              
              <View className="bg-white rounded-lg p-4 shadow-sm border border-gray-200" style={{ overflow: 'visible' }}>
                {/* Customer Name with Search */}
                <View className="mb-4" style={{ zIndex: 1000, position: 'relative' }}>
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
                  />
                </View>

                {/* Business Name */}
                <View className="mb-4">
                  <View className="flex-row items-center mb-2">
                    <Text className="text-sm font-medium text-gray-700">
                      Business Name
                    </Text>
                    {customer.businessName && customer.autoFilledFields.businessName && (
                      <View className="ml-2 px-2 py-1 bg-green-100 rounded-full">
                        <Text className="text-xs text-green-600">Auto-filled</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={customer.businessName || ''}
                    onChangeText={(text) => {
                      updateCustomerInfo({ businessName: text });
                      clearError('businessName');
                      // Clear auto-filled flag when user manually types
                      setAutoFilledFields({ businessName: false });
                    }}
                    placeholder="Enter business name (optional)"
                    className={`border rounded-lg px-3 py-3 text-base ${
                      errors.businessName ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.businessName && (
                    <Text className="text-red-500 text-sm mt-1">{errors.businessName}</Text>
                  )}
                </View>

                {/* Business Phone */}
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-sm font-medium text-gray-700">
                      Business Phone
                    </Text>
                    {customer.businessPhone && customer.autoFilledFields.businessPhone && (
                      <View className="ml-2 px-2 py-1 bg-green-100 rounded-full">
                        <Text className="text-xs text-green-600">Auto-filled</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={customer.businessPhone || ''}
                    onChangeText={(text) => {
                      updateCustomerInfo({ businessPhone: text });
                      clearError('businessPhone');
                      // Clear auto-filled flag when user manually types
                      setAutoFilledFields({ businessPhone: false });
                    }}
                    placeholder="Enter business phone (optional)"
                    keyboardType="phone-pad"
                    className={`border rounded-lg px-3 py-3 text-base ${
                      errors.businessPhone ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.businessPhone && (
                    <Text className="text-red-500 text-sm mt-1">{errors.businessPhone}</Text>
                  )}
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
    </View>
  );
};

export default ReceiptCreationScreen;
