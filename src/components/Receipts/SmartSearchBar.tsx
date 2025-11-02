import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SmartSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: string[];
  onFilterToggle: (filter: string) => void;
  onClearAll: () => void;
}

const FILTERS = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'paid', label: 'Paid', icon: 'checkmark-circle' },
  { id: 'unpaid', label: 'Unpaid', icon: 'alert-circle' },
  { id: 'partial', label: 'Partial', icon: 'time' },
  { id: 'overdue', label: 'Overdue', icon: 'warning' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'week', label: 'This Week', icon: 'calendar' },
  { id: 'month', label: 'This Month', icon: 'calendar-outline' },
];

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterToggle,
  onClearAll,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = activeFilters.length > 0 && !activeFilters.includes('all');

  return (
    <View style={{ backgroundColor: 'white', paddingBottom: 8 }}>
      {/* Search Input */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
      }}>
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: isFocused ? 2 : 0,
          borderColor: isFocused ? '#3b82f6' : 'transparent',
        }}>
          <Ionicons name="search" size={20} color={isFocused ? '#3b82f6' : '#9ca3af'} />
          <TextInput
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 15,
              color: '#111827',
            }}
            placeholder="Search receipts, customers..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Toggle Button */}
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={{
            marginLeft: 8,
            backgroundColor: hasActiveFilters ? '#3b82f6' : '#f3f4f6',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons 
            name={showFilters ? 'funnel' : 'funnel-outline'} 
            size={20} 
            color={hasActiveFilters ? 'white' : '#6b7280'} 
          />
          {hasActiveFilters && (
            <View style={{
              backgroundColor: 'white',
              borderRadius: 10,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}>
              <Text style={{ color: '#3b82f6', fontSize: 10, fontWeight: '700' }}>
                {activeFilters.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <View style={{ paddingHorizontal: 16 }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {FILTERS.map((filter) => {
              const isActive = activeFilters.includes(filter.id);
              return (
                <TouchableOpacity
                  key={filter.id}
                  onPress={() => onFilterToggle(filter.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#3b82f6' : 'white',
                    borderWidth: 1,
                    borderColor: isActive ? '#3b82f6' : '#e5e7eb',
                    gap: 6,
                  }}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={16} 
                    color={isActive ? 'white' : '#6b7280'} 
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isActive ? 'white' : '#6b7280',
                  }}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Clear All Button */}
          {hasActiveFilters && (
            <TouchableOpacity
              onPress={onClearAll}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
                marginTop: 4,
                gap: 4,
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color="#6b7280" />
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '600' }}>
                Clear all filters
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active Filter Pills (when filters hidden) */}
      {!showFilters && hasActiveFilters && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {activeFilters.map((filterId) => {
              const filter = FILTERS.find(f => f.id === filterId);
              if (!filter) return null;
              
              return (
                <View
                  key={filterId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 14,
                    backgroundColor: '#dbeafe',
                    gap: 4,
                  }}
                >
                  <Ionicons name={filter.icon as any} size={12} color="#1e40af" />
                  <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '600' }}>
                    {filter.label}
                  </Text>
                  <TouchableOpacity onPress={() => onFilterToggle(filterId)}>
                    <Ionicons name="close" size={14} color="#1e40af" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default SmartSearchBar;
