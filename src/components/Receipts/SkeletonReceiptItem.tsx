import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * WhatsApp-style skeleton loader for receipts
 * Shows placeholder content while data is loading
 * Provides instant visual feedback
 */
export const SkeletonReceiptItem = React.memo(() => {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonContent}>
        {/* Header */}
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonBox, styles.skeletonAvatar]} />
          <View style={styles.skeletonInfo}>
            <View style={[styles.skeletonBox, styles.skeletonName]} />
            <View style={[styles.skeletonBox, styles.skeletonDate]} />
          </View>
          <View style={[styles.skeletonBox, styles.skeletonBadge]} />
        </View>
        
        {/* Payment Info */}
        <View style={styles.skeletonPayment}>
          <View style={[styles.skeletonBox, styles.skeletonRow]} />
          <View style={[styles.skeletonBox, styles.skeletonRow]} />
          <View style={[styles.skeletonBox, styles.skeletonProgress]} />
        </View>
        
        {/* Action Buttons */}
        <View style={styles.skeletonActions}>
          <View style={[styles.skeletonBox, styles.skeletonButton]} />
          <View style={[styles.skeletonBox, styles.skeletonSmallButton]} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    overflow: 'hidden',
  },
  skeletonContent: {
    padding: 16,
  },
  skeletonBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonInfo: {
    flex: 1,
    gap: 6,
  },
  skeletonName: {
    width: '60%',
    height: 16,
  },
  skeletonDate: {
    width: '80%',
    height: 12,
  },
  skeletonBadge: {
    width: 60,
    height: 24,
  },
  skeletonPayment: {
    gap: 8,
    marginBottom: 12,
  },
  skeletonRow: {
    width: '100%',
    height: 40,
  },
  skeletonProgress: {
    width: '100%',
    height: 4,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonButton: {
    flex: 1,
    height: 40,
  },
  skeletonSmallButton: {
    width: 100,
    height: 40,
  },
});

SkeletonReceiptItem.displayName = 'SkeletonReceiptItem';
