import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { ItemDetails } from '../types';
import ItemService from '../services/data/ItemService';
import StockService from '../services/data/StockService';
import ItemForm from './ItemForm';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useUpdateStock } from '../hooks/useSyncManager';
import { usePendingUpdates } from '../store/syncStore';
import { db, auth } from '../config/firebase';
import { collection } from 'firebase/firestore';
import { formatCurrency } from '../utils';

const ItemsScreen: React.FC = () => {
  // TanStack Query hooks for items
  const { 
    data: items = [], 
    isLoading, 
    error, 
    refetch 
  } = useItems();
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 ItemsScreen Debug:');
    console.log('- Items count:', items?.length || 0);
    console.log('- Is Loading:', isLoading);
    console.log('- Error:', error?.message || 'none');
    console.log('- Items data:', items);
    console.log('- Firebase config status:', {
      hasAuth: !!auth,
      hasDb: !!db,
      isConnected: db ? 'likely' : 'no'
    });
  }, [items, isLoading, error]);
  
  // Test Firebase connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('🧪 Testing Firebase connection...');
        const testCollection = collection(db, 'item_details');
        console.log('✅ Firebase collection reference created successfully');
      } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
      }
    };
    testConnection();
  }, []);
  
  // Mutation hooks
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
  const updateStockMutation = useUpdateStock();
  
  // Zustand state for pending updates
  const pendingUpdates = usePendingUpdates();
  
  // Local UI state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDetails | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Beverages' | 'Food'>('All');

  // Check if item has pending updates
  const isItemPending = (itemId: string) => {
    return Array.from(pendingUpdates.values()).some(
      update => update.documentId === itemId && update.collection === 'item_details'
    );
  };

  const refreshItems = async () => {
    try {
      console.log('Refreshing items...');
      await refetch();
      console.log('Items refreshed successfully');
    } catch (error) {
      console.error('Error refreshing items:', error);
      alert('Failed to refresh items. Please try again.');
    }
  };

  const handleCreateItem = async (itemData: Omit<ItemDetails, 'id'>) => {
    try {
      setIsFormLoading(true);
      await createItemMutation.mutateAsync(itemData);
      setShowForm(false);
      console.log('✅ Item created successfully');
    } catch (error) {
      console.error('❌ Error creating item:', error);
      throw error; // Re-throw so ItemForm can handle it
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleUpdateItem = async (itemData: Omit<ItemDetails, 'id'>) => {
    if (!editingItem) return;

    try {
      setIsFormLoading(true);
      await updateItemMutation.mutateAsync({
        itemId: editingItem.id,
        itemData
      });
      setEditingItem(null);
      setShowForm(false);
      console.log('✅ Item updated successfully');
    } catch (error) {
      console.error('❌ Error updating item:', error);
      throw error; // Re-throw so ItemForm can handle it
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteItemMutation.mutateAsync(itemId);
      console.log('✅ Item deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting item:', error);
      alert('Failed to delete item. Please try again.');
    }
  };

  const handleEditItem = (item: ItemDetails) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  // Handle stock operations with optimistic updates
  const handleAddStock = async (itemId: string, quantity: number = 1) => {
    updateStockMutation.mutate(
      { itemId, stockChange: quantity },
      {
        onSuccess: (data) => {
          console.log(`✅ Stock added successfully:`, data);
        },
        onError: (error) => {
          console.error('❌ Failed to add stock:', error);
          alert(`Failed to add stock. Error: ${error.message}`);
        },
      }
    );
  };

  const handleSubtractStock = async (itemId: string, quantity: number = 1) => {
    // Check current stock before attempting subtraction
    const currentItem = items.find(item => item.id === itemId);
    if (!currentItem || (currentItem.stocks || 0) < quantity) {
      alert(`Insufficient stock. Available: ${currentItem?.stocks || 0}, Requested: ${quantity}`);
      return;
    }

    updateStockMutation.mutate(
      { itemId, stockChange: -quantity },
      {
        onSuccess: (data) => {
          console.log(`✅ Stock subtracted successfully:`, data);
        },
        onError: (error) => {
          console.error('❌ Failed to subtract stock:', error);
          alert(`Failed to subtract stock. Error: ${error.message}`);
        },
      }
    );
  };

  // Filter and sort items
  const filteredAndSortedItems = items
    .filter(item => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      // Note: Category filtering would require adding a category field to ItemDetails
      // For now, we'll just filter by search term
      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase());
      } else {
        comparison = a.price - b.price;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field: 'name' | 'price') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: 'name' | 'price') => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1f2937' }}>Items</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={refreshItems}
              disabled={isLoading}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: isLoading ? '#9ca3af' : '#10b981',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{ color: 'white', fontSize: 16 }}>🔄</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: '#3b82f6',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: 12,
          paddingHorizontal: 15,
          paddingVertical: 12,
          marginBottom: 20
        }}>
          <Text style={{ marginRight: 10, fontSize: 16, color: '#6b7280' }}>🔍</Text>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search items..."
            style={{ flex: 1, fontSize: 16, color: '#1f2937' }}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Category Filters */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {['All', 'Beverages', 'Food'].map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category as any)}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: selectedCategory === category ? '#3b82f6' : '#e5e7eb'
              }}
            >
              <Text style={{
                color: selectedCategory === category ? 'white' : '#6b7280',
                fontWeight: selectedCategory === category ? 'bold' : 'normal'
              }}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Items List */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
        {error ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 18, color: '#ef4444', marginBottom: 10 }}>
              ❌ Error loading items
            </Text>
            <Text style={{ color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
              {error.message}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={{
                backgroundColor: '#3b82f6',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 }}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 10, color: '#6b7280' }}>Loading items...</Text>
          </View>
        ) : filteredAndSortedItems.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 10 }}>
              {searchTerm ? 'No items found' : 'No items yet'}
            </Text>
            <Text style={{ color: '#9ca3af', textAlign: 'center', marginBottom: 20 }}>
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Start by adding your first item to the inventory'
              }
            </Text>
            {!searchTerm && (
              <TouchableOpacity
                onPress={() => setShowForm(true)}
                style={{
                  backgroundColor: '#3b82f6',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Add Your First Item</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredAndSortedItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleEditItem(item)}
              activeOpacity={0.7}
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 20,
                marginBottom: 15,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2
              }}
            >
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
                      {item.item_name}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      {item.item_name.toLowerCase()} - Available in store
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>GENERAL • Tap to edit</Text>
                  </View>
                  <View style={{
                    backgroundColor: '#f3f4f6',
                    borderRadius: 15,
                    width: 30,
                    height: 30,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>✏️</Text>
                  </View>
                </View>
              </View>

              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <View style={{
                  backgroundColor: item.stocks > 20 ? '#10b981' : item.stocks > 10 ? '#f59e0b' : '#ef4444',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  opacity: isItemPending(item.id) ? 0.7 : 1
                }}>
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                    {item.stocks || 0} in stock{isItemPending(item.id) ? ' (updating...)' : ''}
                  </Text>
                </View>

                <Text style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#3b82f6'
                }}>
{formatCurrency(item.price, 'INR', 'en-IN')}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Form Modal */}
      {showForm && (
        <ItemForm
          item={editingItem}
          onSubmit={editingItem ? handleUpdateItem : handleCreateItem}
          onCancel={handleCloseForm}
          isLoading={isFormLoading}
        />
      )}
    </View>
  );
};

export default ItemsScreen;
