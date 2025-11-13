import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Switch,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PaymentReminderService, {
  PartyWithReminder,
  ReminderSettings,
  ReminderLog,
} from '../services/features/PaymentReminderService';

type TabType = 'parties' | 'settings' | 'history';

const PaymentRemindersScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TabType>('parties');
  const [parties, setParties] = useState<PartyWithReminder[]>([]);
  const [dueParties, setDueParties] = useState<PartyWithReminder[]>([]);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const reminderService = PaymentReminderService.getInstance();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load settings always
      const settingsData = await reminderService.getSettings();
      setSettings(settingsData);

      if (activeTab === 'parties') {
        const [allParties, due] = await Promise.all([
          reminderService.getPartiesWithBalance(),
          reminderService.getPartiesDueForReminder(),
        ]);
        setParties(allParties);
        setDueParties(due);
      } else if (activeTab === 'history') {
        const logsData = await reminderService.getReminderLogs(100);
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load reminder data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [activeTab]);

  const handleSendReminder = async (party: PartyWithReminder) => {
    try {
      Alert.alert(
        'Send Reminder',
        `Send payment reminder to ${party.personName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Push Notification',
            onPress: async () => {
              const success = await reminderService.sendReminderNotification(party);
              if (success) {
                Alert.alert('Success', 'Reminder sent successfully');
                loadData();
              } else {
                Alert.alert('Error', 'Failed to send reminder');
              }
            },
          },
          {
            text: 'WhatsApp',
            onPress: () => handleWhatsAppReminder(party),
          },
        ]
      );
    } catch (error) {
      console.error('Error sending reminder:', error);
      Alert.alert('Error', 'Failed to send reminder');
    }
  };

  const handleWhatsAppReminder = async (party: PartyWithReminder) => {
    try {
      const whatsappUrl = reminderService.getWhatsAppLink(party);
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        
        // Update tracking after opening WhatsApp
        await reminderService.sendReminderNotification(party);
      } else {
        Alert.alert('Error', 'WhatsApp is not installed on this device');
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  };

  const handleSendAllReminders = async () => {
    if (dueParties.length === 0) {
      Alert.alert('No Reminders Due', 'There are no parties due for reminders at this time');
      return;
    }

    Alert.alert(
      'Send All Reminders',
      `Send reminders to ${dueParties.length} parties?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSendingReminders(true);
              const result = await reminderService.sendAllDueReminders();
              Alert.alert(
                'Reminders Sent',
                `Successfully sent: ${result.sent}\nFailed: ${result.failed}`
              );
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to send reminders');
            } finally {
              setSendingReminders(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateSetting = async (key: keyof ReminderSettings, value: any) => {
    try {
      await reminderService.updateSettings({ [key]: value });
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
      Alert.alert('Success', 'Settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const handleTestNotification = async () => {
    try {
      await reminderService.sendTestNotification();
      Alert.alert('Test Sent', 'Check your notifications!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const renderPartyCard = (party: PartyWithReminder, isDue: boolean) => {
    const daysOverdue = party.overduedays || 0;
    const lastReminder = party.lastReminderSent
      ? new Date(party.lastReminderSent.toDate()).toLocaleDateString()
      : 'Never';

    return (
      <View
        key={party.id}
        className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
          isDue ? 'border-red-500' : 'border-orange-500'
        }`}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{party.personName}</Text>
            {party.businessName && (
              <Text className="text-sm text-gray-600">{party.businessName}</Text>
            )}
          </View>
          <View className="bg-red-100 px-3 py-1 rounded-full">
            <Text className="text-red-700 font-bold">₹{party.balanceDue.toFixed(2)}</Text>
          </View>
        </View>

        <View className="flex-row items-center mb-2">
          <Ionicons name="call-outline" size={14} color="#6b7280" />
          <Text className="text-sm text-gray-600 ml-1">{party.phoneNumber}</Text>
        </View>

        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 ml-1">
              {daysOverdue} days overdue
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="notifications-outline" size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 ml-1">
              Last: {lastReminder} ({party.reminderCount || 0}x)
            </Text>
          </View>
        </View>

        {isDue && (
          <View className="bg-yellow-50 p-2 rounded-lg mb-3">
            <Text className="text-xs text-yellow-800 font-semibold">
              ⚠️ Due for reminder now
            </Text>
          </View>
        )}

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleSendReminder(party)}
            className="flex-1 bg-blue-500 py-2 rounded-lg flex-row items-center justify-center"
          >
            <Ionicons name="notifications" size={16} color="white" />
            <Text className="text-white font-semibold ml-2">Send Reminder</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => handleWhatsAppReminder(party)}
            className="bg-green-500 py-2 px-4 rounded-lg flex-row items-center justify-center"
          >
            <Ionicons name="logo-whatsapp" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPartiesTab = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-500 mt-4">Loading parties...</Text>
        </View>
      );
    }

    return (
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-red-50 rounded-xl p-4">
            <Text className="text-red-600 text-2xl font-bold">{dueParties.length}</Text>
            <Text className="text-red-700 text-xs mt-1">Due Now</Text>
          </View>
          <View className="flex-1 bg-orange-50 rounded-xl p-4">
            <Text className="text-orange-600 text-2xl font-bold">{parties.length}</Text>
            <Text className="text-orange-700 text-xs mt-1">Total Overdue</Text>
          </View>
          <View className="flex-1 bg-blue-50 rounded-xl p-4">
            <Text className="text-blue-600 text-2xl font-bold">
              ₹{parties.reduce((sum, p) => sum + p.balanceDue, 0).toFixed(0)}
            </Text>
            <Text className="text-blue-700 text-xs mt-1">Total Due</Text>
          </View>
        </View>

        {/* Send All Button */}
        {dueParties.length > 0 && (
          <TouchableOpacity
            onPress={handleSendAllReminders}
            disabled={sendingReminders}
            className="bg-gradient-to-r from-blue-500 to-blue-600 py-4 rounded-xl mb-6 flex-row items-center justify-center shadow-lg"
          >
            {sendingReminders ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-2">
                  Send All Reminders ({dueParties.length})
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Due Parties Section */}
        {dueParties.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-3">Due for Reminder</Text>
            {dueParties.map((party) => renderPartyCard(party, true))}
          </View>
        )}

        {/* All Parties Section */}
        <View>
          <Text className="text-lg font-bold text-gray-900 mb-3">All Overdue Parties</Text>
          {parties.length === 0 ? (
            <View className="bg-green-50 rounded-xl p-8 items-center">
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              <Text className="text-green-800 font-bold text-lg mt-4">All Clear!</Text>
              <Text className="text-green-700 text-center mt-2">
                No parties with outstanding balances
              </Text>
            </View>
          ) : (
            parties.map((party) => renderPartyCard(party, false))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderSettingsTab = () => {
    if (!settings) return null;

    return (
      <ScrollView className="flex-1">
        {/* Auto Reminders */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">Auto Reminders</Text>
              <Text className="text-sm text-gray-600">
                Automatically check and send reminders daily
              </Text>
            </View>
            <Switch
              value={settings.autoReminderEnabled}
              onValueChange={(value) => handleUpdateSetting('autoReminderEnabled', value)}
            />
          </View>
        </View>

        {/* Minimum Balance */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-3">Minimum Balance</Text>
          <Text className="text-sm text-gray-600 mb-3">
            Only send reminders if balance is at least:
          </Text>
          <View className="flex-row gap-2">
            {[100, 500, 1000, 5000].map((amount) => (
              <TouchableOpacity
                key={amount}
                onPress={() => handleUpdateSetting('minimumBalance', amount)}
                className={`flex-1 py-3 rounded-lg ${
                  settings.minimumBalance === amount
                    ? 'bg-blue-500'
                    : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    settings.minimumBalance === amount
                      ? 'text-white'
                      : 'text-gray-700'
                  }`}
                >
                  ₹{amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Frequency */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-3">Reminder Frequency</Text>
          <View className="gap-2">
            {[
              { value: 'daily', label: 'Daily', desc: 'Send reminders every day' },
              { value: 'weekly', label: 'Weekly', desc: 'Send reminders once a week' },
              { value: 'biweekly', label: 'Bi-weekly', desc: 'Send reminders every 2 weeks' },
              { value: 'monthly', label: 'Monthly', desc: 'Send reminders once a month' },
            ].map((freq) => (
              <TouchableOpacity
                key={freq.value}
                onPress={() => handleUpdateSetting('reminderFrequency', freq.value)}
                className={`p-4 rounded-lg border-2 ${
                  settings.reminderFrequency === freq.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text
                  className={`font-bold ${
                    settings.reminderFrequency === freq.value
                      ? 'text-blue-700'
                      : 'text-gray-900'
                  }`}
                >
                  {freq.label}
                </Text>
                <Text className="text-sm text-gray-600 mt-1">{freq.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Grace Period */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-gray-900 mb-3">Grace Period</Text>
          <Text className="text-sm text-gray-600 mb-3">
            Wait this many days before sending first reminder:
          </Text>
          <View className="flex-row gap-2">
            {[3, 7, 14, 30].map((days) => (
              <TouchableOpacity
                key={days}
                onPress={() => handleUpdateSetting('gracePeriodDays', days)}
                className={`flex-1 py-3 rounded-lg ${
                  settings.gracePeriodDays === days
                    ? 'bg-blue-500'
                    : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    settings.gracePeriodDays === days
                      ? 'text-white'
                      : 'text-gray-700'
                  }`}
                >
                  {days}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Test Notification */}
        <TouchableOpacity
          onPress={handleTestNotification}
          className="bg-purple-500 py-4 rounded-xl flex-row items-center justify-center mb-4"
        >
          <Ionicons name="flask" size={20} color="white" />
          <Text className="text-white font-bold ml-2">Send Test Notification</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderHistoryTab = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }

    return (
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {logs.length === 0 ? (
          <View className="bg-gray-50 rounded-xl p-8 items-center mt-8">
            <Ionicons name="time-outline" size={48} color="#9ca3af" />
            <Text className="text-gray-600 font-bold text-lg mt-4">No History Yet</Text>
            <Text className="text-gray-500 text-center mt-2">
              Reminder history will appear here
            </Text>
          </View>
        ) : (
          logs.map((log) => (
            <View
              key={log.id}
              className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                log.status === 'sent' ? 'border-green-500' : 'border-red-500'
              }`}
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">{log.partyName}</Text>
                  <Text className="text-sm text-gray-600">₹{log.balanceDue.toFixed(2)}</Text>
                </View>
                <View
                  className={`px-3 py-1 rounded-full ${
                    log.status === 'sent' ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      log.status === 'sent' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {log.status}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center mb-2">
                <Ionicons
                  name={
                    log.reminderType === 'whatsapp'
                      ? 'logo-whatsapp'
                      : log.reminderType === 'sms'
                      ? 'mail'
                      : 'notifications'
                  }
                  size={14}
                  color="#6b7280"
                />
                <Text className="text-xs text-gray-500 ml-1 capitalize">
                  {log.reminderType}
                </Text>
                <Text className="text-xs text-gray-400 ml-4">
                  {new Date(log.sentAt.toDate()).toLocaleString()}
                </Text>
              </View>

              {log.message && log.status === 'sent' && (
                <Text className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2">
                  {log.message}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Payment Reminders</Text>
            <Text className="text-sm text-gray-600 mt-1">
              Automate payment collection follow-ups
            </Text>
          </View>
          {navigation && (
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mt-4">
          <TouchableOpacity
            onPress={() => setActiveTab('parties')}
            className={`flex-1 py-3 rounded-lg ${
              activeTab === 'parties' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'parties' ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              Parties
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            className={`flex-1 py-3 rounded-lg ${
              activeTab === 'settings' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'settings' ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              Settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-lg ${
              activeTab === 'history' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === 'history' ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 py-4">
        {activeTab === 'parties' && renderPartiesTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </View>
    </SafeAreaView>
  );
};

export default PaymentRemindersScreen;
