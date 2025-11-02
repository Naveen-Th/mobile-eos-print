import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableReceiptItemProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onPay?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  isPaid?: boolean;
  showActions?: boolean;
}

const SwipeableReceiptItem: React.FC<SwipeableReceiptItemProps> = ({
  children,
  onDelete,
  onPay,
  onPrint,
  onShare,
  isPaid = false,
  showActions = false,
}) => {

  // For now, just render children without swipe gestures
  // Swipe gestures removed due to complexity - using action buttons in cards instead
  return <View>{children}</View>;
};

export default SwipeableReceiptItem;
