// Import Firebase modules
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  enableNetwork,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';

class FirebaseService {
  private static instance: FirebaseService;
  private initialized = false;

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Initialize Firebase if not already initialized
   */
  public async initialize(): Promise<void> {
    try {
      if (this.initialized) {
        console.log('Firebase already initialized');
        return;
      }

      // Firebase is automatically initialized via config/firebase.ts
      console.log('Firebase initialized automatically');
      this.initialized = true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  /**
   * Get Firestore instance
   */
  public getFirestore() {
    return db;
  }

  /**
   * Check if Firebase is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Test Firestore connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Try to enable network (this will fail gracefully if already enabled)
      await enableNetwork(db);
      
      // Test with a simple operation
      const testCollection = collection(db, 'test');
      await getDocs(testCollection);
      
      console.log('Firestore connection test successful');
      return true;
    } catch (error) {
      console.error('Firestore connection test failed:', error);
      return false;
    }
  }

  /**
   * Create a document in Firestore
   */
  public async createDocument(
    collectionName: string,
    documentId: string,
    data: any
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await setDoc(docRef, data);
      console.log(`Document created in ${collectionName}/${documentId}`);
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  /**
   * Get a document from Firestore
   */
  public async getDocument(
    collectionName: string,
    documentId: string
  ): Promise<any> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Update a document in Firestore
   */
  public async updateDocument(
    collectionName: string,
    documentId: string,
    data: any
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, data);
      console.log(`Document updated in ${collectionName}/${documentId}`);
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete a document from Firestore
   */
  public async deleteDocument(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
      console.log(`Document deleted from ${collectionName}/${documentId}`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get all documents from a collection
   */
  public async getCollection(collectionName: string): Promise<any[]> {
    try {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);
      
      const documents: any[] = [];
      snapshot.forEach(doc => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return documents;
    } catch (error) {
      console.error('Error getting collection:', error);
      throw error;
    }
  }

  /**
   * Listen to real-time updates from a collection
   */
  public subscribeToCollection(
    collectionName: string,
    callback: (documents: any[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    try {
      const colRef = collection(db, collectionName);
      
      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const documents: any[] = [];
          snapshot.forEach(doc => {
            documents.push({ id: doc.id, ...doc.data() });
          });
          callback(documents);
        },
        (error) => {
          console.error('Error in collection subscription:', error);
          if (errorCallback) {
            errorCallback(error);
          }
        }
      );
      
      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to collection:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
      return () => {};
    }
  }

  /**
   * Get all item details from item_details collection
   */
  public async getItemDetails(): Promise<any[]> {
    try {
      const items = await this.getCollection('item_details');
      // Ensure stocks field is included with default value
      return items.map(item => ({
        ...item,
        stocks: item.stocks || 0
      }));
    } catch (error) {
      console.error('Error fetching item details:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates from item_details collection
   */
  public subscribeToItemDetails(
    callback: (items: any[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    return this.subscribeToCollection('item_details', callback, errorCallback);
  }

  /**
   * Listen to real-time updates from a document
   */
  public subscribeToDocument(
    collectionName: string,
    documentId: string,
    callback: (document: any) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    try {
      const docRef = doc(db, collectionName, documentId);
      
      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() });
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error('Error in document subscription:', error);
          if (errorCallback) {
            errorCallback(error);
          }
        }
      );
      
      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to document:', error);
      if (errorCallback) {
        errorCallback(error as Error);
      }
      return () => {};
    }
  }
}

export default FirebaseService.getInstance();
