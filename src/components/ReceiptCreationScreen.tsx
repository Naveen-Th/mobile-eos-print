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
import { useCart } from '../context/CartContext';
import { PrintOptionsScreen } from './PrintOptionsScreen';
import SearchableDropdown from './SearchableDropdown';
import { ItemDetails, Receipt, ReceiptItem } from '../types';
import ItemService from '../services/ItemService';
import ReceiptFirebaseService from '../services/ReceiptFirebaseService';
import CustomerService, { UniqueCustomer } from '../services/CustomerService';
import StockService from '../services/StockService';
import {
  formatCurrency,
  generateReceiptNumber,
  generateId,
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
  const { state: cartState, addItem, updateQuantity, removeItem, clearCart, updateCustomerInfo } = useCart();
  const [availableItems, setAvailableItems] = useState<ItemDetails[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [customerError, setCustomerError] = useState<string>('');
  const [businessNameError, setBusinessNameError] = useState<string>('');
  const [businessPhoneError, setBusinessPhoneError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [optimisticReceiptId, setOptimisticReceiptId] = useState<string | null>(null);
  
  // Customer search state
  const [customerSearchResults, setCustomerSearchResults] = useState<UniqueCustomer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  
  // Track which fields were auto-filled (only show badge if selected from dropdown)
  const [autoFilledFields, setAutoFilledFields] = useState({
    businessName: false,
    businessPhone: false
  });
  
  // Form state for adding items
  const [formItems, setFormItems] = useState<Array<{
    id: string;
    selectedItemId: string;
    price: string;
    quantity: string;
  }>>([{ id: '1', selectedItemId: '', price: '0.00', quantity: '1' }]);
  
  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (visible) {
      // Start real-time customer listener
      CustomerService.setupRealtimeListener();

      // Subscribe to real-time item updates (this handles initial loading too)
      const unsubscribe = ItemService.subscribeToItems(
        (items) => {
          console.log('Received real-time items update:', items.length, 'items');
          setAvailableItems(items);
          setIsLoadingItems(false);
        },
        (error) => {
          console.error('Error subscribing to items:', error);
          Alert.error('Failed to load items. Please try again.', '⚠️ Error Loading Items');
          setIsLoadingItems(false);
        }
      );
      return () => {
        unsubscribe();
        // We keep the customer listener alive across screens to maintain cache freshness
      };
    }
  }, [visible]);

  const addNewItemForm = () => {
    const newId = (formItems.length + 1).toString();
    setFormItems([...formItems, { 
      id: newId, 
      selectedItemId: '', 
      price: '0.00', 
      quantity: '1' 
    }]);
  };

  const removeItemForm = (id: string) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter(item => item.id !== id));
    }
  };

  const updateFormItem = async (id: string, field: string, value: string) => {
    // Update the form item
    setFormItems(formItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    
    // If updating quantity, validate against available stock in real-time
    if (field === 'quantity' && value) {
      const formItem = formItems.find(item => item.id === id);
      if (formItem && formItem.selectedItemId) {
        const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
        if (selectedItem) {
          const requestedQuantity = parseInt(value);
          const currentStock = selectedItem.stocks || 0;
          
          if (requestedQuantity > currentStock) {
            // Show warning with real-time stock info
            setTimeout(() => {
              ReceiptAlerts.validationError(
                'Insufficient Stock',
                `Not enough stock for "${selectedItem.item_name}".\n\nRequested: ${requestedQuantity}\nAvailable: ${currentStock}\n\nPlease adjust the quantity or check if stock was recently updated.`
              );
            }, 300); // Reduced delay for better responsiveness
          }
        }
      }
    }
  };

  const handleItemSelect = (formId: string, itemId: string) => {
    console.log('handleItemSelect called with:', formId, itemId);
    const selectedItem = availableItems.find(item => item.id === itemId);
    console.log('Selected item found:', selectedItem);
    
    if (selectedItem) {
      // Check if item has sufficient stock for minimum quantity (1)
      const currentStock = selectedItem.stocks || 0;
      if (currentStock <= 0) {
        ReceiptAlerts.validationError(
          'Out of Stock',
          `"${selectedItem.item_name}" is currently out of stock.\n\nAvailable: ${currentStock}\n\nPlease choose a different item or restock first.`
        );
        return;
      }
      
      console.log('Updating form item with:', {
        selectedItemId: itemId,
        price: selectedItem.price.toFixed(2)
      });
      
      // Update the form item
      setFormItems(prevItems => 
        prevItems.map(item => 
          item.id === formId 
            ? { ...item, selectedItemId: itemId, price: selectedItem.price.toFixed(2) }
            : item
        )
      );
    }
  };

  const clearForm = () => {
    setFormItems([{ id: '1', selectedItemId: '', price: '0.00', quantity: '1' }]);
    updateCustomerInfo({ 
      customerName: '',
      businessName: '',
      businessPhone: ''
    });
    setCustomerError('');
    setBusinessNameError('');
    setBusinessPhoneError('');
    setIsNewCustomer(false);
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setAutoFilledFields({ businessName: false, businessPhone: false });
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
    } else {
      updateQuantity(itemId, newQuantity);
    }
  };

  const handleCustomerNameChange = (text: string) => {
    updateCustomerInfo({ customerName: text });
    setCustomerError(''); // Clear error when typing
    
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
        setIsNewCustomer(false);
      } catch (error) {
        console.error('Error loading recent customers:', error);
        setCustomerSearchResults([]);
        setIsNewCustomer(false);
      } finally {
        setIsSearchingCustomers(false);
      }
      return;
    }

    setIsSearchingCustomers(true);
    try {
      const results = await CustomerService.searchCustomers(query);
      const safeResults = results || [];
      setCustomerSearchResults(safeResults);
      
      // Check if this is a new customer
      const trimmedQuery = query.trim().toLowerCase();
      const existingCustomer = safeResults.find(
        (customer: UniqueCustomer) => customer.customerName.toLowerCase() === trimmedQuery
      );
      setIsNewCustomer(!existingCustomer);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerSearchResults([]);
      setIsNewCustomer(!!query.trim());
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleCustomerSelect = (customer: UniqueCustomer) => {
    // Auto-fill all customer information
    updateCustomerInfo({
      customerName: customer.customerName,
      businessName: customer.businessName || '',
      businessPhone: customer.businessPhone || ''
    });
    
    // Track which fields were actually auto-filled
    setAutoFilledFields({
      businessName: !!(customer.businessName && customer.businessName.trim()),
      businessPhone: !!(customer.businessPhone && customer.businessPhone.trim())
    });
    
    // Clear any errors and flags
    setCustomerError('');
    setBusinessNameError('');
    setBusinessPhoneError('');
    setIsNewCustomer(false);
    
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

  const validateReceipt = (): boolean => {
    if (cartState.items.length === 0) {
      ReceiptAlerts.validationError('Receipt Items', 'Please add at least one item to the receipt');
      return false;
    }

    // Validate customer information
    const customerErrors = validateCustomerInfo({
      customerName: cartState.customerName?.trim(),
    });

    if (customerErrors && customerErrors.length > 0) {
      setCustomerError(customerErrors[0].message);
      return false;
    }

    return true;
  };

  const validateReceiptForm = (): boolean => {
    const validItems = formItems.filter(item => 
      item.selectedItemId && 
      parseFloat(item.price) > 0 && 
      parseInt(item.quantity) > 0
    );

    if (validItems.length === 0) {
      ReceiptAlerts.validationError('Receipt Items', 'Please add at least one valid item to the receipt');
      return false;
    }

    // Validate customer information
    const customerErrors = validateCustomerInfo({
      customerName: cartState.customerName?.trim(),
    });

    if (customerErrors && customerErrors.length > 0) {
      setCustomerError(customerErrors[0].message);
      return false;
    }

    return true;
  };

  const calculateReceiptTotals = (items: ReceiptItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax rate
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      // Keep real-time listener active for better UX across screen transitions
      // CustomerService.stopRealtimeListener(); // Uncomment if you want to stop on unmount
    };
  }, []);

  const handleCreateReceipt = async () => {
    if (!validateReceiptForm()) {
      return;
    }

    try {
      setIsProcessing(true);

      // Convert form items to receipt items
      const validItems = formItems.filter(item => 
        item.selectedItemId && 
        parseFloat(item.price) > 0 && 
        parseInt(item.quantity) > 0
      );

      // Check stock availability for all items before creating receipt
      for (const formItem of validItems) {
        const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
        if (selectedItem) {
          const requestedQuantity = parseInt(formItem.quantity);
          const hasStock = await StockService.hasLuckyStock(selectedItem.id, requestedQuantity);
          
          if (!hasStock) {
            const currentStock = await StockService.getItemStock(selectedItem.id);
            ReceiptAlerts.validationError(
              'Insufficient Stock',
              `Not enough stock for "${selectedItem.item_name}".\n\nRequested: ${requestedQuantity}\nAvailable: ${currentStock}\n\nPlease adjust the quantity or choose a different item.`
            );
            setIsProcessing(false);
            return;
          }
        }
      }

      const receiptItems: ReceiptItem[] = validItems.map(formItem => {
        const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
        return {
          id: formItem.id,
          name: selectedItem?.item_name || '',
          price: parseFloat(formItem.price),
          quantity: parseInt(formItem.quantity),
        };
      });

      const totals = calculateReceiptTotals(receiptItems);

      // Create receipt object
      const receipt: Receipt = {
        id: generateId(),
        receiptNumber: generateReceiptNumber(),
        items: receiptItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        date: new Date(),
        companyName: 'My Thermal Receipt Store',
        companyAddress: '123 Business St, City, State 12345',
        businessName: cartState.businessName?.trim() || undefined,
        businessPhone: cartState.businessPhone?.trim() || undefined,
        footerMessage: 'Thank you for your business!',
        customerName: cartState.customerName?.trim(),
      };

      // Save receipt to Firebase receipts collection
      const result = await ReceiptFirebaseService.saveReceipt(receipt, 'thermal');
      
      if (result.success) {
        // Subtract quantities from stock after successful receipt creation
        try {
          for (const item of receiptItems) {
            const selectedItem = availableItems.find(availableItem => availableItem.item_name === item.name);
            if (selectedItem) {
              await StockService.subtractStock(selectedItem.id, item.quantity);
              console.log(`Subtracted ${item.quantity} from stock for item: ${item.name}`);
            }
          }
          console.log('Stock levels updated successfully for all items');
        } catch (stockError) {
          console.error('Error updating stock levels:', stockError);
          // Still show success message but warn about stock update
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${receipt.receiptNumber} created successfully!\n\n⚠️ Note: There was an issue updating stock levels. Please check inventory manually.`
          );
          clearForm();
          onClose();
          return;
        }
        
        if (isNewCustomer) {
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${receipt.receiptNumber} created successfully!\n\n✨ New customer "${cartState.customerName}" has been added to your customer database.\n📦 Stock levels updated automatically.`
          );
        } else {
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${receipt.receiptNumber} created successfully!\n\n📦 Stock levels updated automatically.`
          );
        }
        
        // Clear customer cache to include the new customer in future searches
        if (isNewCustomer) {
          CustomerService.clearCache();
        }
        
        clearForm();
        onClose();
      } else {
        ReceiptAlerts.receiptSaveError(result.error || 'Failed to create receipt');
      }
    } catch (error) {
      console.error('Error creating receipt:', error);
      ReceiptAlerts.receiptSaveError('Failed to create receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    const validItems = formItems.filter(item => 
      item.selectedItemId && 
      parseFloat(item.price) > 0 && 
      parseInt(item.quantity) > 0
    );

    if (validItems.length === 0) {
      ReceiptAlerts.validationError('Items Selection', 'Please select at least one valid item');
      return;
    }

    // Validate customer information
    const customerErrors = validateCustomerInfo({
      customerName: cartState.customerName?.trim(),
    });

    if (customerErrors.length > 0) {
      setCustomerError(customerErrors[0].message);
      return;
    }

    // Create cart items for the print modal
    const cartItems = validItems.map(formItem => {
      const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
      return {
        id: formItem.id,
        name: selectedItem?.item_name || '',
        price: parseFloat(formItem.price),
        quantity: parseInt(formItem.quantity),
      };
    });

    setShowPrintOptions(true);
  };

  const handlePrintComplete = () => {
    clearForm();
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
        cartItems={cartItems}
        customerName={cartState.customerName}
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
                onChangeText={(value) => updateFormItem(formItem.id, 'price', value)}
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
              onChangeText={(value) => updateFormItem(formItem.id, 'quantity', value)}
              placeholder="1"
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
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
                    {isNewCustomer && (
                      <View className="px-2 py-1 bg-blue-100 rounded-full">
                        <Text className="text-xs text-blue-600 font-medium">✨ New Customer</Text>
                      </View>
                    )}
                  </View>
                  <SearchableDropdown
                    value={cartState.customerName || ''}
                    onChangeText={handleCustomerNameChange}
                    onSelectCustomer={handleCustomerSelect}
                    placeholder="Enter customer name"
                    error={customerError}
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
                    {cartState.businessName && autoFilledFields.businessName && (
                      <View className="ml-2 px-2 py-1 bg-green-100 rounded-full">
                        <Text className="text-xs text-green-600">Auto-filled</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={cartState.businessName || ''}
                    onChangeText={(text) => {
                      updateCustomerInfo({ businessName: text });
                      setBusinessNameError('');
                      // Clear auto-filled flag when user manually types
                      setAutoFilledFields(prev => ({ ...prev, businessName: false }));
                    }}
                    placeholder="Enter business name (optional)"
                    className={`border rounded-lg px-3 py-3 text-base ${
                      businessNameError ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {businessNameError && (
                    <Text className="text-red-500 text-sm mt-1">{businessNameError}</Text>
                  )}
                </View>

                {/* Business Phone */}
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-sm font-medium text-gray-700">
                      Business Phone
                    </Text>
                    {cartState.businessPhone && autoFilledFields.businessPhone && (
                      <View className="ml-2 px-2 py-1 bg-green-100 rounded-full">
                        <Text className="text-xs text-green-600">Auto-filled</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={cartState.businessPhone || ''}
                    onChangeText={(text) => {
                      updateCustomerInfo({ businessPhone: text });
                      setBusinessPhoneError('');
                      // Clear auto-filled flag when user manually types
                      setAutoFilledFields(prev => ({ ...prev, businessPhone: false }));
                    }}
                    placeholder="Enter business phone (optional)"
                    keyboardType="phone-pad"
                    className={`border rounded-lg px-3 py-3 text-base ${
                      businessPhoneError ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {businessPhoneError && (
                    <Text className="text-red-500 text-sm mt-1">{businessPhoneError}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Items Form Section */}
            <View className="mb-6">
              {isLoadingItems ? (
                <View className="bg-white rounded-lg p-8 items-center">
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text className="text-gray-500 mt-2">Loading items...</Text>
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
            onPress={clearForm}
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
