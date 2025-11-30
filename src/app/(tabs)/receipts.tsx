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
import { useProgressiveReceipts } from '../../hooks/useProgressiveReceipts';
import { useQueryClient } from '@tanstack/react-query';
import { usePendingUpdates } from '../../store/syncStore';
import PDFService from '../../services/printing/PDFService';
import BalanceTrackingService from '../../services/business/BalanceTrackingService';
import ThermalPrinterService from '../../services/printing/ThermalPrinterService';

// Import components
import ReceiptDetailModal from '../../components/Receipts/ReceiptDetailModal';
import DeleteConfirmationModal from '../../components/Receipts/DeleteConfirmationModal';
import ReceiptItem from '../../components/Receipts/ReceiptItemOptimized'; // Using optimized version
import ReceiptsHeader from '../../components/Receipts/ReceiptsHeader';
import EmptyState from '../../components/Receipts/EmptyState';
import LoadingState from '../../components/Receipts/LoadingState';
import ErrorState from '../../components/Receipts/ErrorState';
import RecordPaymentModal from '../../components/RecordPaymentModalWithCascade';
import FloatingActionBar from '../../components/Receipts/FloatingActionBar';
import LoadMoreButton from '../../components/Receipts/LoadMoreButton';
import SectionHeader from '../../components/Receipts/SectionHeader';
import { useDebounce } from '../../hooks/useDebounce';
import { useCustomerBalances, useReceiptsWithBalance } from '../../hooks/useCustomerBalances';
import { groupReceiptsIntoSections, getSectionSummary, filterSections, ReceiptSection } from '../../utils/receiptSections';
import { performanceTime, performanceTimeEnd } from '../../utils/performanceTiming';

const ReceiptsScreen: React.FC = () => {
  const queryClient = useQueryClient();

  // Progressive receipts hook - loads 50 initially, allows loading more
  const {
    receipts = [],
    isLoading: loading,
    error,
    isLoadingMore,
    hasMore,
    loadMore,
    loadAll,
    reset,
    stats
  } = useProgressiveReceipts();

  // Removed debug logs for performance

  // Zustand state for pending updates
  const pendingUpdates = usePendingUpdates();

  // Local UI state
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FirebaseReceipt | null>(null);

  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce search for performance
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'total' | 'unpaid'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Delete functionality states
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Removed debug logs for performance
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'multiple' | 'all'>('single');
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());
  const [pendingStatusUpdates, setPendingStatusUpdates] = useState<Set<string>>(new Set());

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [receiptForPayment, setReceiptForPayment] = useState<FirebaseReceipt | null>(null);

  // Section collapse/expand state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Toggle section collapsed state
  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  }, []);

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

      // Status updated
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
      // ✅ OPTIMIZED: Real-time listener already has latest data!
      // Reset to initial 50 receipts on pull-to-refresh
      reset();

      // Just wait a moment to show user something happened
      await new Promise(resolve => setTimeout(resolve, 300));

      if (__DEV__) {
        console.log('✅ Refresh complete - reset to recent 50 receipts');
      }
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
  }, [reset]);

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
      // If it's a Firestore Timestamp-like object with seconds and nanoseconds
      else if (typeof date === 'object' && date !== null && 'seconds' in date && 'nanoseconds' in date) {
        dateObj = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
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

  // ✅ OPTIMIZED: Calculate customer balances with O(n) hook
  const customerBalances = useCustomerBalances(receipts);

  // ✅ OPTIMIZED: Calculate receipts with balance (only when needed for display)
  const receiptsWithDynamicBalance = useReceiptsWithBalance(receipts);

  // ✅ Sort receipts based on sortBy and sortOrder
  const sortedReceipts = useMemo(() => {
    if (!receiptsWithDynamicBalance || receiptsWithDynamicBalance.length === 0) {
      return receiptsWithDynamicBalance;
    }

    const sorted = [...receiptsWithDynamicBalance].sort((a, b) => {
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

        case 'unpaid':
          // Sort by unpaid amount (total - amountPaid)
          const unpaidA = (a.total || 0) - (a.amountPaid || 0);
          const unpaidB = (b.total || 0) - (b.amountPaid || 0);
          comparison = unpaidA - unpaidB;
          break;

        default:
          comparison = 0;
      }

      // Apply sort order (asc or desc)
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [receiptsWithDynamicBalance, sortBy, sortOrder]);

  // ✅ OPTIMIZED: Split grouping and filtering into separate memos
  // Group receipts into sections (only when receipts change)
  const allReceiptSections = useMemo(() => {
    performanceTime('⚡ Group Sections');
    const sections = groupReceiptsIntoSections(sortedReceipts);
    performanceTimeEnd('⚡ Group Sections');
    return sections;
  }, [sortedReceipts]);

  // Filter sections (cheap operation, can run on search/filter changes)
  const receiptSections = useMemo(() => {
    performanceTime('⚡ Filter Sections');
    const filtered = filterSections(allReceiptSections, debouncedSearchQuery, statusFilter);
    performanceTimeEnd('⚡ Filter Sections');
    return filtered;
  }, [allReceiptSections, debouncedSearchQuery, statusFilter]);

  // Flatten sections into list items (receipts only, no section headers for single section)
  const flattenedData = useMemo(() => {
    // Since we now have a single "Recent Receipts" section, just return the receipts directly
    if (receiptSections.length === 0) return [];
    return receiptSections[0].data; // Get receipts from the single section
  }, [receiptSections]);

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
    const BATCH_SIZE = 10; // Process 10 at a time to avoid overwhelming Firestore

    try {
      switch (deleteMode) {
        case 'single':
          if (receiptToDelete) {
            receiptIdsToDelete = [receiptToDelete];
            receiptsToBackup = receipts.filter(r => r.id === receiptToDelete);

            // Mark as pending immediately for instant UI feedback
            setPendingDeletions(prev => new Set(prev).add(receiptToDelete));

            // Close modal immediately for better UX
            setShowDeleteConfirm(false);

            // ✅ Optimistic cache update - remove from cache immediately
            console.log('🗑️ [DELETE] Optimistically removing receipt:', receiptToDelete);
            queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
              if (!oldData) return oldData;
              const filtered = oldData.filter(r => r.id !== receiptToDelete);
              console.log(`  🗑️ Filtered cache: ${oldData.length} -> ${filtered.length}`);
              return filtered;
            });

            // Also trigger a refetch to ensure UI updates
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['firebase', 'collections', 'receipts'] });
              reset(); // Reset progressive receipts to clear local state
            }, 100);

            await ReceiptFirebaseService.deleteReceipt(receiptToDelete);
          }
          break;
        case 'multiple':
          receiptIdsToDelete = Array.from(selectedReceipts);
          receiptsToBackup = receipts.filter(r => selectedReceipts.has(r.id));

          // Mark as pending immediately for instant UI feedback
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });

          // Close modal immediately for better UX
          setShowDeleteConfirm(false);

          // ✅ Optimistic cache update - remove multiple from cache immediately
          console.log(`🗑️ [DELETE] Optimistically removing ${receiptIdsToDelete.length} receipts`);
          queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
            if (!oldData) return oldData;
            const filtered = oldData.filter(r => !receiptIdsToDelete.includes(r.id));
            console.log(`  🗑️ Filtered cache: ${oldData.length} -> ${filtered.length}`);
            return filtered;
          });

          // Also trigger a refetch to ensure UI updates
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['firebase', 'collections', 'receipts'] });
            reset(); // Reset progressive receipts to clear local state
          }, 100);

          // Batch delete with optimized Promise.all
          for (let i = 0; i < receiptIdsToDelete.length; i += BATCH_SIZE) {
            const batch = receiptIdsToDelete.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          }

          setSelectedReceipts(new Set());
          setIsSelectionMode(false);
          break;
        case 'all':
          // Delete all receipts across all sections
          const allReceipts = receiptSections.flatMap(s => s.data);
          receiptIdsToDelete = allReceipts.map(r => r.id);
          receiptsToBackup = [...allReceipts];

          // Mark as pending immediately for instant UI feedback
          setPendingDeletions(prev => {
            const newSet = new Set(prev);
            receiptIdsToDelete.forEach(id => newSet.add(id));
            return newSet;
          });

          // Close modal immediately for better UX
          setShowDeleteConfirm(false);

          // ✅ Optimistic cache update - remove all from cache immediately
          console.log(`🗑️ [DELETE] Optimistically removing ${receiptIdsToDelete.length} receipts (all)`);
          queryClient.setQueryData<FirebaseReceipt[]>(['firebase', 'collections', 'receipts'], (oldData) => {
            if (!oldData) return oldData;
            const filtered = oldData.filter(r => !receiptIdsToDelete.includes(r.id));
            console.log(`  🗑️ Filtered cache: ${oldData.length} -> ${filtered.length}`);
            return filtered;
          });

          // Also trigger a refetch to ensure UI updates
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['firebase', 'collections', 'receipts'] });
            reset(); // Reset progressive receipts to clear local state
          }, 100);

          // Batch delete with optimized Promise.all
          for (let i = 0; i < receiptIdsToDelete.length; i += BATCH_SIZE) {
            const batch = receiptIdsToDelete.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(id => ReceiptFirebaseService.deleteReceipt(id)));
          }
          break;
      }

      // Success - real-time listener will sync with Firebase
      // Show subtle toast-like feedback instead of blocking alert
    } catch (error) {
      console.error('Error deleting receipts:', error);

      // Revert pending deletions on error
      setPendingDeletions(prev => {
        const newSet = new Set(prev);
        receiptIdsToDelete.forEach(id => newSet.delete(id));
        return newSet;
      });

      Alert.alert('Error', 'Failed to delete receipt(s). Please try again.');
    } finally {
      // Clear pending deletions after successful delete
      setTimeout(() => {
        setPendingDeletions(prev => {
          const newSet = new Set(prev);
          receiptIdsToDelete.forEach(id => newSet.delete(id));
          return newSet;
        });
      }, 500); // Small delay to ensure smooth animation

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
    const allReceipts = receiptSections.flatMap(s => s.data);
    const allIds = allReceipts.map(r => r.id);
    setSelectedReceipts(new Set(allIds));
  }, [receiptSections]);

  const clearSelection = useCallback(() => {
    setSelectedReceipts(new Set());
    setIsSelectionMode(false);
  }, []);

  // Handle PDF generation
  const handleSavePDF = React.useCallback(async (receipt: FirebaseReceipt) => {
    try {
      await PDFService.generateAndSaveReceiptPDF(receipt);

      // Update receipt status to exported
      await handleReceiptStatusUpdate(receipt.id, 'exported');
    } catch (error) {
      console.error('Error in handleSavePDF:', error);
      // Error handling is done in PDFService.generateAndSaveReceiptPDF
    }
  }, [handleReceiptStatusUpdate]);

  // Handle thermal print
  const handleThermalPrint = React.useCallback(async (receipt: FirebaseReceipt) => {
    try {
      // Update receipt status to printed
      await handleReceiptStatusUpdate(receipt.id, 'printed');
    } catch (error) {
      console.error('Error updating receipt status after print:', error);
      // Don't throw - print already succeeded
    }
  }, [handleReceiptStatusUpdate]);

  // Note: Optimistic updates are handled by the real-time sync system

  // Memoized key extractor
  const keyExtractor = useCallback((item: FirebaseReceipt) => item.id, []);

  // ✅ OPTIMIZED: Memoized render function with minimal dependencies
  const renderListItem = useCallback(({ item }: { item: FirebaseReceipt }) => {
    const receipt = item;
    const isSelected = selectedReceipts.has(receipt.id);
    const isPendingDeletion = pendingDeletions.has(receipt.id);

    // Get customer's total balance (pre-computed)
    const customerKey = receipt.customerName || 'Walk-in Customer';
    const customerTotalBalance = customerBalances.get(customerKey);

    return (
      <ReceiptItem
        item={receipt}
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
            setSelectedReceipts(new Set([receipt.id]));
          }
        }}
        onPress={() => {
          if (isSelectionMode && !isPendingDeletion) {
            toggleReceiptSelection(receipt.id);
          }
        }}
        onToggleSelection={toggleReceiptSelection}
        onViewReceipt={setSelectedReceipt}
        onDeleteReceipt={handleDeleteSingle}
        onSavePDF={handleSavePDF}
        onPrintReceipt={handleThermalPrint}
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
    handleThermalPrint,
    setSelectedReceipt,
    setReceiptForPayment,
    setShowPaymentModal,
  ]);

  // Infinite scroll handler
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, loadMore]);

  // Footer component for loading indicator
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={styles.footerText}>Loading more receipts...</Text>
      </View>
    );
  }, [isLoadingMore]);

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
          filteredCount={receiptSections.reduce((sum, s) => sum + s.data.length, 0)}
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
          onSortByChange={(sortBy) => setSortBy(sortBy as 'date' | 'customer' | 'total' | 'unpaid')}
          onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        />

        {flattenedData.length === 0 ? (
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
          <View style={styles.contentWrapper}>
            <FlashList
              data={flattenedData}
              renderItem={renderListItem}
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
              // ⚡ Infinite Scroll
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              // ⚡ ULTRA-OPTIMIZED: Performance settings for smooth 60fps scrolling
              removeClippedSubviews={true}
              drawDistance={500}
              maxToRenderPerBatch={10}
              windowSize={7}
              initialNumToRender={15}
              updateCellsBatchingPeriod={30}
            >
            </FlashList>
          </View>
        )}
        
        <DeleteConfirmationModal
        visible={showDeleteConfirm}
        deleteMode={deleteMode}
        selectedCount={selectedReceipts.size}
        totalCount={receiptSections.reduce((sum, s) => sum + s.data.length, 0)}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        />

        {
  selectedReceipt && (
    <ReceiptDetailModal
      receipt={selectedReceipt}
      onClose={() => setSelectedReceipt(null)}
    />
  )
}

{/* Payment Modal */ }
<RecordPaymentModal
  visible={showPaymentModal}
  receipt={receiptForPayment}
  onClose={() => {
    setShowPaymentModal(false);
    setReceiptForPayment(null);
  }}
  onPaymentRecorded={(transaction) => {
    // Real-time listener will automatically update the receipt
    Alert.alert(
      'Payment Recorded',
      `Payment of ${formatCurrency(transaction.amount)} recorded successfully!`,
      [{ text: 'OK' }]
    );
  }}
/>

{/* Floating Action Bar for Batch Delete */ }
<FloatingActionBar
  visible={isSelectionMode && selectedReceipts.size > 0}
  selectedCount={selectedReceipts.size}
  onDelete={handleDeleteMultiple}
  onSelectAll={selectAllReceipts}
  onDeselectAll={clearSelection}
  isDeleting={isDeleting}
/>
      </SafeAreaView >
    </View >
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
  contentWrapper: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 12,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  bottomControls: {
    backgroundColor: '#f8fafc',
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
});

export default ReceiptsScreen;
