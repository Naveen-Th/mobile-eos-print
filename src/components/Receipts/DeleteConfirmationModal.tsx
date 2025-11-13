import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DeleteConfirmationModalProps {
  visible: boolean;
  deleteMode: 'single' | 'multiple' | 'all';
  selectedCount: number;
  totalCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  visible,
  deleteMode,
  selectedCount,
  totalCount,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  const getTitle = () => {
    switch (deleteMode) {
      case 'single':
        return 'Delete Receipt';
      case 'multiple':
        return `Delete ${selectedCount} Receipts`;
      case 'all':
        return `Delete All ${totalCount} Receipts`;
      default:
        return 'Delete Receipt';
    }
  };

  const getMessage = () => {
    switch (deleteMode) {
      case 'single':
        return 'Are you sure you want to delete this receipt? This action cannot be undone.';
      case 'multiple':
        return `Are you sure you want to delete ${selectedCount} selected receipts? This action cannot be undone.`;
      case 'all':
        return `Are you sure you want to delete all ${totalCount} receipts? This action cannot be undone.`;
      default:
        return 'Are you sure you want to delete this receipt?';
    }
  };

  const getIcon = () => {
    switch (deleteMode) {
      case 'single':
        return 'trash-outline';
      case 'multiple':
        return 'trash-outline';
      case 'all':
        return 'warning-outline';
      default:
        return 'trash-outline';
    }
  };

  const getIconColor = () => {
    return deleteMode === 'all' ? '#f59e0b' : '#ef4444';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: deleteMode === 'all' ? '#fef3c7' : '#fee2e2' }]}>
            <Ionicons 
              name={getIcon()} 
              size={32} 
              color={getIconColor()} 
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>{getTitle()}</Text>

          {/* Message */}
          <Text style={styles.message}>{getMessage()}</Text>

          {/* Warning for delete all */}
          {deleteMode === 'all' && (
            <View style={styles.warningContainer}>
              <Ionicons name="alert-circle" size={16} color="#f59e0b" />
              <Text style={styles.warningText}>
                This will permanently delete all receipts and their data
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                deleteMode === 'all' && styles.confirmButtonWarning,
                isDeleting && styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons 
                    name={getIcon()} 
                    size={16} 
                    color="white" 
                  />
                  <Text style={styles.confirmButtonText}>
                    {deleteMode === 'single' ? 'Delete' : `Delete ${deleteMode === 'all' ? 'All' : selectedCount}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 24,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 12,
    color: '#f59e0b',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
    marginLeft: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonWarning: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default DeleteConfirmationModal;
