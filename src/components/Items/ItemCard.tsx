import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ItemDetails } from '../../types';
import { usePendingUpdates } from '../../store/syncStore';

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
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isSelectionMode && styles.cardSelectionMode,
      ]}
      onPress={isSelectionMode ? onPress : () => onEditItem(item)}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Selection Checkbox */}
      {isSelectionMode && (
        <View style={styles.selectionContainer}>
          <TouchableOpacity
            style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            onPress={() => onToggleSelection(item.id)}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.item_name}
            </Text>
            <Text style={styles.itemPrice}>
              ${item.price.toFixed(2)}
            </Text>
          </View>

          {/* Stock Badge */}
          <View style={[styles.stockBadge, { 
            backgroundColor: getStockColor(item.stocks || 0),
            opacity: isItemPending ? 0.7 : 1
          }]}>
            <Ionicons 
              name={getStockIcon(item.stocks || 0)} 
              size={12} 
              color="white" 
            />
            <Text style={styles.stockText}>
              {getStockText(item.stocks || 0)}{isItemPending ? ' (updating...)' : ''}
            </Text>
          </View>
        </View>

      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  cardSelectionMode: {
    marginLeft: 16,
  },
  selectionContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  cardContent: {
    padding: 16,
    paddingLeft: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 80,
    justifyContent: 'center',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
});

export default ItemCard;
