import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Initialize Firebase app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services with React Native optimizations
let db: ReturnType<typeof getFirestore>;
let auth: ReturnType<typeof getAuth>;

try {
  // Initialize Firestore with offline persistence
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true, // For React Native
  });
} catch (error) {
  // Fallback if already initialized
  db = getFirestore(app);
}

try {
  // Initialize Auth for React Native
  auth = initializeAuth(app, {
    // Note: React Native persistence is handled automatically
  });
} catch (error) {
  // Fallback if already initialized
  auth = getAuth(app);
}

// Mobile-specific Firebase setup
const isDevelopment = __DEV__;

if (isDevelopment) {
  console.log('Firebase initialized for mobile development mode');
  
  // You can enable emulators for development if needed
  // Note: Uncomment these lines if you want to use Firebase emulators
  /*
  try {
    if (Platform.OS === 'android') {
      connectAuthEmulator(auth, 'http://10.0.2.2:9099');
      connectFirestoreEmulator(db, '10.0.2.2', 8080);
    } else {
      connectAuthEmulator(auth, 'http://localhost:9099');
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    console.log('Connected to Firebase emulators');
  } catch (error) {
    console.log('Firebase emulators already connected or not available');
  }
  */
} else {
  console.log('Firebase initialized for mobile production mode');
}

// Export Firebase services
export { db, auth };
export default app;

// Mobile-specific Firebase utilities
export const isFirebaseConnected = () => {
  return app && auth && db;
};

export const getFirebaseConnectionStatus = () => {
  return {
    app: !!app,
    auth: !!auth,
    firestore: !!db,
    platform: Platform.OS
  };
};
