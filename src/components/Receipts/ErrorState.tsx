import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <View className="flex-1 bg-red-50">
      <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-6 shadow-xl border border-gray-200 max-w-sm">
            <View className="items-center">
              <View className="bg-red-500 rounded-full p-3 mb-4">
                <Ionicons name="alert-circle-outline" size={28} color="white" />
              </View>
              <Text className="text-lg font-bold text-gray-900 mb-2 text-center">Something went wrong</Text>
              <Text className="text-gray-500 text-center mb-4 leading-relaxed">{error}</Text>
              <TouchableOpacity 
                onPress={onRetry}
                className="bg-red-500 px-6 py-3 rounded-xl shadow-lg"
              >
                <Text className="text-white font-semibold text-sm">Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default ErrorState;
