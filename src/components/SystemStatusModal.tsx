import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSystemHealth, getHealthStatus } from '../utils/systemHealth';
import type { SystemHealthReport, HealthStatus } from '../types/SystemHealth';
import { resetAllCircuitBreakers } from '../utils/ErrorHandler';
import { clearPerformanceMetrics } from '../utils/performanceTiming';

interface SystemStatusModalProps {
  visible: boolean;
  onClose: () => void;
}

const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<SystemHealthReport | null>(null);
  const [slideAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      loadHealthData();
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadHealthData = async () => {
    setLoading(true);
    try {
      const health = getSystemHealth();
      setHealthData(health);
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCircuitBreakers = () => {
    resetAllCircuitBreakers();
    loadHealthData();
  };

  const handleClearMetrics = () => {
    clearPerformanceMetrics();
    loadHealthData();
  };

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return '#10b981';
      case 'degraded':
        return '#f59e0b';
      case 'critical':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'checkmark-circle';
      case 'degraded':
        return 'warning';
      case 'critical':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const getCircuitBreakerStateColor = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return '#10b981';
      case 'HALF_OPEN':
        return '#f59e0b';
      case 'OPEN':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getCircuitBreakerStateIcon = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return 'checkmark-circle';
      case 'HALF_OPEN':
        return 'sync-circle';
      case 'OPEN':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <Animated.View
          className="bg-white rounded-t-3xl"
          style={{
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                }),
              },
            ],
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="pulse" size={24} color="#3b82f6" />
              <Text className="text-xl font-bold text-gray-900 ml-2">System Health</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            className="max-h-[70vh]"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View className="py-20 items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-gray-500 mt-4">Loading health data...</Text>
              </View>
            ) : healthData ? (
              <View className="px-6 py-4">
                {/* Overall Status */}
                <View 
                  className="rounded-2xl p-6 mb-6"
                  style={{ backgroundColor: `${getStatusColor(healthData.health)}15` }}
                >
                  <View className="flex-row items-center mb-3">
                    <Ionicons 
                      name={getStatusIcon(healthData.health)} 
                      size={32} 
                      color={getStatusColor(healthData.health)} 
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-lg font-bold text-gray-900 capitalize">
                        {healthData.health}
                      </Text>
                      <Text className="text-sm text-gray-500">
                        {new Date(healthData.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Circuit Breakers */}
                <View className="mb-6">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-base font-semibold text-gray-900">
                      Circuit Breakers
                    </Text>
                    <View className="flex-row items-center">
                      <View className="bg-green-100 px-3 py-1 rounded-full">
                        <Text className="text-green-700 text-xs font-semibold">
                          {healthData.circuitBreakers.closed} Active
                        </Text>
                      </View>
                    </View>
                  </View>

                  {healthData.circuitBreakers.details?.map((breaker: any, index: number) => (
                    <View key={index} className="bg-gray-50 rounded-xl p-4 mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm font-semibold text-gray-900 flex-1">
                          {breaker.name}
                        </Text>
                        <View 
                          className="flex-row items-center px-3 py-1 rounded-full"
                          style={{ backgroundColor: `${getCircuitBreakerStateColor(breaker.state)}20` }}
                        >
                          <Ionicons 
                            name={getCircuitBreakerStateIcon(breaker.state)} 
                            size={14} 
                            color={getCircuitBreakerStateColor(breaker.state)} 
                          />
                          <Text 
                            className="text-xs font-semibold ml-1"
                            style={{ color: getCircuitBreakerStateColor(breaker.state) }}
                          >
                            {breaker.state}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        <View className="flex-row items-center mr-4">
                          <Ionicons name="close-circle" size={12} color="#ef4444" />
                          <Text className="text-xs text-gray-600 ml-1">
                            {breaker.failures} failures
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                          <Text className="text-xs text-gray-600 ml-1">
                            {breaker.successes} successes
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Performance Metrics */}
                {healthData.performance.operations?.length > 0 && (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-900 mb-4">
                      Performance Metrics
                    </Text>
                    {healthData.performance.operations.map((op: any, index: number) => (
                      <View key={index} className="bg-gray-50 rounded-xl p-4 mb-3">
                        <View className="flex-row items-center justify-between mb-3">
                          <Text className="text-sm font-semibold text-gray-900 flex-1">
                            {op.name}
                          </Text>
                          {op.p95Ms > 3000 && (
                            <View className="bg-orange-100 px-2 py-1 rounded-full">
                              <Text className="text-orange-700 text-xs font-semibold">SLOW</Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Average</Text>
                            <Text className="text-sm font-semibold text-gray-700">
                              {formatDuration(op.avgMs)}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">P95</Text>
                            <Text 
                              className="text-sm font-semibold"
                              style={{ color: op.p95Ms > 3000 ? '#f59e0b' : '#10b981' }}
                            >
                              {formatDuration(op.p95Ms)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}


                {/* Action Buttons */}
                <View className="flex-row mb-4">
                  <TouchableOpacity
                    className="flex-1 bg-blue-500 rounded-xl p-4 items-center mr-3"
                    onPress={loadHealthData}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={20} color="white" />
                    <Text className="text-white font-semibold mt-1 text-sm">Refresh</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    className="flex-1 bg-orange-500 rounded-xl p-4 items-center"
                    onPress={handleResetCircuitBreakers}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="power" size={20} color="white" />
                    <Text className="text-white font-semibold mt-1 text-sm">Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="py-20 items-center">
                <Ionicons name="alert-circle" size={48} color="#6b7280" />
                <Text className="text-gray-500 mt-4">No health data available</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default SystemStatusModal;
