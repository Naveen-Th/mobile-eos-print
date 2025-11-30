import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Modal, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptAlerts } from './common';
import { useReceiptIntegration } from '../hooks/useReceiptIntegration';
import CustomerService, { UniqueCustomer } from '../services/data/CustomerService';
import { useBalanceStore } from '../stores/balanceStore';
import PartyManagementScreen from '../screens/PartyManagementScreen';
import TaxSettingsModal from './TaxSettingsModal';
import { PrintOptionsScreen } from './PrintOptionsScreen';

// Step Components
import StepIndicator from './receipt/StepIndicator';
import CustomerStep from './receipt/CustomerStep';
import ItemsStep from './receipt/ItemsStep';
import ReviewStep from './receipt/ReviewStep';

type Step = 'customer' | 'items' | 'review';

interface ReceiptCreationScreenProps {
  onClose: () => void;
  visible: boolean;
}

const ReceiptCreationScreen: React.FC<ReceiptCreationScreenProps> = ({ onClose, visible }) => {
  const { store, cartCompatibility } = useReceiptIntegration(visible);
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
    loadTaxRate,
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
  const [isCustomerServiceReady, setIsCustomerServiceReady] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Initialize CustomerService when screen becomes visible
  useEffect(() => {
    if (visible) {
      console.log('✅ Receipt modal opened - resetting to customer step');
      setCurrentStep('customer');

      CustomerService.initialize()
        .then(() => {
          setIsCustomerServiceReady(true);
          console.log('CustomerService initialized');
        })
        .catch(err => {
          console.error('Failed to initialize CustomerService:', err);
          setIsCustomerServiceReady(false);
        });
    }
  }, [visible]);

  // Step transition with keyboard dismiss
  const transitionToStep = useCallback((nextStep: Step) => {
    Keyboard.dismiss();
    setCurrentStep(nextStep);
  }, []);

  // Field update handler
  const handleUpdateFormItem = useCallback((id: string, field: string, value: string) => {
    if (field === 'qty_200g' || field === 'qty_100g' || field === 'qty_50g' || field === 'pricePerKg') {
      if (value && value !== '0' && !value.includes('.')) {
        value = value.replace(/^0+/, '') || '0';
      }
    }
    updateFormItem(id, field as any, value);
  }, [updateFormItem]);

  // Customer handlers
  const handleCustomerNameChange = useCallback(async (text: string) => {
    updateCustomerInfo({ customerName: text });
    clearError('customer');

    // Reset balance when clearing customer name
    if (!text.trim()) {
      updateBalanceInfo({ oldBalance: 0, isManualOldBalance: false, amountPaid: 0 });
      setIsLoadingBalance(false);
      return;
    }

    // Don't fetch balance while typing - only when customer is selected
    // This prevents slow queries on every keystroke
  }, [updateCustomerInfo, clearError, updateBalanceInfo]);

  const handleCustomerSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Load ALL customers when no search query (show all saved parties)
      try {
        const recentCustomers = await CustomerService.getRecentCustomers(1000); // Fetch up to 1000 customers
        setCustomerSearchResults(Array.isArray(recentCustomers) ? recentCustomers : []);
        updateCustomerInfo({ isNewCustomer: false });
      } catch (error) {
        setCustomerSearchResults([]);
        updateCustomerInfo({ isNewCustomer: false });
      }
      return;
    }

    setIsSearchingCustomers(true);
    try {
      const results = await CustomerService.searchCustomersImmediate(query);
      const safeResults = Array.isArray(results) ? results : [];
      setCustomerSearchResults(safeResults);

      const trimmedQuery = query.trim().toLowerCase();
      const existingCustomer = safeResults.find(
        (cust: UniqueCustomer) => cust.customerName.toLowerCase().trim() === trimmedQuery
      );
      updateCustomerInfo({ isNewCustomer: !existingCustomer });
    } catch (error) {
      setCustomerSearchResults([]);
      updateCustomerInfo({ isNewCustomer: !!query.trim() });
    } finally {
      setIsSearchingCustomers(false);
    }
  }, [updateCustomerInfo]);

  const handleCustomerSelect = useCallback(async (cust: UniqueCustomer) => {
    updateCustomerInfo({
      customerName: cust.customerName,
      isNewCustomer: false
    });

    clearError('customer');
    setShowCustomerDropdown(false);

    // ✅ Fetch balance using Zustand BalanceStore
    setIsLoadingBalance(true);
    try {
      const oldBalance = await useBalanceStore.getState().calculateBalance(cust.customerName);
      // Auto-fetched balance is NOT manual - it's dynamically calculated from existing receipts
      updateBalanceInfo({ oldBalance, isManualOldBalance: false });
    } catch (error) {
      console.error('Error fetching customer balance:', error);
      updateBalanceInfo({ oldBalance: 0, isManualOldBalance: false });
    } finally {
      setIsLoadingBalance(false);
    }
  }, [updateCustomerInfo, clearError, updateBalanceInfo]);

  const handleCustomerFocus = useCallback(async () => {
    setShowCustomerDropdown(true);
    if (isCustomerServiceReady) {
      try {
        // Load ALL customers when dropdown opens (show all saved parties)
        const allCustomers = await CustomerService.getRecentCustomers(1000); // Fetch up to 1000 customers
        setCustomerSearchResults(Array.isArray(allCustomers) ? allCustomers : []);
      } catch (error) {
        console.error('Error loading customers:', error);
      }
    }
  }, [isCustomerServiceReady]);

  const handleCustomerBlur = useCallback(() => {
    setTimeout(() => {
      setShowCustomerDropdown(false);
    }, 200);
  }, []);

  const handleManualBalanceChange = useCallback((value: number) => {
    // When user manually enters a balance, mark it as manual
    // This affects how payment cascade works - manual balance is consumed on this receipt
    updateBalanceInfo({ oldBalance: value, isManualOldBalance: true });
  }, [updateBalanceInfo]);

  // Item handlers
  const handleItemSelect = useCallback(async (formId: string, itemId: string) => {
    await selectItem(formId, itemId);
  }, [selectItem]);

  const handleTogglePaymentStatus = useCallback(() => {
    const currentReceiptPaid = balance.amountPaid >= receiptTotals.total;

    if (currentReceiptPaid) {
      updateBalanceInfo({ amountPaid: 0 });
    } else {
      updateBalanceInfo({ amountPaid: receiptTotals.total });
    }
  }, [balance.amountPaid, receiptTotals.total, updateBalanceInfo]);

  // Form handlers
  const handleClearForm = useCallback(() => {
    clearForm();
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setCurrentStep('customer');
  }, [clearForm]);

  const handleClose = useCallback(() => {
    console.log('🚪 Closing receipt screen');
    Keyboard.dismiss();
    handleClearForm();
    setShowPrintOptions(false);
    setShowPartyManagement(false);
    setShowTaxSettings(false);
    onClose();
  }, [handleClearForm, onClose]);

  // Submit handlers
  const handleCreateReceipt = useCallback(async () => {
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
  }, [createReceipt, customer.isNewCustomer, customer.customerName, handleClearForm, onClose]);

  const handlePrint = useCallback(async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    const validItems = formItems.filter(item =>
      item.selectedItemId && parseFloat(item.price) > 0 && parseInt(item.quantity) > 0
    );

    if (validItems.length === 0) {
      ReceiptAlerts.validationError('Items Selection', 'Please select at least one valid item');
      return;
    }

    setShowPrintOptions(true);
  }, [validateForm, formItems]);

  const handlePrintComplete = useCallback(() => {
    handleClearForm();
    onClose();
  }, [handleClearForm, onClose]);

  // Validation memoization
  const canProceedFromCustomer = useMemo(() => {
    return customer.customerName && customer.customerName.trim().length > 0;
  }, [customer.customerName]);

  const canProceedFromItems = useMemo(() => {
    const validItems = formItems.filter(item =>
      item.selectedItemId && parseFloat(item.price) > 0
    );
    return validItems.length > 0;
  }, [formItems]);

  // Print options screen
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

  if (!visible) return null;

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
            onPress={handleClose}
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
      <StepIndicator
        currentStep={currentStep}
        canProceedFromCustomer={canProceedFromCustomer}
        canProceedFromItems={canProceedFromItems}
      />

      {/* Step Content */}
      {currentStep === 'customer' && (
        <CustomerStep
          customerName={customer.customerName}
          isNewCustomer={customer.isNewCustomer}
          oldBalance={balance.oldBalance}
          error={errors.customer}
          searchResults={customerSearchResults}
          isSearching={isSearchingCustomers}
          showDropdown={showCustomerDropdown}
          isLoadingBalance={isLoadingBalance}
          onCustomerNameChange={handleCustomerNameChange}
          onCustomerSearch={handleCustomerSearch}
          onCustomerSelect={handleCustomerSelect}
          onCustomerFocus={handleCustomerFocus}
          onCustomerBlur={handleCustomerBlur}
          onAddParty={() => setShowPartyManagement(true)}
          onNext={() => transitionToStep('items')}
          onManualBalanceChange={handleManualBalanceChange}
          canProceed={canProceedFromCustomer}
        />
      )}

      {currentStep === 'items' && (
        <ItemsStep
          customerName={customer.customerName}
          formItems={formItems}
          availableItems={availableItems}
          isLoadingItems={isLoadingItems}
          itemsError={itemsError}
          amountPaid={balance.amountPaid}
          receiptTotal={receiptTotals.total}
          onItemSelect={handleItemSelect}
          onUpdateField={handleUpdateFormItem}
          onAddItem={addFormItem}
          onRemoveItem={removeFormItem}
          onTogglePaymentStatus={handleTogglePaymentStatus}
          onBack={() => transitionToStep('customer')}
          onNext={() => transitionToStep('review')}
          canProceed={canProceedFromItems}
          setItemsLoading={setItemsLoading}
          setItemsError={setItemsError}
        />
      )}

      {currentStep === 'review' && (
        <ReviewStep
          customerName={customer.customerName}
          formItems={formItems}
          availableItems={availableItems}
          subtotal={receiptTotals.subtotal}
          tax={receiptTotals.tax}
          total={receiptTotals.total}
          taxRate={taxRate}
          amountPaid={balance.amountPaid}
          oldBalance={balance.oldBalance}
          newBalance={balance.newBalance}
          onEditTax={() => setShowTaxSettings(true)}
          onBack={() => transitionToStep('items')}
          onClear={handleClearForm}
          onSave={handleCreateReceipt}
          onPrint={handlePrint}
          isProcessing={isProcessing}
        />
      )}

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
