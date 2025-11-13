import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e5e7eb',
  },
});

// Item Card Skeleton
export const ItemCardSkeleton: React.FC = () => {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.cardContent}>
        <View style={skeletonStyles.header}>
          <View style={skeletonStyles.textColumn}>
            <SkeletonLoader width="70%" height={18} borderRadius={4} style={{ marginBottom: 8 }} />
            <SkeletonLoader width="40%" height={24} borderRadius={4} />
          </View>
          <SkeletonLoader width={80} height={28} borderRadius={14} />
        </View>
      </View>
    </View>
  );
};

// List of skeleton items
export const ItemsListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ItemCardSkeleton key={index} />
      ))}
    </>
  );
};

// Customer List Item Skeleton
export const CustomerListItemSkeleton: React.FC = () => {
  return (
    <View style={skeletonStyles.customerItem}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <SkeletonLoader width="60%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
        <SkeletonLoader width="45%" height={13} borderRadius={4} style={{ marginBottom: 4 }} />
        <SkeletonLoader width="35%" height={12} borderRadius={4} />
      </View>
      <SkeletonLoader width={60} height={24} borderRadius={12} />
    </View>
  );
};

// Customer List Skeleton
export const CustomerListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <CustomerListItemSkeleton key={index} />
      ))}
    </>
  );
};

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textColumn: {
    flex: 1,
    marginRight: 12,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
    minHeight: 68,
  },
});

export default SkeletonLoader;
