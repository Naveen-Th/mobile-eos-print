import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseReceipt } from '../../services/ReceiptFirebaseService';
import { formatCurrency } from '../../utils';

interface ReceiptItemProps {
  item: FirebaseReceipt;
  isSelected: boolean;
  isSelectionMode: boolean;
  isPendingDeletion?: boolean;
  formatReceiptDate: (date: any) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
  onLongPress: () => void;
  onPress: () => void;
  onToggleSelection: (receiptId: string) => void;
  onViewReceipt: (receipt: FirebaseReceipt) => void;
  onDeleteReceipt: (receiptId: string) => void;
}

const ReceiptItem: React.FC<ReceiptItemProps> = ({
  item,
  isSelected,
  isSelectionMode,
  isPendingDeletion = false,
  formatReceiptDate,
  getStatusColor,
  getStatusIcon,
  onLongPress,
  onPress,
  onToggleSelection,
  onViewReceipt,
  onDeleteReceipt,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isSelectionMode && styles.cardSelectionMode,
        isPendingDeletion && styles.cardPendingDeletion,
      ]}
      onPress={isPendingDeletion ? undefined : (isSelectionMode ? onPress : () => onViewReceipt(item))}
      onLongPress={isPendingDeletion ? undefined : onLongPress}
      activeOpacity={isPendingDeletion ? 1 : 0.7}
      disabled={isPendingDeletion}
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

      <View style={[styles.cardContent, { paddingLeft: isSelectionMode ? 44 : 16, opacity: isPendingDeletion ? 0.6 : 1 }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.receiptInfo}>
            <View style={styles.customerRow}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customerName || 'Walk-in Customer'}
              </Text>
            </View>
            <Text style={styles.receiptDate}>
              {formatReceiptDate(item.date)}
            </Text>
            <Text style={styles.receiptNumber}>
              #{item.receiptNumber}{isPendingDeletion ? ' (Deleting...)' : ''}
            </Text>
          </View>

          {/* Total Amount */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
          </View>
        </View>


        {/* Actions */}
        {!isSelectionMode && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.printButton]}
            >
              <Ionicons name="print-outline" size={16} color="#10b981" />
              <Text style={styles.printButtonText}>Print</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.pdfButton]}
            >
              <Ionicons name="document-outline" size={16} color="#3b82f6" />
              <Text style={styles.pdfButtonText}>Save PDF</Text>
            </TouchableOpacity>
          </View>
        )}
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
  cardPendingDeletion: {
    backgroundColor: '#fef3f2',
    borderColor: '#fecaca',
    borderWidth: 1,
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
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  receiptInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  receiptDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  receiptNumber: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  totalContainer: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  printButton: {
    backgroundColor: '#f0fdf4',
  },
  printButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10b981',
    marginLeft: 4,
  },
  pdfButton: {
    backgroundColor: '#eff6ff',
  },
  pdfButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3b82f6',
    marginLeft: 4,
  },
});

export default ReceiptItem;
