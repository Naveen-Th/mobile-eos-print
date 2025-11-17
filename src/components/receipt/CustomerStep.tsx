import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomerSearchModal from '../CustomerSearchModal';
import { UniqueCustomer } from '../../services/data/CustomerService';
import { formatCurrency } from '../../utils';

interface CustomerStepProps {
  customerName: string;
  isNewCustomer: boolean;
  oldBalance: number;
  error?: string;
  searchResults: UniqueCustomer[];
  isSearching: boolean;
  showDropdown: boolean;
  isLoadingBalance?: boolean;
  onCustomerNameChange: (text: string) => void;
  onCustomerSearch: (query: string) => void;
  onCustomerSelect: (customer: UniqueCustomer) => void;
  onCustomerFocus: () => void;
  onCustomerBlur: () => void;
  onAddParty: () => void;
  onNext: () => void;
  onManualBalanceChange: (value: number) => void;
  canProceed: boolean;
}

const CustomerStep: React.FC<CustomerStepProps> = ({
  customerName,
  isNewCustomer,
  oldBalance,
  error,
  searchResults,
  isSearching,
  showDropdown,
  isLoadingBalance = false,
  onCustomerNameChange,
  onCustomerSearch,
  onCustomerSelect,
  onCustomerFocus,
  onCustomerBlur,
  onAddParty,
  onNext,
  onManualBalanceChange,
  canProceed,
}) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [manualBalanceInput, setManualBalanceInput] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScrollView 
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
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

            {/* Customer Name with Search */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', letterSpacing: -0.2 }}>
                  Customer Name <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                {isNewCustomer && (
                  <View style={{ 
                    paddingHorizontal: 12, 
                    paddingVertical: 5, 
                    backgroundColor: '#dbeafe', 
                    borderRadius: 8, 
                    borderWidth: 1, 
                    borderColor: '#93c5fd' 
                  }}>
                    <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '700', letterSpacing: 0.3 }}>NEW CUSTOMER</Text>
                  </View>
                )}
              </View>
              
              {/* Customer Input Field - Opens Modal */}
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(true);
                  onCustomerFocus();
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: error ? '#ef4444' : '#e5e7eb',
                  borderRadius: 12,
                  backgroundColor: '#fafafa',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <Ionicons name="search" size={22} color="#9ca3af" style={{ marginRight: 12 }} />
                <Text style={{
                  flex: 1,
                  fontSize: 15,
                  color: customerName ? '#1f2937' : '#9ca3af',
                  fontWeight: customerName ? '400' : '400',
                }}>
                  {customerName || 'Search or enter customer name'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
              
              {error && (
                <Text style={{
                  color: '#ef4444',
                  fontSize: 14,
                  marginTop: 6,
                  marginLeft: 4,
                }}>
                  {error}
                </Text>
              )}
            </View>
            
            {/* Customer Search Modal */}
            <CustomerSearchModal
              visible={showSearchModal}
              value={customerName || ''}
              onChangeText={onCustomerNameChange}
              onSelectCustomer={onCustomerSelect}
              onClose={() => {
                setShowSearchModal(false);
                onCustomerBlur();
              }}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearch={onCustomerSearch}
              onAddParty={onAddParty}
            />

            {/* Previous Balance Input (Manual or Auto-fetched) */}
            {customerName && (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', letterSpacing: -0.2 }}>
                    Previous Balance <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '400' }}>(Optional)</Text>
                  </Text>
                  {!isManualMode && !isLoadingBalance && (
                    <TouchableOpacity
                      onPress={() => {
                        setIsManualMode(true);
                        setManualBalanceInput(oldBalance > 0 ? oldBalance.toString() : '');
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        backgroundColor: '#f3f4f6',
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#374151', fontWeight: '600' }}>EDIT</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isLoadingBalance ? (
                  // Loading State
                  <View style={{
                    padding: 14,
                    backgroundColor: '#f3f4f6',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                  }}>
                    <ActivityIndicator size="small" color="#3b82f6" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>
                      Loading previous balance...
                    </Text>
                  </View>
                ) : isManualMode ? (
                  // Manual Input Mode (only when explicitly enabled)
                  <View>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: '#e5e7eb',
                      borderRadius: 12,
                      backgroundColor: 'white',
                      paddingHorizontal: 16,
                      paddingVertical: 4,
                    }}>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: '#6b7280', marginRight: 8 }}>₹</Text>
                      <TextInput
                        value={manualBalanceInput}
                        onChangeText={(text) => {
                          const cleanText = text.replace(/[^0-9.]/g, '');
                          const parts = cleanText.split('.');
                          if (parts.length > 2) return;
                          setManualBalanceInput(cleanText);
                          const value = parseFloat(cleanText) || 0;
                          onManualBalanceChange(value);
                        }}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        autoFocus
                        style={{
                          flex: 1,
                          fontSize: 18,
                          fontWeight: '600',
                          color: '#1f2937',
                          paddingVertical: 12,
                        }}
                      />
                      {manualBalanceInput && (
                        <TouchableOpacity
                          onPress={() => {
                            setManualBalanceInput('');
                            onManualBalanceChange(0);
                          }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="close-circle" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
                        Enter any outstanding balance from previous transactions
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsManualMode(false);
                          setManualBalanceInput('');
                        }}
                        style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                      >
                        <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '600' }}>CANCEL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // ✅ Display Mode - Show balance (whether ₹0 or not) with EDIT button
                  <View style={{
                    padding: 14,
                    backgroundColor: oldBalance > 0 ? '#fef2f2' : '#f0fdf4',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: oldBalance > 0 ? '#fecaca' : '#bbf7d0',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: oldBalance > 0 ? '#991b1b' : '#166534', marginBottom: 3, letterSpacing: 0.5 }}>
                          {oldBalance > 0 ? 'AUTO-FETCHED BALANCE' : 'NO OUTSTANDING BALANCE'}
                        </Text>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: oldBalance > 0 ? '#dc2626' : '#16a34a' }}>
                          {formatCurrency(oldBalance)}
                        </Text>
                        <Text style={{ fontSize: 11, color: oldBalance > 0 ? '#991b1b' : '#166534', marginTop: 3 }}>
                          {oldBalance > 0 ? '💰 Outstanding from previous transactions' : '✓ Customer has no pending balance'}
                        </Text>
                      </View>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: oldBalance > 0 ? '#dc2626' : '#16a34a',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons name="wallet" size={20} color="white" />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Action Button */}
      <View style={{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        padding: 16,
      }}>
        {canProceed ? (
          <TouchableOpacity
            onPress={onNext}
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
    </View>
  );
};

export default CustomerStep;
