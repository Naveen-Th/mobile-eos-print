import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReceiptFirebaseService, { FirebaseReceipt } from '../../services/business/ReceiptFirebaseService';
import { useReceipts } from '../../hooks/useSyncManager';
import { usePendingUpdates } from '../../store/syncStore';
import PDFService from '../../services/printing/PDFService';
import BalanceTrackingService from '../../services/business/BalanceTrackingService';

// Import components
import ReceiptDetailModal from '../../components/Receipts/ReceiptDetailModal';
import DeleteConfirmationModal from '../../components/Receipts/DeleteConfirmationModal';
import ReceiptItem from '../../components/Receipts/ReceiptItemOptimized';
import ReceiptsHeader from '../../components/Receipts/ReceiptsHeader';
import EmptyState from '../../components/Receipts/EmptyState';
import LoadingState from '../../components/Receipts/LoadingState';
import ErrorState from '../../components/Receipts/ErrorState';
import RecordPaymentModal from '../../components/RecordPaymentModalWithCascade';
import FloatingActionBar from '../../components/Receipts/FloatingActionBar';
import Pagination from '../../components/Receipts/Pagination';
import { useDebounce } from '../../hooks/useDebounce';
import { useQueryClient } from '@tanstack/react-query';
import { CacheInvalidation } from '../../utils/cacheInvalidation';
import { searchFilterSort, buildSearchIndex } from '../../utils/receiptSearchOptimized';
import { performanceTime, performanceTimeEnd } from '../../utils/performanceTiming';

const ReceiptsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  
  // TanStack Query hooks for receipts
  const { 
    data: receipts = [], 
    isLoading: loading, 
    error, 
    refetch 
  } = useReceipts();
  
  // Zustand state for pending updates
  const pendingUpdates = usePendingUpdates();
  
  // Local UI state
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FirebaseReceipt | null>(null);
  
  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [receiptForPayment, setReceiptForPayment] = useState<FirebaseReceipt | null>(null);
  
  // Customer balances cache
  const [customerBalances, setCustomerBalances] = useState<Map<string, number>>(new Map());
  
  // Debounce timer for balance calculations
  const balanceCalculationTimer = useRef<NodeJS.Timeout | null>(null);
  
  // ⚡ OPTIMIZED PAGINATION - 10 items per page with lazy loading
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedItemsCount, setDisplayedItemsCount] = useState(ITEMS_PER_PAGE);
  
  // Lazy loading state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Helper function to handle receipt status updates
  const handleReceiptStatusUpdate = React.useCallback(async (receiptId: string, newStatus: 'printed' | 'exported' | 'draft') => {
    if (!receiptId || typeof receiptId !== 'string') {
      console.error('Invalid receipt ID provided for status update');
      return;
    }
    
    setPendingStatusUpdates(prev => new Set(prev).add(receiptId));
    
    try {
      const result = await ReceiptFirebaseService.updateReceiptStatus(receiptId, newStatus, new Date());
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update receipt status');
      }
    } catch (error: any) {
      console.error('Error updating receipt status:', error);
      Alert.alert(
        'Update Failed', 
        `Failed to update receipt status: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
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
      console.log('🔄 Manual refresh triggered - invalidating cache...');
      await CacheInvalidation.invalidateReceipts(queryClient);
      console.log('✅ Cache invalidated - data should be fresh now');
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
  }, [queryClient]);

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
      
      if (date instanceof Date) {
        dateObj = date;
      } else if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (typeof date === 'number' && !isNaN(date)) {
        dateObj = new Date(date);
      } else if (typeof date === 'string' && date.trim()) {
        dateObj = new Date(date);
      } else {
        console.warn('Unknown date format:', date);
        return 'Invalid Date';
      }
      
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date object created from:', date);
        return 'Invalid Date';
      }
      
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
        return '#10b981';
      case 'exported':
        return '#3b82f6';
      case 'draft':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
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

  // Calculate customer balances with debouncing
  useEffect(() => {
    if (balanceCalculationTimer.current) {
      clearTimeout(balanceCalculationTimer.current);
    }
    
    balanceCalculationTimer.current = setTimeout(() => {
      const balances = new Map<string, number>();
      const customerReceipts = new Map<string, FirebaseReceipt[]>();
      
      receiptsWithDynamicBalance.forEach(receipt => {
        const customerKey = receipt.customerName || 'Walk-in Customer';
        if (!customerReceipts.has(customerKey)) {
          customerReceipts.set(customerKey, []);
        }
        customerReceipts.get(customerKey)!.push(receipt);
      });
      
      customerReceipts.forEach((receipts, customerName) => {
        const totalBalance = receipts.reduce((sum, receipt) => {
          const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);
          return sum + receiptBalance;
        }, 0);
        
        balances.set(customerName, totalBalance);
      });
      
      setCustomerBalances(balances);
    }, 150);
    
    return () => {
      if (balanceCalculationTimer.current) {
        clearTimeout(balanceCalculationTimer.current);
      }
    };
  }, [receiptsWithDynamicBalance]);
  
  // Calculate dynamic balances
  const receiptsWithDynamicBalance = useMemo(() => {
    if (!receipts || receipts.length === 0) return [];
    
    const sorted = [...receipts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
      const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
      return dateA.getTime() - dateB.getTime();
    });
    
    const customerBalanceMap = new Map<string, number>();
    
    return sorted.map(receipt => {
      const customerName = receipt.customerName || 'Walk-in Customer';
      const previousBalance = customerBalanceMap.get(customerName) || 0;
      const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);
      
      customerBalanceMap.set(customerName, previousBalance + receiptBalance);
      
      return {
        ...receipt,
        oldBalance: previousBalance,
        newBalance: previousBalance + receiptBalance,
      };
    });
  }, [receipts]);
  
  // Build search index
  useEffect(() => {
    if (receiptsWithDynamicBalance.length > 0) {
      buildSearchIndex(receiptsWithDynamicBalance);
    }
  }, [receiptsWithDynamicBalance]);
  
  // Filter and sort receipts
  const filteredAndSortedReceipts = useMemo(() => {
    performanceTime('⚡ Search+Filter+Sort');
    
    const result = searchFilterSort(
      receiptsWithDynamicBalance,
      debouncedSearchQuery,
      statusFilter,
      sortBy,
      sortOrder
    );
    
    performanceTimeEnd('⚡ Search+Filter+Sort');
    console.log(`✅ Filtered ${result.length} receipts from ${receiptsWithDynamicBalance.length} total`);
    
    return result;
  }, [receiptsWithDynamicBalance, debouncedSearchQuery, statusFilter, sortBy, sortOrder]);
  
  // ⚡ OPTIMIZED PAGINATION - Only show 10 items per page
  const paginatedReceipts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const page = filteredAndSortedReceipts.slice(startIndex, endIndex);
    
    console.log(`📄 Showing page ${currentPage}: items ${startIndex + 1}-${Math.min(endIndex, filteredAndSortedReceipts.length)} of ${filteredAndSortedReceipts.length}`);
    
    return page;
  }, [filteredAndSortedReceipts, currentPage]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setDisplayedItemsCount(ITEMS_PER_PAGE);
  }, [debouncedSearchQuery, statusFilter, sortBy, sortOrder]);

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
  
  const handlePageChange = useCallback((page: number) => {
    console.log(`📄 Changing to page ${page}`);
    setCurrentPage(page);
  }, []);

  const confirmDelete = async () => {
    setIsDeleting(true);
    let receiptIdsToDelete: string[] = [];
    let receiptsToBackup: FirebaseReceipt[] = [];
    const BATCH_SIZE = 10;
    
    try {
      switch (deleteMode) {
        case 'single':
          if (receiptToDelete) {
            receiptIdsToDelete = [receiptToDelete];
            receiptsToBackup = receipts.filter(r => r.id === receiptToDelete);
            
            setPendingDeletions(prev => new Set(prev).add(receiptToDelete));
            setShowDeleteConfirm(false);
            
            // ✅ Optimistic cache update - remove from cache immediately
            console.log('🗑️ [DELETE] Optimistically removing receipt:', receiptToDelete);
            queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
              if (!oldData) return oldData;
              return oldData.filter(r => r.id !== receiptToDelete);
            });
            
            await ReceiptFirebaseService.deleteReceipt(receiptToDelete);
          }
          break;
        case 'multiple':
          receiptIdsToDelete = Array.from(selectedReceipts);
          receiptsToBackup = receipts.filter(r => selectedReceipts.has(r.id));
          
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });
          
          setShowDeleteConfirm(false);
          
          // ✅ Optimistic cache update - remove multiple from cache immediately
          console.log(`🗑️ [DELETE] Optimistically removing ${receiptIdsToDelete.length} receipts`);
          queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
            if (!oldData) return oldData;
            return oldData.filter(r => !receiptIdsToDelete.includes(r.id));
          });
          
          for (let i = 0; i < receiptIdsToDelete.length; i += BATCH_SIZE) {
            const batch = receiptIdsToDelete.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          }
          
          setSelectedReceipts(new Set());
          setIsSelectionMode(false);
          break;
        case 'all':
          receiptIdsToDelete = filteredAndSortedReceipts.map(r => r.id);
          receiptsToBackup = [...filteredAndSortedReceipts];
          
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });
          
          setShowDeleteConfirm(false);
          
          // ✅ Optimistic cache update - remove all filtered from cache immediately
          console.log(`🗑️ [DELETE] Optimistically removing ${receiptIdsToDelete.length} receipts (all filtered)`);
          queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
            if (!oldData) return oldData;
            return oldData.filter(r => !receiptIdsToDelete.includes(r.id));
          });
          
          for (let i = 0; i < receiptIdsToDelete.length; i += BATCH_SIZE) {
            const batch = receiptIdsToDelete.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          }
          break;
      }
    } catch (error) {
      console.error('Error deleting receipts:', error);
      
      setPendingDeletions(prev => {
        const newSet = new Set(prev);
        receiptIdsToDelete.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      Alert.alert('Error', 'Failed to delete receipt(s). Please try again.');
    } finally {
      setTimeout(() => {
        setPendingDeletions(prev => {
          const newSet = new Set(prev);
          receiptIdsToDelete.forEach(id => newSet.delete(id));
          return newSet;
        });
      }, 500);
      
      setIsDeleting(false);
      setReceiptToDelete(null);
    }
  };

  const toggleReceiptSelection = useCallback((receiptId: string) => {
    setSelectedReceipts(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(receiptId)) {
        newSelected.delete(receiptId);
      } else {
        newSelected.add(receiptId);
      }
      return newSelected;
    });
  }, []);

  const selectAllReceipts = useCallback(() => {
    const allIds = filteredAndSortedReceipts.map(r => r.id);
    setSelectedReceipts(new Set(allIds));
  }, [filteredAndSortedReceipts]);

  const clearSelection = useCallback(() => {
    setSelectedReceipts(new Set());
    setIsSelectionMode(false);
  }, []);

  const handleSavePDF = React.useCallback(async (receipt: FirebaseReceipt) => {
    try {
      await PDFService.generateAndSaveReceiptPDF(receipt);
      await handleReceiptStatusUpdate(receipt.id, 'exported');
    } catch (error) {
      console.error('Error in handleSavePDF:', error);
    }
  }, [handleReceiptStatusUpdate]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: FirebaseReceipt) => item.id, []);

  // Memoized render function
  const renderReceiptItem = useCallback(({ item }: { item: FirebaseReceipt }) => {
    const isSelected = selectedReceipts.has(item.id);
    const isPendingDeletion = pendingDeletions.has(item.id);
    
    const customerKey = item.customerName || 'Walk-in Customer';
    const customerTotalBalance = customerBalances.get(customerKey);
    
    return (
      <ReceiptItem
        item={item}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        isPendingDeletion={isPendingDeletion}
        formatReceiptDate={formatReceiptDate}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        customerTotalBalance={customerTotalBalance}
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
        onPayClick={(receipt) => {
          setReceiptForPayment(receipt);
          setShowPaymentModal(true);
        }}
      />
    );
  }, [
    selectedReceipts,
    isSelectionMode,
    pendingDeletions,
    customerBalances,
    formatReceiptDate,
    getStatusColor,
    getStatusIcon,
    toggleReceiptSelection,
    handleDeleteSingle,
    handleSavePDF,
  ]);

  if (loading) {
    return <LoadingState message="Loading receipts..." />;
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
          isDeleting={isDeleting}
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
          <>
            <FlashList
              data={paginatedReceipts}
              renderItem={renderReceiptItem}
              keyExtractor={keyExtractor}
              estimatedItemSize={180}
              contentContainerStyle={[
                styles.listContent,
                isSelectionMode && selectedReceipts.size > 0 && { paddingBottom: 120 }
              ]}
              showsVerticalScrollIndicator={false}
              extraData={{ isSelectionMode, selectedReceipts, pendingDeletions }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#3b82f6']}
                  tintColor="#3b82f6"
                  progressViewOffset={-40}
                />
              }
              // ⚡ OPTIMIZED for smooth scrolling with pagination
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={3}
              initialNumToRender={10}
              updateCellsBatchingPeriod={50}
              getItemType={() => 'receipt'}
            />
            
            {/* ⚡ PAGINATION - Shows 10 items per page */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredAndSortedReceipts.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
            />
          </>
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
        
        <RecordPaymentModal
          visible={showPaymentModal}
          receipt={receiptForPayment}
          onClose={() => {
            setShowPaymentModal(false);
            setReceiptForPayment(null);
          }}
          onPaymentRecorded={(transaction) => {
            Alert.alert(
              'Payment Recorded',
              `Payment of ${formatCurrency(transaction.amount)} recorded successfully!`,
              [{ text: 'OK' }]
            );
          }}
        />
        
        <FloatingActionBar
          visible={isSelectionMode && selectedReceipts.size > 0}
          selectedCount={selectedReceipts.size}
          onDelete={handleDeleteMultiple}
          onSelectAll={selectAllReceipts}
          onDeselectAll={clearSelection}
          isDeleting={isDeleting}
        />
      </SafeAreaView>
    </View>
  );
};

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 12,
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
