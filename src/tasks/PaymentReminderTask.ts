import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import PaymentReminderService from '../services/PaymentReminderService';

const PAYMENT_REMINDER_TASK = 'PAYMENT_REMINDER_BACKGROUND_TASK';

/**
 * Background task to check and send payment reminders
 * This runs periodically even when the app is closed
 */
TaskManager.defineTask(PAYMENT_REMINDER_TASK, async () => {
  try {
    console.log('📋 Background task: Checking for payment reminders...');
    
    const reminderService = PaymentReminderService.getInstance();
    const settings = await reminderService.getSettings();

    // Only run if auto reminders are enabled
    if (!settings.autoReminderEnabled) {
      console.log('Auto reminders disabled, skipping...');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Send reminders to due parties
    const result = await reminderService.sendAllDueReminders();
    
    console.log(`✅ Background task completed: ${result.sent} sent, ${result.failed} failed`);
    
    return result.sent > 0 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('❌ Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background task
 */
export async function registerPaymentReminderTask(): Promise<void> {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(PAYMENT_REMINDER_TASK);
    
    if (isRegistered) {
      console.log('📋 Payment reminder task already registered');
      return;
    }

    // Register the background fetch task
    await BackgroundFetch.registerTaskAsync(PAYMENT_REMINDER_TASK, {
      minimumInterval: 60 * 60 * 12, // Run every 12 hours minimum
      stopOnTerminate: false, // Continue even after app is closed
      startOnBoot: true, // Start on device boot
    });

    console.log('✅ Payment reminder background task registered successfully');
  } catch (error) {
    console.error('❌ Failed to register background task:', error);
  }
}

/**
 * Unregister the background task
 */
export async function unregisterPaymentReminderTask(): Promise<void> {
  try {
    await TaskManager.unregisterTaskAsync(PAYMENT_REMINDER_TASK);
    console.log('✅ Payment reminder background task unregistered');
  } catch (error) {
    console.error('❌ Failed to unregister background task:', error);
  }
}

/**
 * Check background task status
 */
export async function getBackgroundTaskStatus(): Promise<{
  isRegistered: boolean;
  status?: any;
}> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(PAYMENT_REMINDER_TASK);
    
    if (isRegistered) {
      const status = await BackgroundFetch.getStatusAsync();
      return { isRegistered: true, status };
    }
    
    return { isRegistered: false };
  } catch (error) {
    console.error('Error checking background task status:', error);
    return { isRegistered: false };
  }
}

export default PAYMENT_REMINDER_TASK;
