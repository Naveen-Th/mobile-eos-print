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
import MobileAuthService, { MobileUser } from '../../services/MobileAuthService';
import TaxSettingsModal from '../../components/TaxSettingsModal';
import { getTaxRate } from '../../services/TaxSettings';

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
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
  const [showTaxSettings, setShowTaxSettings] = useState(false);
  const [showReceiptTemplates, setShowReceiptTemplates] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState<string>('U');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentTaxRate, setCurrentTaxRate] = useState<number>(8);
  
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
  
  const settingsData: SettingItem[] = [
    {
      id: '1',
      title: 'Printer Configuration',
      subtitle: 'Configure thermal printers',
      type: 'navigation',
      icon: 'print-outline',
      onPress: () => setShowPrinterSetup(true),
    },
    {
      id: '2',
      title: 'Tax Settings',
      subtitle: `Current rate: ${currentTaxRate}%`,
      type: 'navigation',
      icon: 'calculator-outline',
      onPress: () => setShowTaxSettings(true),
    },
    {
      id: '3',
      title: 'Store Information',
      subtitle: 'Update store details',
      type: 'navigation',
      icon: 'storefront-outline',
      onPress: () => console.log('Store info pressed'),
    },
    {
      id: '4',
      title: 'Party Name',
      subtitle: 'Manage party details',
      type: 'navigation',
      icon: 'people-outline',
      onPress: () => setShowPartyManagement(true),
    },
    {
      id: '5',
      title: 'Receipt Template',
      subtitle: 'Customize receipt format',
      type: 'navigation',
      icon: 'receipt-outline',
      onPress: () => setShowReceiptTemplates(true),
    },
    {
      id: '6',
      title: 'Auto Print',
      subtitle: 'Automatically print receipts',
      type: 'toggle',
      icon: 'flash-outline',
      value: true,
    },
    {
      id: '7',
      title: 'Sound Notifications',
      subtitle: 'Play sound for print confirmations',
      type: 'toggle',
      icon: 'volume-medium-outline',
      value: false,
    },
    {
      id: '8',
      title: 'Backup Data',
      subtitle: 'Backup receipts and settings',
      type: 'navigation',
      icon: 'cloud-upload-outline',
      onPress: () => console.log('Backup pressed'),
    },
    {
      id: '9',
      title: 'App Version',
      subtitle: '1.0.0',
      type: 'info',
      icon: 'information-circle-outline',
    },
  ];

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
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
                [{ text: 'OK' }]
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileIcon}>
            <Text style={styles.profileInitial}>{userInitial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userEmail || 'User Email'}</Text>
            <Text style={styles.profileRole}>Viewer</Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          <View style={styles.settingsCard}>
            {settingsData.slice(0, 5).map(renderSettingItem)}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsCard}>
            {settingsData.slice(5, 7).map(renderSettingItem)}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Data & Info</Text>
          <View style={styles.settingsCard}>
            {settingsData.slice(7).map(renderSettingItem)}
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
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
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
