import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UniqueCustomer } from '../../services/data/CustomerService';

interface CustomerListItemProps {
  customer: UniqueCustomer;
  index: number;
  total: number;
  onSelect: (customer: UniqueCustomer) => void;
  searchQuery?: string;
}

/**
 * Memoized customer list item component for optimal performance
 * Only re-renders when customer data or search query changes
 */
const CustomerListItem: React.FC<CustomerListItemProps> = React.memo(({
  customer,
  index,
  total,
  onSelect,
  searchQuery = '',
}) => {
  // Helper function to highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query || query.length === 0) {
      return <Text>{text}</Text>;
    }

    try {
      const parts = text.split(new RegExp(`(${query})`, 'gi'));
      return (
        <Text>
          {parts.map((part, i) => 
            part.toLowerCase() === query.toLowerCase() ? (
              <Text key={i} style={{ fontWeight: '700', color: '#3b82f6' }}>
                {part}
              </Text>
            ) : (
              <Text key={i}>{part}</Text>
            )
          )}
        </Text>
      );
    } catch (error) {
      // If regex fails (special characters), return plain text
      return <Text>{text}</Text>;
    }
  };

  return (
    <TouchableOpacity
      onPress={() => onSelect(customer)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: index < total - 1 ? 1 : 0,
        borderBottomColor: '#f0f0f0',
        backgroundColor: 'white',
        minHeight: 68,
      }}
      activeOpacity={0.7}
    >
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#111827',
            marginBottom: 4,
            lineHeight: 20,
          }}>
            {highlightText(customer.customerName, searchQuery)}
          </Text>
          {customer.businessName && (
            <Text style={{
              fontSize: 13,
              color: '#4b5563',
              marginBottom: 2,
              lineHeight: 16,
            }}>
              {highlightText(customer.businessName, searchQuery)}
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
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal re-rendering
  return (
    prevProps.customer.id === nextProps.customer.id &&
    prevProps.customer.customerName === nextProps.customer.customerName &&
    prevProps.customer.businessName === nextProps.customer.businessName &&
    prevProps.customer.businessPhone === nextProps.customer.businessPhone &&
    prevProps.customer.receiptCount === nextProps.customer.receiptCount &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.index === nextProps.index &&
    prevProps.total === nextProps.total
  );
});

CustomerListItem.displayName = 'CustomerListItem';

export default CustomerListItem;
