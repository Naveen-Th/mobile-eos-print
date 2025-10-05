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
import { useReceipts } from '../../hooks/useSyncManager';
import { usePendingUpdates } from '../../store/syncStore';
import PDFService from '../../services/PDFService';

// Import components
import ReceiptDetailModal from '../../components/Receipts/ReceiptDetailModal';
import DeleteConfirmationModal from '../../components/Receipts/DeleteConfirmationModal';
import ReceiptItem from '../../components/Receipts/ReceiptItem';
import ReceiptsHeader from '../../components/Receipts/ReceiptsHeader';
import EmptyState from '../../components/Receipts/EmptyState';
import LoadingState from '../../components/Receipts/LoadingState';
import ErrorState from '../../components/Receipts/ErrorState';

const ReceiptsScreen: React.FC = () => {
  // TanStack Query hooks for receipts
  const { 
    data: receipts = [], 
    isLoading: loading, 
    error, 
    refetch 
  } = useReceipts();
  
  // Debug: Log what receipts screen is receiving
  console.log('🚿 [RECEIPTS SCREEN DEBUG] Receipts data:', receipts);
  console.log('🚿 [RECEIPTS SCREEN DEBUG] Is loading:', loading);
  console.log('🚿 [RECEIPTS SCREEN DEBUG] Error:', error);
  console.log('🚿 [RECEIPTS SCREEN DEBUG] Receipts length:', receipts?.length);
  
  // Zustand state for pending updates
  const pendingUpdates = usePendingUpdates();
  
  // Local UI state
  const [refreshing, setRefreshing] = useState(false);
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

  // Helper function to handle receipt status updates (simplified - relies on real-time sync)
  const handleReceiptStatusUpdate = React.useCallback(async (receiptId: string, newStatus: 'printed' | 'exported' | 'draft') => {
    if (!receiptId || typeof receiptId !== 'string') {
      console.error('Invalid receipt ID provided for status update');
      return;
    }
    
    // Add to pending updates
    setPendingStatusUpdates(prev => new Set(prev).add(receiptId));
    
    try {
      const result = await ReceiptFirebaseService.updateReceiptStatus(receiptId, newStatus, new Date());
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update receipt status');
      }
      
      console.log(`Receipt ${receiptId} status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating receipt status:', error);
      Alert.alert(
        'Update Failed', 
        `Failed to update receipt status: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      // Remove from pending updates
      setPendingStatusUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(receiptId);
        return newSet;
      });
    }
  }, []);

  // Check if receipt has pending updates
  const isReceiptPending = (receiptId: string) => {
    return Array.from(pendingUpdates.values()).some(
      update => update.documentId === receiptId && update.collection === 'receipts'
    );
  };

  const loadReceipts = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Don't call refetch for real-time collections - data comes from listener
      console.log('Skipping refetch for real-time collection - data comes from Firebase listener');
      // Just simulate a brief loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('Receipts refresh completed (real-time data)');
    } catch (err) {
      console.error('Error refreshing receipts:', err);
      Alert.alert(
        'Error',
        'Failed to refresh receipts. Please check your connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, []); // Removed refetch from dependencies

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceipts();
  };

  const formatReceiptDate = React.useCallback((date: any) => {
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
      else if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // If it's a timestamp number
      else if (typeof date === 'number' && !isNaN(date)) {
        dateObj = new Date(date);
      }
      // If it's a string
      else if (typeof date === 'string' && date.trim()) {
        dateObj = new Date(date);
      }
      else {
        console.warn('Unknown date format:', date);
        return 'Invalid Date';
      }
      
      // Validate the date object
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date object created from:', date);
        return 'Invalid Date';
      }
      
      // Format the date consistently
      const dateOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      };
      
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      const formattedDate = dateObj.toLocaleDateString(undefined, dateOptions);
      const formattedTime = dateObj.toLocaleTimeString(undefined, timeOptions);
      
      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      console.error('Error formatting date:', error, 'Input:', date);
      return 'Invalid Date';
    }
  }, []);
  const getStatusColor = React.useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'printed':
        return '#10b981'; // Green
      case 'exported':
        return '#3b82f6'; // Blue
      case 'draft':
        return '#f59e0b'; // Yellow/Orange
      case 'failed':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  }, []);

  const getStatusIcon = React.useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'printed':
        return 'checkmark-circle';
      case 'exported':
        return 'download';
      case 'draft':
        return 'time';
      case 'failed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  }, []);

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
            
            // Mark as pending
            setPendingDeletions(prev => new Set(prev).add(receiptToDelete));
            
            await ReceiptFirebaseService.deleteReceipt(receiptToDelete);
          }
          break;
        case 'multiple':
          receiptIdsToDelete = Array.from(selectedReceipts);
          receiptsToBackup = receipts.filter(r => selectedReceipts.has(r.id));
          
          // Mark as pending
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });
          
          await Promise.all(receiptIdsToDelete.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          setSelectedReceipts(new Set());
          setIsSelectionMode(false);
          break;
        case 'all':
          receiptIdsToDelete = filteredAndSortedReceipts.map(r => r.id);
          receiptsToBackup = [...filteredAndSortedReceipts];
          
          // Mark as pending
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });
          
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
      
      // Note: Real-time sync will automatically revert any failed deletes
      
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

  // Handle PDF generation
  const handleSavePDF = React.useCallback(async (receipt: FirebaseReceipt) => {
    try {
      console.log('Generating PDF for receipt:', receipt.receiptNumber);
      await PDFService.generateAndSaveReceiptPDF(receipt);
      
      // Update receipt status to exported
      await handleReceiptStatusUpdate(receipt.id, 'exported');
    } catch (error) {
      console.error('Error in handleSavePDF:', error);
      // Error handling is done in PDFService.generateAndSaveReceiptPDF
    }
  }, [handleReceiptStatusUpdate]);

  // Note: Optimistic updates are handled by the real-time sync system

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
        onSavePDF={handleSavePDF}
      />
    );
  };

  if (loading) {
    return (
      <LoadingState message="Loading receipts..." />
    );
  }

  if (error) {
    return (
      <ErrorState 
        error={error}
        onRetry={loadReceipts}
        title="Failed to load receipts"
        message="There was an error loading your receipts. Please check your connection and try again."
      />
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
