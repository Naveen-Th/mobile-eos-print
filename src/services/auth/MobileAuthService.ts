import { auth, db, initializeFirebase as initFirebaseConfig, getFirebaseAuth, getFirebaseDb } from '../../config/firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface MobileUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  role: 'admin' | 'cashier' | 'viewer';
  isActive: boolean;
  lastLoginAt?: any;
  createdAt?: any;
}

class MobileAuthService {
  private static instance: MobileAuthService;
  private readonly USERS_COLLECTION = 'users';
  private readonly LAST_USER_KEY = 'lastUser';
  private readonly SESSION_KEY = 'authSession'; // Full session data for restore
  private readonly CREDENTIALS_KEY = 'savedCredentials'; // Saved email and password for auto-login
  private currentUser: MobileUser | null = null;

  public static getInstance(): MobileAuthService {
    if (!MobileAuthService.instance) {
      MobileAuthService.instance = new MobileAuthService();
    }
    return MobileAuthService.instance;
  }

  /**
   * Initialize Firebase (call only when online)
   */
  public initializeFirebase(): boolean {
    try {
      console.log('🔥 MobileAuthService: Initializing Firebase...');
      const success = initFirebaseConfig();
      if (success) {
        console.log('✅ Firebase initialized successfully');
      } else {
        console.log('⚠️ Firebase initialization returned false');
      }
      return success;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      return false;
    }
  }

  /**
   * Initialize the auth service and set up auth state listener
   */
  public initialize(): void {
    // Check if Firebase is initialized before setting up listener
    if (!auth) {
      console.log('📴 Firebase auth not initialized - skipping auth state listener setup');
      return;
    }
    
    this.onAuthStateChanged((user) => {
      this.currentUser = user;
      console.log('Mobile auth state changed:', user ? `Logged in as ${user.email}` : 'Logged out');
    });
  }

  /**
   * Get current user
   */
  public getCurrentUser(): MobileUser | null {
    return this.currentUser;
  }

  /**
   * Sign in with email and password
   */
  public async signIn(email: string, password: string): Promise<MobileUser> {
    try {
      console.log('Attempting mobile sign in for:', email);
      
      // Input validation
      if (!email?.trim() || !password?.trim()) {
        throw new Error('Email and password are required');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      if (!user) {
        throw new Error('Authentication failed - no user returned');
      }

      // Get user profile from Firestore first (this will create one if it doesn't exist)
      const userProfile = await this.getUserProfile(user.uid);
      
      // Update last login time after getting profile
      try {
        await this.updateLastLoginTime(user.uid);
      } catch (updateError) {
        console.warn('Failed to update last login time:', updateError);
        // Don't fail the login for this
      }

      const mobileUser: MobileUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || userProfile?.displayName || 'User',
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        role: userProfile?.role || 'viewer',
        isActive: userProfile?.isActive !== false, // Default to true unless explicitly false
        lastLoginAt: userProfile?.lastLoginAt,
        createdAt: userProfile?.createdAt
      };

      // Store full session in AsyncStorage for persistent login
      try {
        await AsyncStorage.setItem(this.SESSION_KEY, JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: mobileUser.displayName,
          photoURL: mobileUser.photoURL,
          emailVerified: user.emailVerified,
          role: mobileUser.role,
          isActive: mobileUser.isActive,
          lastLoginAt: new Date().toISOString(),
          createdAt: mobileUser.createdAt,
        }));
        console.log('✅ Session persisted to AsyncStorage');

        // Store credentials for auto-login
        await AsyncStorage.setItem(this.CREDENTIALS_KEY, JSON.stringify({
          email: email.trim(),
          password: password,
        }));
        console.log('✅ Credentials saved for auto-login');
      } catch (storageError) {
        console.warn('Failed to persist session:', storageError);
      }

      console.log('Mobile sign in successful');
      return mobileUser;
    } catch (error: any) {
      console.error('Mobile sign in error:', error);
      
      // Handle specific Firebase auth errors
      let errorMessage = 'An error occurred during login';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please try again later';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      // Show mobile alert for error
      Alert.alert(
        'Login Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Sign up with email and password
   */
  public async signUp(
    email: string, 
    password: string, 
    displayName: string,
    role: 'admin' | 'cashier' | 'viewer' = 'viewer'
  ): Promise<MobileUser> {
    try {
      console.log('Attempting mobile sign up for:', email);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore
      const userProfile = {
        email,
        displayName,
        role,
        permissions: this.getDefaultPermissions(role),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        isActive: true
      };

      const userDocRef = doc(db, this.USERS_COLLECTION, user.uid);
      await setDoc(userDocRef, userProfile);

      const mobileUser: MobileUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        role,
        isActive: true,
        createdAt: userProfile.createdAt,
        lastLoginAt: userProfile.lastLoginAt
      };

      // Show success alert
      Alert.alert(
        'Account Created',
        `Welcome to Thermal Receipt Printer, ${displayName}!`,
        [{ text: 'OK' }]
      );

      console.log('Mobile sign up successful');
      return mobileUser;
    } catch (error: any) {
      console.error('Mobile sign up error:', error);
      
      Alert.alert(
        'Registration Failed',
        error.message || 'An error occurred during registration',
        [{ text: 'OK' }]
      );
      
      throw error;
    }
  }

  /**
   * Sign out
   */
  public async signOut(): Promise<void> {
    try {
      console.log('🚪 Starting sign out process...');
      
      // Clear current user state
      this.currentUser = null;
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Clear ALL AsyncStorage keys and values
      try {
        console.log('🗑️ Clearing all AsyncStorage data...');
        
        // Get all keys
        const allKeys = await AsyncStorage.getAllKeys();
        console.log(`📋 Found ${allKeys.length} keys in AsyncStorage:`, allKeys);
        
        // Clear all keys
        await AsyncStorage.multiRemove(allKeys);
        console.log('✅ All AsyncStorage data cleared');
        
        // Alternative: Clear specific keys if you want to preserve some data
        // Auth-related keys
        // await AsyncStorage.removeItem(this.SESSION_KEY);
        // await AsyncStorage.removeItem(this.LAST_USER_KEY);
        // await AsyncStorage.removeItem(this.CREDENTIALS_KEY);
        // 
        // // App data keys
        // await AsyncStorage.removeItem('stored_receipts');
        // await AsyncStorage.removeItem('receipt_counter');
        // await AsyncStorage.removeItem('lastAutoSyncTime');
        // await AsyncStorage.removeItem('autoSyncMetrics');
        // await AsyncStorage.removeItem('@payment_reminder_settings');
        // await AsyncStorage.removeItem('@app_language');
        // await AsyncStorage.removeItem('receipt_templates');
        // await AsyncStorage.removeItem('default_template_id');
        // await AsyncStorage.removeItem('app_tax_rate');
        
      } catch (storageError) {
        console.error('❌ Failed to clear AsyncStorage on signout:', storageError);
      }
      
      console.log('✅ Mobile sign out successful');
    } catch (error: any) {
      console.error('❌ Mobile sign out error:', error);
      
      // Even if Firebase signout fails, clear local state and storage
      this.currentUser = null;
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(allKeys);
        console.log('✅ AsyncStorage cleared despite error');
      } catch (storageError) {
        console.error('❌ Failed to clear AsyncStorage on signout error:', storageError);
      }
      
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  public async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
      
      Alert.alert(
        'Password Reset',
        'Password reset email sent. Please check your email.',
        [{ text: 'OK' }]
      );
      
      console.log('Password reset email sent for mobile user');
    } catch (error: any) {
      console.error('Mobile password reset error:', error);
      
      Alert.alert(
        'Password Reset Failed',
        error.message || 'Failed to send password reset email',
        [{ text: 'OK' }]
      );
      
      throw error;
    }
  }

  /**
   * Listen to authentication state changes
   */
  public onAuthStateChanged(callback: (user: MobileUser | null) => void): () => void {
    // Check if Firebase auth is initialized
    if (!auth) {
      console.log('📴 Firebase auth not initialized - skipping auth state listener');
      // Return a no-op unsubscribe function
      return () => {};
    }
    
    return onFirebaseAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await this.getUserProfile(firebaseUser.uid);
        const user: MobileUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          role: userProfile?.role || 'viewer',
          isActive: userProfile?.isActive || true,
          lastLoginAt: userProfile?.lastLoginAt,
          createdAt: userProfile?.createdAt
        };
        callback(user);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get offline stored user (for when Firebase is unavailable)
   */
  public async getOfflineUser(): Promise<any | null> {
    try {
      const storedUser = await AsyncStorage.getItem(this.LAST_USER_KEY);
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Error getting offline user:', error);
      return null;
    }
  }

  /**
   * Load stored session from AsyncStorage to restore login on app restart
   */
  public async loadStoredSession(): Promise<MobileUser | null> {
    try {
      const sessionData = await AsyncStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;

      const session = JSON.parse(sessionData);
      const user: MobileUser = {
        uid: session.uid,
        email: session.email || null,
        displayName: session.displayName || 'User',
        photoURL: session.photoURL || null,
        emailVerified: session.emailVerified ?? true,
        role: session.role || 'viewer',
        isActive: session.isActive !== false,
        lastLoginAt: session.lastLoginAt,
        createdAt: session.createdAt,
      };
      // Log removed - logged by caller instead to avoid duplicates
      return user;
    } catch (error) {
      console.error('Error loading stored session from AsyncStorage:', error);
      return null;
    }
  }

  /**
   * Get saved credentials from AsyncStorage
   */
  public async getSavedCredentials(): Promise<{ email: string; password: string } | null> {
    try {
      const credentialsData = await AsyncStorage.getItem(this.CREDENTIALS_KEY);
      if (!credentialsData) return null;

      const credentials = JSON.parse(credentialsData);
      console.log('✅ Found saved credentials for:', credentials.email);
      return credentials;
    } catch (error) {
      console.error('Error loading saved credentials:', error);
      return null;
    }
  }

  /**
   * Attempt auto-login with saved credentials
   */
  public async attemptAutoLogin(): Promise<MobileUser | null> {
    try {
      const credentials = await this.getSavedCredentials();
      if (!credentials) {
        console.log('No saved credentials found for auto-login');
        return null;
      }

      console.log('🔄 Attempting auto-login with saved credentials...');
      const user = await this.signIn(credentials.email, credentials.password);
      console.log('✅ Auto-login successful');
      return user;
    } catch (error) {
      console.error('❌ Auto-login failed:', error);
      // Clear invalid credentials
      try {
        await AsyncStorage.removeItem(this.CREDENTIALS_KEY);
      } catch (clearError) {
        console.warn('Failed to clear invalid credentials:', clearError);
      }
      return null;
    }
  }

  /**
   * Get user profile from Firestore
   */
  private async getUserProfile(uid: string): Promise<any | null> {
    try {
      const userDocRef = doc(db, this.USERS_COLLECTION, uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        return { uid, ...docSnap.data() };
      }
      
      // If user profile doesn't exist, create a default one
      console.warn(`User profile not found for UID: ${uid}. Creating default profile.`);
      const defaultProfile = {
        email: auth.currentUser?.email || '',
        displayName: auth.currentUser?.displayName || 'User',
        role: 'viewer' as const,
        permissions: this.getDefaultPermissions('viewer'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        isActive: true
      };
      
      await setDoc(userDocRef, defaultProfile);
      return { uid, ...defaultProfile };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update last login time
   */
  private async updateLastLoginTime(uid: string): Promise<void> {
    try {
      const userDocRef = doc(db, this.USERS_COLLECTION, uid);
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last login time:', error);
    }
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(role: 'admin' | 'cashier' | 'viewer'): string[] {
    const permissions = {
      admin: [
        'manage_users',
        'manage_printers',
        'create_receipts',
        'view_receipts',
        'edit_receipts',
        'delete_receipts',
        'export_data',
        'view_analytics',
        'manage_settings'
      ],
      cashier: [
        'create_receipts',
        'view_receipts',
        'edit_receipts',
        'manage_printers'
      ],
      viewer: [
        'view_receipts'
      ]
    };

    return permissions[role] || permissions.viewer;
  }
}

export default MobileAuthService.getInstance();
export type { MobileUser };
