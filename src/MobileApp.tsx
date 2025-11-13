import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SignInForm from './components/SignInForm';
import MobileAuthService, { MobileUser } from './services/auth/MobileAuthService';
import AppLayout from './layout/AppLayout';
import { QueryProvider } from './providers/QueryProvider';
import OfflineFirstService from './services/storage/OfflineFirstService';
import AutoSyncService from './services/storage/AutoSyncService';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import SyncStatus from './components/SyncStatus';
import { LanguageProvider } from './contexts/LanguageContext';
import AppErrorScreen from './components/AppErrorScreen';
import OfflineBanner from './components/OfflineBanner';
import { useNetworkStore, useIsOffline } from './store/networkStore';
import { registerPaymentReminderTask } from './tasks/PaymentReminderTask';
import SplashScreen from './screens/SplashScreen';
import WelcomeScreen from './screens/WelcomeScreen';

// Network monitoring component with initialization
const NetworkMonitor: React.FC = () => {
  const initialize = useNetworkStore((state) => state.initialize);
  
  React.useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [initialize]);
  
  return null;
};

const MobileApp: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<MobileUser | null>(null);
  const [offlineInitialized, setOfflineInitialized] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ progress: 0, status: '' });
  const [initError, setInitError] = useState<Error | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasTriggeredSync, setHasTriggeredSync] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false); // Guard against double init
  const isOffline = useIsOffline();
  const { isConnected, initialize: initializeNetwork } = useNetworkStore();

  useEffect(() => {
    // Guard against double initialization (React 18 StrictMode can cause this)
    if (hasInitialized) {
      return;
    }
    setHasInitialized(true);
    
    const initAuth = async () => {
      try {
        // Initialize network monitoring first (non-blocking)
        initializeNetwork();
        
        // OFFLINE-FIRST: Check for stored session immediately (works offline)
        const storedSession = await MobileAuthService.loadStoredSession();
        if (storedSession) {
          if (__DEV__) {
            console.log('✅ Restored session from AsyncStorage:', storedSession.email);
          }
          setCurrentUser(storedSession);
          setIsLoading(false);
          
          // DEFERRED: If online, try to sync in background (non-blocking)
          setTimeout(() => {
            if (isConnected) {
              try {
                MobileAuthService.initializeFirebase();
                triggerAutoSync(storedSession.uid);
              } catch (syncError) {
                console.warn('⚠️ Background sync failed:', syncError);
                // Continue in offline mode
              }
            } else {
              if (__DEV__) {
                console.log('📴 OFFLINE MODE - App fully functional with local data');
              }
            }
          }, 100); // Defer Firebase init
          
          return () => {};
        }
        
        // If online, try Firebase auth
        if (isConnected) {
          console.log('🌐 Online - initializing Firebase Auth');
          
          // Initialize Firebase only when online
          MobileAuthService.initializeFirebase();
          MobileAuthService.initialize();
          
          // Try to auto-login with saved credentials
          try {
            const autoLoginUser = await MobileAuthService.attemptAutoLogin();
            if (autoLoginUser) {
              console.log('✅ Auto-login successful:', autoLoginUser.email);
              setCurrentUser(autoLoginUser);
              setIsLoading(false);
              
              // Trigger auto-sync after successful auto-login
              triggerAutoSync(autoLoginUser.uid);
              
              return () => {};
            }
          } catch (error) {
            console.error('Auto-login failed, will show login form:', error);
          }
        } else {
          console.log('📴 Offline - Will show login (requires online for first login)');
          setIsLoading(false);
          return () => {};
        }
      
        // Set up auth state listener only if online
        if (isConnected) {
          const unsubscribe = MobileAuthService.onAuthStateChanged((user) => {
            const previousUser = currentUser;
            setCurrentUser(user);
            setIsLoading(false);
            
            // Trigger auto-sync when user logs in (but not on initial load or logout)
            if (user && !previousUser) {
              try {
                triggerAutoSync(user.uid);
              } catch (syncError) {
                console.warn('⚠️ Auto-sync failed:', syncError);
              }
            }
          });

          return unsubscribe;
        } else {
          console.log('📴 Offline - Showing login (first-time users need online)');
          setIsLoading(false);
          return () => {};
        }
      } catch (error) {
        // Firebase initialization failed - ALLOW OFFLINE MODE
        console.error('❌ Firebase initialization failed:', error);
        
        // Try to use stored session for offline mode
        try {
          const storedSession = await MobileAuthService.loadStoredSession();
          if (storedSession) {
            console.log('✅ 📴 OFFLINE MODE: Using stored session');
            setCurrentUser(storedSession);
            setIsLoading(false);
            return () => {};
          }
        } catch (offlineError) {
          console.error('❌ Offline session load failed:', offlineError);
        }
        
        // No stored session available - show login (requires online for first login)
        console.log('📴 No offline session - first-time login requires internet');
        setIsLoading(false);
        return () => {};
      }
    };

    const unsubscribePromise = initAuth();
    
    return () => {
      unsubscribePromise.then(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    };
  }, []);

  // Initialize offline-first service after auth is ready
  useEffect(() => {
    const initOfflineFirst = async () => {
      if (!isLoading && !offlineInitialized) {
        try {
          if (__DEV__) {
            console.log('🚀 Initializing offline-first service...');
          }
          await OfflineFirstService.initialize();
          setOfflineInitialized(true);
          if (__DEV__) {
            console.log('✅ Offline-first service initialized');
          }
          
          // DEFERRED: Initialize payment reminder background task after a delay
          // This is non-critical and can happen in the background
          setTimeout(async () => {
            try {
              await registerPaymentReminderTask();
              if (__DEV__) {
                console.log('✅ Payment reminder background task registered');
              }
            } catch (bgError) {
              console.warn('⚠️ Failed to register payment reminder task:', bgError);
              // Non-critical error, don't block app
            }
          }, 3000); // Defer by 3 seconds
        } catch (error) {
          console.error('❌ Failed to initialize offline-first:', error);
          // Still mark as initialized - app should work offline
          setOfflineInitialized(true);
        }
      }
    };

    initOfflineFirst();
  }, [isLoading, offlineInitialized]);

  const handleSignOut = async () => {
    try {
      console.log('MobileApp: Starting sign out process...');
      await MobileAuthService.signOut();
      // Clear user state immediately after sign out
      setCurrentUser(null);
      console.log('MobileApp: Sign out completed successfully');
    } catch (error) {
      console.error('MobileApp: Sign out error:', error);
      // Even if there's an error, clear the local state
      setCurrentUser(null);
      throw error; // Re-throw to let caller handle
    }
  };

  const handleSignInSuccess = (user: MobileUser) => {
    console.log('User signed in successfully:', user.email);
    setCurrentUser(user);
    // Trigger auto-sync after successful sign-in
    triggerAutoSync(user.uid);
  };

  /**
   * Trigger automatic sync on login
   */
  const triggerAutoSync = async (userId: string) => {
    // Prevent duplicate sync triggers
    if (hasTriggeredSync) {
      console.log('⏸️ Auto-sync already triggered, skipping...');
      return;
    }

    // Only sync if online
    if (!isConnected) {
      console.log('📴 Offline - skipping auto-sync');
      setSyncProgress({ progress: 0, status: 'Working offline' });
      return;
    }
    
    setHasTriggeredSync(true);
    
    try {
      console.log('🔄 Triggering auto-sync on login...');
      
      // Set up progress listener
      const removeListener = AutoSyncService.addSyncListener((progress, status) => {
        setSyncProgress({ progress, status });
        console.log(`Sync progress: ${progress}% - ${status}`);
      });
      
      // Start sync in background (don't block UI)
      AutoSyncService.syncOnLogin(userId, {
        forceFullSync: false, // Use incremental sync for better performance
        batchSize: 100,
        throttleDelay: 0, // No throttle for faster sync
      }).then(() => {
        console.log('✅ Auto-sync completed successfully');
        setSyncProgress({ progress: 100, status: 'Sync complete' });
        removeListener();
        // Reset flag after successful sync to allow future syncs if needed
        setTimeout(() => setHasTriggeredSync(false), 60000); // Reset after 1 minute
      }).catch((error) => {
        console.error('❌ Auto-sync error:', error);
        setSyncProgress({ progress: 0, status: 'Sync failed - working offline' });
        removeListener();
        setHasTriggeredSync(false); // Reset on error to allow retry
      });
    } catch (error) {
      console.error('Error triggering auto-sync:', error);
    }
  };

  const handleSignInError = (error: string) => {
    console.error('Sign in error:', error);
  };

  const handleRetryInit = () => {
    setInitError(null);
    setIsLoading(true);
    // Force reload by changing a key or re-initializing
    window.location?.reload?.();
  };

  const handleSplashFinish = () => {
    setShowSplash(false);
    // If user is already authenticated, skip welcome screen
    if (!currentUser) {
      setShowWelcome(true);
    }
  };

  const handleWelcomeSignIn = () => {
    setShowWelcome(false);
    // SignInForm will be shown automatically
  };

  const handleWelcomeSignUp = () => {
    setShowWelcome(false);
    // For now, show sign-in form. You can create a separate SignUpForm later
    // TODO: Create and show SignUpForm component
  };

  // Show splash screen first
  if (showSplash) {
    return (
      <SafeAreaProvider>
        <SplashScreen onFinish={handleSplashFinish} />
      </SafeAreaProvider>
    );
  }

  // Show welcome screen after splash (only for new users)
  if (showWelcome && !currentUser) {
    return (
      <SafeAreaProvider>
        <WelcomeScreen 
          onSignIn={handleWelcomeSignIn}
          onSignUp={handleWelcomeSignUp}
        />
      </SafeAreaProvider>
    );
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <SafeAreaProvider>
        <AppErrorScreen 
          error={initError}
          onRetry={handleRetryInit}
        />
      </SafeAreaProvider>
    );
  }

  // Loading screen
  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f9ff',
          padding: 20
        }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{
              width: 64,
              height: 64,
              backgroundColor: '#2563eb',
              borderRadius: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16
            }}>
              <ActivityIndicator size="large" color="white" />
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: '600',
              color: '#111827',
              marginBottom: 8,
              textAlign: 'center'
            }}>
              Thermal Receipt Printer
            </Text>
            <Text style={{
              fontSize: 16,
              color: '#6b7280',
              textAlign: 'center'
            }}>
              {syncProgress.status || (isOffline ? 'Loading offline data...' : 'Initializing Firebase...')}
            </Text>
            {isOffline && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: '#fef3c7',
                borderRadius: 8,
              }}>
                <Text style={{ fontSize: 14, color: '#92400e' }}>📴 Offline Mode</Text>
              </View>
            )}
            {syncProgress.progress > 0 && syncProgress.progress < 100 && (
              <View style={{
                width: 200,
                height: 4,
                backgroundColor: '#e5e7eb',
                borderRadius: 2,
                marginTop: 12,
                overflow: 'hidden'
              }}>
                <View style={{
                  width: `${syncProgress.progress}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                }} />
              </View>
            )}
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  // Main app when user is authenticated
  if (currentUser) {
    return (
      <SafeAreaProvider>
        <LanguageProvider>
          <QueryProvider>
            <NetworkMonitor />
            <View style={{ flex: 1 }}>
              <OfflineBanner />
              <AppLayout user={currentUser} onLogout={handleSignOut} />
              <SyncStatus />
            </View>
          </QueryProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    );
  }

  // Sign-in form when user is not authenticated
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SignInForm 
          onSignInSuccess={handleSignInSuccess}
          onSignInError={handleSignInError}
        />
      </LanguageProvider>
    </SafeAreaProvider>
  );
};

export default MobileApp;
