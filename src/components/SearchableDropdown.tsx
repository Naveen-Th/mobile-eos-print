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
  onAddParty?: () => void;
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
  onAddParty,
}) => {
  const [inputHeight, setInputHeight] = useState(0);
  const [inputPosition, setInputPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);

  const screenHeight = Dimensions.get('window').height;
  const maxDropdownHeight = 320; // Increased max height

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
          }}>
            {customer.customerName}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 8,
        }}>
          {(customer.receiptCount || 0) > 1 && (
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
  const estimatedItemHeight = 70; // Increased item height estimate
  const headerHeight = 50; // Height for header section
  const estimatedContentHeight = (searchResults ? searchResults.length : 0) * estimatedItemHeight + headerHeight;
  
  const dropdownHeight = Math.min(
    maxDropdownHeight,
    availableSpaceBelow - 120, // Leave space for keyboard
    estimatedContentHeight
  );

  return (
    <View ref={containerRef} style={{ position: 'relative', zIndex: showDropdown ? 10000 : 1000 }}>
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
      {showDropdown && (
        <View
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#d1d5db',
            maxHeight: dropdownHeight,
            elevation: Platform.OS === 'android' ? 10 : 0,
            shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
            shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 8 } : { width: 0, height: 0 },
            shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0,
            shadowRadius: Platform.OS === 'ios' ? 12 : 0,
            zIndex: 20000,
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
            <View>
              {/* Header with "Showing Saved Parties" and "Add new party" */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: '#f9fafb',
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                }}>
                  Showing Saved Parties
                </Text>
                {onAddParty && (
                  <TouchableOpacity
                    onPress={() => {
                      onAddParty();
                      onBlur();
                    }}
                  >
                    <Text style={{
                      color: '#3b82f6',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      Add new party
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Customer List */}
              <ScrollView
                style={{ maxHeight: Math.max(200, dropdownHeight - headerHeight) }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {searchResults.map((customer, index) => (
                  <TouchableOpacity
                    key={`${customer.customerName}-${customer.id || index}`}
                    onPress={() => handleSelectCustomer(customer)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: index < searchResults.length - 1 ? 1 : 0,
                      borderBottomColor: '#f0f0f0',
                      backgroundColor: 'white',
                      minHeight: 68, // Ensure minimum height for proper display
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start', // Changed to flex-start for better alignment
                    }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: 4,
                          lineHeight: 20,
                        }}>
                          {customer.customerName}
                        </Text>
                        {customer.businessName && (
                          <Text style={{
                            fontSize: 13,
                            color: '#4b5563',
                            marginBottom: 2,
                            lineHeight: 16,
                          }}>
                            {customer.businessName}
                          </Text>
                        )}
                        {customer.businessPhone && (
                          <Text style={{
                            fontSize: 12,
                            color: '#6b7280',
                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                            lineHeight: 16,
                          }}>
                            {customer.businessPhone}
                          </Text>
                        )}
                      </View>
                      <View style={{ 
                        alignItems: 'flex-end', 
                        justifyContent: 'flex-start',
                        minWidth: 60,
                      }}>
                        {(customer.receiptCount || 0) > 0 && (
                          <View style={{
                            backgroundColor: '#dcfce7',
                            borderRadius: 12,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            marginBottom: 4,
                          }}>
                            <Text style={{
                              fontSize: 11,
                              color: '#15803d',
                              fontWeight: '600',
                            }}>
                              {customer.receiptCount} receipt{customer.receiptCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            // No search results - show header with Add Party
            <View>
              {/* Header with "Add new party" only when no results */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: '#f9fafb',
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                }}>
                  {value.trim() ? 'No customers found' : 'No saved customers'}
                </Text>
                {onAddParty && (
                  <TouchableOpacity
                    onPress={() => {
                      onAddParty();
                      onBlur();
                    }}
                  >
                    <Text style={{
                      color: '#3b82f6',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      Add new party
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Empty state content */}
              <View style={{
                paddingVertical: 32,
                paddingHorizontal: 16,
                alignItems: 'center',
                backgroundColor: 'white',
              }}>
                <Ionicons name="people-outline" size={48} color="#d1d5db" />
                <Text style={{
                  color: '#9ca3af',
                  fontSize: 14,
                  textAlign: 'center',
                  marginTop: 12,
                  fontWeight: '500',
                }}>
                  {value.trim() ? 'No matching customers found' : 'Start typing to search or add a new party'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default SearchableDropdown;
