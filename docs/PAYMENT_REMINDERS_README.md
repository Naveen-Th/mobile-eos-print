# 💰 Payment Reminders System - Complete Guide

## 🎉 What's Been Built

Your Thermal Receipt Printer mobile app now has a **fully automated Payment Reminders System** to help you collect payments from parties with outstanding balances!

## 📦 New Dependencies Installed

```json
{
  "expo-notifications": "~0.28.0",
  "expo-device": "~6.0.2",
  "expo-task-manager": "~11.8.2",
  "expo-background-fetch": "~12.0.1"
}
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Payment Reminders System               │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐        ┌─────▼─────┐      ┌─────▼─────┐
   │  Screen │        │  Service  │      │   Tasks   │
   │   UI    │───────▶│  Logic    │◀─────│Background │
   └─────────┘        └───────────┘      └───────────┘
        │                   │                   │
        │              ┌────▼────┐              │
        │              │Firebase │              │
        └──────────────┤person_  │──────────────┘
                       │details  │
                       └─────────┘
```

## 📁 Files Created

### 1. **Core Service**
- `src/services/PaymentReminderService.ts` (528 lines)
  - Fetch parties with outstanding balance
  - Send push notifications
  - WhatsApp integration
  - Settings management
  - Reminder history logging
  - Automatic scheduling

### 2. **User Interface**
- `src/screens/PaymentRemindersScreen.tsx` (615 lines)
  - Three tabs: Parties, Settings, History
  - Beautiful card-based UI
  - Real-time data updates
  - Manual and bulk reminder sending

### 3. **Background Tasks**
- `src/tasks/PaymentReminderTask.ts` (98 lines)
  - Background reminder checks
  - Runs even when app is closed
  - Configurable intervals

### 4. **Navigation Updates**
- Updated `src/layout/AppLayout.tsx` - Added screen route
- Updated `src/app/(tabs)/settings.tsx` - Added menu item

## ✨ Key Features

### 1. **Smart Filtering**
- ✅ Minimum balance threshold (₹100, ₹500, ₹1000, ₹5000)
- ✅ Grace period (3, 7, 14, 30 days)
- ✅ Configurable frequency (Daily, Weekly, Bi-weekly, Monthly)
- ✅ Automatic reminder scheduling

### 2. **Multiple Reminder Methods**
- 💬 **Push Notifications** - In-app reminders to yourself
- 📱 **WhatsApp** - Direct WhatsApp link with pre-filled message
- 📧 **SMS** - Coming soon

### 3. **Party Management**
- View all parties with outstanding balance
- See "Due for Reminder" parties separately
- Track reminder count per party
- View last reminder sent date
- Calculate days overdue

### 4. **Automation**
- ⏰ Set reminder time (default: 10:00 AM)
- 🔄 Automatic daily checks
- 📋 Background task execution
- 🔕 Easy enable/disable toggle

### 5. **Reminder History**
- Complete audit trail
- Success/failure tracking
- View sent messages
- Timestamp tracking

## 🚀 How to Use

### Step 1: Access Payment Reminders

1. Open the app
2. Go to **Settings** tab
3. Tap **"Payment Reminders"**
4. Or navigate directly from home screen

### Step 2: Configure Settings

1. Tap the **"Settings"** tab
2. Configure your preferences:
   - **Auto Reminders**: Enable/Disable automatic reminders
   - **Minimum Balance**: Set threshold (e.g., ₹500)
   - **Frequency**: Choose how often to remind (e.g., Weekly)
   - **Grace Period**: Days to wait before first reminder (e.g., 7 days)
3. Tap **"Send Test Notification"** to verify it works

### Step 3: View Parties Due for Payment

1. Tap the **"Parties"** tab
2. See summary cards:
   - **Due Now**: Parties that need reminders today
   - **Total Overdue**: All parties with balances
   - **Total Due**: Sum of all outstanding balances
3. View party cards with:
   - Name and business name
   - Phone number
   - Balance amount
   - Days overdue
   - Last reminder date
   - Reminder count

### Step 4: Send Reminders

#### Manual Single Reminder
1. Find the party in the list
2. Tap **"Send Reminder"** button
3. Choose:
   - **Push Notification**: Immediate notification to you
   - **WhatsApp**: Opens WhatsApp with pre-filled message

#### Bulk Reminders
1. Tap the **"Send All Reminders"** button at the top
2. Confirms how many reminders will be sent
3. All due parties receive reminders automatically

### Step 5: Track History

1. Tap the **"History"** tab
2. View all sent reminders with:
   - Party name and balance
   - Reminder type (Push/WhatsApp/SMS)
   - Status (Sent/Failed)
   - Timestamp
   - Message preview

## 🔧 Technical Details

### Firebase Collections

#### `person_details` (Existing - Enhanced)
New fields added for reminder tracking:
```typescript
{
  id: string;
  personName: string;
  businessName: string;
  phoneNumber: string;
  balanceDue: number;
  lastReminderSent?: Timestamp;     // NEW
  reminderCount?: number;            // NEW
  nextReminderDate?: Timestamp;      // NEW
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `reminder_logs` (New Collection)
```typescript
{
  id: string;
  partyId: string;
  partyName: string;
  balanceDue: number;
  reminderType: 'push' | 'whatsapp' | 'sms';
  sentAt: Timestamp;
  status: 'sent' | 'failed';
  message: string;
}
```

### Settings (AsyncStorage)
```typescript
{
  enabled: boolean;
  minimumBalance: number;
  reminderFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  reminderTime: { hour: number; minute: number };
  gracePeriodDays: number;
  autoReminderEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
}
```

### Notification Permissions

The system automatically requests notification permissions on first use. On:
- **iOS**: Shows system permission dialog
- **Android**: Creates notification channel for high-priority reminders

### Background Tasks

The background task runs:
- **Minimum Interval**: 12 hours
- **Conditions**: Only when auto-reminders enabled
- **Behavior**: Checks for due reminders and sends them
- **Platform Support**: iOS (limited), Android (full)

## 📱 Platform-Specific Notes

### iOS
- Background tasks are **limited** by iOS
- May not run exactly on schedule
- Best for testing: Keep app in foreground
- Production: Users should open app regularly

### Android
- Full background task support
- Reliable scheduled execution
- Notification channels for priority
- Works even when app is closed

## 🧪 Testing Guide

### Test 1: Basic Notification
1. Go to **Settings** tab in Payment Reminders
2. Tap **"Send Test Notification"**
3. You should see a test notification immediately
4. ✅ Success: Notification appears

### Test 2: WhatsApp Integration
1. Add a party with balance in `person_details`
2. Ensure party has valid phone number
3. Go to **Parties** tab
4. Tap party's WhatsApp button (green)
5. ✅ Success: WhatsApp opens with pre-filled message

### Test 3: Manual Reminder
1. Create a test party with `balanceDue >= 100`
2. Go to **Parties** tab
3. Tap **"Send Reminder"** on the party
4. Choose **"Push Notification"**
5. ✅ Success: Notification sent, logged in History

### Test 4: Bulk Reminders
1. Create multiple parties with balances
2. Wait for grace period to pass (or set to 0 days)
3. Go to **Parties** tab
4. Tap **"Send All Reminders"**
5. ✅ Success: All reminders sent, count displayed

### Test 5: Auto Reminders
1. Enable **"Auto Reminders"** in Settings
2. Set **Reminder Time** to current time + 2 minutes
3. Wait for scheduled time
4. ✅ Success: Notification appears at scheduled time

### Test 6: Frequency Logic
1. Send a reminder to a party
2. Check `lastReminderSent` is updated in Firebase
3. Try to send again immediately
4. ✅ Success: Party not in "Due Now" list (respects frequency)

## 🎯 WhatsApp Message Template

Default message sent:
```
Dear [Party Name],

This is a gentle reminder regarding your outstanding payment of ₹[Amount].

Kindly arrange the payment at your earliest convenience.

Thank you for your business!

Best regards,
Your Business Name
```

**Customization**: Edit `generateWhatsAppMessage()` in `PaymentReminderService.ts`

## 📊 Expected Behavior

### When Auto-Reminders are Enabled:
1. App checks for due reminders at scheduled time (default: 10:00 AM)
2. Fetches all parties with `balanceDue >= minimumBalance`
3. Filters by grace period and frequency
4. Sends push notifications to each due party
5. Updates `lastReminderSent`, `reminderCount`, `nextReminderDate` in Firebase
6. Logs each reminder in `reminder_logs` collection

### Frequency Logic:
- **Daily**: Remind again after 1 day
- **Weekly**: Remind again after 7 days
- **Bi-weekly**: Remind again after 14 days  
- **Monthly**: Remind again after 30 days

### Grace Period:
- Party created on Day 0
- Grace period = 7 days
- First reminder sent on Day 7 (if balance >= threshold)
- Subsequent reminders follow frequency setting

## 🔐 Permissions Required

### Android
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### iOS
```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>processing</string>
</array>
```

These are handled automatically by Expo.

## 🐛 Troubleshooting

### Notifications Not Showing
1. Check notification permissions: Settings → App → Notifications
2. Verify test notification works
3. Check console logs for errors
4. Ensure device is not in Do Not Disturb mode

### WhatsApp Not Opening
1. Verify WhatsApp is installed
2. Check phone number format (must include country code)
3. Try `+91XXXXXXXXXX` format for Indian numbers

### Background Task Not Running
1. iOS: Background tasks are limited, test in foreground
2. Android: Check battery optimization settings
3. Verify auto-reminders are enabled in settings
4. Check logs: `await getBackgroundTaskStatus()`

### Reminders Not Respecting Frequency
1. Check Firebase `lastReminderSent` field
2. Verify frequency setting in Settings tab
3. Ensure system time is correct
4. Check console logs for filtering logic

### No Parties Showing Up
1. Verify `person_details` has parties with `balanceDue > 0`
2. Check minimum balance threshold in settings
3. Ensure Firebase connection is active
4. Try lowering minimum balance to ₹1

## 🚀 Future Enhancements

Potential features to add:

1. **SMS Integration** - Send SMS reminders
2. **Email Reminders** - Send email statements
3. **Custom Messages** - Per-party message templates
4. **Payment Links** - Include payment links in reminders
5. **Reminder Templates** - Multiple message templates
6. **Smart Timing** - Send at best time based on party's past response
7. **Escalation** - Increase frequency for very overdue parties
8. **Party Response Tracking** - Track if party pays after reminder
9. **Multi-language Support** - Reminders in party's preferred language
10. **Voice Calls** - Automated voice reminder calls

## 📈 Success Metrics

Track these to measure effectiveness:
- **Reminder Sent Rate**: Total reminders sent
- **Payment Collection Rate**: Payments received after reminders
- **Average Days to Payment**: Time from reminder to payment
- **Response Rate**: Parties who respond to reminders
- **Overdue Reduction**: % reduction in overdue balances

## 🎓 Code Examples

### Send a Single Reminder
```typescript
import PaymentReminderService from './src/services/PaymentReminderService';

const service = PaymentReminderService.getInstance();
const party = await service.getPartiesWithBalance()[0];
await service.sendReminderNotification(party);
```

### Get Reminder Statistics
```typescript
const parties = await service.getPartiesWithBalance();
const dueParties = await service.getPartiesDueForReminder();
const logs = await service.getReminderLogs(100);

console.log(`Total overdue: ${parties.length}`);
console.log(`Due for reminder: ${dueParties.length}`);
console.log(`Reminders sent: ${logs.filter(l => l.status === 'sent').length}`);
```

### Update Settings Programmatically
```typescript
await service.updateSettings({
  minimumBalance: 1000,
  reminderFrequency: 'weekly',
  gracePeriodDays: 14,
  autoReminderEnabled: true,
});
```

### Register Background Task
```typescript
import { registerPaymentReminderTask } from './src/tasks/PaymentReminderTask';

await registerPaymentReminderTask();
console.log('Background task registered!');
```

## 🎊 You're All Set!

Your Payment Reminders System is ready to use! The system will:

✅ **Automatically track** parties with outstanding balances  
✅ **Intelligently schedule** reminders based on your settings  
✅ **Send notifications** at the right time  
✅ **Support WhatsApp** for direct communication  
✅ **Log everything** for audit trails  
✅ **Work offline** with cached data  
✅ **Run in background** even when app is closed  

## 📞 Support

If you need help:
1. Check console logs for detailed error messages
2. Review this README for common issues
3. Test with the built-in test notification feature
4. Verify Firebase `person_details` has valid data

---

**Built with**: Expo • React Native • Firebase • TypeScript  
**Features**: Push Notifications • WhatsApp • Background Tasks • Offline Support  
**Status**: ✅ Production Ready
