import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { ItemDetails } from '../types';
import ItemService from '../services/ItemService';
import StockService from '../services/StockService';
import ItemForm from './ItemForm';

const ItemsScreen: React.FC = () => {
  const [items, setItems] = useState<ItemDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDetails | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Beverages' | 'Food'>('All');
  const [pendingStockUpdates, setPendingStockUpdates] = useState<Set<string>>(new Set());
  const pendingStockUpdatesRef = useRef<Set<string>>(new Set());
  
  // Keep ref in sync with state
  useEffect(() => {
    pendingStockUpdatesRef.current = pendingStockUpdates;
  }, [pendingStockUpdates]);

  useEffect(() => {
    // Subscribe to real-time updates (this handles initial loading too)
    const unsubscribe = ItemService.subscribeToItems(
      (updatedItems) => {
        console.log('Received real-time items update:', updatedItems.length, 'items');
        
        // Smart merge of real-time updates with optimistic changes
        setItems(prevItems => {
          const currentPendingUpdates = pendingStockUpdatesRef.current;
          
          // If no pending updates, use Firebase data directly
          if (currentPendingUpdates.size === 0) {
            console.log('📥 Using Firebase data directly (no pending updates)');
            return updatedItems;
          }
          
          // For items with pending updates, we need to be more careful
          return updatedItems.map(firebaseItem => {
            const hasPendingUpdate = currentPendingUpdates.has(firebaseItem.id);
            
            if (hasPendingUpdate) {
              const optimisticItem = prevItems.find(item => item.id === firebaseItem.id);
              if (optimisticItem) {
                // Only preserve optimistic stock if it's significantly different from Firebase
                // This helps detect when the Firebase update contains our own changes
                const stockDifference = Math.abs(optimisticItem.stocks - firebaseItem.stocks);
                
                if (stockDifference <= 1) {
                  // Firebase likely has our changes - use it and auto-clear pending
                  console.log(`✅ Firebase synced for item ${firebaseItem.id}: ${firebaseItem.stocks} (was optimistic: ${optimisticItem.stocks})`);
                  
                  // Auto-clear the pending update since Firebase now has the correct value
                  setTimeout(() => {
                    setPendingStockUpdates(prev => {
                      const newSet = new Set(prev);
                      if (newSet.delete(firebaseItem.id)) {
                        console.log(`✨ Auto-cleared pending update for item ${firebaseItem.id}`);
                      }
                      return newSet;
                    });
                  }, 100); // Small delay to avoid state updates during render
                  
                  return firebaseItem;
                } else {
                  // Keep optimistic value as Firebase might not have our changes yet
                  console.log(`⏳ Preserving optimistic stock for item ${firebaseItem.id}: ${optimisticItem.stocks} (Firebase: ${firebaseItem.stocks})`);
                  return {
                    ...firebaseItem,
                    stocks: optimisticItem.stocks
                  };
                }
              }
            }
            
            return firebaseItem;
          });
        });
        
        setIsLoading(false);
      },
      (error) => {
        console.error('Error subscribing to items:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []); // Remove dependency to prevent subscription recreation

  const refreshItems = async () => {
    try {
      setRefreshing(true);
      
      // Clear any stuck pending updates during manual refresh
      setPendingStockUpdates(new Set());
      console.log('Cleared all pending stock updates during refresh');
      
      // Force refresh the item data from Firestore
      await ItemService.forceRefresh();
      console.log('Items force refreshed');
    } catch (error) {
      console.error('Error refreshing items:', error);
      alert('Failed to refresh items. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateItem = async (itemData: Omit<ItemDetails, 'id'>) => {
    try {
      setIsFormLoading(true);
      await ItemService.createItem(itemData);
      setShowForm(false);
      // Items will be updated via the real-time subscription
    } catch (error) {
      console.error('Error creating item:', error);
      throw error; // Re-throw so ItemForm can handle it
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleUpdateItem = async (itemData: Omit<ItemDetails, 'id'>) => {
    if (!editingItem) return;

    try {
      setIsFormLoading(true);
      await ItemService.updateItem(editingItem.id, itemData);
      setEditingItem(null);
      setShowForm(false);
      // Items will be updated via the real-time subscription
    } catch (error) {
      console.error('Error updating item:', error);
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
      await ItemService.deleteItem(itemId);
      // Items will be updated via the real-time subscription
    } catch (error) {
      console.error('Error deleting item:', error);
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

  // Optimistic update helper
  const updateItemStockOptimistically = (itemId: string, stockChange: number) => {
    setItems(prevItems => 
      prevItems.map(item => {
        if (item.id === itemId) {
          const newStock = Math.max(0, item.stocks + stockChange);
          console.log(`Optimistic update for item ${itemId}: ${item.stocks} → ${newStock} (change: ${stockChange})`);
          return { ...item, stocks: newStock };
        }
        return item;
      })
    );
  };

  // Rollback optimistic update on error
  const rollbackItemStockUpdate = (itemId: string, stockChange: number) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, stocks: Math.max(0, item.stocks - stockChange) }
          : item
      )
    );
  };

  // Handle stock operations with optimistic updates
  const handleAddStock = async (itemId: string, quantity: number) => {
    const currentItem = items.find(item => item.id === itemId);
    console.log(`Adding ${quantity} stock to item ${itemId}. Current stock: ${currentItem?.stocks}`);
    
    // Add to pending updates for visual feedback
    setPendingStockUpdates(prev => {
      const newSet = new Set(prev).add(itemId);
      console.log(`Added ${itemId} to pending stock updates. Pending items:`, Array.from(newSet));
      return newSet;
    });
    
    // Optimistic update - immediately update the UI
    updateItemStockOptimistically(itemId, quantity);
    
    try {
      await StockService.addStock(itemId, quantity);
      console.log(`Successfully added ${quantity} stock to item ${itemId} in Firebase`);
      
      // Brief wait for real-time sync - auto-clear will handle the rest
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Success - Firebase will sync and the real-time listener will confirm the change
    } catch (error) {
      console.error('Error adding stock:', error);
      // Rollback the optimistic update on error
      rollbackItemStockUpdate(itemId, quantity);
      alert(`Failed to add stock. Error: ${error.message}`);
    } finally {
      // Remove from pending updates after allowing time for Firebase sync
      setPendingStockUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        console.log(`Removed ${itemId} from pending stock updates. Remaining pending:`, Array.from(newSet));
        return newSet;
      });
    }
  };

  const handleSubtractStock = async (itemId: string, quantity: number) => {
    // Check if we have enough stock before optimistic update
    const currentItem = items.find(item => item.id === itemId);
    if (!currentItem || currentItem.stocks < quantity) {
      alert(`Insufficient stock. Available: ${currentItem?.stocks || 0}, Requested: ${quantity}`);
      return;
    }
    
    console.log(`Subtracting ${quantity} stock from item ${itemId}. Current stock: ${currentItem.stocks}`);
    
    // Add to pending updates for visual feedback
    setPendingStockUpdates(prev => {
      const newSet = new Set(prev).add(itemId);
      console.log(`Added ${itemId} to pending stock updates. Pending items:`, Array.from(newSet));
      return newSet;
    });
    
    // Optimistic update - immediately update the UI
    updateItemStockOptimistically(itemId, -quantity);
    
    try {
      await StockService.subtractStock(itemId, quantity);
      console.log(`Successfully subtracted ${quantity} stock from item ${itemId} in Firebase`);
      
      // Brief wait for real-time sync - auto-clear will handle the rest
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Success - Firebase will sync and the real-time listener will confirm the change
    } catch (error) {
      console.error('Error subtracting stock:', error);
      // Rollback the optimistic update on error
      rollbackItemStockUpdate(itemId, -quantity);
      alert(`Failed to subtract stock. Error: ${error.message}`);
    } finally {
      // Remove from pending updates after allowing time for Firebase sync
      setPendingStockUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        console.log(`Removed ${itemId} from pending stock updates. Remaining pending:`, Array.from(newSet));
        return newSet;
      });
    }
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
              disabled={refreshing}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: refreshing ? '#9ca3af' : '#10b981',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {refreshing ? (
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
        {isLoading ? (
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
                elevation: 2
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
                alignItems: 'center'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    backgroundColor: item.stocks > 20 ? '#10b981' : item.stocks > 10 ? '#f59e0b' : '#ef4444',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    marginRight: 15,
                    opacity: pendingStockUpdates.has(item.id) ? 0.7 : 1
                  }}>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                      {item.stocks} in stock{pendingStockUpdates.has(item.id) ? ' (updating...)' : ''}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {/* Edit Button */}
                    <TouchableOpacity
                      onPress={() => handleEditItem(item)}
                      style={{
                        backgroundColor: '#3b82f6',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 16 }}>✏️</Text>
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(item.id, item.item_name)}
                      style={{
                        backgroundColor: '#ef4444',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>

                    {/* Subtract Stock Button */}
                    <TouchableOpacity
                      onPress={() => handleSubtractStock(item.id, 1)}
                      disabled={pendingStockUpdates.has(item.id) || item.stocks <= 0}
                      style={{
                        backgroundColor: pendingStockUpdates.has(item.id) || item.stocks <= 0 ? '#9ca3af' : '#f59e0b',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 16 }}>-</Text>
                    </TouchableOpacity>

                    {/* Add Stock Button */}
                    <TouchableOpacity
                      onPress={() => handleAddStock(item.id, 1)}
                      disabled={pendingStockUpdates.has(item.id)}
                      style={{
                        backgroundColor: pendingStockUpdates.has(item.id) ? '#9ca3af' : '#10b981',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 16 }}>
                        {pendingStockUpdates.has(item.id) ? '⏳' : '+'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#3b82f6'
                }}>
                  ${item.price.toFixed(2)}
                </Text>
              </View>
            </View>
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
