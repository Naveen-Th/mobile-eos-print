import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface FloatingActionBarProps {
  visible: boolean;
  selectedCount: number;
  onDelete: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isDeleting?: boolean;
}

const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  visible,
  selectedCount,
  onDelete,
  onSelectAll,
  onDeselectAll,
  isDeleting = false,
}) => {
  const slideAnim = React.useRef(new Animated.Value(100)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [visible]);

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDelete();
  };

  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectAll();
  };

  const handleDeselectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDeselectAll();
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        }
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Glass morphism effect */}
      <View style={styles.glassContainer}>
        {/* Left Section - Selection Info */}
        <View style={styles.leftSection}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedCount}</Text>
          </View>
          <Text style={styles.selectedText}>
            {selectedCount === 1 ? 'item' : 'items'} selected
          </Text>
        </View>

        {/* Right Section - Actions */}
        <View style={styles.rightSection}>
          {/* Select/Deselect All Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={selectedCount > 0 ? handleDeselectAll : handleSelectAll}
          >
            <Ionicons 
              name={selectedCount > 0 ? "close-circle" : "checkmark-circle"} 
              size={22} 
              color={selectedCount > 0 ? "#ef4444" : "#3b82f6"} 
            />
            <Text style={[styles.actionText, { color: selectedCount > 0 ? "#ef4444" : "#3b82f6" }]}>
              {selectedCount > 0 ? 'Clear' : 'All'}
            </Text>
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity 
            style={[
              styles.deleteButton,
              selectedCount === 0 && styles.deleteButtonDisabled
            ]}
            onPress={handleDelete}
            disabled={selectedCount === 0 || isDeleting}
          >
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    zIndex: 1000,
  },
  glassContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  deleteButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default FloatingActionBar;

