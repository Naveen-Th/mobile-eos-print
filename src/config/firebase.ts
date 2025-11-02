import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore,
  initializeFirestore, 
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getAuth, Auth, connectAuthEmulator, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';

// Firebase configuration (same as shared config but adapted for mobile)
const firebaseConfig = {
  apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
  authDomain: "bill-printing-21ea4.firebaseapp.com",
  projectId: "bill-printing-21ea4",
  storageBucket: "bill-printing-21ea4.firebasestorage.app",
  messagingSenderId: "890975566565",
  appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};

// Lazy initialization - only initialize Firebase when actually needed
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Initialize Firebase services (call this only when online)
 * @returns true if successful, false if already initialized or error
 */
export const initializeFirebase = (): boolean => {
  if (isInitialized) {
    console.log('📱 Firebase already initialized');
    return true;
  }

  try {
    console.log('🚀 Initializing Firebase for mobile...');
    
    // Initialize Firebase app
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    // Initialize Firestore
    try {
      db = initializeFirestore(app, {
        localCache: Platform.OS === 'web'
          ? persistentLocalCache({
              tabManager: persistentSingleTabManager(undefined),
            })
          : memoryLocalCache(),
        experimentalForceLongPolling: Platform.OS !== 'web',
      });
    } catch (error) {
      // Fallback if already initialized
      db = getFirestore(app);
    }
    
    // Initialize Auth
    try {
      auth = initializeAuth(app, {
        // Note: React Native persistence is handled automatically by the SDK
      });
    } catch (error) {
      // Fallback if already initialized
      auth = getAuth(app);
    }
    
    isInitialized = true;
    initializationError = null;
    
    if (__DEV__) {
      console.log('✅ Firebase initialized for mobile development mode');
    } else {
      console.log('✅ Firebase initialized for mobile production mode');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    initializationError = error as Error;
    isInitialized = false;
    return false;
  }
};

/**
 * Get Firebase app instance (initializes if needed)
 */
export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isInitialized && !initializationError) {
    initializeFirebase();
  }
  return app;
};

/**
 * Get Firestore instance (initializes if needed)
 */
export const getFirebaseDb = (): Firestore | null => {
  if (!isInitialized && !initializationError) {
    initializeFirebase();
  }
  return db;
};

/**
 * Get Auth instance (initializes if needed)
 */
export const getFirebaseAuth = (): Auth | null => {
  if (!isInitialized && !initializationError) {
    initializeFirebase();
  }
  return auth;
};

// Export for backward compatibility (but these may be null!)
export { db, auth };
export default app;

// Mobile-specific Firebase utilities
export const isFirebaseConnected = (): boolean => {
  return isInitialized && !!app && !!auth && !!db;
};

export const isFirebaseInitialized = (): boolean => {
  return isInitialized;
};

export const getFirebaseConnectionStatus = () => {
  return {
    initialized: isInitialized,
    app: !!app,
    auth: !!auth,
    firestore: !!db,
    error: initializationError?.message,
    platform: Platform.OS
  };
};
