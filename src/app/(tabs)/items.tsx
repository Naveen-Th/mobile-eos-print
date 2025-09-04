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
import AddItemModal from '../../components/AddItemModal';

// Import new components
import ItemsHeader from '../../components/Items/ItemsHeader';
import ItemCard from '../../components/Items/ItemCard';
import DeleteConfirmationModal from '../../components/Items/DeleteConfirmationModal';
import EditItemModal from '../../components/Items/EditItemModal';

const ItemsScreen: React.FC = () => {
  const [items, setItems] = useState<ItemDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setError(null);
      const itemData = await ItemService.getAllItems();
      setItems(itemData);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
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
    try {
      await StockService.addStock(itemId, 1);
      Alert.alert('Success', 'Stock added successfully!');
    } catch (error) {
      console.error('Error adding stock:', error);
      Alert.alert('Error', 'Failed to add stock');
    }
  };

  // Edit functions
  const handleEditItem = (item: ItemDetails) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleSaveItem = async (itemData: Omit<ItemDetails, 'id'>) => {
    if (!editingItem) return;
    
    try {
      await ItemService.updateItem(editingItem.id, itemData);
      await loadItems(); // Refresh the list
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
            await ItemService.deleteItem(itemToDelete);
            setItems(items.filter(i => i.id !== itemToDelete));
          }
          break;
        case 'multiple':
          const selectedIds = Array.from(selectedItems);
          await Promise.all(selectedIds.map(id => ItemService.deleteItem(id)));
          setItems(items.filter(i => !selectedItems.has(i.id)));
          setSelectedItems(new Set());
          setIsSelectionMode(false);
          break;
        case 'all':
          const allIds = filteredAndSortedItems.map(i => i.id);
          await Promise.all(allIds.map(id => ItemService.deleteItem(id)));
          setItems(items.filter(i => !allIds.includes(i.id)));
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
          onRefresh={loadItems}
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
        <AddItemModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onItemAdded={loadItems}
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
