import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  addDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getFirebaseDb, isFirebaseInitialized } from '../../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReminderSettings {
  enabled: boolean;
  minimumBalance: number; // Only remind if balance >= this amount
  reminderFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  reminderTime: { hour: number; minute: number }; // When to send reminders
  gracePeriodDays: number; // Days before starting reminders after bill creation
  autoReminderEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
}

export interface PartyWithReminder {
  id: string;
  personName: string;
  businessName: string;
  phoneNumber: string;
  balanceDue: number;
  lastReminderSent?: Timestamp;
  reminderCount?: number;
  nextReminderDate?: Timestamp;
  overduedays?: number;
}

export interface ReminderLog {
  id?: string;
  partyId: string;
  partyName: string;
  balanceDue: number;
  reminderType: 'push' | 'whatsapp' | 'sms';
  sentAt: Timestamp;
  status: 'sent' | 'failed';
  message: string;
}

class PaymentReminderService {
  private static instance: PaymentReminderService;
  private readonly SETTINGS_KEY = '@payment_reminder_settings';
  private readonly COLLECTION_NAME = 'person_details';
  private readonly REMINDER_LOGS_COLLECTION = 'reminder_logs';

  private constructor() {
    this.initializeNotifications();
  }

  public static getInstance(): PaymentReminderService {
    if (!PaymentReminderService.instance) {
      PaymentReminderService.instance = new PaymentReminderService();
    }
    return PaymentReminderService.instance;
  }

  /**
   * Initialize notification handling
   */
  private async initializeNotifications() {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Request permissions
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return;
      }

      // Android specific channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('payment-reminders', {
          name: 'Payment Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }
    }
  }

  /**
   * Get reminder settings
   */
  async getSettings(): Promise<ReminderSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (settingsJson) {
        return JSON.parse(settingsJson);
      }
      
      // Default settings
      return {
        enabled: true,
        minimumBalance: 100,
        reminderFrequency: 'weekly',
        reminderTime: { hour: 10, minute: 0 },
        gracePeriodDays: 7,
        autoReminderEnabled: true,
        whatsappEnabled: true,
        smsEnabled: false,
      };
    } catch (error) {
      console.error('Error getting reminder settings:', error);
      throw error;
    }
  }

  /**
   * Update reminder settings
   */
  async updateSettings(settings: Partial<ReminderSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(newSettings));
      
      // Reschedule reminders with new settings
      if (newSettings.autoReminderEnabled) {
        await this.scheduleAutomaticReminders();
      } else {
        await this.cancelAllScheduledReminders();
      }
    } catch (error) {
      console.error('Error updating reminder settings:', error);
      throw error;
    }
  }

  /**
   * Get parties with outstanding balance
   */
  async getPartiesWithBalance(): Promise<PartyWithReminder[]> {
    try {
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        console.log('📴 Firebase not initialized');
        return [];
      }

      const settings = await this.getSettings();
      
      const partiesRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        partiesRef,
        where('balanceDue', '>=', settings.minimumBalance),
        orderBy('balanceDue', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const parties: PartyWithReminder[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        parties.push({
          id: doc.id,
          personName: data.personName || '',
          businessName: data.businessName || '',
          phoneNumber: data.phoneNumber || '',
          balanceDue: data.balanceDue || 0,
          lastReminderSent: data.lastReminderSent,
          reminderCount: data.reminderCount || 0,
          nextReminderDate: data.nextReminderDate,
          overduedays: data.createdAt
            ? Math.floor((Date.now() - data.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        });
      });

      console.log(`Found ${parties.length} parties with outstanding balance`);
      return parties;
    } catch (error) {
      console.error('Error getting parties with balance:', error);
      return [];
    }
  }

  /**
   * Get parties due for reminder based on settings
   */
  async getPartiesDueForReminder(): Promise<PartyWithReminder[]> {
    try {
      const allParties = await this.getPartiesWithBalance();
      const settings = await this.getSettings();
      const now = new Date();

      return allParties.filter((party) => {
        // Check if party meets minimum balance
        if (party.balanceDue < settings.minimumBalance) {
          return false;
        }

        // Check grace period (if never reminded before)
        if (!party.lastReminderSent && party.overduedays! < settings.gracePeriodDays) {
          return false;
        }

        // Check if next reminder date has passed
        if (party.nextReminderDate) {
          const nextDate = party.nextReminderDate.toDate();
          if (nextDate > now) {
            return false; // Not due yet
          }
        }

        // Check frequency since last reminder
        if (party.lastReminderSent) {
          const lastSent = party.lastReminderSent.toDate();
          const daysSinceLastReminder = Math.floor(
            (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
          );

          const frequencyDays = this.getFrequencyInDays(settings.reminderFrequency);
          if (daysSinceLastReminder < frequencyDays) {
            return false; // Too soon
          }
        }

        return true;
      });
    } catch (error) {
      console.error('Error getting parties due for reminder:', error);
      return [];
    }
  }

  /**
   * Convert frequency to days
   */
  private getFrequencyInDays(frequency: ReminderSettings['reminderFrequency']): number {
    switch (frequency) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'biweekly':
        return 14;
      case 'monthly':
        return 30;
      default:
        return 7;
    }
  }

  /**
   * Send reminder notification for a party
   */
  async sendReminderNotification(party: PartyWithReminder): Promise<boolean> {
    try {
      const message = this.generateReminderMessage(party);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💰 Payment Reminder',
          body: message,
          data: { partyId: party.id, type: 'payment_reminder' },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });

      // Update party reminder tracking
      await this.updatePartyReminderTracking(party.id);

      // Log the reminder
      await this.logReminder({
        partyId: party.id,
        partyName: party.personName,
        balanceDue: party.balanceDue,
        reminderType: 'push',
        sentAt: Timestamp.now(),
        status: 'sent',
        message,
      });

      console.log(`✅ Reminder sent for ${party.personName}`);
      return true;
    } catch (error) {
      console.error('Error sending reminder notification:', error);
      
      // Log failed attempt
      await this.logReminder({
        partyId: party.id,
        partyName: party.personName,
        balanceDue: party.balanceDue,
        reminderType: 'push',
        sentAt: Timestamp.now(),
        status: 'failed',
        message: String(error),
      });

      return false;
    }
  }

  /**
   * Generate reminder message
   */
  private generateReminderMessage(party: PartyWithReminder): string {
    const amount = party.balanceDue.toFixed(2);
    const name = party.personName || party.businessName;
    
    return `${name} has an outstanding balance of ₹${amount}. Please follow up for payment collection.`;
  }

  /**
   * Update party reminder tracking in Firebase
   */
  private async updatePartyReminderTracking(partyId: string): Promise<void> {
    try {
      const db = getFirebaseDb();
      if (!db) return;

      const settings = await this.getSettings();
      const frequencyDays = this.getFrequencyInDays(settings.reminderFrequency);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + frequencyDays);

      const partyRef = doc(db, this.COLLECTION_NAME, partyId);
      
      // Get current reminder count
      const currentParty = (await getPartiesWithBalance()).find(p => p.id === partyId);
      const reminderCount = (currentParty?.reminderCount || 0) + 1;

      await updateDoc(partyRef, {
        lastReminderSent: Timestamp.now(),
        nextReminderDate: Timestamp.fromDate(nextDate),
        reminderCount,
      });
    } catch (error) {
      console.error('Error updating party reminder tracking:', error);
    }
  }

  /**
   * Log reminder to Firebase
   */
  private async logReminder(log: ReminderLog): Promise<void> {
    try {
      const db = getFirebaseDb();
      if (!db) return;

      await addDoc(collection(db, this.REMINDER_LOGS_COLLECTION), log);
    } catch (error) {
      console.error('Error logging reminder:', error);
    }
  }

  /**
   * Get reminder logs
   */
  async getReminderLogs(limitCount: number = 50): Promise<ReminderLog[]> {
    try {
      const db = getFirebaseDb();
      if (!isFirebaseInitialized() || !db) {
        return [];
      }

      const logsRef = collection(db, this.REMINDER_LOGS_COLLECTION);
      const q = query(logsRef, orderBy('sentAt', 'desc'), limit(limitCount));

      const querySnapshot = await getDocs(q);
      const logs: ReminderLog[] = [];

      querySnapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data(),
        } as ReminderLog);
      });

      return logs;
    } catch (error) {
      console.error('Error getting reminder logs:', error);
      return [];
    }
  }

  /**
   * Schedule automatic reminders (daily check)
   */
  async scheduleAutomaticReminders(): Promise<void> {
    try {
      // Cancel existing scheduled reminders
      await this.cancelAllScheduledReminders();

      const settings = await this.getSettings();
      if (!settings.autoReminderEnabled) {
        console.log('Auto reminders disabled');
        return;
      }

      // Schedule daily reminder check
      const trigger: Notifications.DailyTriggerInput = {
        hour: settings.reminderTime.hour,
        minute: settings.reminderTime.minute,
        repeats: true,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Payment Reminder Check',
          body: 'Checking for parties with outstanding payments...',
          data: { type: 'reminder_check' },
        },
        trigger,
      });

      console.log(`✅ Scheduled automatic reminders at ${settings.reminderTime.hour}:${settings.reminderTime.minute}`);
    } catch (error) {
      console.error('Error scheduling automatic reminders:', error);
      throw error;
    }
  }

  /**
   * Cancel all scheduled reminders
   */
  async cancelAllScheduledReminders(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ Cancelled all scheduled reminders');
    } catch (error) {
      console.error('Error cancelling scheduled reminders:', error);
    }
  }

  /**
   * Send reminders to all due parties
   */
  async sendAllDueReminders(): Promise<{ sent: number; failed: number }> {
    try {
      const dueParties = await this.getPartiesDueForReminder();
      console.log(`📋 Found ${dueParties.length} parties due for reminder`);

      let sent = 0;
      let failed = 0;

      for (const party of dueParties) {
        const success = await this.sendReminderNotification(party);
        if (success) {
          sent++;
        } else {
          failed++;
        }
        
        // Add small delay between notifications
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ Reminders sent: ${sent}, failed: ${failed}`);
      return { sent, failed };
    } catch (error) {
      console.error('Error sending all due reminders:', error);
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Get WhatsApp message link
   */
  getWhatsAppLink(party: PartyWithReminder): string {
    const message = this.generateWhatsAppMessage(party);
    const phoneNumber = party.phoneNumber.replace(/\D/g, '');
    return `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
  }

  /**
   * Generate WhatsApp message
   */
  private generateWhatsAppMessage(party: PartyWithReminder): string {
    const amount = party.balanceDue.toFixed(2);
    const name = party.personName || party.businessName;
    
    return `Dear ${name},\n\nThis is a gentle reminder regarding your outstanding payment of ₹${amount}.\n\nKindly arrange the payment at your earliest convenience.\n\nThank you for your business!\n\nBest regards,\nYour Business Name`;
  }

  /**
   * Test notification
   */
  async sendTestNotification(): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Payment Reminder',
        body: 'This is a test reminder notification. System is working!',
        data: { type: 'test' },
      },
      trigger: null,
    });
  }
}

export default PaymentReminderService;

// Helper function to be used in background tasks
async function getPartiesWithBalance() {
  return PaymentReminderService.getInstance().getPartiesWithBalance();
}
