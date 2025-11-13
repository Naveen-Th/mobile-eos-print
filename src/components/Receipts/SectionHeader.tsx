import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SectionHeaderProps {
  title: string;
  summary: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({
  title,
  summary,
  isExpanded,
  onToggle,
}) => {
  const rotateAnim = React.useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [isExpanded, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="chevron-down" size={20} color="#6b7280" />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.title === nextProps.title &&
    prevProps.summary === nextProps.summary &&
    prevProps.isExpanded === nextProps.isExpanded
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  summary: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default SectionHeader;
