import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import ItemService from '../../services/data/ItemService';
import StockService from '../../services/data/StockService';
import { ItemDetails } from '../../types';
import AddItemModalSynced from '../../components/AddItemModalSynced';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useUpdateStock } from '../../hooks/useSyncManager';
import { usePendingUpdates } from '../../store/syncStore';
import { ItemsListSkeleton } from '../../components/ui/SkeletonLoader';

// Import new components
import ItemsHeader from '../../components/Items/ItemsHeader';
import ItemCard from '../../components/Items/ItemCard';
import DeleteConfirmationModal from '../../components/Items/DeleteConfirmationModal';
import EditItemModal from '../../components/Items/EditItemModal';

const ItemsScreen: React.FC = () => {
  // TanStack Query hooks for items
  const { 
    data: items = [], 
    isLoading: loading, 
    error, 
    refetch 
  } = useItems();
  
  // Mutation hooks
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
  const updateStockMutation = useUpdateStock();
  
  // Zustand state for pending updates
  const pendingUpdates = usePendingUpdates();
  
  // Local UI state
  const [refreshing, setRefreshing] = useState(false);
  
  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDetails | null>(null);
  
  // Delete functionality states
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'multiple' | 'all'>('single');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ✅ Removed excessive debug logging - was causing 4x duplicate logs

  // Check if item has pending updates
  const isItemPending = (itemId: string) => {
    return Array.from(pendingUpdates.values()).some(
      update => update.documentId === itemId && update.collection === 'item_details'
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
      // ✅ Reduced logging - only log errors
    } catch (error) {
      console.error('❌ Refetch failed:', error);
      Alert.alert('Error', 'Failed to refresh items. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.item_name.toLowerCase().includes(query) ||
        item.price.toString().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase());
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'stock':
          comparison = (a.stocks || 0) - (b.stocks || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [items, searchQuery, sortBy, sortOrder]);

  // Stock management functions - memoized
  const handleAddStock = useCallback((itemId: string) => {
    updateStockMutation.mutate(
      { itemId, stockChange: 1 },
      {
        onError: (error) => {
          console.error('❌ Failed to add stock:', error);
          Alert.alert('Error', 'Failed to add stock');
        },
      }
    );
  }, [updateStockMutation]);

  // Edit functions - memoized
  const handleEditItem = useCallback((item: ItemDetails) => {
    setEditingItem(item);
    setShowEditModal(true);
  }, []);

  const handleSaveItem = useCallback(async (itemData: Omit<ItemDetails, 'id'>) => {
    if (!editingItem) return;
    
    try {
      await updateItemMutation.mutateAsync({
        itemId: editingItem.id,
        itemData
      });
    } catch (error) {
      throw error; // Re-throw so modal can handle it
    }
  }, [editingItem, updateItemMutation]);

  // Delete functions - memoized
  const handleDeleteSingle = useCallback((itemId: string) => {
    setItemToDelete(itemId);
    setDeleteMode('single');
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteMultiple = useCallback(() => {
    if (selectedItems.size === 0) return;
    setDeleteMode('multiple');
    setShowDeleteConfirm(true);
  }, [selectedItems.size]);

  const handleDeleteAll = useCallback(() => {
    setDeleteMode('all');
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      switch (deleteMode) {
        case 'single':
          if (itemToDelete) {
            await deleteItemMutation.mutateAsync(itemToDelete);
          }
          break;
        case 'multiple':
          const selectedIds = Array.from(selectedItems);
          await Promise.all(selectedIds.map(id => deleteItemMutation.mutateAsync(id)));
          setSelectedItems(new Set());
          setIsSelectionMode(false);
          break;
        case 'all':
          const allIds = filteredAndSortedItems.map(i => i.id);
          await Promise.all(allIds.map(id => deleteItemMutation.mutateAsync(id)));
          break;
      }
      Alert.alert(
        'Success',
        `Item${deleteMode === 'single' ? '' : 's'} deleted successfully`
      );
    } catch (error) {
      console.error('Error deleting items:', error);
      Alert.alert('Error', 'Failed to delete item(s). Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  }, [deleteMode, itemToDelete, selectedItems, filteredAndSortedItems, deleteItemMutation]);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  }, []);

  const selectAllItems = useCallback(() => {
    const allIds = filteredAndSortedItems.map(i => i.id);
    setSelectedItems(new Set(allIds));
  }, [filteredAndSortedItems]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  }, []);

  const renderItemCard = useCallback(({ item }: { item: ItemDetails }) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
      <ItemCard
        item={item}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        onPress={() => {
          if (isSelectionMode) {
            toggleItemSelection(item.id);
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedItems(new Set([item.id]));
          }
        }}
        onToggleSelection={toggleItemSelection}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteSingle}
        onAddStock={handleAddStock}
      />
    );
  }, [selectedItems, isSelectionMode, toggleItemSelection, handleEditItem, handleDeleteSingle, handleAddStock]);

  // Key extractor for list optimization
  const keyExtractor = useCallback((item: ItemDetails) => item.id, []);

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ItemsHeader
            isSelectionMode={false}
            selectedCount={0}
            filteredCount={0}
            totalCount={0}
            searchQuery=""
            sortBy="name"
            sortOrder="asc"
            showFilters={false}
            onToggleSelectionMode={() => {}}
            onSelectAll={() => {}}
            onDeleteMultiple={() => {}}
            onDeleteAll={() => {}}
            onClearSelection={() => {}}
            onToggleFilters={() => {}}
            onRefresh={() => {}}
            onSearchChange={() => {}}
            onClearSearch={() => {}}
            onSortByChange={() => {}}
            onSortOrderToggle={() => {}}
            onAddItem={() => setShowAddModal(true)}
          />
          <ItemsListSkeleton count={8} />
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ItemsHeader
          isSelectionMode={isSelectionMode}
          selectedCount={selectedItems.size}
          filteredCount={filteredAndSortedItems.length}
          totalCount={items.length}
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortOrder={sortOrder}
          showFilters={showFilters}
          onToggleSelectionMode={() => setIsSelectionMode(true)}
          onSelectAll={selectAllItems}
          onDeleteMultiple={handleDeleteMultiple}
          onDeleteAll={handleDeleteAll}
          onClearSelection={clearSelection}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onRefresh={onRefresh}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onSortByChange={(sortBy) => setSortBy(sortBy)}
          onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          onAddItem={() => setShowAddModal(true)}
        />

        {filteredAndSortedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 10, textAlign: 'center' }}>
              {searchQuery ? 'No items found' : 'No items yet'}
            </Text>
            <Text style={{ color: '#9ca3af', textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Start by adding your first item to the inventory'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                onPress={() => setShowAddModal(true)}
                style={{
                  backgroundColor: '#3b82f6',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Add Your First Item</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlashList
            data={filteredAndSortedItems}
            renderItem={renderItemCard}
            keyExtractor={keyExtractor}
            estimatedItemSize={120}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3b82f6']}
                tintColor="#3b82f6"
              />
            }
            // FlashList performance optimizations
            drawDistance={500}
            removeClippedSubviews={true}
          />
        )}
        
        {/* Modals */}
        <AddItemModalSynced
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
        />

        <EditItemModal
          visible={showEditModal}
          item={editingItem}
          onClose={() => {
            setShowEditModal(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
        />
        
        <DeleteConfirmationModal
          visible={showDeleteConfirm}
          deleteMode={deleteMode}
          selectedCount={selectedItems.size}
          totalCount={filteredAndSortedItems.length}
          isDeleting={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingTop: 8,
  },
  listContent: {
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
});

export default ItemsScreen;
