import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
import { useItems, useUpdateStock } from '../hooks/useSyncManager';
import { useConnectionState, usePendingUpdates } from '../store/syncStore';
import { ItemDetails } from '../types';
import ItemForm from './ItemForm';

const ItemsScreenNew: React.FC = () => {
  // TanStack Query hooks
  const { 
    data: items = [], 
    isLoading, 
    error, 
    refetch 
  } = useItems();
  
  const updateStockMutation = useUpdateStock();
  
  // Zustand state
  const connectionState = useConnectionState();
  const pendingUpdates = usePendingUpdates();
  
  // Local UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Beverages' | 'Food'>('All');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDetails | null>(null);
  
  // Stock update handlers with optimistic updates
  const handleAddStock = (itemId: string, quantity: number = 1) => {
    updateStockMutation.mutate(
      { itemId, stockChange: quantity },
      {
        onSuccess: (data) => {
          console.log(`✅ Stock added successfully:`, data);
        },
        onError: (error) => {
          console.error('❌ Failed to add stock:', error);
        },
      }
    );
  };

  const handleSubtractStock = (itemId: string, quantity: number = 1) => {
    // Check current stock before attempting subtraction
    const currentItem = items.find(item => item.id === itemId);
    if (!currentItem || currentItem.stocks < quantity) {
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
        },
      }
    );
  };

  // Check if item has pending updates
  const isItemPending = (itemId: string) => {
    return Array.from(pendingUpdates.values()).some(
      update => update.documentId === itemId && update.collection === 'item_details'
    );
  };

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
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
  }, [items, searchTerm, sortBy, sortOrder]);

  const handleEditItem = (item: ItemDetails) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  // Connection status indicator
  const getConnectionIndicator = () => {
    if (!connectionState.isOnline) {
      return { color: '#ef4444', text: '🔴 Offline' };
    }
    if (!connectionState.isConnected) {
      return { color: '#f59e0b', text: '🟡 Connecting...' };
    }
    switch (connectionState.connectionQuality) {
      case 'excellent':
        return { color: '#10b981', text: '🟢 Connected' };
      case 'good':
        return { color: '#10b981', text: '🟢 Good' };
      case 'poor':
        return { color: '#f59e0b', text: '🟡 Poor Connection' };
      default:
        return { color: '#6b7280', text: '⚪ Unknown' };
    }
  };

  const connectionIndicator = getConnectionIndicator();

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
            paddingVertical: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
      {/* Header with connection status */}
      <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1f2937' }}>Items</Text>
            <Text style={{ fontSize: 12, color: connectionIndicator.color, marginTop: 2 }}>
              {connectionIndicator.text}
              {connectionState.lastSync && (
                ` • Last sync: ${connectionState.lastSync.toLocaleTimeString()}`
              )}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => refetch()}
              disabled={isLoading}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: isLoading ? '#9ca3af' : '#10b981',
                justifyContent: 'center',
                alignItems: 'center',
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
                alignItems: 'center',
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
          marginBottom: 20,
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
                backgroundColor: selectedCategory === category ? '#3b82f6' : '#e5e7eb',
              }}
            >
              <Text style={{
                color: selectedCategory === category ? 'white' : '#6b7280',
                fontWeight: selectedCategory === category ? 'bold' : 'normal',
              }}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Items List */}
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
        {isLoading && items.length === 0 ? (
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
                : 'Start by adding your first item to the inventory'}
            </Text>
            {!searchTerm && (
              <TouchableOpacity
                onPress={() => setShowForm(true)}
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
          filteredAndSortedItems.map((item) => {
            const isPending = isItemPending(item.id);
            
            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 15,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  opacity: isPending ? 0.8 : 1,
                }}
              >
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
                    {item.item_name}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14 }}>
                    {item.item_name.toLowerCase()} - Available in store
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>GENERAL</Text>
                </View>

                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      backgroundColor: item.stocks > 20 ? '#10b981' : item.stocks > 10 ? '#f59e0b' : '#ef4444',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      marginRight: 15,
                    }}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                        {item.stocks} in stock{isPending ? ' (syncing...)' : ''}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {/* Edit Button */}
                      <TouchableOpacity
                        onPress={() => handleEditItem(item)}
                        disabled={isPending}
                        style={{
                          backgroundColor: isPending ? '#9ca3af' : '#3b82f6',
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 16 }}>✏️</Text>
                      </TouchableOpacity>

                      {/* Subtract Stock Button */}
                      <TouchableOpacity
                        onPress={() => handleSubtractStock(item.id, 1)}
                        disabled={isPending || item.stocks <= 0}
                        style={{
                          backgroundColor: (isPending || item.stocks <= 0) ? '#9ca3af' : '#f59e0b',
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 16 }}>
                          {isPending ? '⏳' : '-'}
                        </Text>
                      </TouchableOpacity>

                      {/* Add Stock Button */}
                      <TouchableOpacity
                        onPress={() => handleAddStock(item.id, 1)}
                        disabled={isPending}
                        style={{
                          backgroundColor: isPending ? '#9ca3af' : '#10b981',
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 16 }}>
                          {isPending ? '⏳' : '+'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#3b82f6',
                  }}>
                    ${item.price.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Form Modal */}
      {showForm && (
        <ItemForm
          item={editingItem}
          onSubmit={async (itemData) => {
            // Handle form submission here
            console.log('Form submitted:', itemData);
            handleCloseForm();
          }}
          onCancel={handleCloseForm}
          isLoading={false}
        />
      )}
    </View>
  );
};

export default ItemsScreenNew;
