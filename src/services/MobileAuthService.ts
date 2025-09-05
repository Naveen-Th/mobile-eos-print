import { auth, db } from '../config/firebase';
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
  private currentUser: MobileUser | null = null;

  public static getInstance(): MobileAuthService {
    if (!MobileAuthService.instance) {
      MobileAuthService.instance = new MobileAuthService();
    }
    return MobileAuthService.instance;
  }

  /**
   * Initialize the auth service and set up auth state listener
   */
  public initialize(): void {
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

      // Store user in AsyncStorage for offline access
      try {
        await AsyncStorage.setItem(this.LAST_USER_KEY, JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: mobileUser.displayName,
          role: mobileUser.role,
          lastLogin: new Date().toISOString()
        }));
      } catch (storageError) {
        console.warn('Failed to store user in AsyncStorage:', storageError);
        // Don't fail the login for this
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
      // Clear current user state
      this.currentUser = null;
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      // Clear stored user data
      try {
        await AsyncStorage.removeItem(this.LAST_USER_KEY);
      } catch (storageError) {
        console.warn('Failed to clear AsyncStorage on signout:', storageError);
      }
      
      console.log('Mobile sign out successful');
    } catch (error: any) {
      console.error('Mobile sign out error:', error);
      
      // Even if Firebase signout fails, clear local state
      this.currentUser = null;
      try {
        await AsyncStorage.removeItem(this.LAST_USER_KEY);
      } catch (storageError) {
        console.warn('Failed to clear AsyncStorage on signout error:', storageError);
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
