import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PartyManagementScreen from '../../screens/PartyManagementScreen';
import PrinterSetupScreen from '../../screens/PrinterSetupScreen';
import ReceiptTemplatesScreen from '../../screens/ReceiptTemplatesScreen';
import MobileAuthService, { MobileUser } from '../../services/auth/MobileAuthService';
import TaxSettingsModal from '../../components/TaxSettingsModal';
import { getTaxRate } from '../../services/utilities/TaxSettings';
import SyncStatus from '../../components/SyncStatus';
import { useLanguage } from '../../contexts/LanguageContext';
import { Language } from '../../locales';
import CategoryManagementModal from '../../components/CategoryManagementModal';
import { useNavigation } from '@react-navigation/native';
import BalanceSyncUtility from '../../services/business/BalanceSyncUtility';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'navigation' | 'toggle' | 'info';
  icon: string;
  value?: boolean;
  onPress?: () => void;
}

interface SettingsScreenProps {
  user?: MobileUser | null;
  onLogout?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onLogout }) => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();
  const navigation = useNavigation<any>();
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [showReceiptTemplates, setShowReceiptTemplates] = useState(false);
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState<string>('U');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentTaxRate, setCurrentTaxRate] = useState<number>(8);
  const [isSyncingBalances, setIsSyncingBalances] = useState(false);
  
  useEffect(() => {
    // Use passed user prop first, then fallback to auth service
    const currentUser = user || MobileAuthService.getCurrentUser();
    if (currentUser && currentUser.email) {
      setUserEmail(currentUser.email);
      // Set initial to first character of email or display name
      setUserInitial((currentUser.displayName?.charAt(0) || currentUser.email.charAt(0) || 'U').toUpperCase());
    }

    // Load current tax rate
    loadTaxRate();
  }, [user]);

  const loadTaxRate = async () => {
    try {
      const rate = await getTaxRate();
      setCurrentTaxRate(rate);
    } catch (error) {
      console.error('Error loading tax rate:', error);
    }
  };

  const handleTaxRateUpdated = (newRate: number) => {
    setCurrentTaxRate(newRate);
  };

  const handleSyncAllBalances = async () => {
    Alert.alert(
      'Sync Customer Balances',
      'This will recalculate all customer balances from receipts and update person_details. This may take a moment. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: async () => {
            setIsSyncingBalances(true);
            try {
              const result = await BalanceSyncUtility.syncAllCustomerBalances();
              
              if (result.success) {
                Alert.alert(
                  'Sync Complete',
                  `Successfully synced ${result.syncedCount} customers.\n\nAll balances are now up to date.`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  'Sync Completed with Errors',
                  `Synced: ${result.syncedCount}\nFailed: ${result.failedCount}\n\nCheck console for details.`,
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              Alert.alert(
                'Sync Failed',
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [{ text: 'OK' }]
              );
            } finally {
              setIsSyncingBalances(false);
            }
          }
        }
      ]
    );
  };

  const handleBalanceReport = async () => {
    setIsSyncingBalances(true);
    try {
      const report = await BalanceSyncUtility.generateBalanceReport();
      
      const discrepancyCount = report.customers.filter(c => c.hasDiscrepancy).length;
      
      Alert.alert(
        'Balance Report',
        `Total Customers: ${report.customers.length}\n` +
        `Total Balance (Receipts): ₹${report.totalReceiptsBalance.toFixed(2)}\n` +
        `Total Balance (Person Details): ₹${report.totalPersonDetailsBalance.toFixed(2)}\n` +
        `Discrepancies: ${discrepancyCount} customers\n\n` +
        `${discrepancyCount > 0 ? 'Run "Sync All Balances" to fix discrepancies.' : '✅ All balances are in sync!'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Report Failed',
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSyncingBalances(false);
    }
  };
  
  const settingsData: SettingItem[] = [
    {
      id: '1',
      title: t('settings.printerConfiguration'),
      subtitle: t('settings.printerConfigurationSubtitle'),
      type: 'navigation',
      icon: 'print-outline',
      onPress: () => setShowPrinterSetup(true),
    },
    {
      id: '2',
      title: t('settings.taxSettings'),
      subtitle: t('settings.taxSettingsSubtitle', { rate: currentTaxRate }),
      type: 'navigation',
      icon: 'calculator-outline',
      onPress: () => setShowTaxSettings(true),
    },
    {
      id: '3',
      title: t('settings.storeInformation'),
      subtitle: t('settings.storeInformationSubtitle'),
      type: 'navigation',
      icon: 'storefront-outline',
      onPress: () => console.log('Store info pressed'),
    },
    {
      id: '4',
      title: t('settings.partyName'),
      subtitle: t('settings.partyNameSubtitle'),
      type: 'navigation',
      icon: 'people-outline',
      onPress: () => setShowPartyManagement(true),
    },
    {
      id: '4a',
      title: 'Categories',
      subtitle: 'Manage item categories',
      type: 'navigation',
      icon: 'folder-outline',
      onPress: () => setShowCategoryManagement(true),
    },
    {
      id: '4b',
      title: 'Pending Bills',
      subtitle: 'View customer balances',
      type: 'navigation',
      icon: 'wallet-outline',
      onPress: () => {
        try {
          navigation.navigate('PendingBillsScreen');
        } catch (e) {
          console.warn('Navigation failed:', e);
        }
      },
    },
    {
      id: '4c',
      title: 'Analytics',
      subtitle: 'View sales reports',
      type: 'navigation',
      icon: 'stats-chart-outline',
      onPress: () => {
        try {
          navigation.navigate('AnalyticsScreen');
        } catch (e) {
          console.warn('Navigation failed:', e);
        }
      },
    },
    {
      id: '4d',
      title: 'Payment Reminders',
      subtitle: 'Automate payment collection',
      type: 'navigation',
      icon: 'notifications-outline',
      onPress: () => {
        try {
          navigation.navigate('PaymentRemindersScreen');
        } catch (e) {
          console.warn('Navigation failed:', e);
        }
      },
    },
    {
      id: '5',
      title: t('settings.receiptTemplate'),
      subtitle: t('settings.receiptTemplateSubtitle'),
      type: 'navigation',
      icon: 'receipt-outline',
      onPress: () => setShowReceiptTemplates(true),
    },
    {
      id: '6',
      title: t('settings.autoPrint'),
      subtitle: t('settings.autoPrintSubtitle'),
      type: 'toggle',
      icon: 'flash-outline',
      value: true,
    },
    {
      id: '7',
      title: t('settings.soundNotifications'),
      subtitle: t('settings.soundNotificationsSubtitle'),
      type: 'toggle',
      icon: 'volume-medium-outline',
      value: false,
    },
    {
      id: '8',
      title: t('settings.language'),
      subtitle: availableLanguages[language],
      type: 'navigation',
      icon: 'language-outline',
      onPress: () => setShowLanguageModal(true),
    },
    {
      id: '9',
      title: t('settings.sync'),
      subtitle: t('settings.syncSubtitle'),
      type: 'navigation',
      icon: 'sync-outline',
      onPress: () => setShowSyncStatus(true),
    },
    {
      id: '9d',
      title: '🔄 Sync All Balances',
      subtitle: 'Fix customer balance discrepancies',
      type: 'navigation',
      icon: 'sync-circle-outline',
      onPress: handleSyncAllBalances,
    },
    {
      id: '9e',
      title: '📊 Balance Report',
      subtitle: 'Check for balance discrepancies',
      type: 'navigation',
      icon: 'analytics-outline',
      onPress: handleBalanceReport,
    },
    {
      id: '10',
      title: t('settings.backupData'),
      subtitle: t('settings.backupDataSubtitle'),
      type: 'navigation',
      icon: 'cloud-upload-outline',
      onPress: () => console.log('Backup pressed'),
    },
    {
      id: '11',
      title: t('settings.appVersion'),
      subtitle: '1.0.0',
      type: 'info',
      icon: 'information-circle-outline',
    },
  ];

  const handleLanguageChange = async (lang: Language) => {
    try {
      await setLanguage(lang);
      setShowLanguageModal(false);
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(
        'Error',
        'Failed to change language. Please try again.',
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      t('settings.signOut'),
      t('settings.signOutConfirm'),
      [
        {
          text: t('settings.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              console.log('Sign out pressed');
              // Use the onLogout prop if available, otherwise use the auth service directly
              if (onLogout) {
                // onLogout might be async, so we await it
                await onLogout();
              } else {
                await MobileAuthService.signOut();
              }
              console.log('Sign out successful');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert(
                'Sign Out Error',
                'Failed to sign out. Please try again.',
                [{ text: t('common.ok') }]
              );
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const renderSettingItem = (item: SettingItem) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.settingItem}
        onPress={item.onPress}
        disabled={item.type === 'info'}
        activeOpacity={item.type === 'info' ? 1 : 0.7}
      >
        <View style={styles.settingLeft}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={item.icon as any} 
              size={20} 
              color="#2563eb" 
            />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{item.title}</Text>
            {item.subtitle && (
              <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
            )}
          </View>
        </View>

        <View style={styles.settingRight}>
          {item.type === 'toggle' && (
            <Switch
              value={item.value}
              onValueChange={(value) => {
                console.log(`Toggle ${item.title}: ${value}`);
              }}
              trackColor={{ false: '#e5e7eb', true: '#2563eb' }}
              thumbColor={item.value ? '#ffffff' : '#f4f3f4'}
            />
          )}
          {item.type === 'navigation' && (
            <Ionicons name="chevron-forward-outline" size={16} color="#9ca3af" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileIcon}>
            <Text style={styles.profileInitial}>{userInitial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userEmail || 'User Email'}</Text>
            <Text style={styles.profileRole}>{t('settings.viewer')}</Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{t('settings.appSettings')}</Text>
          <View style={styles.settingsCard}>
            {settingsData.slice(0, 5).map(renderSettingItem)}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{t('settings.preferences')}</Text>
          <View style={styles.settingsCard}>
            {settingsData.slice(5, 8).map(renderSettingItem)}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{t('settings.dataAndInfo')}</Text>
          <View style={styles.settingsCard}>
            {settingsData.slice(8).map(renderSettingItem)}
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity 
            style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]} 
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            )}
            <Text style={styles.signOutText}>
              {isSigningOut ? t('settings.signingOut') : t('settings.signOut')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Party Management Modal */}
      <Modal
        visible={showPartyManagement}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPartyManagement(false)}
      >
        <PartyManagementScreen onBack={() => setShowPartyManagement(false)} />
      </Modal>
      
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
      
      {/* Tax Settings Modal */}
      <TaxSettingsModal
        visible={showTaxSettings}
        onClose={() => setShowTaxSettings(false)}
        onTaxRateUpdated={handleTaxRateUpdated}
      />
      
      {/* Receipt Templates Modal */}
      <Modal
        visible={showReceiptTemplates}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReceiptTemplates(false)}
      >
        <ReceiptTemplatesScreen onBack={() => setShowReceiptTemplates(false)} />
      </Modal>
      
      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          {/* Header */}
          <View style={{
            backgroundColor: 'white',
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
                {t('settings.language')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowLanguageModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f3f4f6',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 18, color: '#6b7280' }}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {Object.entries(availableLanguages).map(([code, name]) => (
              <TouchableOpacity
                key={code}
                style={{
                  backgroundColor: 'white',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: language === code ? 2 : 1,
                  borderColor: language === code ? '#2563eb' : '#e5e7eb',
                }}
                onPress={() => handleLanguageChange(code as Language)}
              >
                <Text style={{ fontSize: 16, fontWeight: language === code ? '600' : '400', color: '#111827' }}>
                  {name}
                </Text>
                {language === code && (
                  <Ionicons name="checkmark-circle" size={24} color="#2563eb" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
      
      {/* Category Management Modal */}
      <CategoryManagementModal
        visible={showCategoryManagement}
        onClose={() => setShowCategoryManagement(false)}
      />

      {/* Sync Status Modal - using Modal wrapper */}
      <Modal
        visible={showSyncStatus}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSyncStatus(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          {/* Header */}
          <View style={{
            backgroundColor: 'white',
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
                Sync Status
              </Text>
              <TouchableOpacity
                onPress={() => setShowSyncStatus(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f3f4f6',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 18, color: '#6b7280' }}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
              Data synchronization will sync your receipts, items, and settings across devices.
            </Text>
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 14, color: '#111827', marginBottom: 8 }}>• Real-time sync with cloud</Text>
              <Text style={{ fontSize: 14, color: '#111827', marginBottom: 8 }}>• Offline support</Text>
              <Text style={{ fontSize: 14, color: '#111827', marginBottom: 8 }}>• Automatic backup</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollContent: {
    paddingVertical: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#2563eb',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#f0f9ff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  settingRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
});

export default SettingsScreen;
