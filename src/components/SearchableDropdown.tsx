import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UniqueCustomer } from '../services/CustomerService';

interface SearchableDropdownProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectCustomer?: (customer: UniqueCustomer) => void;
  placeholder?: string;
  error?: string;
  searchResults: UniqueCustomer[];
  isSearching: boolean;
  showDropdown: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSearch: (query: string) => void;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  value,
  onChangeText,
  onSelectCustomer,
  placeholder = "Enter customer name",
  error,
  searchResults,
  isSearching,
  showDropdown,
  onFocus,
  onBlur,
  onSearch,
}) => {
  const [inputHeight, setInputHeight] = useState(0);
  const [inputPosition, setInputPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);

  const screenHeight = Dimensions.get('window').height;
  const maxDropdownHeight = 200;

  useEffect(() => {
    if (showDropdown && containerRef.current) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        setInputPosition({ x, y: y + height });
        setInputHeight(height);
      });
    }
  }, [showDropdown]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    onSearch(text);
  };

  const handleSelectCustomer = (customer: UniqueCustomer) => {
    onChangeText(customer.customerName);
    onSelectCustomer?.(customer);
    onBlur();
  };

  const handleInputFocus = () => {
    onFocus();
    // Load recent customers when focused
    onSearch(value);
  };

  const renderDropdownItem = (customer: UniqueCustomer, index: number) => (
    <TouchableOpacity
      key={`${customer.customerName}-${index}`}
      onPress={() => handleSelectCustomer(customer)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: index < searchResults.length - 1 ? 1 : 0,
        borderBottomColor: '#f0f0f0',
        backgroundColor: 'white',
      }}
      activeOpacity={0.7}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '500',
            color: '#374151',
            marginBottom: 2,
          }}>
            {customer.customerName}
          </Text>
          {(customer.businessName || customer.businessPhone) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {customer.businessName && (
                <Text style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginRight: 12,
                }}>
                  📧 {customer.businessName}
                </Text>
              )}
              {customer.businessPhone && (
                <Text style={{
                  fontSize: 12,
                  color: '#6b7280',
                }}>
                  📞 {customer.businessPhone}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 8,
        }}>
          {customer.receiptCount > 1 && (
            <View style={{
              backgroundColor: '#e5e7eb',
              borderRadius: 12,
              paddingHorizontal: 6,
              paddingVertical: 2,
              marginRight: 8,
            }}>
              <Text style={{
                fontSize: 10,
                color: '#6b7280',
                fontWeight: '500',
              }}>
                {customer.receiptCount} receipts
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
      </View>
    </TouchableOpacity>
  );

  // Calculate dropdown position
  const dropdownTop = inputPosition.y;
  const availableSpaceBelow = screenHeight - dropdownTop;
  const dropdownHeight = Math.min(
    maxDropdownHeight,
    availableSpaceBelow - 100, // Leave some space for keyboard
(searchResults ? searchResults.length : 0) * 60 + 20 // Approximate item height + padding
  );

  return (
    <View ref={containerRef} style={{ position: 'relative', zIndex: 1000 }}>
      {/* Input Field */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: error ? '#ef4444' : '#d1d5db',
        borderRadius: 8,
        backgroundColor: 'white',
        paddingRight: 12,
      }}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleTextChange}
          onFocus={handleInputFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{
            flex: 1,
            paddingHorizontal: 12,
            paddingVertical: 12,
            fontSize: 16,
            color: '#374151',
          }}
          autoCapitalize="words"
          autoCorrect={false}
          placeholderTextColor="#9ca3af"
        />
        
        {isSearching ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : value ? (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              onSearch('');
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="search" size={20} color="#9ca3af" />
        )}
      </View>

      {/* Error Message */}
      {error && (
        <Text style={{
          color: '#ef4444',
          fontSize: 14,
          marginTop: 4,
          marginLeft: 4,
        }}>
          {error}
        </Text>
      )}

      {/* Dropdown Results */}
      {showDropdown && ((searchResults && searchResults.length > 0) || isSearching) && (
        <View
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            maxHeight: dropdownHeight,
            elevation: Platform.OS === 'android' ? 5 : 0,
            shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
            shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 4 } : { width: 0, height: 0 },
            shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
            shadowRadius: Platform.OS === 'ios' ? 8 : 0,
            zIndex: 1000,
            marginTop: 4,
          }}
        >
          {isSearching ? (
            <View style={{
              paddingVertical: 20,
              alignItems: 'center',
            }}>
              <ActivityIndicator size="small" color="#6b7280" />
              <Text style={{
                color: '#6b7280',
                fontSize: 14,
                marginTop: 8,
              }}>
                Searching customers...
              </Text>
            </View>
          ) : searchResults && searchResults.length > 0 ? (
            <ScrollView
              style={{ maxHeight: dropdownHeight }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {searchResults.map((customer, index) => renderDropdownItem(customer, index))}
              {searchResults.length >= 10 && (
                <View style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: '#f9fafb',
                  borderTopWidth: 1,
                  borderTopColor: '#e5e7eb',
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: '#6b7280',
                    textAlign: 'center',
                    fontStyle: 'italic',
                  }}>
                    Showing top 10 results. Type to narrow search.
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={{
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}>
              <Ionicons name="person-add-outline" size={24} color="#10b981" />
              <Text style={{
                color: '#10b981',
                fontSize: 14,
                textAlign: 'center',
                marginTop: 8,
                fontWeight: '500',
              }}>
                ✨ New Customer
              </Text>
              <Text style={{
                color: '#6b7280',
                fontSize: 12,
                textAlign: 'center',
                marginTop: 4,
              }}>
                "{value}" will be added as a new customer
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default SearchableDropdown;
