import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  hasSearch: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasSearch, hasFilters, onClearFilters }) => {
  const isFiltered = hasSearch || hasFilters;
  
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={isFiltered ? 'search-outline' : 'receipt-outline'} 
              size={32} 
              color="white" 
            />
          </View>
          <Text style={styles.title}>
            {isFiltered ? 'No Matching Receipts' : 'No Receipts Found'}
          </Text>
          <Text style={styles.description}>
            {isFiltered 
              ? 'Try adjusting your search or filters'
              : 'No receipts have been created yet. Start creating receipts to see them here!'
            }
          </Text>
          {isFiltered && (
            <TouchableOpacity 
              onPress={onClearFilters}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxWidth: 280,
    width: '100%',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#6b7280',
    borderRadius: 32,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
  },
  clearButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EmptyState;
