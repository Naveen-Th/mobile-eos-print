import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PendingBillsService, { PendingBill } from '../services/PendingBillsService';
import { formatCurrency } from '../utils';

const PendingBillsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [stats, setStats] = useState({
    totalPending: 0,
    totalBills: 0,
    overdueCount: 0,
    partialPaymentCount: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState<PendingBill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('=== Loading Pending Bills Data ===');
      const service = PendingBillsService.getInstance();
      const [billsData, statsData] = await Promise.all([
        service.getAllPendingBills(),
        service.getBillsStatistics(),
      ]);
      console.log('Loaded bills:', billsData.length);
      console.log('Bills data:', billsData);
      setBills(billsData);
      setStats(statsData);
      console.log('Stats:', statsData);
    } catch (error) {
      console.error('Error loading pending bills:', error);
      Alert.alert('Error', `Failed to load pending bills: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedBill) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    if (amount > selectedBill.remainingBalance) {
      Alert.alert(
        'Invalid Amount',
        'Payment amount cannot exceed remaining balance'
      );
      return;
    }

    try {
      await PendingBillsService.getInstance().recordPayment({
        billId: selectedBill.id,
        amount,
        paymentMethod: 'cash',
      });

      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setSelectedBill(null);
      loadData();
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'Failed to record payment');
    }
  };

  const handleDeleteBill = (bill: PendingBill) => {
    Alert.alert(
      'Delete Bill',
      `Are you sure you want to delete this bill for ${bill.customerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PendingBillsService.getInstance().deleteBill(bill.id);
              Alert.alert('Success', 'Bill deleted successfully');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete bill');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-orange-100 text-orange-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredBills = bills.filter((bill) =>
    bill.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bill.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStatCard = (title: string, value: string, icon: string) => (
    <View className="flex-1 bg-white rounded-xl p-4 mr-3">
      <Text className="text-gray-500 text-xs font-medium mb-1">{title}</Text>
      <View className="flex-row items-center">
        <Text className="text-xl font-bold text-gray-900 mr-2">{value}</Text>
        <Text className="text-lg">{icon}</Text>
      </View>
    </View>
  );

  const renderBillItem = (bill: PendingBill) => (
    <View
      key={bill.id}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 mb-1">
            {bill.customerName}
          </Text>
          {bill.businessName && (
            <Text className="text-sm text-gray-500">{bill.businessName}</Text>
          )}
          {bill.receiptNumber && (
            <Text className="text-xs text-gray-400 mt-1">
              Receipt #{bill.receiptNumber}
            </Text>
          )}
        </View>
        <View className={`px-3 py-1 rounded-full ${getStatusColor(bill.status)}`}>
          <Text className="text-xs font-bold uppercase">{bill.status}</Text>
        </View>
      </View>

      <View className="border-t border-gray-100 pt-3 mb-3">
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600">Total Amount:</Text>
          <Text className="font-semibold text-gray-900">
            {formatCurrency(bill.amount)}
          </Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600">Paid:</Text>
          <Text className="font-semibold text-green-600">
            {formatCurrency(bill.paidAmount)}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="font-semibold text-gray-900">Remaining:</Text>
          <Text className="font-bold text-red-600 text-lg">
            {formatCurrency(bill.remainingBalance)}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => {
            setSelectedBill(bill);
            setPaymentAmount(bill.remainingBalance.toString());
            setShowPaymentModal(true);
          }}
          className="flex-1 bg-green-500 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold text-center">
            Record Payment
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteBill(bill)}
          className="bg-red-500 py-3 px-4 rounded-lg"
        >
          <Text className="text-white font-semibold">🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPaymentModal(false)}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Record Payment
          </Text>

          {selectedBill && (
            <>
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <Text className="text-gray-600 mb-2">Customer</Text>
                <Text className="text-lg font-bold text-gray-900 mb-3">
                  {selectedBill.customerName}
                </Text>
                <View className="flex-row justify-between">
                  <Text className="text-gray-600">Remaining Balance:</Text>
                  <Text className="text-xl font-bold text-red-600">
                    {formatCurrency(selectedBill.remainingBalance)}
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Payment Amount
                </Text>
                <TextInput
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  className="bg-gray-100 rounded-xl px-4 py-4 text-lg font-semibold"
                />
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowPaymentModal(false);
                    setPaymentAmount('');
                    setSelectedBill(null);
                  }}
                  className="flex-1 bg-gray-200 py-4 rounded-xl"
                >
                  <Text className="text-gray-700 font-semibold text-center">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRecordPayment}
                  className="flex-1 bg-green-500 py-4 rounded-xl"
                >
                  <Text className="text-white font-semibold text-center">
                    Record Payment
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-600 mt-4">Loading pending bills...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-5 pt-5">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            Pending Bills
          </Text>
          <Text className="text-gray-600">
            Manage customer balances and payments
          </Text>
        </View>

        {/* Stats Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
        >
          {renderStatCard(
            'Total Pending',
            formatCurrency(stats.totalPending),
            '💰'
          )}
          {renderStatCard('Total Bills', stats.totalBills.toString(), '📋')}
          {renderStatCard('Overdue', stats.overdueCount.toString(), '⚠️')}
          {renderStatCard(
            'Partial Paid',
            stats.partialPaymentCount.toString(),
            '📊'
          )}
        </ScrollView>

        {/* Search */}
        <View className="bg-white rounded-xl mb-6 shadow-sm">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by customer name..."
            className="px-4 py-4"
          />
        </View>

        {/* Bills List */}
        {filteredBills.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-6xl mb-4">💸</Text>
            <Text className="text-xl font-bold text-gray-900 mb-2">
              No Pending Bills
            </Text>
            <Text className="text-gray-600 text-center">
              {searchQuery
                ? 'No bills match your search'
                : 'All customers have settled their balances'}
            </Text>
          </View>
        ) : (
          filteredBills.map(renderBillItem)
        )}

        <View className="h-8" />
      </ScrollView>

      {renderPaymentModal()}
    </SafeAreaView>
  );
};

export default PendingBillsScreen;
