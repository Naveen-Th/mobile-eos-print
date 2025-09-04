import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useItemDetails } from '../hooks/useItemDetails';
import { useStocks } from '../hooks/useStocks';
import ItemService from '../services/ItemService';

/**
 * This is an example component showing how to use the stock management functionality.
 * It demonstrates adding items, updating stocks, and viewing stock levels.
 */
export const StockManagementExample: React.FC = () => {
  const { itemDetails, isLoading: itemsLoading, error: itemsError } = useItemDetails();
  const { isLoading: stocksLoading, error: stocksError, addStock, updateStock, subtractStock, getLowStockItems } = useStocks();

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [lowStockItems, setLowStockItems] = useState([]);

  // Create a new item with initial stock
  const handleCreateItem = async () => {
    if (!newItemName || !newItemPrice || !newItemStock) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const itemData = {
        item_name: newItemName,
        price: parseFloat(newItemPrice),
        stocks: parseInt(newItemStock)
      };

      await ItemService.createItem(itemData);
      
      // Clear form
      setNewItemName('');
      setNewItemPrice('');
      setNewItemStock('');
      
      Alert.alert('Success', 'Item created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create item');
      console.error('Error creating item:', error);
    }
  };

  // Add stock to existing item
  const handleAddStock = async () => {
    if (!selectedItemId || !stockQuantity) {
      Alert.alert('Error', 'Please select an item and enter quantity');
      return;
    }

    await addStock(selectedItemId, parseInt(stockQuantity));
    setStockQuantity('');
    
    if (!stocksError) {
      Alert.alert('Success', 'Stock added successfully!');
    } else {
      Alert.alert('Error', stocksError);
    }
  };

  // Update stock to specific level
  const handleUpdateStock = async () => {
    if (!selectedItemId || !stockQuantity) {
      Alert.alert('Error', 'Please select an item and enter quantity');
      return;
    }

    await updateStock(selectedItemId, parseInt(stockQuantity));
    setStockQuantity('');
    
    if (!stocksError) {
      Alert.alert('Success', 'Stock updated successfully!');
    } else {
      Alert.alert('Error', stocksError);
    }
  };

  // Subtract stock (for sales)
  const handleSubtractStock = async () => {
    if (!selectedItemId || !stockQuantity) {
      Alert.alert('Error', 'Please select an item and enter quantity');
      return;
    }

    await subtractStock(selectedItemId, parseInt(stockQuantity));
    setStockQuantity('');
    
    if (!stocksError) {
      Alert.alert('Success', 'Stock subtracted successfully!');
    } else {
      Alert.alert('Error', stocksError);
    }
  };

  // Get low stock items
  const handleGetLowStockItems = async () => {
    const lowStock = await getLowStockItems(10); // Items with stock <= 10
    setLowStockItems(lowStock);
  };

  useEffect(() => {
    handleGetLowStockItems();
  }, []);

  if (itemsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading items...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Stock Management Example
      </Text>

      {/* Create New Item Section */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Create New Item
        </Text>
        
        <TextInput
          placeholder="Item Name"
          value={newItemName}
          onChangeText={setNewItemName}
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 }}
        />
        
        <TextInput
          placeholder="Price"
          value={newItemPrice}
          onChangeText={setNewItemPrice}
          keyboardType="numeric"
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 }}
        />
        
        <TextInput
          placeholder="Initial Stock"
          value={newItemStock}
          onChangeText={setNewItemStock}
          keyboardType="numeric"
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 }}
        />
        
        <TouchableOpacity
          onPress={handleCreateItem}
          style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 5, alignItems: 'center' }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Create Item</Text>
        </TouchableOpacity>
      </View>

      {/* Stock Management Section */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Manage Stock
        </Text>
        
        {/* Item Selection */}
        <Text style={{ marginBottom: 5 }}>Select Item:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {itemDetails.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setSelectedItemId(item.id)}
              style={{
                backgroundColor: selectedItemId === item.id ? '#007AFF' : '#f0f0f0',
                padding: 10,
                marginRight: 10,
                borderRadius: 5,
                minWidth: 120
              }}
            >
              <Text style={{ 
                color: selectedItemId === item.id ? 'white' : 'black',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                {item.item_name}
              </Text>
              <Text style={{ 
                color: selectedItemId === item.id ? 'white' : 'gray',
                textAlign: 'center',
                fontSize: 12
              }}>
                Stock: {item.stocks}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <TextInput
          placeholder="Quantity"
          value={stockQuantity}
          onChangeText={setStockQuantity}
          keyboardType="numeric"
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 }}
        />
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <TouchableOpacity
            onPress={handleAddStock}
            style={{ backgroundColor: '#28A745', padding: 10, borderRadius: 5, flex: 1, marginRight: 5 }}
            disabled={stocksLoading}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
              Add Stock
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleUpdateStock}
            style={{ backgroundColor: '#FFC107', padding: 10, borderRadius: 5, flex: 1, marginHorizontal: 5 }}
            disabled={stocksLoading}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
              Set Stock
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleSubtractStock}
            style={{ backgroundColor: '#DC3545', padding: 10, borderRadius: 5, flex: 1, marginLeft: 5 }}
            disabled={stocksLoading}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
              Subtract
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Items List */}
      <View style={{ marginBottom: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Current Items & Stock Levels
        </Text>
        
        {itemDetails.map((item) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 15,
              backgroundColor: '#f8f9fa',
              marginBottom: 5,
              borderRadius: 5,
              borderLeftWidth: 4,
              borderLeftColor: item.stocks <= 10 ? '#DC3545' : item.stocks <= 20 ? '#FFC107' : '#28A745'
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.item_name}</Text>
              <Text style={{ color: '#666', fontSize: 14 }}>${item.price.toFixed(2)}</Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: item.stocks <= 10 ? '#DC3545' : item.stocks <= 20 ? '#FFC107' : '#28A745'
              }}>
                {item.stocks}
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>in stock</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#DC3545', marginBottom: 10 }}>
            ⚠️ Low Stock Alert
          </Text>
          
          {lowStockItems.map((item) => (
            <View
              key={item.id}
              style={{
                padding: 10,
                backgroundColor: '#FFE6E6',
                marginBottom: 5,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: '#DC3545'
              }}
            >
              <Text style={{ fontWeight: 'bold', color: '#DC3545' }}>
                {item.item_name} - Only {item.stocks} left!
              </Text>
            </View>
          ))}
          
          <TouchableOpacity
            onPress={handleGetLowStockItems}
            style={{ backgroundColor: '#DC3545', padding: 10, borderRadius: 5, marginTop: 10 }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
              Refresh Low Stock Items
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Display */}
      {(itemsError || stocksError) && (
        <View style={{ 
          backgroundColor: '#FFE6E6',
          padding: 15,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: '#DC3545',
          marginBottom: 20
        }}>
          <Text style={{ color: '#DC3545', fontWeight: 'bold' }}>
            Error: {itemsError || stocksError}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};
