import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const ItemsLoadingSkeleton: React.FC = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      {/* Customer info skeleton */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Animated.View style={[styles.avatar, { opacity }]} />
          <View style={styles.headerTextContainer}>
            <Animated.View style={[styles.smallText, { opacity }]} />
            <Animated.View style={[styles.mediumText, { opacity, marginTop: 4 }]} />
          </View>
        </View>
        <Animated.View style={[styles.button, { opacity, marginTop: 12 }]} />
      </View>

      {/* Item cards skeleton */}
      {[1, 2].map((_, index) => (
        <View key={index} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Animated.View style={[styles.smallText, { opacity }]} />
            <Animated.View style={[styles.iconBox, { opacity }]} />
          </View>
          <Animated.View style={[styles.dropdown, { opacity, marginTop: 10 }]} />
          <View style={styles.tableHeader}>
            {[1, 2, 3, 4, 5].map((_, i) => (
              <Animated.View key={i} style={[styles.tableCell, { opacity }]} />
            ))}
          </View>
          <Animated.View style={[styles.totalRow, { opacity, marginTop: 4 }]} />
        </View>
      ))}

      {/* Add item button skeleton */}
      <Animated.View style={[styles.addButton, { opacity }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  smallText: {
    height: 10,
    width: '30%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  mediumText: {
    height: 14,
    width: '50%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  button: {
    height: 36,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconBox: {
    width: 26,
    height: 26,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  dropdown: {
    height: 48,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 4,
  },
  tableCell: {
    flex: 1,
    height: 36,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  totalRow: {
    height: 52,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
  },
  addButton: {
    height: 48,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
  },
});

export default ItemsLoadingSkeleton;
