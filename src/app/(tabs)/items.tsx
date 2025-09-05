import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ItemService from '../../services/ItemService';
import StockService from '../../services/StockService';
import { ItemDetails } from '../../types';
import AddItemModalSynced from '../../components/AddItemModalSynced';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useUpdateStock } from '../../hooks/useSyncManager';
import { usePendingUpdates } from '../../store/syncStore';

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

  // Check if item has pending updates
  const isItemPending = (itemId: string) => {
    return Array.from(pendingUpdates.values()).some(
      update => update.documentId === itemId && update.collection === 'item_details'
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

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

  // Stock management functions
  const handleAddStock = async (itemId: string) => {
    updateStockMutation.mutate(
      { itemId, stockChange: 1 },
      {
        onSuccess: (data) => {
          console.log(`✅ Stock added successfully:`, data);
        },
        onError: (error) => {
          console.error('❌ Failed to add stock:', error);
          Alert.alert('Error', 'Failed to add stock');
        },
      }
    );
  };

  // Edit functions
  const handleEditItem = (item: ItemDetails) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleSaveItem = async (itemData: Omit<ItemDetails, 'id'>) => {
    if (!editingItem) return;
    
    try {
      await updateItemMutation.mutateAsync({
        itemId: editingItem.id,
        itemData
      });
    } catch (error) {
      throw error; // Re-throw so modal can handle it
    }
  };

  // Delete functions
  const handleDeleteSingle = (itemId: string) => {
    setItemToDelete(itemId);
    setDeleteMode('single');
    setShowDeleteConfirm(true);
  };

  const handleDeleteMultiple = () => {
    if (selectedItems.size === 0) return;
    setDeleteMode('multiple');
    setShowDeleteConfirm(true);
  };

  const handleDeleteAll = () => {
    setDeleteMode('all');
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
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
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllItems = () => {
    const allIds = filteredAndSortedItems.map(i => i.id);
    setSelectedItems(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  const renderItemCard = ({ item }: { item: ItemDetails }) => {
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
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
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
            <ActivityIndicator size="large" color="#9ca3af" />
          </View>
        ) : (
          <FlatList
            data={filteredAndSortedItems}
            renderItem={renderItemCard}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3b82f6']}
                tintColor="#3b82f6"
              />
            }
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
