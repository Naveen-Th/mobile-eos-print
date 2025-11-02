import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import AnalyticsService, { SalesAnalytics } from '../services/AnalyticsService';
import { formatCurrency } from '../utils';

const { width } = Dimensions.get('window');

type TimeRange = 'today' | 'week' | 'month' | 'custom';

const AnalyticsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('today');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [selectedRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const service = AnalyticsService.getInstance();
      
      let data: SalesAnalytics;
      switch (selectedRange) {
        case 'today':
          data = await service.getTodayStats();
          break;
        case 'week':
          data = await service.getWeekStats();
          break;
        case 'month':
          data = await service.getMonthStats();
          break;
        default:
          data = await service.getTodayStats();
      }
      
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const renderTimeRangeSelector = () => (
    <View className="flex-row bg-white rounded-xl p-2 mb-6 shadow-sm">
      {(['today', 'week', 'month'] as TimeRange[]).map((range) => (
        <TouchableOpacity
          key={range}
          onPress={() => setSelectedRange(range)}
          className={`flex-1 py-3 px-4 rounded-lg ${
            selectedRange === range
              ? 'bg-blue-500'
              : 'bg-transparent'
          }`}
        >
          <Text
            className={`text-center font-semibold capitalize ${
              selectedRange === range
                ? 'text-white'
                : 'text-gray-600'
            }`}
          >
            {range}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatCard = (
    title: string,
    value: string,
    icon: string,
    color: string,
    subtitle?: string
  ) => (
    <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-gray-500 text-sm font-semibold mb-2">{title}</Text>
          <Text className="text-3xl font-bold text-gray-900 mb-1">{value}</Text>
          {subtitle && (
            <Text className="text-xs text-gray-400">{subtitle}</Text>
          )}
        </View>
        <View
          className="w-16 h-16 rounded-2xl items-center justify-center shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Text className="text-3xl">{icon}</Text>
        </View>
      </View>
    </View>
  );

  const renderTopSellingItems = () => {
    if (!analytics?.topSellingItems?.length) return null;

    return (
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          🏆 Top Selling Items
        </Text>
        {analytics.topSellingItems.slice(0, 5).map((item, index) => (
          <View
            key={index}
            className="flex-row items-center justify-between py-3 border-b border-gray-100"
          >
            <View className="flex-1">
              <View className="flex-row items-center">
                <View className="w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Text className="text-xs font-bold text-blue-600">
                    {index + 1}
                  </Text>
                </View>
                <Text className="text-gray-900 font-medium flex-1">
                  {item.itemName}
                </Text>
              </View>
              <Text className="text-gray-500 text-sm ml-9">
                {item.quantitySold} units sold
              </Text>
            </View>
            <Text className="text-green-600 font-bold">
              {formatCurrency(item.revenue)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSalesChart = () => {
    if (!analytics?.salesByDay || analytics.salesByDay.length === 0) return null;

    // Get last 7 days of data
    const chartData = analytics.salesByDay.slice(-7);
    const labels = chartData.map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const salesData = chartData.map(d => d.sales);

    const chartConfig = {
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: '5',
        strokeWidth: '2',
        stroke: '#3b82f6',
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#f3f4f6',
        strokeWidth: 1,
      },
    };

    return (
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">📈 Sales Trend</Text>
          <View className="bg-blue-50 px-3 py-1 rounded-full">
            <Text className="text-blue-600 text-xs font-semibold">Last 7 Days</Text>
          </View>
        </View>
        <LineChart
          data={{
            labels,
            datasets: [{ data: salesData.length > 0 ? salesData : [0] }],
          }}
          width={width - 60}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={{
            borderRadius: 16,
          }}
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          fromZero={true}
        />
      </View>
    );
  };

  const renderCategoryBreakdown = () => {
    if (!analytics?.salesByCategory?.length) return null;

    const total = analytics.salesByCategory.reduce((sum, cat) => sum + cat.sales, 0);
    const topCategories = analytics.salesByCategory.slice(0, 5);

    return (
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          📊 Sales by Category
        </Text>
        {topCategories.map((category, index) => {
          const percentage = total > 0 ? (category.sales / total) * 100 : 0;
          const gradientColors = [
            ['#3b82f6', '#2563eb'],
            ['#8b5cf6', '#7c3aed'],
            ['#10b981', '#059669'],
            ['#f59e0b', '#d97706'],
            ['#ef4444', '#dc2626'],
          ];
          const [startColor, endColor] = gradientColors[index % gradientColors.length];
          
          return (
            <View key={index} className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-900 font-semibold">
                  {category.category}
                </Text>
                <Text className="text-gray-600 font-bold">
                  {formatCurrency(category.sales)}
                </Text>
              </View>
              <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: startColor,
                  }}
                />
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-gray-500 text-xs font-medium">
                  {percentage.toFixed(1)}% of total
                </Text>
                <Text className="text-gray-500 text-xs">
                  {category.itemCount} items
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderCustomerStats = () => {
    if (!analytics?.customerStats) return null;

    const { totalCustomers, repeatCustomers, newCustomers } = analytics.customerStats;
    const repeatRate = totalCustomers > 0 
      ? ((repeatCustomers / totalCustomers) * 100).toFixed(1) 
      : '0';

    return (
      <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          👥 Customer Statistics
        </Text>
        <View className="flex-row justify-between mb-3">
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Total Customers</Text>
            <Text className="text-2xl font-bold text-gray-900">
              {totalCustomers}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Repeat Rate</Text>
            <Text className="text-2xl font-bold text-green-600">
              {repeatRate}%
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Repeat Customers</Text>
            <Text className="text-xl font-semibold text-gray-900">
              {repeatCustomers}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">New Customers</Text>
            <Text className="text-xl font-semibold text-gray-900">
              {newCustomers}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-600 mt-4">Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📊</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Unable to Load Analytics
          </Text>
          <Text className="text-gray-600 text-center mb-6">{error}</Text>
          <TouchableOpacity
            onPress={loadAnalytics}
            className="bg-blue-500 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-gray-50 to-gray-100">
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-4xl font-black text-gray-900 mb-2">
            Analytics & Reports
          </Text>
          <Text className="text-gray-600 text-base">
            Track your business performance
          </Text>
        </View>

        {/* Time Range Selector */}
        {renderTimeRangeSelector()}

        {/* Main Stats */}
        {analytics && (
          <>
            {/* Primary Stats Card with gradient */}
            <View className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 mb-4 shadow-lg">
              <Text className="text-white text-sm font-semibold mb-2 opacity-90">
                Total Revenue
              </Text>
              <Text className="text-white text-5xl font-black mb-1">
                {formatCurrency(analytics.totalSales)}
              </Text>
              <View className="flex-row items-center mt-2">
                <View className="bg-white/20 px-3 py-1 rounded-full">
                  <Text className="text-white text-xs font-bold">
                    {analytics.totalTransactions} transactions
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Stats Grid */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
                <Text className="text-gray-500 text-xs font-semibold mb-1">Transactions</Text>
                <Text className="text-gray-900 text-2xl font-bold">
                  {analytics.totalTransactions}
                </Text>
                <Text className="text-2xl mt-1">🧾</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
                <Text className="text-gray-500 text-xs font-semibold mb-1">Items Sold</Text>
                <Text className="text-gray-900 text-2xl font-bold">
                  {analytics.totalItems}
                </Text>
                <Text className="text-2xl mt-1">📦</Text>
              </View>
              <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
                <Text className="text-gray-500 text-xs font-semibold mb-1">Avg Order</Text>
                <Text className="text-gray-900 text-xl font-bold">
                  {formatCurrency(analytics.averageOrderValue)}
                </Text>
                <Text className="text-2xl mt-1">📈</Text>
              </View>
            </View>

            {/* Sales Chart */}
            {renderSalesChart()}

            {/* Top Selling Items */}
            {renderTopSellingItems()}

            {/* Category Breakdown */}
            {renderCategoryBreakdown()}

            {/* Customer Stats */}
            {renderCustomerStats()}
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AnalyticsScreen;



