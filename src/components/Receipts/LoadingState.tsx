import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LoadingState: React.FC = () => {
  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-6 shadow-xl border border-gray-200">
            <View className="items-center">
              <View className="bg-blue-500 rounded-full p-3 mb-4">
                <ActivityIndicator size="large" color="white" />
              </View>
              <Text className="text-lg font-bold text-gray-900 mb-2">Loading Receipts</Text>
              <Text className="text-gray-500 text-center">Please wait while we fetch your receipts...</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default LoadingState;
