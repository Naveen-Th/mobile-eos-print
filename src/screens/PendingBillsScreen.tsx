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
import PendingBillsService, { PendingBill } from '../services/business/PendingBillsService';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { useReceipts } from '../hooks/useSyncManager';
import { formatCurrency } from '../utils';
import { useLanguage } from '../contexts/LanguageContext';

interface CustomerBalance {
  customerName: string;
  businessName?: string;
  totalBalance: number;
  billsCount: number;
  bills: PendingBill[];
}

const PendingBillsScreen: React.FC = () => {
  const { t } = useLanguage();
  const { 
    data: receiptsData = [], 
    isLoading: loading
  } = useReceipts();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState<PendingBill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [viewMode, setViewMode] = useState<'customer' | 'individual'>('customer');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // Convert receipts to pending bills format (only unpaid/partial ones)
  const bills: PendingBill[] = React.useMemo(() => {
    return receiptsData
      .filter(receipt => {
        const total = receipt.total || 0;
        const amountPaid = receipt.amountPaid || 0;
        return total - amountPaid > 0; // Only include unpaid bills
      })
      .map(receipt => {
        const oldBalance = receipt.oldBalance || 0;
        const total = receipt.total || 0;
        const amountPaid = receipt.amountPaid || 0;
        const remainingBalance = total - amountPaid;
        
        const status: 'pending' | 'partial' | 'paid' | 'overdue' = 
          amountPaid > 0 && remainingBalance > 0 ? 'partial' : 'pending';
        
        return {
          id: receipt.id,
          customerId: '',
          customerName: receipt.customerName || 'Walk-in Customer',
          businessName: receipt.businessName,
          businessPhone: receipt.businessPhone,
          amount: total,
          oldBalance,
          paidAmount: amountPaid,
          remainingBalance,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          notes: undefined,
          dueDate: undefined,
          status,
          createdAt: receipt.createdAt?.toDate ? receipt.createdAt.toDate() : new Date(receipt.date),
          updatedAt: receipt.updatedAt?.toDate ? receipt.updatedAt.toDate() : new Date(receipt.date),
        };
      });
  }, [receiptsData]);
  
  // Calculate stats from bills
  const stats = React.useMemo(() => ({
    totalPending: bills.reduce((sum, bill) => sum + bill.amount, 0),
    totalBills: bills.length,
    overdueCount: 0, // Would need due date logic
    partialPaymentCount: bills.filter(bill => bill.status === 'partial').length,
  }), [bills]);
  

  const handleRecordPayment = async () => {
    if (!selectedBill) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('pendingBills.invalidAmount'), t('pendingBills.invalidAmountMessage'));
      return;
    }

    if (amount > selectedBill.remainingBalance) {
      Alert.alert(
        t('pendingBills.invalidAmount'),
        t('pendingBills.exceedsBalance')
      );
      return;
    }

            try {
              await PendingBillsService.getInstance().recordPayment({
                billId: selectedBill.id,
                amount,
                paymentMethod: 'cash',
              });

              Alert.alert(t('common.success'), t('pendingBills.paymentSuccess'));
              setShowPaymentModal(false);
              setPaymentAmount('');
              setSelectedBill(null);
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert(t('common.error'), t('pendingBills.paymentError'));
    }
  };

  const handleDeleteBill = (bill: PendingBill) => {
    Alert.alert(
      t('pendingBills.deleteBill'),
      t('pendingBills.deleteBillConfirm', { customer: bill.customerName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await PendingBillsService.getInstance().deleteBill(bill.id);
              Alert.alert(t('common.success'), t('pendingBills.deleteSuccess'));
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('pendingBills.deleteError'));
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

  // Group bills by customer
  const customerBalances: CustomerBalance[] = React.useMemo(() => {
    const grouped = bills.reduce((acc, bill) => {
      const key = bill.customerName;
      if (!acc[key]) {
        acc[key] = {
          customerName: bill.customerName,
          businessName: bill.businessName,
          totalBalance: 0,
          billsCount: 0,
          bills: [],
        };
      }
      
      acc[key].totalBalance += bill.amount;
      acc[key].billsCount += 1;
      acc[key].bills.push(bill);
      return acc;
    }, {} as Record<string, CustomerBalance>);

    return Object.values(grouped).sort((a, b) => b.totalBalance - a.totalBalance);
  }, [bills]);

  const filteredBills = bills.filter((bill) =>
    bill.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bill.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customerBalances.filter((customer) =>
    customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const renderCustomerBalanceItem = (customer: CustomerBalance) => {
    const isExpanded = expandedCustomer === customer.customerName;
    
    return (
      <View key={customer.customerName} className="mb-3">
        <TouchableOpacity
          onPress={() => setExpandedCustomer(isExpanded ? null : customer.customerName)}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900 mb-1">
                {customer.customerName}
              </Text>
              {customer.businessName && (
                <Text className="text-sm text-gray-500">{customer.businessName}</Text>
              )}
              <Text className="text-xs text-gray-400 mt-1">
                {customer.billsCount} {customer.billsCount === 1 ? t('pendingBills.bill') : t('pendingBills.bills')}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-bold text-red-600 text-xl">
                {formatCurrency(customer.totalBalance)}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                {isExpanded ? '▼' : '▶'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View className="mt-2 ml-3">
            {customer.bills.map(renderBillItem)}
          </View>
        )}
      </View>
    );
  };

  const renderBillItem = (bill: PendingBill) => {
    const isPaid = bill.remainingBalance <= 0.01;
    
    return (
      <View
        key={bill.id}
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900 mb-1">
              {bill.customerName}
            </Text>
            {bill.businessName && (
              <Text className="text-sm text-gray-500">{bill.businessName}</Text>
            )}
          </View>
          
          {/* Total Amount */}
          <View className="items-end">
            <Text className="text-xs text-gray-500">{t('pendingBills.total')}</Text>
            <Text className="text-base font-bold text-blue-600">
              {formatCurrency(bill.amount)}
            </Text>
          </View>
        </View>

        {/* Receipt Number */}
        {bill.receiptNumber && (
          <Text className="text-xs text-gray-400 mb-2">
            #{bill.receiptNumber}
          </Text>
        )}

        {/* Balance and Status Information */}
        <View className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-3">
          {/* Status Badge */}
          <View className="flex-row items-center justify-between mb-2">
            <View className={`px-2 py-1 rounded-full flex-row items-center ${
              isPaid
                ? 'bg-green-100'
                : bill.paidAmount > 0
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
            }`}>
              <Text className={`text-xs font-bold ${
                isPaid
                  ? 'text-green-600'
                  : bill.paidAmount > 0
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}>
                {isPaid ? `✓ ${t('pendingBills.paid')}` : bill.paidAmount > 0 ? `⏱ ${t('pendingBills.partial')}` : `⚠ ${t('pendingBills.unpaid')}`}
              </Text>
            </View>
            
            {/* Balance Due */}
            <View className="items-end">
              <Text className="text-xs text-gray-500">{t('pendingBills.balanceDue')}</Text>
              <Text className={`text-base font-bold ${
                bill.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(bill.remainingBalance)}
              </Text>
            </View>
          </View>

          {/* Financial Details */}
          {(bill.oldBalance !== undefined && bill.oldBalance !== 0) || bill.paidAmount > 0 ? (
            <View className="flex-row justify-between pt-2 border-t border-gray-200">
              {/* Previous Balance */}
              {bill.oldBalance !== undefined && bill.oldBalance !== 0 && (
                <View className="flex-1">
                  <Text className="text-xs text-gray-500">{t('pendingBills.previousBalance')}</Text>
                  <Text className="text-sm font-semibold text-gray-600">
                    {formatCurrency(bill.oldBalance)}
                  </Text>
                </View>
              )}
              
              {/* Amount Paid */}
              {bill.paidAmount > 0 && (
                <View className="flex-1 items-end">
                  <Text className="text-xs text-gray-500">{t('pendingBills.amountPaid')}</Text>
                  <Text className="text-sm font-bold text-green-600">
                    {formatCurrency(bill.paidAmount)}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        {!isPaid && (
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                setSelectedBill(bill);
                setPaymentAmount(bill.remainingBalance.toString());
                setShowPaymentModal(true);
              }}
              className="flex-1 bg-green-500 py-3 rounded-lg flex-row items-center justify-center"
            >
              <Text className="text-white font-semibold text-sm">
                💳 {t('pendingBills.pay')} {formatCurrency(bill.remainingBalance)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteBill(bill)}
              className="bg-red-500 py-3 px-4 rounded-lg"
            >
              <Text className="text-white font-semibold">🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

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
            {t('pendingBills.recordPayment')}
          </Text>

          {selectedBill && (
            <>
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <Text className="text-gray-600 mb-2">{t('pendingBills.customer')}</Text>
                <Text className="text-lg font-bold text-gray-900 mb-3">
                  {selectedBill.customerName}
                </Text>
                <View className="flex-row justify-between">
                  <Text className="text-gray-600">{t('pendingBills.remainingBalance')}:</Text>
                  <Text className="text-xl font-bold text-red-600">
                    {formatCurrency(selectedBill.remainingBalance)}
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  {t('pendingBills.paymentAmount')}
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
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRecordPayment}
                  className="flex-1 bg-green-500 py-4 rounded-xl"
                >
                  <Text className="text-white font-semibold text-center">
                    {t('pendingBills.recordPayment')}
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
          <Text className="text-gray-600 mt-4">{t('pendingBills.loadingBills')}</Text>
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
            {t('pendingBills.title')}
          </Text>
          <Text className="text-gray-600">
            {t('pendingBills.subtitle')}
          </Text>
        </View>

        {/* Stats Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
        >
          {renderStatCard(
            t('pendingBills.totalPending'),
            formatCurrency(stats.totalPending),
            '💰'
          )}
          {renderStatCard(t('pendingBills.totalBills'), stats.totalBills.toString(), '📋')}
          {renderStatCard(t('pendingBills.overdue'), stats.overdueCount.toString(), '⚠️')}
          {renderStatCard(
            t('pendingBills.partialPaid'),
            stats.partialPaymentCount.toString(),
            '📊'
          )}
        </ScrollView>

        {/* View Mode Toggle */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={() => setViewMode('customer')}
            className={`flex-1 py-3 rounded-xl ${
              viewMode === 'customer' ? 'bg-blue-500' : 'bg-white'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                viewMode === 'customer' ? 'text-white' : 'text-gray-700'
              }`}
            >
              {t('pendingBills.byCustomer')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('individual')}
            className={`flex-1 py-3 rounded-xl ${
              viewMode === 'individual' ? 'bg-blue-500' : 'bg-white'
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                viewMode === 'individual' ? 'text-white' : 'text-gray-700'
              }`}
            >
              {t('pendingBills.individualBills')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="bg-white rounded-xl mb-6 shadow-sm">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('pendingBills.searchPlaceholder')}
            className="px-4 py-4"
          />
        </View>

        {/* Bills List */}
        {viewMode === 'customer' ? (
          filteredCustomers.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <Text className="text-6xl mb-4">💸</Text>
              <Text className="text-xl font-bold text-gray-900 mb-2">
                {t('pendingBills.noPendingBills')}
              </Text>
              <Text className="text-gray-600 text-center">
                {searchQuery
                  ? t('pendingBills.noCustomersMatch')
                  : t('pendingBills.allSettled')}
              </Text>
            </View>
          ) : (
            <View>
              <Text className="text-sm text-gray-600 mb-3">
                {filteredCustomers.length === 1 
                  ? t('pendingBills.customerWithBalance', { count: filteredCustomers.length })
                  : t('pendingBills.customersWithBalance', { count: filteredCustomers.length })}
              </Text>
              {filteredCustomers.map(renderCustomerBalanceItem)}
            </View>
          )
        ) : filteredBills.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-6xl mb-4">💸</Text>
            <Text className="text-xl font-bold text-gray-900 mb-2">
              {t('pendingBills.noPendingBills')}
            </Text>
            <Text className="text-gray-600 text-center">
              {searchQuery
                ? t('pendingBills.noBillsMatch')
                : t('pendingBills.allSettled')}
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
