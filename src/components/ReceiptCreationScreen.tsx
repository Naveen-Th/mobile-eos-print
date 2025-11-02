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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import BalanceTrackingService from '../services/BalanceTrackingService';
import {
  formatCurrency,
  validateCustomerInfo,
} from '../utils/index';

interface ReceiptCreationScreenProps {
  onClose: () => void;
  visible: boolean;
}

type Step = 'customer' | 'items' | 'review';

const ReceiptCreationScreen: React.FC<ReceiptCreationScreenProps> = ({
  onClose,
  visible,
}) => {
  const { store, cartCompatibility } = useReceiptIntegration(visible);
  const insets = useSafeAreaInsets();
  
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
  
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  
  // Customer search state
  const [customerSearchResults, setCustomerSearchResults] = useState<UniqueCustomer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Animation for step transitions
  const fadeAnim = useState(new Animated.Value(1))[0];

  const transitionToStep = (nextStep: Step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setCurrentStep(nextStep);
  };

  const addNewItemForm = addFormItem;
  const removeItemForm = removeFormItem;

  const handleUpdateFormItem = (id: string, field: string, value: string) => {
    if (field === 'kg' || field === 'gms' || field === 'pricePerKg') {
      if (value && value !== '0' && !value.includes('.')) {
        value = value.replace(/^0+/, '') || '0';
      }
    }
    updateFormItem(id, field as any, value);
  };

  const handleItemSelect = async (formId: string, itemId: string) => {
    await selectItem(formId, itemId);
  };

  const handleClearForm = () => {
    clearForm();
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setCurrentStep('customer');
  };

  const handleCustomerNameChange = async (text: string) => {
    updateCustomerInfo({ customerName: text });
    clearError('customer');
    
    if (!text.trim()) {
      // Reset balance when customer name is cleared
      // isPaid will be calculated automatically
      updateBalanceInfo({ oldBalance: 0, amountPaid: 0 });
      return;
    }
    
    if (text.trim().length >= 3) {
      try {
        const oldBalance = await BalanceTrackingService.getCustomerBalance(text);
        updateBalanceInfo({ oldBalance });
      } catch (error) {
        console.error('Error fetching customer balance:', error);
      }
    }
  };

  const handleCustomerSearch = async (query: string) => {
    if (!query.trim()) {
      setIsSearchingCustomers(true);
      try {
        const recentCustomers = await CustomerService.getRecentCustomers(10);
        setCustomerSearchResults(Array.isArray(recentCustomers) ? recentCustomers : []);
        updateCustomerInfo({ isNewCustomer: false });
      } catch (error) {
        setCustomerSearchResults([]);
        updateCustomerInfo({ isNewCustomer: false });
      } finally {
        setIsSearchingCustomers(false);
      }
      return;
    }

    setIsSearchingCustomers(true);
    try {
      let results;
      if (query.trim().length <= 3) {
        results = await CustomerService.searchCustomersImmediate(query);
      } else {
        results = await CustomerService.searchCustomers(query);
      }
      
      const safeResults = Array.isArray(results) ? results : [];
      setCustomerSearchResults(safeResults);
      
      const trimmedQuery = query.trim().toLowerCase();
      const existingCustomer = safeResults.find(
        (customer: UniqueCustomer) => customer.customerName.toLowerCase().trim() === trimmedQuery
      );
      updateCustomerInfo({ isNewCustomer: !existingCustomer });
    } catch (error) {
      setCustomerSearchResults([]);
      updateCustomerInfo({ isNewCustomer: !!query.trim() });
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleCustomerSelect = async (customer: UniqueCustomer) => {
    updateCustomerInfo({
      customerName: customer.customerName,
      isNewCustomer: false
    });
    
    clearError('customer');
    setShowCustomerDropdown(false);
    
    try {
      const oldBalance = await BalanceTrackingService.getCustomerBalance(customer.customerName);
      updateBalanceInfo({ oldBalance });
    } catch (error) {
      updateBalanceInfo({ oldBalance: 0 });
    }
  };

  const handleCustomerFocus = async () => {
    setShowCustomerDropdown(true);
    try {
      await CustomerService.forceRefresh();
    } catch (error) {
      console.error('Error refreshing customer data:', error);
    }
  };

  const handleCustomerBlur = () => {
    setTimeout(() => {
      setShowCustomerDropdown(false);
    }, 200);
  };

  const handleAddParty = () => {
    setShowPartyManagement(true);
    setShowCustomerDropdown(false);
  };

  const handleCreateReceipt = async () => {
    try {
      const result = await createReceipt();
      
      if (result.success && result.receipt) {
        if (customer.isNewCustomer) {
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${result.receipt.receiptNumber} created successfully!\n\n✨ New customer "${customer.customerName}" has been added.\n📦 Stock levels updated.`
          );
          CustomerService.clearCache();
        } else {
          ReceiptAlerts.receiptCreatedSuccessfully(
            `Receipt ${result.receipt.receiptNumber} created successfully!\n\n📦 Stock levels updated.`
          );
        }
        
        handleClearForm();
        onClose();
      } else {
        ReceiptAlerts.receiptSaveError(result.error || 'Failed to create receipt');
      }
    } catch (error) {
      ReceiptAlerts.receiptSaveError('Failed to create receipt. Please try again.');
    }
  };

  const handlePrint = async () => {
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

  // Step validation
  const canProceedFromCustomer = () => {
    return customer.customerName && customer.customerName.trim().length > 0;
  };

  const canProceedFromItems = () => {
    const validItems = formItems.filter(item => 
      item.selectedItemId && 
      parseFloat(item.price) > 0
    );
    return validItems.length > 0;
  };

  // Print options
  if (showPrintOptions) {
    return (
      <PrintOptionsScreen
        onClose={() => setShowPrintOptions(false)}
        cartItems={cartCompatibility.items}
        customerName={cartCompatibility.customerName}
        subtotal={cartCompatibility.subtotal}
        tax={cartCompatibility.tax}
        total={cartCompatibility.total}
        onPrintComplete={handlePrintComplete}
      />
    );
  }

  // Step progress indicator
  const renderStepIndicator = () => {
    const steps = [
      { key: 'customer' as Step, label: 'Customer', icon: 'person' },
      { key: 'items' as Step, label: 'Items', icon: 'cube' },
      { key: 'review' as Step, label: 'Review', icon: 'checkmark-circle' },
    ];

    return (
      <View style={{
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}>
        {steps.map((step, index) => {
          const isActive = currentStep === step.key;
          const isCompleted = 
            (step.key === 'customer' && canProceedFromCustomer()) ||
            (step.key === 'items' && canProceedFromItems());
          
          return (
            <View key={step.key} style={{ flex: 1, alignItems: 'center', position: 'relative' }}>
              {isActive ? (
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#111827',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 4,
                }}>
                  <Ionicons name={step.icon as any} size={20} color="white" />
                </View>
              ) : isCompleted ? (
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#10b981',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <Ionicons name="checkmark" size={18} color="white" />
                </View>
              ) : (
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f3f4f6',
                  borderWidth: 1.5,
                  borderColor: '#e5e7eb',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <Ionicons name={step.icon as any} size={18} color="#9ca3af" />
                </View>
              )}
              {index < steps.length - 1 && (
                <View style={{
                  position: 'absolute',
                  top: 18,
                  left: '60%',
                  width: '80%',
                  height: 2,
                  backgroundColor: isCompleted ? '#10b981' : '#e5e7eb',
                  zIndex: -1,
                }} />
              )}
              <Text style={{
                fontSize: 11,
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#111827' : isCompleted ? '#10b981' : '#6b7280',
                letterSpacing: 0.2,
              }}>
                {step.label}
              </Text>
              {index < steps.length - 1 && (
                <View style={{
                  position: 'absolute',
                  top: 20,
                  left: '50%',
                  width: '100%',
                  height: 2,
                  backgroundColor: '#e5e7eb',
                  zIndex: -1,
                }} />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // Step 1: Customer Information
  const renderCustomerStep = () => (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScrollView 
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: '#111827',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Ionicons name="person-add" size={28} color="white" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6, letterSpacing: -0.5 }}>
              Customer Information
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18 }}>
              Search for an existing customer or create a new one
            </Text>
          </View>

          {/* Customer Name with Search */}
          <View style={{ zIndex: showCustomerDropdown ? 20000 : 1000, position: 'relative', marginBottom: showCustomerDropdown ? 200 : 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                Customer Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              {customer.isNewCustomer && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#dbeafe', borderRadius: 12, borderWidth: 1, borderColor: '#93c5fd' }}>
                  <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '600' }}>NEW CUSTOMER</Text>
                </View>
              )}
            </View>
            <SearchableDropdown
              value={customer.customerName || ''}
              onChangeText={handleCustomerNameChange}
              onSelectCustomer={handleCustomerSelect}
              placeholder="Search or enter customer name"
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

          {/* Previous Balance Information - Display only when customer has outstanding balance */}
          {customer.customerName && balance.oldBalance > 0 && (
            <View style={{
              marginTop: 16,
            }}>
              <View style={{
                padding: 14,
                backgroundColor: '#fef2f2',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#fecaca',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#991b1b', marginBottom: 3, letterSpacing: 0.5 }}>
                      PREVIOUS BALANCE
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#dc2626' }}>
                      {formatCurrency(balance.oldBalance)}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#991b1b', marginTop: 3 }}>
                      💰 Outstanding from previous transactions
                    </Text>
                  </View>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: '#dc2626',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons name="wallet" size={20} color="white" />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
      }}>
        {canProceedFromCustomer() ? (
          <TouchableOpacity
            onPress={() => transitionToStep('items')}
            activeOpacity={0.9}
            style={{
              backgroundColor: '#111827',
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{
              color: 'white',
              fontWeight: '600',
              fontSize: 15,
              marginRight: 6,
              letterSpacing: 0.5,
            }}>
              Continue to Items
            </Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={{
            backgroundColor: '#f3f4f6',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}>
            <Text style={{ color: '#9ca3af', fontWeight: '500', fontSize: 14 }}>
              Enter customer name to continue
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  // Step 2: Items Selection
  const renderItemsStep = () => (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScrollView 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with customer name */}
          <View style={{
            backgroundColor: 'white',
            padding: 14,
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#111827',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="person" size={18} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600', marginBottom: 3, letterSpacing: 0.5 }}>CUSTOMER</Text>
                <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600' }}>{customer.customerName}</Text>
              </View>
            </View>
            
            {/* Paid Receipt Button */}
            <TouchableOpacity
              onPress={() => {
                // Check if current receipt is already paid (amountPaid covers at least the current receipt total)
                const currentReceiptPaid = balance.amountPaid >= receiptTotals.total;
                
                if (currentReceiptPaid) {
                  // If currently paid, unpay the current receipt
                  // Reset amountPaid to 0 (no payment for current receipt)
                  updateBalanceInfo({ 
                    amountPaid: 0
                  });
                } else {
                  // Mark only current receipt as paid (NOT including previous balance)
                  // isPaid will be calculated automatically based on newBalance
                  updateBalanceInfo({ 
                    amountPaid: receiptTotals.total 
                  });
                }
              }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: balance.amountPaid >= receiptTotals.total ? '#10b981' : '#fef3c7',
                borderWidth: 1,
                borderColor: balance.amountPaid >= receiptTotals.total ? '#10b981' : '#fcd34d',
              }}
            >
              <Ionicons 
                name={balance.amountPaid >= receiptTotals.total ? 'checkmark-circle' : 'alert-circle'} 
                size={16} 
                color={balance.amountPaid >= receiptTotals.total ? 'white' : '#92400e'} 
                style={{ marginRight: 6 }} 
              />
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: balance.amountPaid >= receiptTotals.total ? 'white' : '#92400e',
              }}>
                {balance.amountPaid >= receiptTotals.total ? '✓ PAID RECEIPT' : 'UNPAID RECEIPT'}
              </Text>
            </TouchableOpacity>
          </View>

          {isLoadingItems ? (
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 48,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={{ color: '#6b7280', marginTop: 12, fontWeight: '500' }}>Loading items...</Text>
            </View>
          ) : itemsError ? (
            <View style={{
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
              borderRadius: 12,
              padding: 40,
              alignItems: 'center',
            }}>
              <Ionicons name="alert-circle" size={48} color="#dc2626" />
              <Text style={{ color: '#991b1b', textAlign: 'center', marginTop: 12, fontWeight: '500' }}>{itemsError}</Text>
              <TouchableOpacity 
                onPress={() => setItemsLoading(true)}
                activeOpacity={0.9}
                style={{
                  marginTop: 16,
                  backgroundColor: '#dc2626',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {formItems.map((formItem, index) => (
                <View key={formItem.id} style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 14,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 2,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f3f4f6',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 1 }}>
                      ITEM {index + 1}
                    </Text>
                    {formItems.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeItemForm(formItem.id)}
                        activeOpacity={0.7}
                        style={{
                          padding: 5,
                          backgroundColor: '#fef2f2',
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#fecaca',
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                {/* Item Name Dropdown - Full Width */}
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>
                    Item Name <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <Dropdown
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 14,
                      backgroundColor: 'white',
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
                    onChange={(item) => handleItemSelect(formItem.id, item.value)}
                    renderRightIcon={() => (
                      <Ionicons name="chevron-down" size={20} color="#9ca3af" />
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

                {/* Quantity Fields - Grid Layout */}
                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Per Kg
                    </Text>
                    <TextInput
                      value={formItem.pricePerKg || '0.00'}
                      onChangeText={(value) => handleUpdateFormItem(formItem.id, 'pricePerKg', value)}
                      placeholder="0.00"
                      keyboardType="numeric"
                      style={{
                        borderWidth: 1,
                        borderColor: '#d1d5db',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        fontSize: 16,
                        textAlign: 'center',
                        backgroundColor: 'white',
                      }}
                    />
                  </View>

                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                      Kg <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      value={formItem.kg || '0'}
                      onChangeText={(value) => handleUpdateFormItem(formItem.id, 'kg', value)}
                      placeholder="0"
                      keyboardType="numeric"
                      style={{
                        borderWidth: 1,
                        borderColor: '#d1d5db',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        fontSize: 16,
                        textAlign: 'center',
                        backgroundColor: 'white',
                      }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
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
                        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                      )}
                    />
                  </View>
                </View>

                  {/* Item Total */}
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: '#f9fafb',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    marginTop: 4,
                  }}>
                    <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500' }}>Item Total</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                      {formatCurrency(parseFloat(formItem.calculatedPrice || formItem.price || '0') || 0)}
                    </Text>
                  </View>

                  {formItem.stockError && (
                    <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 8, fontWeight: '600' }}>
                      {formItem.stockError}
                    </Text>
                  )}
                </View>
              ))}

              {/* Add Item Button */}
              <TouchableOpacity
                onPress={addNewItemForm}
                activeOpacity={0.9}
                style={{
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'white',
                  borderWidth: 2,
                  borderColor: '#111827',
                  borderStyle: 'dashed',
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#111827" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                  Add Another Item
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
      }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => transitionToStep('customer')}
            activeOpacity={0.9}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 18,
              backgroundColor: 'white',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#111827" style={{ marginRight: 6 }} />
            <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (!canProceedFromItems()) {
                setError('form', 'Please add at least one valid item');
                return;
              }
              transitionToStep('review');
            }}
            disabled={!canProceedFromItems()}
            activeOpacity={0.9}
            style={{
              flex: 1,
              backgroundColor: canProceedFromItems() ? '#111827' : '#f3f4f6',
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: canProceedFromItems() ? 0.15 : 0,
              shadowRadius: 4,
              elevation: canProceedFromItems() ? 3 : 0,
              borderWidth: canProceedFromItems() ? 0 : 1,
              borderColor: '#e5e7eb',
            }}
          >
            <Text style={{
              color: canProceedFromItems() ? 'white' : '#9ca3af',
              fontWeight: '600',
              fontSize: 15,
              marginRight: 6,
              letterSpacing: 0.5,
            }}>
              Review & Total
            </Text>
            <Ionicons name="arrow-forward" size={18} color={canProceedFromItems() ? 'white' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  // Step 3: Review & Total
  const renderReviewStep = () => {
    const validItems = formItems.filter(item => 
      item.selectedItemId && 
      parseFloat(item.price) > 0
    );

    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <ScrollView 
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Customer Summary */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              marginBottom: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 1 }}>
                CUSTOMER DETAILS
              </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Name:</Text>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>
                {customer.customerName}
              </Text>
            </View>
            {balance.oldBalance > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>Old Balance:</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#dc2626' }}>
                  {formatCurrency(balance.oldBalance)}
                </Text>
              </View>
            )}
            {balance.isPaid && balance.amountPaid > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>Amount Paid:</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#10b981' }}>
                  {formatCurrency(balance.amountPaid)}
                </Text>
              </View>
            )}
          </View>
          
          {/* Payment Status Badge - Prominent */}
          <TouchableOpacity
            onPress={() => transitionToStep('items')}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              marginBottom: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
              borderWidth: 2,
              borderColor: balance.amountPaid >= receiptTotals.total ? '#10b981' : '#fbbf24',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: balance.amountPaid >= receiptTotals.total ? '#10b981' : '#fbbf24',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons 
                    name={balance.amountPaid >= receiptTotals.total ? 'checkmark-circle' : 'alert-circle'} 
                    size={24} 
                    color="white" 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 10, 
                    color: '#6b7280', 
                    fontWeight: '600', 
                    marginBottom: 3,
                    letterSpacing: 0.5 
                  }}>
                    PAYMENT STATUS
                  </Text>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: '700', 
                    color: balance.amountPaid >= receiptTotals.total ? '#10b981' : '#d97706',
                    letterSpacing: 0.3
                  }}>
                    {balance.amountPaid >= receiptTotals.total ? '✓ PAID RECEIPT' : '⚠ UNPAID RECEIPT'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {balance.amountPaid >= receiptTotals.total 
                      ? `Payment: ${formatCurrency(balance.amountPaid)}`
                      : 'Tap to mark as paid'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>

            {/* Items Summary */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              marginBottom: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 1 }}>
                ITEMS ({validItems.length})
              </Text>
            {validItems.map((formItem, index) => {
              const selectedItem = availableItems.find(item => item.id === formItem.selectedItemId);
              return (
                <View key={formItem.id} style={{
                  paddingVertical: 10,
                  borderBottomWidth: index < validItems.length - 1 ? 1 : 0,
                  borderBottomColor: '#f3f4f6',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937', flex: 1 }}>
                      {selectedItem?.item_name || 'Unknown Item'}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }}>
                      {formatCurrency(parseFloat(formItem.calculatedPrice || formItem.price || '0') || 0)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                    {formItem.kg}kg {formItem.gms ? `${formItem.gms}g` : ''} @ {formatCurrency(parseFloat(formItem.pricePerKg || '0'))}
                  </Text>
                </View>
              );
            })}
          </View>

            {/* Total Breakdown */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              marginBottom: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 12, letterSpacing: 1 }}>
                TOTAL BREAKDOWN
              </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Subtotal:</Text>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>
                {formatCurrency(receiptTotals.subtotal)}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>Tax ({taxRate}%):</Text>
                <TouchableOpacity
                  onPress={() => setShowTaxSettings(true)}
                  style={{ marginLeft: 6, padding: 3 }}
                >
                  <Ionicons name="pencil" size={13} color="#2563eb" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>
                {formatCurrency(receiptTotals.tax)}
              </Text>
            </View>
            
              <View style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: '#111827',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 4,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Total:</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>
                  {formatCurrency(receiptTotals.total)}
                </Text>
              </View>

              {balance.newBalance !== receiptTotals.total && (
                <View style={{
                  marginTop: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: balance.newBalance > 0 ? '#fef2f2' : '#ecfdf5',
                  borderWidth: 1,
                  borderColor: balance.newBalance > 0 ? '#fecaca' : '#a7f3d0',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: balance.newBalance > 0 ? '#991b1b' : '#065f46' }}>New Balance:</Text>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: balance.newBalance > 0 ? '#dc2626' : '#10b981' }}>
                    {formatCurrency(balance.newBalance)}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Action Buttons */}
        <View style={{
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          padding: 16,
        }}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => transitionToStep('items')}
              activeOpacity={0.9}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: 'white',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-back" size={16} color="#111827" style={{ marginRight: 6 }} />
              <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClearForm}
              activeOpacity={0.9}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: 'white',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={handleCreateReceipt}
              disabled={isProcessing}
              activeOpacity={0.9}
              style={{
                flex: 1,
                backgroundColor: '#10b981',
                borderRadius: 12,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isProcessing ? 0.7 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              {isProcessing && (
                <ActivityIndicator size="small" color="white" style={{ marginRight: 6 }} />
              )}
              <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{
                color: 'white',
                fontWeight: '600',
                fontSize: 14,
                letterSpacing: 0.5,
              }}>
                Save
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePrint}
              disabled={isProcessing}
              activeOpacity={0.9}
              style={{
                flex: 1,
                backgroundColor: '#111827',
                borderRadius: 12,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isProcessing ? 0.7 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              {isProcessing && (
                <ActivityIndicator size="small" color="white" style={{ marginRight: 6 }} />
              )}
              <Ionicons name="print-outline" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{
                color: 'white',
                fontWeight: '600',
                fontSize: 14,
                letterSpacing: 0.5,
              }}>
                Print
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

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
      <View style={{
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}>
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <TouchableOpacity 
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              backgroundColor: '#f9fafb',
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={{
            fontSize: 16,
            fontWeight: '700',
            color: '#111827',
            letterSpacing: -0.3,
          }}>
            Create Receipt
          </Text>
          <View style={{ width: 36, height: 36 }} />
        </View>
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      {currentStep === 'customer' && renderCustomerStep()}
      {currentStep === 'items' && renderItemsStep()}
      {currentStep === 'review' && renderReviewStep()}

      {/* Modals */}
      <Modal
        visible={showPartyManagement}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPartyManagement(false)}
      >
        <PartyManagementScreen onBack={() => setShowPartyManagement(false)} />
      </Modal>

      <TaxSettingsModal
        visible={showTaxSettings}
        onClose={() => setShowTaxSettings(false)}
        onTaxRateUpdated={async () => {
          try {
            await loadTaxRate();
          } catch (e) {
            console.log('Failed to refresh tax rate', e);
          } finally {
            setShowTaxSettings(false);
          }
        }}
      />
    </View>
  );
};

export default ReceiptCreationScreen;
