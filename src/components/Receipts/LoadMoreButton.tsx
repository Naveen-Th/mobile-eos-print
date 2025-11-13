import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadMoreButtonProps {
  onLoadMore: () => Promise<void>;
  onLoadAll: () => Promise<void>;
  isLoading: boolean;
  hasMore: boolean;
  stats: {
    realtime: number;
    loaded: number;
    total: number;
  };
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  onLoadMore,
  onLoadAll,
  isLoading,
  hasMore,
  stats,
}) => {
  // Don't show anything if no more to load
  if (!hasMore) {
    return (
      <View style={styles.container}>
        <View style={styles.endMessage}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.endText}>
            All {stats.total} receipts loaded
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Contextual message */}
      <View style={styles.messageContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="information-circle" size={18} color="#6b7280" />
        </View>
        <View style={styles.messageContent}>
          <Text style={styles.messageTitle}>
            You've reached the end of loaded receipts
          </Text>
          <Text style={styles.messageSubtitle}>
            Showing {stats.total} • {stats.realtime} recent, {stats.loaded} older
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.loadMoreButton]}
          onPress={onLoadMore}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="arrow-down" size={18} color="#ffffff" />
          )}
          <Text style={styles.buttonText}>Load 50 More</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.loadAllButton]}
          onPress={onLoadAll}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Ionicons name="albums" size={18} color="#3b82f6" />
          )}
          <Text style={styles.loadAllText}>Load All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  messageContent: {
    flex: 1,
  },
  messageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 3,
  },
  messageSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '400',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  loadMoreButton: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  loadAllButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  endMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  endText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
});

export default LoadMoreButton;
