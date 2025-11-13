import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import LowStockAlertService, { LowStockItem } from '../services/features/LowStockAlertService';
import { formatCurrency } from '../utils';

interface LowStockAlertsPanelProps {
  onItemPress?: (itemId: string) => void;
}

const LowStockAlertsPanel: React.FC<LowStockAlertsPanelProps> = ({ onItemPress }) => {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await LowStockAlertService.getInstance().getLowStockItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading low stock alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = items.filter(i => i.stockLevel === 'critical').length;
  const lowCount = items.filter(i => i.stockLevel === 'low').length;

  if (loading) {
    return (
      <View className="bg-white rounded-xl p-4 mx-5 mb-4 shadow-sm">
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View className="mx-5 mb-4">
      {/* Alert Banner */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-4 shadow-lg"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Text className="text-3xl mr-3">⚠️</Text>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">
                Low Stock Alert
              </Text>
              <Text className="text-white/90 text-sm">
                {criticalCount} critical • {lowCount} low stock items
              </Text>
            </View>
          </View>
          <Text className="text-white text-2xl">
            {expanded ? '▼' : '▶'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expanded List */}
      {expanded && (
        <View className="bg-white rounded-xl mt-2 shadow-sm">
          <ScrollView className="max-h-96">
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onItemPress?.(item.id)}
                className="p-4 border-b border-gray-100"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <View
                        className={`px-2 py-1 rounded-full mr-2 ${
                          item.stockLevel === 'critical'
                            ? 'bg-red-100'
                            : 'bg-orange-100'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            item.stockLevel === 'critical'
                              ? 'text-red-800'
                              : 'text-orange-800'
                          }`}
                        >
                          {item.stockLevel.toUpperCase()}
                        </Text>
                      </View>
                      <Text className="text-gray-900 font-bold flex-1">
                        {item.item_name}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-gray-600 text-sm">
                        Stock: {item.stocks}/{item.minStock} min
                      </Text>
                      {item.category && (
                        <Text className="text-gray-400 text-sm ml-2">
                          • {item.category}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="items-end ml-3">
                    <Text className="text-gray-900 font-semibold">
                      {formatCurrency(item.price)}
                    </Text>
                    <View className="bg-gray-100 rounded-full h-2 w-16 mt-1 overflow-hidden">
                      <View
                        className={`h-full ${
                          item.stockLevel === 'critical'
                            ? 'bg-red-500'
                            : 'bg-orange-500'
                        }`}
                        style={{ width: `${item.percentageRemaining}%` }}
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default LowStockAlertsPanel;
