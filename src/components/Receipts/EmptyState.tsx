import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface EmptyStateProps {
  hasSearch: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasSearch, hasFilters, onClearFilters }) => {
  const isFiltered = hasSearch || hasFilters;
  
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Card accent={isFiltered ? 'warning' : 'secondary'} className="w-full max-w-[280px] items-center">
        <View className={`mb-4 rounded-2xl p-4 ${isFiltered ? 'bg-warning-500' : 'bg-secondary-500'}`}>
          <Text className="text-2xl">{isFiltered ? '🔎' : '🧾'}</Text>
        </View>
        <Text className="mb-2 text-center text-lg font-extrabold text-secondary-900">
          {isFiltered ? 'No Matching Receipts' : 'No Receipts Found'}
        </Text>
        <Text className="text-center text-sm leading-5 text-secondary-500">
          {isFiltered
            ? 'Try adjusting your search or filters'
            : 'No receipts have been created yet. Start creating receipts to see them here!'}
        </Text>
        {isFiltered && (
          <View className="mt-3">
            <Button title="Clear Filters" onPress={onClearFilters} />
          </View>
        )}
      </Card>
    </View>
  );
};

export default EmptyState;
