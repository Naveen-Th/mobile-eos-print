import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UniqueCustomer } from '../services/data/CustomerService';
import { useDebouncedCallback } from '../hooks/useDebounce';
import CustomerListItem from './ui/CustomerListItem';
import { CustomerListSkeleton } from './ui/SkeletonLoader';

interface CustomerSearchModalProps {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onSelectCustomer?: (customer: UniqueCustomer) => void;
  onClose: () => void;
  searchResults: UniqueCustomer[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onAddParty?: () => void;
}

const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  visible,
  value,
  onChangeText,
  onSelectCustomer,
  onClose,
  searchResults,
  isSearching,
  onSearch,
  onAddParty,
}) => {
  // Debounced search
  const debouncedSearch = useDebouncedCallback((text: string) => {
    onSearch(text);
  }, 100);

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
    debouncedSearch(text);
  }, [onChangeText, debouncedSearch]);

  const handleSelectCustomer = useCallback((customer: UniqueCustomer) => {
    onChangeText(customer.customerName);
    onSelectCustomer?.(customer);
    onClose();
  }, [onChangeText, onSelectCustomer, onClose]);

  // Limit results for display - optimized virtualization
  const displayedResults = useMemo(() => {
    const maxResults = 100; // Show up to 100 for better UX
    return searchResults.slice(0, maxResults);
  }, [searchResults]);

  // Memoized render of customer list items
  const renderedItems = useMemo(() => {
    return displayedResults.map((customer, index) => (
      <CustomerListItem
        key={customer.id || `${customer.customerName}-${index}`}
        customer={customer}
        index={index}
        total={displayedResults.length}
        onSelect={handleSelectCustomer}
        searchQuery={value}
      />
    ));
  }, [displayedResults, handleSelectCustomer, value]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#f3f4f6',
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: '#1f2937',
            letterSpacing: -0.3,
          }}>
            Select Customer
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#f3f4f6',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fafafa' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#e5e7eb',
            borderRadius: 12,
            backgroundColor: '#ffffff',
            paddingRight: 14,
          }}>
            <Ionicons name="search" size={20} color="#9ca3af" style={{ marginLeft: 16 }} />
            <TextInput
              value={value}
              onChangeText={handleTextChange}
              placeholder="Search customer name, business, or phone"
              style={{
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 14,
                fontSize: 15,
                color: '#1f2937',
                fontWeight: '400',
              }}
              autoCapitalize="words"
              autoCorrect={false}
              placeholderTextColor="#9ca3af"
              autoFocus={true}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : value ? (
              <TouchableOpacity
                onPress={() => {
                  onChangeText('');
                  onSearch('');
                }}
                style={{ padding: 4 }}
                activeOpacity={0.6}
              >
                <Ionicons name="close-circle" size={22} color="#6b7280" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Results Header */}
        {!isSearching && displayedResults.length > 0 && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 18,
            paddingVertical: 12,
            backgroundColor: '#fafafa',
            borderBottomWidth: 1,
            borderBottomColor: '#f3f4f6',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '700',
              color: '#6b7280',
              letterSpacing: -0.2,
              textTransform: 'uppercase',
            }}>
              {value.trim()
                ? `Found ${searchResults.length} ${searchResults.length === 1 ? 'customer' : 'customers'}`
                : `${searchResults.length} Saved Customers`
              }
            </Text>
            {onAddParty && (
              <TouchableOpacity
                onPress={() => {
                  onAddParty();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#3b82f6',
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: -0.1,
                }}>
                  Add new party
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer List */}
        <ScrollView
          style={{ flex: 1, backgroundColor: '#ffffff' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
        >
          {isSearching ? (
            <CustomerListSkeleton count={8} />
          ) : displayedResults.length > 0 ? (
            <>
              {renderedItems}
              {searchResults.length > 100 && (
                <View style={{
                  paddingVertical: 20,
                  paddingHorizontal: 18,
                  backgroundColor: '#fafafa',
                  borderTopWidth: 1,
                  borderTopColor: '#f3f4f6',
                }}>
                  <Text style={{
                    fontSize: 13,
                    color: '#6b7280',
                    textAlign: 'center',
                    fontWeight: '500',
                    lineHeight: 18,
                  }}>
                    💡 Showing first 100 of {searchResults.length} customers. Refine your search to find specific customers.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={{
              flex: 1,
              paddingVertical: 80,
              paddingHorizontal: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#f3f4f6',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Ionicons name={value.trim() ? "search-outline" : "people-outline"} size={40} color="#9ca3af" />
              </View>
              <Text style={{
                color: '#374151',
                fontSize: 17,
                textAlign: 'center',
                fontWeight: '600',
                marginBottom: 8,
              }}>
                {value.trim() ? 'No customers found' : 'No saved customers yet'}
              </Text>
              <Text style={{
                color: '#9ca3af',
                fontSize: 14,
                textAlign: 'center',
                lineHeight: 20,
                marginBottom: 24,
              }}>
                {value.trim()
                  ? 'Try a different search term'
                  : 'Add your first customer to get started'}
              </Text>
              {onAddParty && (
                <TouchableOpacity
                  onPress={() => {
                    onAddParty();
                    onClose();
                  }}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: '#3b82f6',
                    borderRadius: 10,
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: '600',
                  }}>
                    Add New Customer
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default CustomerSearchModal;
