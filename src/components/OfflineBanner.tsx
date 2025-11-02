import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore, useIsOffline } from '../store/networkStore';

const OfflineBanner: React.FC = () => {
  const isOffline = useIsOffline();
  const { isConnected, type } = useNetworkStore();
  const [expanded, setExpanded] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.banner}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          <Ionicons name="cloud-offline" size={20} color="#92400e" />
          <View style={styles.textContainer}>
            <Text style={styles.title}>Offline Mode</Text>
            {expanded && (
              <Text style={styles.subtitle}>
                Using cached data. Changes will sync when online.
              </Text>
            )}
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#92400e"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  subtitle: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 4,
  },
});

export default OfflineBanner;
