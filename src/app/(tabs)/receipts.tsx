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
import ReceiptFirebaseService, { FirebaseReceipt } from '../../services/ReceiptFirebaseService';

// Import components
import ReceiptDetailModal from '../../components/Receipts/ReceiptDetailModal';
import DeleteConfirmationModal from '../../components/Receipts/DeleteConfirmationModal';
import ReceiptItem from '../../components/Receipts/ReceiptItem';
import ReceiptsHeader from '../../components/Receipts/ReceiptsHeader';
import EmptyState from '../../components/Receipts/EmptyState';
import LoadingState from '../../components/Receipts/LoadingState';
import ErrorState from '../../components/Receipts/ErrorState';

const ReceiptsScreen: React.FC = () => {
  const [receipts, setReceipts] = useState<FirebaseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<FirebaseReceipt | null>(null);
  
  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Delete functionality states
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'multiple' | 'all'>('single');
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [pendingStatusUpdates, setPendingStatusUpdates] = useState<Set<string>>(new Set());

  // Helper function to update receipt status optimistically
  const updateReceiptStatusOptimistically = (receiptId: string, newStatus: 'printed' | 'exported' | 'draft') => {
    setReceipts(prevReceipts => 
      prevReceipts.map(receipt => 
        receipt.id === receiptId 
          ? { ...receipt, status: newStatus, updatedAt: { toDate: () => new Date() } as any }
          : receipt
      )
    );
  };

  // Helper function to handle receipt status updates with optimistic updates
  const handleReceiptStatusUpdate = async (receiptId: string, newStatus: 'printed' | 'exported' | 'draft') => {
    // Add to pending updates
    setPendingStatusUpdates(prev => new Set(prev).add(receiptId));
    
    // Store original receipt for potential rollback
    const originalReceipt = receipts.find(r => r.id === receiptId);
    
    // Optimistic update
    updateReceiptStatusOptimistically(receiptId, newStatus);
    
    try {
      const result = await ReceiptFirebaseService.updateReceiptStatus(receiptId, newStatus, new Date());
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update receipt status');
      }
      
      console.log(`Receipt ${receiptId} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating receipt status:', error);
      
      // Rollback on error
      if (originalReceipt) {
        setReceipts(prevReceipts => 
          prevReceipts.map(receipt => 
            receipt.id === receiptId ? originalReceipt : receipt
          )
        );
      }
      
      Alert.alert('Error', `Failed to update receipt status: ${error.message}`);
    } finally {
      // Remove from pending updates
      setPendingStatusUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(receiptId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    // Set up real-time subscription
    const setupSubscription = () => {
      setLoading(true);
      setError(null);
      
      unsubscribe = ReceiptFirebaseService.subscribeToReceipts(
        (updatedReceipts) => {
          console.log('Received real-time receipt updates:', updatedReceipts.length);
          
          // Sort receipts by creation date (newest first)
          const sortedReceipts = updatedReceipts.sort((a, b) => {
            try {
              const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
              const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
              return dateB.getTime() - dateA.getTime();
            } catch (error) {
              console.error('Error sorting receipts by date:', error);
              return 0;
            }
          });
          
          setReceipts(sortedReceipts);
          setLoading(false);
          setRefreshing(false);
        },
        (error) => {
          console.error('Real-time receipt subscription error:', error);
          setError('Failed to load receipts. Please try again.');
          setLoading(false);
          setRefreshing(false);
        }
      );
    };
    
    setupSubscription();
    
    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadReceipts = async () => {
    // This method is now mainly used for manual refresh
    // The real-time subscription handles most updates automatically
    try {
      setError(null);
      setRefreshing(true);
      
      // Force a fresh fetch by temporarily stopping and restarting the listener
      ReceiptFirebaseService.stopRealtimeListener();
      
      const receiptData = await ReceiptFirebaseService.getAllReceipts();
      
      // Sort receipts by creation date (newest first)
      const sortedReceipts = receiptData.sort((a, b) => {
        try {
          const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
          const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.error('Error sorting receipts by date:', error);
          return 0;
        }
      });
      
      setReceipts(sortedReceipts);
      
      // Restart the real-time listener
      ReceiptFirebaseService.setupRealtimeListener();
      
    } catch (err) {
      console.error('Error loading receipts:', err);
      setError('Failed to load receipts. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceipts();
  };

  const formatReceiptDate = (date: any) => {
    try {
      let dateObj: Date;
      
      if (!date) {
        return 'No Date';
      }
      
      // If it's already a Date object
      if (date instanceof Date) {
        dateObj = date;
      }
      // If it's a Firebase Timestamp with toDate method
      else if (typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // If it's a timestamp number
      else if (typeof date === 'number') {
        dateObj = new Date(date);
      }
      // If it's a string
      else if (typeof date === 'string') {
        dateObj = new Date(date);
      }
      else {
        console.warn('Unknown date format:', date);
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid Date';
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'printed':
        return '#10b981';
      case 'exported':
        return '#3b82f6';
      case 'draft':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'printed':
        return 'checkmark-circle';
      case 'exported':
        return 'download';
      case 'draft':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  // Filter and sort receipts
  const filteredAndSortedReceipts = useMemo(() => {
    let filtered = receipts;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(receipt => 
        receipt.customerName?.toLowerCase().includes(query) ||
        receipt.receiptNumber?.toLowerCase().includes(query) ||
        receipt.companyName?.toLowerCase().includes(query) ||
        receipt.items.some(item => item.name?.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(receipt => receipt.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
          const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'customer':
          const customerA = (a.customerName || 'Walk-in Customer').toLowerCase();
          const customerB = (b.customerName || 'Walk-in Customer').toLowerCase();
          comparison = customerA.localeCompare(customerB);
          break;
        case 'total':
          comparison = (a.total || 0) - (b.total || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [receipts, searchQuery, statusFilter, sortBy, sortOrder]);

  // Delete functions
  const handleDeleteSingle = (receiptId: string) => {
    setReceiptToDelete(receiptId);
    setDeleteMode('single');
    setShowDeleteConfirm(true);
  };

  const handleDeleteMultiple = () => {
    if (selectedReceipts.size === 0) return;
    setDeleteMode('multiple');
    setShowDeleteConfirm(true);
  };

  const handleDeleteAll = () => {
    setDeleteMode('all');
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    let receiptIdsToDelete: string[] = [];
    let receiptsToBackup: FirebaseReceipt[] = [];
    
    try {
      switch (deleteMode) {
        case 'single':
          if (receiptToDelete) {
            receiptIdsToDelete = [receiptToDelete];
            receiptsToBackup = receipts.filter(r => r.id === receiptToDelete);
            
            // Mark as pending and optimistically remove
            setPendingDeletions(prev => new Set(prev).add(receiptToDelete));
            optimisticallyRemoveReceipts([receiptToDelete]);
            
            await ReceiptFirebaseService.deleteReceipt(receiptToDelete);
          }
          break;
        case 'multiple':
          receiptIdsToDelete = Array.from(selectedReceipts);
          receiptsToBackup = receipts.filter(r => selectedReceipts.has(r.id));
          
          // Mark as pending and optimistically remove
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });
          optimisticallyRemoveReceipts(receiptIdsToDelete);
          
          await Promise.all(receiptIdsToDelete.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          setSelectedReceipts(new Set());
          setIsSelectionMode(false);
          break;
        case 'all':
          receiptIdsToDelete = filteredAndSortedReceipts.map(r => r.id);
          receiptsToBackup = [...filteredAndSortedReceipts];
          
          // Mark as pending and optimistically remove
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });
          optimisticallyRemoveReceipts(receiptIdsToDelete);
          
          await Promise.all(receiptIdsToDelete.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          break;
      }
      
      // Success - real-time listener will sync with Firebase
      Alert.alert(
        'Success',
        `Receipt${deleteMode === 'single' ? '' : 's'} deleted successfully`
      );
    } catch (error) {
      console.error('Error deleting receipts:', error);
      
      // Rollback optimistic updates on error
      if (receiptsToBackup.length > 0) {
        rollbackReceiptDeletion(receiptsToBackup);
      }
      
      Alert.alert('Error', 'Failed to delete receipt(s). Please try again.');
    } finally {
      // Clear pending deletions
      setPendingDeletions(prev => {
        const newSet = new Set(prev);
        receiptIdsToDelete.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setReceiptToDelete(null);
    }
  };

  const toggleReceiptSelection = (receiptId: string) => {
    const newSelected = new Set(selectedReceipts);
    if (newSelected.has(receiptId)) {
      newSelected.delete(receiptId);
    } else {
      newSelected.add(receiptId);
    }
    setSelectedReceipts(newSelected);
  };

  const selectAllReceipts = () => {
    const allIds = filteredAndSortedReceipts.map(r => r.id);
    setSelectedReceipts(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedReceipts(new Set());
    setIsSelectionMode(false);
  };

  // Optimistic delete helper functions
  const optimisticallyRemoveReceipts = (receiptIds: string[]) => {
    setReceipts(prevReceipts => 
      prevReceipts.filter(receipt => !receiptIds.includes(receipt.id))
    );
  };

  const rollbackReceiptDeletion = (deletedReceipts: FirebaseReceipt[]) => {
    setReceipts(prevReceipts => {
      const restoredReceipts = [...prevReceipts, ...deletedReceipts];
      // Re-sort by creation date (newest first)
      return restoredReceipts.sort((a, b) => {
        try {
          const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
          const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.error('Error sorting receipts by date:', error);
          return 0;
        }
      });
    });
  };

  const renderReceiptItem = ({ item }: { item: FirebaseReceipt }) => {
    const isSelected = selectedReceipts.has(item.id);
    const isPendingDeletion = pendingDeletions.has(item.id);
    
    return (
      <ReceiptItem
        item={item}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        isPendingDeletion={isPendingDeletion}
        formatReceiptDate={formatReceiptDate}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        onLongPress={() => {
          if (!isSelectionMode && !isPendingDeletion) {
            setIsSelectionMode(true);
            setSelectedReceipts(new Set([item.id]));
          }
        }}
        onPress={() => {
          if (isSelectionMode && !isPendingDeletion) {
            toggleReceiptSelection(item.id);
          }
        }}
        onToggleSelection={toggleReceiptSelection}
        onViewReceipt={setSelectedReceipt}
        onDeleteReceipt={handleDeleteSingle}
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
        <ReceiptsHeader
          isSelectionMode={isSelectionMode}
          selectedCount={selectedReceipts.size}
          filteredCount={filteredAndSortedReceipts.length}
          totalCount={receipts.length}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          showFilters={showFilters}
          onToggleSelectionMode={() => setIsSelectionMode(true)}
          onSelectAll={selectAllReceipts}
          onDeleteMultiple={handleDeleteMultiple}
          onDeleteAll={handleDeleteAll}
          onClearSelection={clearSelection}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onRefresh={loadReceipts}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onStatusFilterChange={setStatusFilter}
          onSortByChange={(sortBy) => setSortBy(sortBy as 'date' | 'customer' | 'total')}
          onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        />

        {filteredAndSortedReceipts.length === 0 ? (
          <View style={styles.emptyContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#9ca3af" />
            ) : (
              <EmptyState 
                hasSearch={searchQuery.trim().length > 0}
                hasFilters={statusFilter !== 'all'}
                onClearFilters={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={filteredAndSortedReceipts}
            renderItem={renderReceiptItem}
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
        
        <DeleteConfirmationModal
          visible={showDeleteConfirm}
          deleteMode={deleteMode}
          selectedCount={selectedReceipts.size}
          totalCount={filteredAndSortedReceipts.length}
          isDeleting={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
        
        {selectedReceipt && (
          <ReceiptDetailModal 
            receipt={selectedReceipt} 
            onClose={() => setSelectedReceipt(null)} 
          />
        )}
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

export default ReceiptsScreen;
