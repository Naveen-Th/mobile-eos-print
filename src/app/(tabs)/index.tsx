import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ReceiptCreationScreen from '../../components/ReceiptCreationScreen';
import PrinterSetupScreen from '../../screens/PrinterSetupScreen';

// Try to import LinearGradient, fallback to View if not available
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = View;
}

const { width } = Dimensions.get('window');

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: string[];
  onPress: () => void;
}

interface StatsCard {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  trend: 'up' | 'down' | 'neutral';
}

const HomeScreen: React.FC = () => {
  const [todayStats] = useState({
    sales: 1250.75,
    transactions: 23,
    items: 87,
    avgOrder: 54.38,
  });
  const [showReceiptCreation, setShowReceiptCreation] = useState(false);
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);

  // Function to get greeting based on current time
  const getTimeBasedGreeting = (): string => {
    const currentHour = new Date().getHours();
    
    if (currentHour >= 5 && currentHour < 12) {
      return 'Good Morning!';
    } else if (currentHour >= 12 && currentHour < 17) {
      return 'Good Afternoon!';
    } else if (currentHour >= 17 && currentHour < 21) {
      return 'Good Evening!';
    } else {
      return 'Good Night!';
    }
  };

  const handleCreateReceipt = () => {
    console.log('Opening receipt creation screen...');
    setShowReceiptCreation(true);
  };

  const handleQuickPrint = () => {
    console.log('Quick print receipt...');
    Alert.alert('Quick Print', 'Printing last receipt');
  };

  const handleManageItems = () => {
    console.log('Navigate to items management...');
    Alert.alert('Items', 'Navigate to items management');
  };

  const handleViewReports = () => {
    console.log('View reports...');
    Alert.alert('Reports', 'View sales reports and analytics');
  };

  const handlePrinterSettings = () => {
    console.log('Opening printer setup...');
    setShowPrinterSetup(true);
  };

  const handleBackup = () => {
    console.log('Backup data...');
    Alert.alert('Backup', 'Backup sales data and settings');
  };

  const quickActions: QuickAction[] = [
    {
      id: '1',
      title: 'Create Receipt',
      subtitle: 'New receipt',
      icon: 'add-circle',
      gradientColors: ['#10b981', '#059669'],
      onPress: handleCreateReceipt,
    },
    {
      id: '2',
      title: 'Quick Print',
      subtitle: 'Reprint receipt',
      icon: 'print',
      gradientColors: ['#3b82f6', '#2563eb'],
      onPress: handleQuickPrint,
    },
    {
      id: '3',
      title: 'Manage Items',
      subtitle: 'Edit inventory',
      icon: 'cube',
      gradientColors: ['#8b5cf6', '#7c3aed'],
      onPress: handleManageItems,
    },
    {
      id: '4',
      title: 'Reports',
      subtitle: 'View analytics',
      icon: 'bar-chart',
      gradientColors: ['#f59e0b', '#d97706'],
      onPress: handleViewReports,
    },
    {
      id: '5',
      title: 'Printer Setup',
      subtitle: 'Configure printer',
      icon: 'settings',
      gradientColors: ['#ef4444', '#dc2626'],
      onPress: handlePrinterSettings,
    },
    {
      id: '6',
      title: 'Backup',
      subtitle: 'Save data',
      icon: 'cloud-upload',
      gradientColors: ['#06b6d4', '#0891b2'],
      onPress: handleBackup,
    },
  ];

  const statsCards: StatsCard[] = [
    {
      title: 'Today\'s Sales',
      value: `$${todayStats.sales.toLocaleString()}`,
      subtitle: '+12% from yesterday',
      icon: 'trending-up',
      iconColor: '#10b981',
      trend: 'up',
    },
    {
      title: 'Transactions',
      value: todayStats.transactions.toString(),
      subtitle: 'completed today',
      icon: 'receipt',
      iconColor: '#3b82f6',
      trend: 'up',
    },
    {
      title: 'Items Sold',
      value: todayStats.items.toString(),
      subtitle: 'units moved',
      icon: 'cube',
      iconColor: '#8b5cf6',
      trend: 'neutral',
    },
    {
      title: 'Avg Order',
      value: `$${todayStats.avgOrder.toFixed(2)}`,
      subtitle: 'per transaction',
      icon: 'calculator',
      iconColor: '#f59e0b',
      trend: 'up',
    },
  ];

  const renderStatsCard = (stat: StatsCard, index: number) => (
    <View key={index} className="bg-white rounded-2xl p-4 mr-4 w-48 shadow-sm border border-gray-100">
      <View className="flex-row items-start">
        <View 
          className="w-12 h-12 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: `${stat.iconColor}20` }}
        >
          <Ionicons name={stat.icon} size={24} color={stat.iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900 mb-1">{stat.value}</Text>
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {stat.title}
          </Text>
          <Text className="text-xs text-gray-400">{stat.subtitle}</Text>
        </View>
      </View>
    </View>
  );

  const renderQuickAction = (action: QuickAction, index: number) => (
    <TouchableOpacity
      key={action.id}
      className="mb-4 rounded-2xl overflow-hidden shadow-lg"
      style={{ width: (width - 60) / 2 }}
      onPress={action.onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={action.gradientColors}
        className="p-5 min-h-[120px] justify-between"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View className="self-start mb-3">
          <Ionicons name={action.icon} size={28} color="white" />
        </View>
        <View className="flex-1 justify-end">
          <Text className="text-white font-semibold text-base mb-1">{action.title}</Text>
          <Text className="text-white/80 text-xs">{action.subtitle}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center px-5 pt-5 pb-8">
            <View>
              <Text className="text-gray-500 text-base mb-1">{getTimeBasedGreeting()}</Text>
              <Text className="text-gray-900 text-2xl font-bold">My Thermal Receipt Store</Text>
            </View>
            <TouchableOpacity className="p-1">
              <Ionicons name="person-circle" size={40} color="#6b7280" />
            </TouchableOpacity>
          </View>

        {/* Today's Stats */}
        <View className="mb-8">
          <Text className="text-gray-900 text-lg font-semibold px-5 mb-4">Today's Overview</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {statsCards.map((stat, index) => renderStatsCard(stat, index))}
          </ScrollView>
        </View>

        {/* Quick Actions */}
        <View className="mb-8">
          <Text className="text-gray-900 text-lg font-semibold px-5 mb-4">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-between px-5">
            {quickActions.map((action, index) => renderQuickAction(action, index))}
          </View>
        </View>

        {/* Recent Activity */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center px-5 mb-4">
            <Text className="text-gray-900 text-lg font-semibold">Recent Activity</Text>
            <TouchableOpacity>
              <Text className="text-blue-500 text-sm font-medium">See All</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-white mx-5 rounded-2xl p-5 shadow-sm border border-gray-100">
            {/* Activity Item 1 */}
            <View className="flex-row items-start py-2">
              <View className="mr-3 mt-0.5">
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-medium text-sm mb-0.5">
                  Receipt #R001 printed successfully
                </Text>
                <Text className="text-gray-400 text-xs">2 minutes ago</Text>
              </View>
            </View>
            
            {/* Divider */}
            <View className="h-px bg-gray-100 my-2" />
            
            {/* Activity Item 2 */}
            <View className="flex-row items-start py-2">
              <View className="mr-3 mt-0.5">
                <Ionicons name="add-circle" size={20} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-medium text-sm mb-0.5">
                  New item "Coffee Cup" added
                </Text>
                <Text className="text-gray-400 text-xs">15 minutes ago</Text>
              </View>
            </View>
            
            {/* Divider */}
            <View className="h-px bg-gray-100 my-2" />
            
            {/* Activity Item 3 */}
            <View className="flex-row items-start py-2">
              <View className="mr-3 mt-0.5">
                <Ionicons name="card" size={20} color="#8b5cf6" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-medium text-sm mb-0.5">
                  Sale completed - $45.67
                </Text>
                <Text className="text-gray-400 text-xs">1 hour ago</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Emergency Actions */}
        <View className="px-5 mb-8">
          <Text className="text-gray-900 text-lg font-semibold mb-4">Quick Access</Text>
          <View className="flex-row space-x-4">
            <TouchableOpacity 
              className="flex-1 bg-red-500 rounded-xl p-4 items-center"
              onPress={() => Alert.alert('Emergency', 'Emergency print mode activated')}
              activeOpacity={0.8}
            >
              <Ionicons name="warning" size={24} color="white" />
              <Text className="text-white font-semibold mt-2 text-sm">Emergency Print</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-green-500 rounded-xl p-4 items-center"
              onPress={() => Alert.alert('Status', 'All systems operational')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text className="text-white font-semibold mt-2 text-sm">System Status</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      
      {/* Receipt Creation Screen */}
      <ReceiptCreationScreen
        visible={showReceiptCreation}
        onClose={() => setShowReceiptCreation(false)}
      />
    </SafeAreaView>
      
      {/* Printer Setup Screen */}
      {showPrinterSetup && (
        <PrinterSetupScreen
          onClose={() => setShowPrinterSetup(false)}
          onPrinterSelected={(printer) => {
            console.log('Printer selected:', printer);
            setShowPrinterSetup(false);
          }}
        />
      )}
    </View>
  );
};

export default HomeScreen;
