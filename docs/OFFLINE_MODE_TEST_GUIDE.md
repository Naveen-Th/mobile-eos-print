# 🧪 Offline Mode Testing Guide

## What Was Fixed

The issue was that **Firebase was being initialized at module import time**, before we could check if the device was online or offline. This caused the "Can't connect to internet" error screen to appear when starting the app offline.

### Changes Made

1. **`firebase.ts`** - Made Firebase initialization **lazy and on-demand**:
   - Firebase is no longer initialized when the module loads
   - Added `initializeFirebase()` function to manually trigger initialization
   - Firebase only initializes when explicitly called (and we're online)

2. **`MobileAuthService.ts`** - Added `initializeFirebase()` method:
   - Wraps the Firebase initialization call
   - Only called when the app is online

3. **`MobileApp.tsx`** - Initialize Firebase conditionally:
   - Only calls `initializeFirebase()` when `isConnected === true`
   - Waits for network state to settle before checking
   - Falls back to offline mode with AsyncStorage session

4. **`SignInForm.tsx`** - Smart sign-in handling:
   - Shows alert if trying to sign in while offline
   - Initializes Firebase before attempting sign-in
   - Only allows first-time sign-in when online

---

## 🎯 How It Works Now

### Scenario 1: App Starts Offline (With Cached Session)

```
1. App loads
2. Network store initializes (detects offline)
3. MobileApp checks network → isConnected = false
4. Firebase initialization SKIPPED ✅
5. Load session from AsyncStorage ✅
6. Load data from SQLite ✅
7. App ready! No error screen! 🎉
```

### Scenario 2: App Starts Online

```
1. App loads
2. Network store initializes (detects online)
3. MobileApp checks network → isConnected = true
4. Firebase initializes ✅
5. Try Firebase auth
6. If successful, sync data
7. App ready!
```

### Scenario 3: First Time Sign-In (Offline)

```
1. User tries to sign in offline
2. SignInForm detects offline
3. Shows alert: "Need internet to sign in first time"
4. User cannot proceed
5. No Firebase error!
```

### Scenario 4: First Time Sign-In (Online)

```
1. User signs in while online
2. SignInForm initializes Firebase
3. Sign in proceeds
4. Session saved to AsyncStorage
5. Data synced to SQLite
6. Next time can work offline!
```

---

## ✅ Testing Steps

### Test 1: Offline Start (Already Have Session)
1. Sign in once while online
2. Close app completely
3. **Turn off WiFi/Mobile data**
4. Open app
5. **Expected**: App loads immediately, shows offline banner, NO error screen

### Test 2: Online Start
1. Close app
2. **Turn on WiFi**
3. Open app
4. **Expected**: Firebase initializes, auto-login works, sync starts

### Test 3: Try Sign-In Offline
1. Sign out while online
2. Close app
3. **Turn off WiFi**
4. Open app
5. Try to sign in
6. **Expected**: Alert saying "Need internet connection to sign in first time"

### Test 4: Sign-In Online
1. Make sure WiFi is on
2. Open app
3. Sign in with credentials
4. **Expected**: Firebase initializes, sign-in succeeds, session saved

### Test 5: Network Loss During Use
1. Use app online
2. Turn off WiFi mid-session
3. **Expected**: Offline banner appears, app continues working

### Test 6: Network Restored
1. Use app offline
2. Turn on WiFi
3. **Expected**: Banner disappears, sync starts automatically

---

## 🔍 Debugging

### Check Firebase Initialization Status

Add this anywhere in your code to debug:

```typescript
import { getFirebaseConnectionStatus, isFirebaseInitialized } from './config/firebase';

// Check if Firebase is initialized
const initialized = isFirebaseInitialized();
console.log('Firebase initialized:', initialized);

// Get detailed status
const status = getFirebaseConnectionStatus();
console.log('Firebase status:', status);
```

### Check Network State

```typescript
import { useNetworkStore } from './store/networkStore';

const networkState = useNetworkStore.getState();
console.log('Network state:', networkState);
```

### Check Stored Session

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const session = await AsyncStorage.getItem('authSession');
console.log('Stored session:', session);
```

---

## 🐛 Common Issues & Solutions

### Issue: Still seeing error screen offline

**Solution**: 
1. Make sure you signed in at least once while online
2. Check that session is stored in AsyncStorage
3. Verify network store is detecting offline state

```typescript
// Debug network detection
const { isConnected } = useNetworkStore();
console.log('Is connected:', isConnected);
```

### Issue: Firebase initializes even when offline

**Solution**:
1. Make sure you're not importing from `firebase.ts` directly
2. Always use `MobileAuthService.initializeFirebase()` to initialize
3. Check that `isConnected` is actually false

### Issue: Can't sign in even when online

**Solution**:
1. Check console for Firebase initialization logs
2. Verify Firebase config is correct
3. Make sure `shouldUseFirebase` hook returns true

---

## 📊 Expected Console Output

### Offline Start (With Session)
```
📱 Network monitoring started
Network state: { isConnected: false, type: 'none' }
✅ Loaded stored session: user@example.com
📴 Offline mode - using cached session
🚀 Initializing offline-first service...
✅ Offline-first service initialized
```

### Online Start
```
📱 Network monitoring started
Network state: { isConnected: true, type: 'wifi' }
✅ Loaded stored session: user@example.com
🌐 Online - initializing Firebase Auth
🔥 MobileAuthService: Initializing Firebase...
🚀 Initializing Firebase for mobile...
✅ Firebase initialized for mobile development mode
🔄 Triggering auto-sync on login...
```

### Sign-In (Online)
```
🔥 Initializing Firebase for sign-in...
🚀 Initializing Firebase for mobile...
✅ Firebase initialized successfully
Attempting mobile sign in for: user@example.com
✅ Session persisted to AsyncStorage
✅ Credentials saved for auto-login
Mobile sign in successful
```

---

## 🎉 Success Criteria

Your offline mode is working correctly when:

- ✅ App loads offline without error screen
- ✅ Offline banner shows when offline
- ✅ Can navigate all screens offline
- ✅ Data loads from SQLite instantly
- ✅ Can't sign in for first time offline (shows alert)
- ✅ Can sign in when online
- ✅ Session persists across app restarts
- ✅ Auto-sync works when online
- ✅ Firebase only initializes when online
- ✅ No Firebase errors in console when offline

---

## 🚀 Summary

**Before**: Firebase initialized immediately → Error if offline → App crashes

**After**: Firebase initialized only when online → No errors offline → App works perfectly!

The key insight: **Don't initialize Firebase at module import time. Initialize it lazily when you know you're online.**

---

## 📝 Next Steps

If everything works:
1. Test thoroughly with different network conditions
2. Test with multiple users
3. Test sign out → sign in flow
4. Test data sync after being offline
5. Deploy to TestFlight/Play Store beta

---

**Built with**: Lazy Loading • Conditional Initialization • Network-Aware Patterns
