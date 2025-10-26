import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ItemDetails } from '../../types';
import { usePendingUpdates } from '../../store/syncStore';
import { formatCurrency } from '../../utils';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

interface ItemCardProps {
  item: ItemDetails;
  isSelected: boolean;
  isSelectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggleSelection: (itemId: string) => void;
  onEditItem: (item: ItemDetails) => void;
  onDeleteItem: (itemId: string) => void;
  onAddStock: (itemId: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  isSelected,
  isSelectionMode,
  onPress,
  onLongPress,
  onToggleSelection,
  onEditItem,
  onDeleteItem,
  onAddStock,
}) => {
  const pendingUpdates = usePendingUpdates();
  
  // Check if item has pending updates
  const isItemPending = Array.from(pendingUpdates.values()).some(
    update => update.documentId === item.id && update.collection === 'item_details'
  );
  const getStockColor = (stock: number) => {
    if (stock > 20) return '#10b981';
    if (stock > 10) return '#f59e0b';
    return '#ef4444';
  };

  const getStockIcon = (stock: number) => {
    if (stock > 20) return 'checkmark-circle';
    if (stock > 10) return 'warning';
    return 'alert-circle';
  };

  const getStockText = (stock: number) => {
    if (stock === 0) return 'Out of stock';
    if (stock === 1) return '1 kg left';
    return `${stock} kg`;
  };

  return (
    <Card
      className={`mx-4 mb-3 ${isSelected ? 'border-2 border-primary-500 bg-primary-50' : ''} ${
        isSelectionMode ? 'ml-4' : ''
      }`}
    >
      <TouchableOpacity
        onPress={isSelectionMode ? onPress : () => onEditItem(item)}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <View className="absolute left-3 top-3 z-10">
            <TouchableOpacity
              className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                isSelected ? 'border-primary-600 bg-primary-600' : 'border-secondary-300 bg-white'
              }`}
              onPress={() => onToggleSelection(item.id)}
            >
              {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
            </TouchableOpacity>
          </View>
        )}

        <View className="p-4">
          {/* Header */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="mr-3 flex-1">
              <Text numberOfLines={2} className="mb-1 text-lg font-semibold text-secondary-900">
                {item.item_name}
              </Text>
              <Text className="text-xl font-extrabold text-primary-600">
                {formatCurrency(item.price)}
              </Text>
            </View>

            {/* Stock Badge */}
            <Badge
              variant={item.stocks && item.stocks > 20 ? 'success' : item.stocks && item.stocks > 10 ? 'warning' : 'danger'}
              className={`${isItemPending ? 'opacity-70' : ''} min-w-[80px] items-center`}
            >
              {getStockText(item.stocks || 0)}
            </Badge>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
};

export default ItemCard;
