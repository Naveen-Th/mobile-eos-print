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
        return 'Delete Item';
      case 'multiple':
        return `Delete ${selectedCount} Items`;
      case 'all':
        return `Delete All ${totalCount} Items`;
      default:
        return 'Delete Item';
    }
  };

  const getMessage = () => {
    switch (deleteMode) {
      case 'single':
        return 'Are you sure you want to delete this item? This action cannot be undone.';
      case 'multiple':
        return `Are you sure you want to delete ${selectedCount} selected items? This action cannot be undone.`;
      case 'all':
        return `Are you sure you want to delete all ${totalCount} items? This action cannot be undone.`;
      default:
        return 'Are you sure you want to delete this item?';
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
                This will permanently delete all items and their stock data
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButton: {
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  confirmButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
    marginLeft: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default DeleteConfirmationModal;
