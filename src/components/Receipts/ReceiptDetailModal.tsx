import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseReceipt } from '../../services/ReceiptFirebaseService';
import { formatCurrency, formatReceiptDate } from '../../utils';
import ReceiptDeliveryModal from '../ReceiptDeliveryModal';
import { Receipt } from '../../types';
import ThermalPrinterService from '../../services/ThermalPrinterService';

interface ReceiptDetailModalProps {
  receipt: FirebaseReceipt;
  onClose: () => void;
}

const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({ receipt, onClose }) => {
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const printerService = ThermalPrinterService.getInstance();

  // Add debug logging
  console.log('Receipt Modal Data:', {
    status: receipt.status,
    receiptNumber: receipt.receiptNumber,
    items: receipt.items?.length || 0,
    date: receipt.date,
    customerName: receipt.customerName
  });

  // Safely convert date to Date object
  const convertDate = (date: any): Date => {
    try {
      if (date && typeof date.toDate === 'function') {
        return date.toDate();
      } else if (date instanceof Date) {
        return date;
      } else if (typeof date === 'string' || typeof date === 'number') {
        return new Date(date);
      }
      console.warn('Invalid date format in receipt:', date);
      return new Date();
    } catch (error) {
      console.error('Error converting receipt date:', error);
      return new Date();
    }
  };

  // Convert FirebaseReceipt to Receipt type for delivery modal
  const receiptForDelivery: Receipt = {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    items: receipt.items.map(item => ({
      id: item.id || '',
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    total: receipt.total,
    date: convertDate(receipt.date),
    companyName: receipt.companyName,
    companyAddress: receipt.companyAddress,
    customerName: receipt.customerName,
    footerMessage: receipt.footerMessage,
  };

  const getStatusStyle = (status: string | undefined) => {
    switch (status) {
      case 'printed':
        return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'exported':
        return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
      case 'draft':
        return { backgroundColor: '#fef3c7', color: '#d97706' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const formatReceiptDateSafe = (date: any) => {
    try {
      if (!date) return 'No Date';
      
      if (date.toDate && typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString() + ' ' + date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      if (date instanceof Date) {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Date formatting error:', error, date);
      return 'Invalid Date';
    }
  };

  // Decide how to interpret saved item prices (unit price vs line total)
  const sumPriceTimesQty = (receipt.items || []).reduce((s, it: any) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const sumPriceOnly = (receipt.items || []).reduce((s, it: any) => s + (Number(it.price) || 0), 0);
  const preferLineTotals = Math.abs(sumPriceTimesQty - (receipt.subtotal || 0)) > Math.abs(sumPriceOnly - (receipt.subtotal || 0));

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const unitPrice = preferLineTotals && qty > 0 ? price / qty : price;
    const lineTotal = preferLineTotals ? price : price * qty;

    return (
      <View style={modalStyles.itemRow}>
        <View style={modalStyles.itemInfo}>
          <Text style={modalStyles.itemName}>{item.name || 'Unnamed Item'}</Text>
          <Text style={modalStyles.itemDetail}>{qty} × {formatCurrency(unitPrice)}</Text>
        </View>
        <View style={modalStyles.itemAmount}>
          <Text style={modalStyles.itemTotal}>
            {formatCurrency(lineTotal)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Enhanced Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerContent}>
              <Text style={modalStyles.headerTitle}>Receipt Details</Text>
              <Text style={modalStyles.headerSubtitle}>#{receipt.receiptNumber}</Text>
              <View style={[modalStyles.statusBadge, getStatusStyle(receipt.status)]}>
                <Text style={[modalStyles.statusText, { color: getStatusStyle(receipt.status).color }]}>
                  {receipt.status ? receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1) : 'Unknown'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Enhanced Content */}
          <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
            {/* Receipt Information Card */}
            <View style={modalStyles.infoCard}>
              <Text style={modalStyles.cardTitle}>📋 Receipt Information</Text>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Number:</Text>
                <Text style={modalStyles.infoValue}>{receipt.receiptNumber}</Text>
              </View>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Date:</Text>
                <Text style={modalStyles.infoValue}>{formatReceiptDate(receipt.date)}</Text>
              </View>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Customer:</Text>
                <Text style={modalStyles.infoValue}>{receipt.customerName || 'Walk-in Customer'}</Text>
              </View>
              {receipt.businessPhone && (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Phone:</Text>
                  <Text style={modalStyles.infoValue}>📞 {receipt.businessPhone}</Text>
                </View>
              )}
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Method:</Text>
                <Text style={modalStyles.infoValue}>{receipt.printMethod === 'pdf' ? '📄 PDF Export' : '🖨️ Thermal Print'}</Text>
              </View>
            </View>

            {/* Company Information Card */}
            <View style={modalStyles.infoCard}>
              <Text style={modalStyles.cardTitle}>🏢 Company Information</Text>
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Name:</Text>
                <Text style={modalStyles.infoValue}>{receipt.companyName}</Text>
              </View>
              {receipt.companyAddress && (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Address:</Text>
                  <Text style={modalStyles.infoValue}>{receipt.companyAddress}</Text>
                </View>
              )}
            </View>

            {/* Items Section */}
            <View style={modalStyles.itemsContainer}>
              <View style={modalStyles.itemsHeader}>
                <Text style={modalStyles.itemsHeaderText}>🛒 Items ({receipt.items.length})</Text>
                <Text style={modalStyles.itemsHeaderText}>{receipt.items.reduce((sum, item) => sum + item.quantity, 0)} total qty</Text>
              </View>
              
              <FlatList
                data={receipt.items}
                renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                scrollEnabled={false}
              />
            </View>

            {/* Payment Summary */}
            <View style={modalStyles.totalsContainer}>
              <Text style={modalStyles.totalsTitle}>💰 Payment Summary</Text>
              
              <View style={modalStyles.totalRow}>
                <Text style={modalStyles.totalLabel}>Subtotal:</Text>
                <Text style={modalStyles.totalValue}>{formatCurrency(receipt.subtotal)}</Text>
              </View>
              
              <View style={modalStyles.totalRow}>
                <Text style={modalStyles.totalLabel}>Tax:</Text>
                <Text style={modalStyles.totalValue}>{formatCurrency(receipt.tax)}</Text>
              </View>
              
              <View style={modalStyles.finalTotalContainer}>
                <Text style={modalStyles.finalTotalLabel}>TOTAL:</Text>
                <Text style={modalStyles.finalTotalValue}>{formatCurrency(receipt.total)}</Text>
              </View>
            </View>

          {/* Footer Message */}
            {receipt.footerMessage && (
              <View style={modalStyles.infoCard}>
                <Text style={[modalStyles.cardTitle, { textAlign: 'center' }]}>💬 {receipt.footerMessage}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={modalStyles.actionButtonsContainer}>
              {/* Print Receipt Button */}
              <TouchableOpacity
                style={[modalStyles.actionButton, modalStyles.printButton]}
                onPress={async () => {
                  // Check if printer is connected
                  if (!printerService.isConnected()) {
                    Alert.alert(
                      'No Printer Connected',
                      'Please connect to a thermal printer first.\n\nGo to Settings → Printer Setup',
                      [
                        { text: 'OK', style: 'cancel' },
                      ]
                    );
                    return;
                  }

                  setIsPrinting(true);
                  try {
                    console.log('🖨️ [ReceiptDetailModal] Starting print process...');
                    console.log('🖨️ [ReceiptDetailModal] Receipt data:', {
                      id: receipt.id,
                      receiptNumber: receipt.receiptNumber,
                      companyName: receipt.companyName,
                      itemCount: receipt.items?.length,
                      total: receipt.total,
                    });
                    
                    // Convert receipt to printer format
                    const receiptData = {
                      storeInfo: {
                        name: receipt.companyName || 'Store',
                        address: receipt.companyAddress || '',
                        phone: receipt.businessPhone || '',
                      },
                      customerInfo: {
                        name: receipt.customerName || undefined,
                        phone: receipt.businessPhone || undefined,
                      },
                      items: receipt.items.map(item => ({
                        name: item.name || 'Item',
                        price: Number(item.price) || 0,
                        quantity: Number(item.quantity) || 0,
                        total: (Number(item.price) || 0) * (Number(item.quantity) || 0),
                      })),
                      subtotal: Number(receipt.subtotal) || 0,
                      tax: Number(receipt.tax) || 0,
                      total: Number(receipt.total) || 0,
                      paymentMethod: 'Cash', // Default
                      receiptNumber: receipt.receiptNumber || 'N/A',
                      timestamp: convertDate(receipt.date),
                      isPaid: receipt.isPaid !== undefined ? receipt.isPaid : true,
                    };

                    console.log('🖨️ [ReceiptDetailModal] Calling printReceipt...');
                    await printerService.printReceipt(receiptData);
                    console.log('🖨️ [ReceiptDetailModal] Print completed successfully');
                    Alert.alert('Success', 'Receipt printed successfully! ✓');
                  } catch (error: any) {
                    console.error('Print error:', error);
                    Alert.alert(
                      'Print Failed',
                      error.message || 'Failed to print receipt. Check printer connection.'
                    );
                  } finally {
                    setIsPrinting(false);
                  }
                }}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="print" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={modalStyles.actionButtonText}>Print Receipt</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Send Receipt Button */}
              <TouchableOpacity
                style={[modalStyles.actionButton, modalStyles.sendButton]}
                onPress={() => setShowDeliveryModal(true)}
              >
                <Ionicons name="mail-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={modalStyles.actionButtonText}>Send Receipt</Text>
              </TouchableOpacity>
            </View>

            {/* Receipt Metadata */}
            <View style={modalStyles.infoCard}>
              <Text style={modalStyles.cardTitle}>📊 Receipt Metadata</Text>
              {receipt.createdAt && (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Created:</Text>
                  <Text style={modalStyles.infoValue}>
                    {receipt.createdAt.toDate ? formatReceiptDate(receipt.createdAt.toDate()) : 'N/A'}
                  </Text>
                </View>
              )}
              {receipt.printedAt && (
                <View style={modalStyles.infoRow}>
                  <Text style={modalStyles.infoLabel}>Printed:</Text>
                  <Text style={modalStyles.infoValue}>
                    {receipt.printedAt.toDate ? formatReceiptDate(receipt.printedAt.toDate()) : 'N/A'}
                  </Text>
                </View>
              )}
              <View style={modalStyles.infoRow}>
                <Text style={modalStyles.infoLabel}>Receipt ID:</Text>
                <Text style={modalStyles.infoValue}>{receipt.id}</Text>
              </View>
            </View>
          </ScrollView>
          
          {/* Action Footer */}
          <View style={modalStyles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={modalStyles.closeButtonFinal}
            >
              <Text style={modalStyles.closeButtonText}>✓ Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Receipt Delivery Modal */}
      <ReceiptDeliveryModal
        visible={showDeliveryModal}
        receipt={receiptForDelivery}
        onClose={() => setShowDeliveryModal(false)}
      />
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    width: '100%',
    height: '90%',
    maxWidth: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    flexDirection: 'column',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#bfdbfe',
    fontWeight: '500',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  itemsContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 16,
  },
  itemsHeader: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemsHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 14,
    color: '#6b7280',
  },
  itemAmount: {
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalsContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  totalsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  finalTotalContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalTotalLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  finalTotalValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#059669',
  },
  footer: {
    padding: 24,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeButtonFinal: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  printButton: {
    backgroundColor: '#DC2626',
  },
  sendButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  // Deprecated - keeping for backward compatibility
  sendReceiptButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sendReceiptText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReceiptDetailModal;
