import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UniqueCustomer } from '../services/data/CustomerService';
import { useDebouncedCallback } from '../hooks/useDebounce';
import CustomerListItem from './ui/CustomerListItem';
import { CustomerListSkeleton } from './ui/SkeletonLoader';

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
  const maxDropdownHeight = 320;

  useEffect(() => {
    if (showDropdown && containerRef.current) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        setInputPosition({ x, y: y + height });
        setInputHeight(height);
      });
    }
  }, [showDropdown]);

  // Debounced search to reduce function calls
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
    onBlur();
  }, [onChangeText, onSelectCustomer, onBlur]);

  const handleInputFocus = useCallback(() => {
    onFocus();
    // Load all/recent customers when focused (empty search shows all)
    onSearch('');
  }, [onFocus, onSearch]);

  // Limit results to prevent performance issues and improve UX
  const displayedResults = useMemo(() => {
    const maxResults = 15; // Show max 15 results - users should refine search for more
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

  // Memoized dropdown calculations with safety checks
  const dropdownCalculations = useMemo(() => {
    const dropdownTop = inputPosition.y || 0;
    const availableSpaceBelow = screenHeight - dropdownTop;
    const estimatedItemHeight = 70;
    const headerHeight = 50;
    const resultsLength = searchResults?.length || 0;
    const estimatedContentHeight = resultsLength * estimatedItemHeight + headerHeight;
    
    // Ensure we have valid numbers
    const safeAvailableSpace = isNaN(availableSpaceBelow) || availableSpaceBelow < 100 ? 300 : availableSpaceBelow;
    
    const dropdownHeight = Math.max(
      200, // Minimum height
      Math.min(
        maxDropdownHeight,
        safeAvailableSpace - 120,
        estimatedContentHeight
      )
    );

    return { 
      dropdownHeight: isNaN(dropdownHeight) ? 300 : dropdownHeight, 
      headerHeight 
    };
  }, [inputPosition.y, screenHeight, maxDropdownHeight, searchResults]);

  // Memoized dropdown styles
  const dropdownStyles = useMemo(() => ({
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: Platform.OS === 'android' ? 12 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 12 } : { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0,
    shadowRadius: Platform.OS === 'ios' ? 20 : 0,
    zIndex: 20000,
    marginTop: 8,
  }), [dropdownCalculations.dropdownHeight]);

  return (
    <View style={{ position: 'relative', zIndex: showDropdown ? 10000 : 1000 }}>
      <View ref={containerRef}>
      {/* Input Field */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: error ? '#ef4444' : (showDropdown ? '#3b82f6' : '#e5e7eb'),
        borderRadius: 12,
        backgroundColor: '#fafafa',
        paddingRight: 14,
        shadowColor: showDropdown ? '#3b82f6' : 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: showDropdown ? 2 : 0,
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
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 15,
            color: '#1f2937',
            fontWeight: '400',
          }}
          autoCapitalize="words"
          autoCorrect={false}
          placeholderTextColor="#9ca3af"
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
        ) : (
          <Ionicons name="search" size={22} color="#9ca3af" />
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
        <View style={dropdownStyles}>
          {isSearching ? (
            <View>
              {/* Header */}
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
                  Searching...
                </Text>
              </View>
              {/* Skeleton Loading */}
              <CustomerListSkeleton count={5} />
            </View>
          ) : displayedResults && displayedResults.length > 0 ? (
            <View style={{ overflow: 'hidden', borderRadius: 16 }}>
              {/* Header with "Showing Saved Parties" and "Add new party" */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 18,
                paddingVertical: 14,
                backgroundColor: '#ffffff',
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: '#1f2937',
                  letterSpacing: -0.2,
                }}>
                  {value.trim() 
                    ? searchResults.length > 15 
                      ? `Found ${searchResults.length} parties` 
                      : `Found ${searchResults.length} ${searchResults.length === 1 ? 'party' : 'parties'}`
                    : searchResults.length > 15
                      ? `${displayedResults.length} of ${searchResults.length} parties`
                      : 'Saved Parties'
                  }
                </Text>
                {onAddParty && (
                  <TouchableOpacity
                    onPress={() => {
                      onAddParty();
                      onBlur();
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
              
              {/* Customer List - Scrollable */}
              <ScrollView
                style={{ 
                  maxHeight: 320,
                  backgroundColor: 'white',
                }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                bounces={true}
                scrollEnabled={true}
                alwaysBounceVertical={false}
              >
                {renderedItems}
                {searchResults.length > 15 && (
                  <View style={{
                    paddingVertical: 14,
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
                      {value.trim() 
                        ? `💡 ${searchResults.length - 15} more found. Refine your search to see more.`
                        : `Showing first 15 of ${searchResults.length} customers. Search to find specific customers quickly.`
                      }
                    </Text>
                  </View>
                )}
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
                paddingVertical: 40,
                paddingHorizontal: 20,
                alignItems: 'center',
                backgroundColor: 'white',
              }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#f3f4f6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <Ionicons name={value.trim() ? "search-outline" : "people-outline"} size={32} color="#9ca3af" />
                </View>
                <Text style={{
                  color: '#374151',
                  fontSize: 15,
                  textAlign: 'center',
                  fontWeight: '600',
                  marginBottom: 6,
                }}>
                  {value.trim() ? 'No customers found' : 'No saved customers yet'}
                </Text>
                <Text style={{
                  color: '#9ca3af',
                  fontSize: 13,
                  textAlign: 'center',
                  lineHeight: 18,
                }}>
                  {value.trim() 
                    ? 'Try a different search or add a new party' 
                    : 'Add your first customer to get started'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
      </View>
    </View>
  );
};

export default SearchableDropdown;
