import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useLowStockItems } from '../hooks/useLowStockItems';
import { useUpdateItem } from '../hooks/useSyncManager';

interface LowStockAlertsProps {
  onNavigateToItem?: (itemId: string) => void;
}

const LowStockAlerts: React.FC<LowStockAlertsProps> = ({ onNavigateToItem }) => {
  const { t } = useLanguage();
  const { data: lowStockItems = [], isLoading, error, refetch } = useLowStockItems();
  const updateItemMutation = useUpdateItem();
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'threshold'>('quantity');
  const [filterCritical, setFilterCritical] = useState(false);

  // Sort and filter items
  const processedItems = useMemo(() => {
    let filtered = [...lowStockItems];
    
    // Filter for critical items (quantity < 50% of threshold)
    if (filterCritical) {
      filtered = filtered.filter(item => 
        item.quantity < (item.lowStockThreshold || 10) * 0.5
      );
    }
    
    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.item_name.localeCompare(b.item_name);
        case 'quantity':
          return a.quantity - b.quantity;
        case 'threshold':
          return (a.lowStockThreshold || 0) - (b.lowStockThreshold || 0);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [lowStockItems, sortBy, filterCritical]);

  const handleEditThreshold = (itemId: string, currentThreshold: number) => {
    setEditingItemId(itemId);
    setEditValue(currentThreshold.toString());
  };

  const handleSaveThreshold = async (itemId: string) => {
    const newThreshold = parseInt(editValue, 10);
    
    if (isNaN(newThreshold) || newThreshold < 0) {
      Alert.alert(
        t('common.error'),
        t('items.invalidThresholdValue'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    try {
      await updateItemMutation.mutateAsync({
        itemId: itemId,
        itemData: { lowStockThreshold: newThreshold }
      });
      
      setEditingItemId(null);
      setEditValue('');
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('items.failedToUpdateThreshold'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditValue('');
  };

  const getStockStatus = (quantity: number, threshold: number) => {
    const percentage = (quantity / threshold) * 100;
    if (percentage <= 0) return { label: t('items.outOfStock'), color: '#dc2626' };
    if (percentage < 50) return { label: t('items.critical'), color: '#ea580c' };
    return { label: t('items.low'), color: '#f59e0b' };
  };

  const renderItem = ({ item }: { item: any }) => {
    const isEditing = editingItemId === item.id;
    const stockStatus = getStockStatus(item.quantity, item.lowStockThreshold || 10);
    
    return (
      <View style={[styles.itemCard, { borderLeftColor: stockStatus.color }]}>
        <TouchableOpacity
          style={styles.itemHeader}
          onPress={() => onNavigateToItem?.(item.id)}
          disabled={isEditing}
        >
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <Text style={styles.itemCategory}>{item.category || t('items.uncategorized')}</Text>
          </View>
          
          <View style={styles.stockBadge}>
            <Text style={[styles.stockBadgeText, { color: stockStatus.color }]}>
              {stockStatus.label}
            </Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.itemDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('items.currentStock')}:</Text>
            <Text style={[styles.detailValue, { color: stockStatus.color, fontWeight: '700' }]}>
              {item.quantity}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('items.threshold')}:</Text>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="number-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.editButton, styles.saveButton]}
                  onPress={() => handleSaveThreshold(item.id)}
                >
                  <Text style={styles.editButtonText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.editButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() => handleEditThreshold(item.id, item.lowStockThreshold || 10)}
              >
                <Text style={styles.detailValue}>{item.lowStockThreshold || 10}</Text>
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('items.price')}:</Text>
            <Text style={styles.detailValue}>${item.price.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t('items.failedToLoadLowStockItems')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Controls */}
      <View style={styles.controls}>
        <View style={styles.sortControls}>
          <Text style={styles.controlLabel}>{t('items.sortBy')}:</Text>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'quantity' && styles.sortButtonActive]}
            onPress={() => setSortBy('quantity')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'quantity' && styles.sortButtonTextActive]}>
              {t('items.quantity')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
            onPress={() => setSortBy('name')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
              {t('items.name')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'threshold' && styles.sortButtonActive]}
            onPress={() => setSortBy('threshold')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'threshold' && styles.sortButtonTextActive]}>
              {t('items.threshold')}
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.filterButton, filterCritical && styles.filterButtonActive]}
          onPress={() => setFilterCritical(!filterCritical)}
        >
          <Text style={[styles.filterButtonText, filterCritical && styles.filterButtonTextActive]}>
            {t('items.criticalOnly')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{processedItems.length}</Text>
          <Text style={styles.summaryLabel}>{t('items.itemsLowStock')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
            {processedItems.filter(item => item.quantity === 0).length}
          </Text>
          <Text style={styles.summaryLabel}>{t('items.outOfStock')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#ea580c' }]}>
            {processedItems.filter(item => 
              item.quantity > 0 && item.quantity < (item.lowStockThreshold || 10) * 0.5
            ).length}
          </Text>
          <Text style={styles.summaryLabel}>{t('items.critical')}</Text>
        </View>
      </View>

      {/* Items List */}
      {processedItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyText}>
            {filterCritical ? t('items.noCriticalItems') : t('items.allItemsInStock')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={processedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor="#2563eb"
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  controls: {
    backgroundColor: 'white',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  sortButtonActive: {
    backgroundColor: '#2563eb',
  },
  sortButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: 'white',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
  },
  filterButtonActive: {
    backgroundColor: '#dc2626',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 13,
    color: '#6b7280',
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemDetails: {
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  thresholdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editIcon: {
    fontSize: 14,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    width: 60,
    height: 32,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    backgroundColor: 'white',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LowStockAlerts;
