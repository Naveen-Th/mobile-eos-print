import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useItems, useUpdateStock } from '../hooks/useSyncManager';
import { useConnectionState, usePendingUpdates } from '../store/syncStore';
import { ItemDetails } from '../types';
import ItemForm from './ItemForm';
import { formatCurrency } from '../utils';
import Input from './ui/Input';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { Title, Muted } from './ui/Typography';

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
      <View className="flex-1 items-center justify-center p-5">
        <Text className="text-lg font-bold text-danger-500">❌ Error loading items</Text>
        <Text className="mt-2 text-center text-secondary-500">{error.message}</Text>
        <View className="mt-4">
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-secondary-50">
      {/* Header with connection status, colorful gradient */}
      <LinearGradient colors={["#3b82f6", "#2563eb"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: 56, paddingBottom: 20 }}>
        <View className="px-5">
          <View className="mb-5 flex-row items-center justify-between">
            <View>
              <Title className="text-white">Items</Title>
              <Text style={{ color: connectionIndicator.color }} className="mt-1 text-xs">
                {connectionIndicator.text}
                {connectionState.lastSync && (
                  ` • Last sync: ${connectionState.lastSync.toLocaleTimeString()}`
                )}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Button
                title={isLoading ? 'Refreshing' : 'Refresh'}
                onPress={() => refetch()}
                disabled={isLoading}
                className="rounded-full bg-white/10 border border-white/20"
                textClassName="text-white"
                leftIcon={isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white">🔄</Text>}
              />
              <Button
                title="Add"
                onPress={() => setShowForm(true)}
                className="rounded-full bg-white"
                textClassName="text-primary-700"
              />
            </View>
          </View>

          {/* Search Bar */}
          <Input
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search items..."
            left={<Text className="text-secondary-500">🔍</Text>}
            containerClassName="bg-white/15 border border-white/20"
            className="text-white"
          />

          {/* Category Filters */}
          <View className="mt-3 flex-row gap-2">
            {['All', 'Beverages', 'Food'].map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category as any)}
                className={`rounded-full px-4 py-2 ${
                  selectedCategory === category ? 'bg-white' : 'bg-white/20 border border-white/30'
                }`}
              >
                <Text className={`${selectedCategory === category ? 'text-primary-700 font-semibold' : 'text-white'}`}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* Items List */}
      <ScrollView className="flex-1 px-5">
        {isLoading && items.length === 0 ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Muted className="mt-2">Loading items...</Muted>
          </View>
        ) : filteredAndSortedItems.length === 0 ? (
          <View className="items-center py-12">
            <Text className="mb-2 text-lg font-semibold text-secondary-500">
              {searchTerm ? 'No items found' : 'No items yet'}
            </Text>
            <Muted className="mb-4 text-center">
              {searchTerm ? 'Try adjusting your search terms' : 'Start by adding your first item to the inventory'}
            </Muted>
            {!searchTerm && (
              <Button title="Add Your First Item" onPress={() => setShowForm(true)} />
            )}
          </View>
        ) : (
          filteredAndSortedItems.map((item) => {
            const isPending = isItemPending(item.id);

            return (
              <Card key={item.id} className={`${isPending ? 'opacity-60' : ''} mb-4`}>
                <TouchableOpacity onPress={() => handleEditItem(item)} disabled={isPending} activeOpacity={0.7}>
                  <View className="mb-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <Text className="mb-1 text-lg font-bold text-secondary-900">{item.item_name}</Text>
                        <Text className="text-sm text-secondary-500">
                          {item.item_name.toLowerCase()} - Available in store
                        </Text>
                        <Muted className="mt-0.5">GENERAL • Tap to edit</Muted>
                      </View>
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-secondary-100">
                        <Text className="text-xs text-secondary-500">✏️</Text>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Badge variant={item.stocks > 20 ? 'success' : item.stocks > 10 ? 'warning' : 'danger'}>
                        {item.stocks} in stock{isPending ? ' (syncing...)' : ''}
                      </Badge>
                    </View>
                    <Text className="text-xl font-extrabold text-primary-600">
                      {formatCurrency(item.price, 'INR', 'en-IN')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Form Modal */}
      {showForm && (
        <ItemForm
          item={editingItem}
          onSubmit={async (itemData) => {
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
