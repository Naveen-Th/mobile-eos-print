# 💰 Payment Reminders - Quick Start Guide

## ⚡ Get Started in 5 Minutes

### Step 1: Run the App
```bash
npm start
# or
npx expo start
```

### Step 2: Access Payment Reminders
1. Open the app
2. Go to **Settings** tab (bottom navigation)
3. Scroll down and tap **"Payment Reminders"**

### Step 3: Test Notifications
1. In Payment Reminders, tap **Settings** tab
2. Scroll down and tap **"Send Test Notification"**
3. ✅ You should see a notification appear!

### Step 4: Add Test Data (Optional)
If you don't have any parties with balances, add one:

```bash
# Option 1: Via Firebase Console
1. Go to Firebase Console
2. Navigate to Firestore
3. Add a document to `person_details`:
   {
     personName: "Test Customer",
     businessName: "Test Business",
     phoneNumber: "+919876543210",
     balanceDue: 1500,
     createdAt: (current timestamp),
     updatedAt: (current timestamp)
   }

# Option 2: Via Your App
1. Use existing party management features
2. Create a receipt with balance due
```

### Step 5: Send Your First Reminder
1. Go to **Parties** tab in Payment Reminders
2. You should see your test party
3. Tap **"Send Reminder"**
4. Choose **"Push Notification"**
5. ✅ Notification sent!

### Step 6: Try WhatsApp (Optional)
1. Make sure party has valid phone number
2. Tap the green WhatsApp button
3. ✅ WhatsApp opens with pre-filled message!

### Step 7: Enable Auto-Reminders
1. Go to **Settings** tab
2. Toggle **"Auto Reminders"** ON
3. Configure:
   - Minimum Balance: ₹500
   - Frequency: Weekly
   - Grace Period: 7 days
4. ✅ System will now auto-remind!

## 📋 Quick Settings Reference

### Recommended Settings for Testing
```
Auto Reminders: ON
Minimum Balance: ₹100 (low for testing)
Frequency: Daily (quick testing)
Grace Period: 0 days (immediate reminders)
```

### Recommended Settings for Production
```
Auto Reminders: ON
Minimum Balance: ₹500
Frequency: Weekly
Grace Period: 7 days
```

## 🧪 Quick Tests

### Test 1: Basic Notification (30 seconds)
```
Settings → Send Test Notification
Expected: Notification appears
```

### Test 2: Manual Reminder (1 minute)
```
1. Add party with balance ₹500
2. Parties → Send Reminder
Expected: Notification appears, logged in History
```

### Test 3: WhatsApp (1 minute)
```
1. Parties → Tap WhatsApp button
Expected: WhatsApp opens with message
```

### Test 4: Bulk Reminders (2 minutes)
```
1. Add 3 parties with balances
2. Set Grace Period to 0 days
3. Parties → Send All Reminders
Expected: All reminders sent
```

## 🎯 Common Use Cases

### Use Case 1: Daily Follow-ups
```
Perfect for: Aggressive collection
Settings:
  - Frequency: Daily
  - Minimum Balance: ₹100
  - Grace Period: 3 days
```

### Use Case 2: Weekly Check-ins
```
Perfect for: Regular businesses
Settings:
  - Frequency: Weekly
  - Minimum Balance: ₹500
  - Grace Period: 7 days
```

### Use Case 3: Monthly Statements
```
Perfect for: Credit customers
Settings:
  - Frequency: Monthly
  - Minimum Balance: ₹1000
  - Grace Period: 30 days
```

## 🚨 Troubleshooting

### No Notification Appearing?
```bash
# Check 1: Permissions
Settings → App → Notifications → Enable

# Check 2: Console logs
Look for: "✅ Reminder sent for [name]"

# Check 3: Test notification
Settings tab → Send Test Notification
```

### No Parties Showing?
```bash
# Check 1: Firebase data
Firebase Console → person_details → Check balanceDue > 0

# Check 2: Minimum balance
Settings tab → Lower to ₹1

# Check 3: Connection
Ensure app is online
```

### WhatsApp Not Opening?
```bash
# Check 1: WhatsApp installed
Verify WhatsApp is on device

# Check 2: Phone number format
Should be: +919876543210

# Check 3: Try manual
Open WhatsApp and paste message
```

## 📱 Platform Notes

### iOS
- Notifications work great in foreground
- Background limited by iOS
- Test with app open first

### Android
- Full background support
- Notifications work when app closed
- Check battery optimization settings

## 🎓 Next Steps

1. ✅ **Test with real data** - Use your actual parties
2. ✅ **Customize messages** - Edit `PaymentReminderService.ts`
3. ✅ **Set up automation** - Enable auto-reminders
4. ✅ **Track results** - Monitor History tab
5. ✅ **Adjust settings** - Fine-tune based on results

## 📞 Need Help?

Read the full documentation:
```
PAYMENT_REMINDERS_README.md
```

Check console logs:
```bash
# Look for these prefixes:
📋 - Reminder checks
✅ - Successful operations
❌ - Errors
💰 - Payment updates
```

## 🎊 You're Ready!

The Payment Reminders System is now active and ready to help you collect payments automatically!

---

**Time to get started**: 5 minutes  
**Difficulty**: Easy  
**Impact**: High - Automated payment collections!
