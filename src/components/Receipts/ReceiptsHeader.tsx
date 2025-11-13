import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Card from '../ui/Card';
import { useLanguage } from '../../contexts/LanguageContext';

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
  isDeleting?: boolean;
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
  isDeleting = false,
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
  const { t } = useLanguage();

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
                <TouchableOpacity onPress={onClearSelection} className="mr-3 rounded-lg p-2 bg-secondary-100">
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
                <View>
                  <Text className="text-base font-bold text-secondary-900">
                    {selectedCount === 0 ? 'Select receipts' : t('receipts.selected', { count: selectedCount, total: filteredCount })}
                  </Text>
                  {selectedCount === 0 && (
                    <Text className="text-xs text-secondary-500 mt-0.5">
                      Tap receipts to select
                    </Text>
                  )}
                </View>
              </View>
              {/* Simplified - actions moved to floating bottom bar */}
              <View />
            </>
          ) : (
            <>
              <View>
                <Text className="text-2xl font-extrabold text-secondary-900">{t('receipts.title')}</Text>
                <Text className="mt-0.5 text-sm text-secondary-500">
                  {t('receipts.receiptCount', { count: totalCount })} {filteredCount !== totalCount && `(${filteredCount} filtered)`}
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
            placeholder={t('receipts.searchPlaceholder')}
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
          {/* Header */}
          <View className="flex-row items-center justify-between pb-5 mb-6 border-b border-secondary-200">
            <Text className="text-xl font-extrabold text-secondary-900">{t('receipts.sortAndFilter')}</Text>
            <TouchableOpacity onPress={onToggleFilters} className="rounded-full p-2 bg-secondary-100">
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <View className="gap-8">
            {/* Status Filter Section */}
            <View>
              <Text className="mb-3 text-sm font-bold text-secondary-700 uppercase tracking-wide">{t('receipts.status')}</Text>
              <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                {['all', 'printed', 'exported', 'draft'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => onStatusFilterChange(status)}
                    className={`rounded-full px-5 py-2.5 ${
                      statusFilter === status ? 'bg-primary-600' : 'bg-secondary-100'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        statusFilter === status ? 'text-white font-bold' : 'text-secondary-700 font-medium'
                      }`}
                    >
                      {t(`receipts.status.${status}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sort By Section */}
            <View>
              <Text className="mb-3 text-sm font-bold text-secondary-700 uppercase tracking-wide">{t('receipts.sortBy')}</Text>
              <View style={{ gap: 12 }}>
                {[{ key: 'date', label: t('receipts.date') }, { key: 'customer', label: t('receipts.customer') }, { key: 'total', label: t('receipts.total') }].map(
                  (option) => (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => onSortByChange(option.key)}
                      className={`flex-row items-center justify-between rounded-xl border px-5 py-4 ${
                        sortBy === option.key ? 'border-primary-400 bg-primary-50' : 'border-secondary-200 bg-white'
                      }`}
                    >
                      <Text className={`text-base ${sortBy === option.key ? 'text-primary-700 font-bold' : 'text-secondary-800 font-medium'}`}>
                        {option.label}
                      </Text>
                      <Ionicons
                        name={getSortIcon(option.key)}
                        size={20}
                        color={sortBy === option.key ? '#2563eb' : '#9ca3af'}
                      />
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {/* Sort Order */}
            <View>
              <TouchableOpacity onPress={onSortOrderToggle} className="flex-row items-center justify-between rounded-xl bg-primary-50 border border-primary-200 px-5 py-4">
                <Text className="text-base text-primary-700 font-bold">{sortOrder === 'asc' ? t('receipts.orderAscending') : t('receipts.orderDescending')}</Text>
                <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={20} color="#2563eb" />
              </TouchableOpacity>
            </View>

            {/* Delete All */}
            <View className="pt-2">
              <TouchableOpacity onPress={onDeleteAll} className="flex-row items-center justify-center gap-2 rounded-xl border-2 border-danger-200 bg-danger-50 px-5 py-4">
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text className="text-base font-bold text-danger-600">{t('receipts.deleteAllReceipts')}</Text>
              </TouchableOpacity>
            </View>
          </View>
      </Modal>
    </>
  );
};

export default React.memo(ReceiptsHeader);
