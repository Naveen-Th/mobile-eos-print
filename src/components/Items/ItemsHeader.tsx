import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ItemsHeaderProps {
  isSelectionMode: boolean;
  selectedCount: number;
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  sortBy: 'name' | 'price' | 'stock';
  sortOrder: 'asc' | 'desc';
  showFilters: boolean;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeleteMultiple: () => void;
  onDeleteAll: () => void;
  onClearSelection: () => void;
  onToggleFilters: () => void;
  onRefresh: () => void;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onSortByChange: (sortBy: 'name' | 'price' | 'stock') => void;
  onSortOrderToggle: () => void;
  onAddItem: () => void;
}

const ItemsHeader: React.FC<ItemsHeaderProps> = ({
  isSelectionMode,
  selectedCount,
  filteredCount,
  totalCount,
  searchQuery,
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
  onSortByChange,
  onSortOrderToggle,
  onAddItem,
}) => {
  const getSortIcon = (field: 'name' | 'price' | 'stock') => {
    if (sortBy !== field) return 'swap-vertical-outline';
    return sortOrder === 'asc' ? 'chevron-up' : 'chevron-down';
  };

  const getSortColor = (field: 'name' | 'price' | 'stock') => {
    return sortBy === field ? '#3b82f6' : '#6b7280';
  };

  return (
    <>
      {/* Main Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {isSelectionMode ? (
            // Selection Mode Header
            <>
              <View style={styles.selectionInfo}>
                <TouchableOpacity onPress={onClearSelection} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.selectionText}>
                  {selectedCount} of {filteredCount} selected
                </Text>
              </View>
              <View style={styles.selectionActions}>
                <TouchableOpacity onPress={onSelectAll} style={styles.selectionButton}>
                  <Text style={styles.selectionButtonText}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={onDeleteMultiple} 
                  style={[styles.selectionButton, styles.deleteButton]}
                  disabled={selectedCount === 0}
                >
                  <Ionicons name="trash-outline" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Normal Header
            <>
              <View>
                <Text style={styles.title}>Items</Text>
                <Text style={styles.subtitle}>
                  {totalCount} items {filteredCount !== totalCount && `(${filteredCount} filtered)`}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={onToggleFilters} style={styles.iconButton}>
                  <Ionicons 
                    name={showFilters ? "options" : "options-outline"} 
                    size={22} 
                    color={showFilters ? "#3b82f6" : "#6b7280"} 
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={onToggleSelectionMode} style={styles.iconButton}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
                  <Ionicons name="refresh-outline" size={22} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onAddItem} style={styles.addButton}>
                  <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Search Bar */}
        {!isSelectionMode && (
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items by name or price..."
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholderTextColor="#9ca3af"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={onClearSearch} style={styles.clearSearchButton}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Filters Modal/Panel */}
      <Modal
        visible={showFilters}
        transparent
        animationType="fade"
        onRequestClose={onToggleFilters}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={onToggleFilters}
        >
          <View style={styles.filtersPanel}>
            <View style={styles.filtersPanelHeader}>
              <Text style={styles.filtersPanelTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={onToggleFilters}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filtersContent}>
              <Text style={styles.filterSectionTitle}>Sort By</Text>
              
              <View style={styles.sortOptions}>
                <TouchableOpacity 
                  style={[styles.sortOption, sortBy === 'name' && styles.sortOptionActive]}
                  onPress={() => onSortByChange('name')}
                >
                  <Text style={[styles.sortOptionText, sortBy === 'name' && styles.sortOptionTextActive]}>
                    Name
                  </Text>
                  <Ionicons 
                    name={getSortIcon('name')} 
                    size={18} 
                    color={getSortColor('name')} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sortOption, sortBy === 'price' && styles.sortOptionActive]}
                  onPress={() => onSortByChange('price')}
                >
                  <Text style={[styles.sortOptionText, sortBy === 'price' && styles.sortOptionTextActive]}>
                    Price
                  </Text>
                  <Ionicons 
                    name={getSortIcon('price')} 
                    size={18} 
                    color={getSortColor('price')} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sortOption, sortBy === 'stock' && styles.sortOptionActive]}
                  onPress={() => onSortByChange('stock')}
                >
                  <Text style={[styles.sortOptionText, sortBy === 'stock' && styles.sortOptionTextActive]}>
                    Stock
                  </Text>
                  <Ionicons 
                    name={getSortIcon('stock')} 
                    size={18} 
                    color={getSortColor('stock')} 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.sortOrderButton}
                onPress={onSortOrderToggle}
              >
                <Text style={styles.sortOrderText}>
                  Order: {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Text>
                <Ionicons 
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={18} 
                  color="#3b82f6" 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.deleteAllButton}
                onPress={onDeleteAll}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={styles.deleteAllText}>Delete All Items</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginRight: 12,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginLeft: 8,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 8,
  },
  clearSearchButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  filtersPanel: {
    backgroundColor: 'white',
    marginTop: 100,
    marginHorizontal: 16,
    borderRadius: 16,
    maxHeight: 400,
  },
  filtersPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filtersPanelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filtersContent: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  sortOptions: {
    marginBottom: 20,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sortOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  sortOrderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 20,
  },
  sortOrderText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  deleteAllButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteAllText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default ItemsHeader;
