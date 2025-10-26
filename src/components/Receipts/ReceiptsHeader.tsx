import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Card from '../ui/Card';

interface ReceiptsHeaderProps {
  isSelectionMode: boolean;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  statusFilter: string;
  sortBy: string;
  sortOrder: string;
  showFilters: boolean;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeleteMultiple: () => void;
  onDeleteAll: () => void;
  onClearSelection: () => void;
  onToggleFilters: () => void;
  onRefresh: () => void;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  onStatusFilterChange: (status: string) => void;
  onSortByChange: (sortBy: string) => void;
  onSortOrderToggle: () => void;
}

const ReceiptsHeader: React.FC<ReceiptsHeaderProps> = ({
  isSelectionMode,
  selectedCount,
  filteredCount,
  totalCount,
  searchQuery,
  statusFilter,
  sortBy,
  sortOrder,
  showFilters,
  onToggleSelectionMode,
  onSelectAll,
  onDeleteMultiple,
  onDeleteAll,
  onClearSelection,
  onToggleFilters,
  onRefresh,
  onSearchChange,
  onClearSearch,
  onStatusFilterChange,
  onSortByChange,
  onSortOrderToggle,
}) => {
  const getSortIcon = (field: string) => {
    if (sortBy !== field) return 'swap-vertical-outline';
    return sortOrder === 'asc' ? 'chevron-up' : 'chevron-down';
  };

  const getSortColor = (field: string) => {
    return sortBy === field ? '#3b82f6' : '#6b7280';
  };

  return (
    <>
      {/* Main Header */}
      <View className="bg-white border-b border-secondary-100 px-4 pt-2 pb-4">
        <View className="mb-4 flex-row items-center justify-between">
          {isSelectionMode ? (
            <>
              <View className="flex-row items-center">
                <TouchableOpacity onPress={onClearSelection} className="mr-3 rounded-lg p-2">
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-base font-semibold text-secondary-800">
                  {selectedCount} of {filteredCount} selected
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Button title="All" onPress={onSelectAll} variant="outline" />
                <Button
                  title=""
                  onPress={onDeleteMultiple}
                  disabled={selectedCount === 0}
                  variant="destructive"
                  leftIcon={<Ionicons name="trash-outline" size={18} color="#fff" />}
                />
              </View>
            </>
          ) : (
            <>
              <View>
                <Text className="text-2xl font-extrabold text-secondary-900">Receipts</Text>
                <Text className="mt-0.5 text-sm text-secondary-500">
                  {totalCount} receipts {filteredCount !== totalCount && `(${filteredCount} filtered)`}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity onPress={onToggleFilters} className="rounded-xl p-2">
                  <Ionicons
                    name={showFilters ? 'options' : 'options-outline'}
                    size={22}
                    color={showFilters ? '#3b82f6' : '#6b7280'}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={onToggleSelectionMode} className="rounded-xl p-2">
                  <Ionicons name="checkmark-circle-outline" size={22} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onRefresh} className="rounded-xl p-2">
                  <Ionicons name="refresh-outline" size={22} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Search Bar */}
        {!isSelectionMode && (
          <Input
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search receipts, customers, items..."
            left={<Ionicons name="search-outline" size={20} color="#6b7280" />}
            right={
              searchQuery.length > 0 ? (
                <TouchableOpacity onPress={onClearSearch} className="rounded-lg">
                  <Ionicons name="close-circle" size={20} color="#6b7280" />
                </TouchableOpacity>
              ) : undefined
            }
          />
        )}
      </View>

      {/* Filters Modal/Panel */}
      <Modal visible={showFilters} onClose={onToggleFilters}>
        <View className="-mx-1">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-secondary-900">Sort & Filter</Text>
            <TouchableOpacity onPress={onToggleFilters} className="rounded-lg p-1">
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <View>
            {/* Status Filter */}
            <Text className="mb-2 text-sm font-semibold text-secondary-700">Status</Text>
            <View className="flex-row flex-wrap gap-2">
              {['all', 'printed', 'exported', 'draft'].map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => onStatusFilterChange(status)}
                  className={`rounded-full px-4 py-2 ${
                    statusFilter === status ? 'bg-primary-600' : 'bg-secondary-100'
                  }`}
                >
                  <Text
                    className={`${
                      statusFilter === status ? 'text-white font-semibold' : 'text-secondary-700'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sort By */}
            <Text className="mt-5 mb-2 text-sm font-semibold text-secondary-700">Sort By</Text>
            <View className="gap-2">
              {[{ key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' }, { key: 'total', label: 'Total' }].map(
                (option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => onSortByChange(option.key)}
                    className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                      sortBy === option.key ? 'border-primary-300 bg-primary-50' : 'border-secondary-200'
                    }`}
                  >
                    <Text className={`text-base ${sortBy === option.key ? 'text-primary-700 font-semibold' : 'text-secondary-800'}`}>
                      {option.label}
                    </Text>
                    <Ionicons
                      name={getSortIcon(option.key)}
                      size={18}
                      color={sortBy === option.key ? '#2563eb' : '#6b7280'}
                    />
                  </TouchableOpacity>
                )
              )}
            </View>

            <TouchableOpacity onPress={onSortOrderToggle} className="mt-3 flex-row items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
              <Text className="text-primary-700">Order: {sortOrder === 'asc' ? 'Ascending' : 'Descending'}</Text>
              <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={18} color="#2563eb" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onDeleteAll} className="mt-4 flex-row items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text className="font-semibold text-danger-600">Delete All Receipts</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ReceiptsHeader;
