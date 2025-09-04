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

export interface DesktopUser {
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

class DesktopAuthService {
  private static instance: DesktopAuthService;
  private readonly USERS_COLLECTION = 'users';
  private currentUser: DesktopUser | null = null;

  public static getInstance(): DesktopAuthService {
    if (!DesktopAuthService.instance) {
      DesktopAuthService.instance = new DesktopAuthService();
    }
    return DesktopAuthService.instance;
  }

  /**
   * Initialize the auth service and set up auth state listener
   */
  public initialize(): void {
    this.onAuthStateChanged((user) => {
      this.currentUser = user;
      console.log('Desktop auth state changed:', user ? `Logged in as ${user.email}` : 'Logged out');
    });
  }

  /**
   * Get current user
   */
  public getCurrentUser(): DesktopUser | null {
    return this.currentUser;
  }

  /**
   * Sign in with email and password
   */
  public async signIn(email: string, password: string): Promise<DesktopUser> {
    try {
      console.log('Attempting desktop sign in for:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login time
      await this.updateLastLoginTime(user.uid);

      // Get user profile from Firestore
      const userProfile = await this.getUserProfile(user.uid);

      const desktopUser: DesktopUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        role: userProfile?.role || 'viewer',
        isActive: userProfile?.isActive || true,
        lastLoginAt: userProfile?.lastLoginAt,
        createdAt: userProfile?.createdAt
      };

      // Store user in local storage for offline access
      if (window.electronAPI?.setStore) {
        await window.electronAPI.setStore('lastUser', {
          email: user.email,
          displayName: user.displayName,
          role: userProfile?.role || 'viewer'
        });
      }

      console.log('Desktop sign in successful');
      return desktopUser;
    } catch (error: any) {
      console.error('Desktop sign in error:', error);
      
      // Show desktop notification for error
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification(
          'Login Failed', 
          error.message || 'An error occurred during login'
        );
      }
      
      throw error;
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
  ): Promise<DesktopUser> {
    try {
      console.log('Attempting desktop sign up for:', email);
      
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

      const desktopUser: DesktopUser = {
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

      // Show success notification
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification(
          'Account Created', 
          `Welcome to Thermal Receipt Printer, ${displayName}!`
        );
      }

      console.log('Desktop sign up successful');
      return desktopUser;
    } catch (error: any) {
      console.error('Desktop sign up error:', error);
      
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification(
          'Registration Failed', 
          error.message || 'An error occurred during registration'
        );
      }
      
      throw error;
    }
  }

  /**
   * Sign out
   */
  public async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
      
      // Clear stored user data
      if (window.electronAPI?.deleteStore) {
        await window.electronAPI.deleteStore('lastUser');
      }
      
      console.log('Desktop sign out successful');
      
      // Show notification
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification(
          'Signed Out', 
          'You have been successfully signed out'
        );
      }
    } catch (error: any) {
      console.error('Desktop sign out error:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  public async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
      
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification(
          'Password Reset', 
          'Password reset email sent. Please check your email.'
        );
      }
      
      console.log('Password reset email sent for desktop user');
    } catch (error: any) {
      console.error('Desktop password reset error:', error);
      
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification(
          'Password Reset Failed', 
          error.message || 'Failed to send password reset email'
        );
      }
      
      throw error;
    }
  }

  /**
   * Listen to authentication state changes
   */
  public onAuthStateChanged(callback: (user: DesktopUser | null) => void): () => void {
    return onFirebaseAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await this.getUserProfile(firebaseUser.uid);
        const user: DesktopUser = {
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
      if (window.electronAPI?.getStore) {
        return await window.electronAPI.getStore('lastUser');
      }
      return null;
    } catch (error) {
      console.error('Error getting offline user:', error);
      return null;
    }
  }

  /**
   * Check if app is online
   */
  public isOnline(): boolean {
    return navigator.onLine;
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
      return null;
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

export default DesktopAuthService.getInstance();