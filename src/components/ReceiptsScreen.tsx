import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { FirebaseReceipt } from '../services/ReceiptFirebaseService';
import { useReceipts } from '../hooks/useSyncManager';
import { formatCurrency, formatReceiptDate } from '../utils';
import RecordPaymentModal from './RecordPaymentModal';

interface ReceiptsScreenProps {
  // Add any props if needed
}

interface ReceiptDetailModalProps {
  receipt: FirebaseReceipt;
  onClose: () => void;
  onPayClick?: (receipt: FirebaseReceipt) => void;
}

const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({ receipt, onClose, onPayClick }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'printed':
        return 'bg-green-100 text-green-800';
      case 'exported':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Decide how to interpret saved item prices (unit price vs line total)
  const sumPriceTimesQty = receipt.items.reduce((s, it: any) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const sumPriceOnly = receipt.items.reduce((s, it: any) => s + (Number(it.price) || 0), 0);
  const preferLineTotals = Math.abs(sumPriceTimesQty - (receipt.subtotal || 0)) > Math.abs(sumPriceOnly - (receipt.subtotal || 0));

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const unitPrice = preferLineTotals && qty > 0 ? price / qty : price;
    const lineTotal = preferLineTotals ? price : price * qty;

    return (
      <div className="flex flex-row justify-between items-center py-4 px-6 border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <div className="flex-1 mr-6">
          <p className="text-base font-semibold text-gray-900 mb-1">{item.name}</p>
          <p className="text-sm text-gray-500">{qty} × {formatCurrency(unitPrice)}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-gray-900">
            {formatCurrency(lineTotal)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95%] overflow-hidden">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex flex-row items-start justify-between">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-2">Receipt Details</h2>
              <p className="text-blue-100 text-lg font-medium mb-3">#{receipt.receiptNumber}</p>
              <div className="flex items-center">
                <div className={`px-4 py-2 rounded-full ${getStatusStyle(receipt.status)}`}>
                  <span className="text-sm font-bold uppercase tracking-wide">
                    {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors ml-6"
            >
              <span className="text-white text-2xl">×</span>
            </button>
          </div>
        </div>

        {/* Enhanced Content */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(95vh - 120px)' }}>
          <div className="p-8">
            {/* Receipt Information Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Receipt Info Card */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  📋 Receipt Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Number:</span>
                    <span className="text-sm font-bold text-gray-900 font-mono bg-white px-2 py-1 rounded">{receipt.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Date:</span>
                    <span className="text-sm text-gray-900">{formatReceiptDate(receipt.date.toDate())}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Customer:</span>
                    <span className="text-sm text-gray-900 font-medium">{receipt.customerName || 'Walk-in Customer'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Method:</span>
                    <span className="text-sm text-gray-900">{receipt.printMethod === 'pdf' ? '📄 PDF Export' : '🖨️ Thermal Print'}</span>
                  </div>
                </div>
              </div>

              {/* Company Info Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">🏢 Company Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Name:</span>
                    <span className="text-sm font-bold text-gray-900">{receipt.companyName}</span>
                  </div>
                  {receipt.companyAddress && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600 mr-4">Address:</span>
                      <span className="text-sm text-gray-900 text-right flex-1">{receipt.companyAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">🛒 Items ({receipt.items.length})</h3>
                <div className="bg-blue-100 px-4 py-2 rounded-full">
                  <span className="text-blue-800 text-sm font-bold">
                    {receipt.items.reduce((sum, item) => sum + item.quantity, 0)} total qty
                  </span>
                </div>
              </div>
              
              <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {/* Items Header */}
                <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Item Details</span>
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Amount</span>
                  </div>
                </div>
                
                {/* Items List */}
                <div>
                  {receipt.items.map((item, index) => renderItem({ item, index }))}
                </div>
              </div>
            </div>

            {/* Enhanced Totals Section */}
            <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 rounded-2xl p-8 mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">💰 Payment Summary</h3>
              <div className="space-y-5">
                <div className="flex justify-between items-center py-3 border-b border-green-200">
                  <span className="text-lg font-medium text-gray-600">Subtotal:</span>
                  <span className="text-xl font-semibold text-gray-900">{formatCurrency(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-green-200">
                  <span className="text-lg font-medium text-gray-600">Tax:</span>
                  <span className="text-xl font-semibold text-gray-900">{formatCurrency(receipt.tax)}</span>
                </div>
                <div className="flex justify-between items-center py-5 bg-white/70 rounded-xl px-6 mt-6">
                  <span className="text-3xl font-bold text-gray-900">TOTAL:</span>
                  <span className="text-4xl font-black text-green-700">{formatCurrency(receipt.total)}</span>
                </div>
                
                {/* Balance Information */}
                {(receipt.oldBalance !== undefined || receipt.newBalance !== undefined || receipt.isPaid !== undefined) && (
                  <div className="mt-6 pt-6 border-t-2 border-green-200">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 text-center">📊 Balance Details</h4>
                    <div className="space-y-3">
                      {receipt.oldBalance !== undefined && receipt.oldBalance !== 0 && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-base font-medium text-gray-600">Old Balance:</span>
                          <span className="text-lg font-semibold text-gray-900">{formatCurrency(receipt.oldBalance)}</span>
                        </div>
                      )}
                      
                      {receipt.isPaid !== undefined && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-base font-medium text-gray-600">Payment Status:</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            receipt.isPaid 
                              ? 'bg-green-200 text-green-800' 
                              : 'bg-red-200 text-red-800'
                          }`}>
                            {receipt.isPaid ? '✓ PAID' : '✗ UNPAID'}
                          </span>
                        </div>
                      )}
                      
                      {receipt.amountPaid !== undefined && receipt.amountPaid > 0 && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-base font-medium text-gray-600">Amount Paid:</span>
                          <span className="text-lg font-semibold text-green-700">{formatCurrency(receipt.amountPaid)}</span>
                        </div>
                      )}
                      
                      {receipt.newBalance !== undefined && (
                        <div className="flex justify-between items-center py-3 bg-white/90 rounded-lg px-4 mt-3">
                          <span className="text-lg font-bold text-gray-900">New Balance:</span>
                          <span className={`text-2xl font-black ${
                            receipt.newBalance > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(receipt.newBalance)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Message */}
            {receipt.footerMessage && (
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 mb-8">
                <p className="text-center font-medium text-gray-700 text-lg leading-relaxed">
                  💬 {receipt.footerMessage}
                </p>
              </div>
            )}

            {/* Receipt Metadata */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Receipt Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receipt.createdAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Created:</span>
                    <span className="text-sm text-gray-900">
                      {receipt.createdAt.toDate ? formatReceiptDate(receipt.createdAt.toDate()) : 'N/A'}
                    </span>
                  </div>
                )}
                {receipt.printedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Printed:</span>
                    <span className="text-sm text-gray-900">
                      {receipt.printedAt.toDate ? formatReceiptDate(receipt.printedAt.toDate()) : 'N/A'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Receipt ID:</span>
                  <span className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded">{receipt.id}</span>
                </div>
                {receipt.pdfPath && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">PDF Path:</span>
                    <span className="text-sm text-gray-900 truncate ml-2">{receipt.pdfPath}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-8 py-6">
          <div className="flex gap-4">
            {/* Show Pay button if receipt has pending balance */}
            {receipt.newBalance !== undefined && receipt.newBalance > 0 && onPayClick && (
              <button
                onClick={() => {
                  onPayClick(receipt);
                  onClose();
                }}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
              >
                💰 Record Payment ({formatCurrency(receipt.newBalance)} pending)
              </button>
            )}
            
            <button
              onClick={onClose}
              className={`${receipt.newBalance > 0 ? 'flex-1' : 'w-full'} bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg`}
            >
              ✓ Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReceiptsScreen: React.FC<ReceiptsScreenProps> = () => {
  // Use sync manager hooks for receipts
  const {
    data: receiptsData = [],
    isLoading: loading,
    error,
    refetch
  } = useReceipts();
  
  // Sort receipts by creation date (newest first)
  const receipts = receiptsData.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || a.date.toDate();
    const dateB = b.createdAt?.toDate?.() || b.date.toDate();
    return dateB.getTime() - dateA.getTime();
  });
  
  // Local UI state
  const [selectedReceipt, setSelectedReceipt] = useState<FirebaseReceipt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'printed' | 'exported'>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [receiptForPayment, setReceiptForPayment] = useState<FirebaseReceipt | null>(null);

  const loadReceipts = async () => {
    try {
      setRefreshing(true);
      await refetch();
      console.log('Receipts refreshed successfully');
    } catch (err) {
      console.error('Error refreshing receipts:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredReceipts = receipts.filter(receipt => {
    // Status filter
    if (statusFilter !== 'all' && receipt.status !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        receipt.receiptNumber.toLowerCase().includes(query) ||
        receipt.companyName.toLowerCase().includes(query) ||
        (receipt.customerName && receipt.customerName.toLowerCase().includes(query)) ||
        receipt.items.some(item => item.name.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'printed':
        return 'bg-green-100 text-green-800';
      case 'exported':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReceiptStats = () => {
    const totalReceipts = receipts.length;
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
    const printedCount = receipts.filter(r => r.status === 'printed').length;
    const exportedCount = receipts.filter(r => r.status === 'exported').length;
    
    return { totalReceipts, totalAmount, printedCount, exportedCount };
  };

  const stats = getReceiptStats();

  if (loading) {
    return (
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-900/5 border border-gray-200/60 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">Loading receipts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Receipts</h3>
          <p className="text-gray-500 mb-4">{error?.message || 'An error occurred'}</p>
          <button 
            onClick={loadReceipts}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-sm shadow-gray-900/5 border border-gray-200/60 p-7">
          <div className="flex items-center">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-semibold text-gray-600 tracking-wide">Total Receipts</p>
              <p className="text-3xl font-bold text-gray-900 tracking-tight">{stats.totalReceipts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-sm shadow-gray-900/5 border border-gray-200/60 p-7">
          <div className="flex items-center">
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-semibold text-gray-600 tracking-wide">Printed</p>
              <p className="text-3xl font-bold text-gray-900 tracking-tight">{stats.printedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-sm shadow-gray-900/5 border border-gray-200/60 p-7">
          <div className="flex items-center">
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-semibold text-gray-600 tracking-wide">Exported</p>
              <p className="text-3xl font-bold text-gray-900 tracking-tight">{stats.exportedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-900/5 border border-gray-200/60 overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Receipt History</h2>
              <p className="text-sm text-gray-600 font-medium">{filteredReceipts.length} of {receipts.length} receipts</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search receipts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 pr-4 py-2.5 w-full sm:w-72 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <svg className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="all">All Status</option>
                <option value="printed">Printed</option>
                <option value="exported">Exported</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={loadReceipts}
                disabled={refreshing}
                className={`px-5 py-2.5 text-white rounded-xl transition-colors text-sm flex items-center space-x-2.5 font-medium ${
                  refreshing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Receipts List */}
        <div className="overflow-x-auto">
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Receipts Found</h3>
              <p className="text-gray-500">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'No receipts have been created yet.'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{receipt.receiptNumber}</div>
                      <div className="text-sm text-gray-500">{receipt.companyName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{receipt.customerName || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{receipt.items.length} items</div>
                      <div className="text-sm text-gray-500">
                        {receipt.items.reduce((sum, item) => sum + item.quantity, 0)} total qty
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(receipt.total)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {receipt.newBalance !== undefined ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(receipt.newBalance)}</div>
                          {receipt.newBalance > 0 ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Paid
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">
                        {receipt.printMethod === 'pdf' ? 'PDF Export' : 'Thermal Print'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(receipt.status)}`}>
                        {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatReceiptDate(receipt.date.toDate())}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Pay Button - show if receipt has pending balance */}
                        {receipt.newBalance !== undefined && receipt.newBalance > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReceiptForPayment(receipt);
                              setShowPaymentModal(true);
                            }}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-semibold"
                          >
                            💰 Pay
                          </button>
                        )}
                        
                        <button
                          onClick={() => setSelectedReceipt(receipt)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <ReceiptDetailModal 
          receipt={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)}
          onPayClick={(receipt) => {
            setReceiptForPayment(receipt);
            setShowPaymentModal(true);
          }}
        />
      )}
      
      {/* Payment Modal */}
      {showPaymentModal && receiptForPayment && (
        <RecordPaymentModal
          visible={showPaymentModal}
          receipt={receiptForPayment}
          onClose={() => {
            setShowPaymentModal(false);
            setReceiptForPayment(null);
          }}
          onPaymentRecorded={(transaction) => {
            console.log('Payment recorded:', transaction);
            // Refresh receipts to show updated balance
            loadReceipts();
          }}
        />
      )}
    </div>
  );
};
