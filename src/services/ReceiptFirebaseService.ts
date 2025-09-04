import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
  query,
  orderBy,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Receipt, ReceiptItem, PrintMethod } from '../types';
import FirebaseService from './FirebaseService';

// Extended interface for Firebase storage
export interface FirebaseReceipt extends Omit<Receipt, 'date'> {
  date: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  printMethod?: PrintMethod;
  printed: boolean;
  printedAt?: Timestamp;
  pdfPath?: string;
  status: 'draft' | 'printed' | 'exported';
}

class ReceiptFirebaseService {
  private static instance: ReceiptFirebaseService;
  private firebaseService: typeof FirebaseService;
  private readonly COLLECTION_NAME = 'receipts';
  
  // Real-time caching properties
  private cachedReceipts: FirebaseReceipt[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private realtimeListener: Unsubscribe | null = null;
  private isListeningToRealtime: boolean = false;
  private changeCallbacks: Array<(receipts: FirebaseReceipt[]) => void> = [];

  private constructor() {
    this.firebaseService = FirebaseService;
  }

  public static getInstance(): ReceiptFirebaseService {
    if (!ReceiptFirebaseService.instance) {
      ReceiptFirebaseService.instance = new ReceiptFirebaseService();
    }
    return ReceiptFirebaseService.instance;
  }

  /**
   * Save receipt data to Firebase
   */
  public async saveReceipt(
    receipt: Receipt,
    printMethod: PrintMethod,
    pdfPath?: string
  ): Promise<{ success: boolean; error?: string; documentId?: string }> {
    try {
      // Ensure Firebase is initialized
      await this.firebaseService.initialize();

      const now = serverTimestamp();
      
      // Convert Receipt to FirebaseReceipt format
      const firebaseReceipt: any = {
        ...receipt,
        date: Timestamp.fromDate(receipt.date),
        createdAt: now,
        updatedAt: now,
        printMethod,
        printed: printMethod === 'thermal',
        status: printMethod === 'pdf' ? 'exported' : 'printed'
      };
      
      // Only add printedAt if it's thermal (avoid undefined values)
      if (printMethod === 'thermal') {
        firebaseReceipt.printedAt = now;
      }
      
      // Only add pdfPath if it's provided (avoid undefined values)
      if (pdfPath) {
        firebaseReceipt.pdfPath = pdfPath;
      }

      // Use receipt ID as document ID for easier retrieval
      const docRef = doc(db, this.COLLECTION_NAME, receipt.id);
      await setDoc(docRef, firebaseReceipt);

      console.log(`Receipt saved to Firebase: ${receipt.id}`);
      
      return { 
        success: true, 
        documentId: receipt.id 
      };
    } catch (error) {
      console.error('Error saving receipt to Firebase:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Update receipt status (e.g., when printed)
   */
  public async updateReceiptStatus(
    receiptId: string,
    status: 'draft' | 'printed' | 'exported',
    printedAt?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        updatedAt: serverTimestamp()
      };

      if (status === 'printed' && printedAt) {
        updateData.printed = true;
        updateData.printedAt = Timestamp.fromDate(printedAt);
      }

      await this.firebaseService.updateDocument(
        this.COLLECTION_NAME,
        receiptId,
        updateData
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating receipt status:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Get receipt from Firebase
   */
  public async getReceipt(receiptId: string): Promise<FirebaseReceipt | null> {
    try {
      const doc = await this.firebaseService.getDocument(this.COLLECTION_NAME, receiptId);
      return doc as FirebaseReceipt;
    } catch (error) {
      console.error('Error getting receipt from Firebase:', error);
      return null;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_DURATION;
  }

  /**
   * Get all receipts from Firebase with real-time caching
   */
  public async getAllReceipts(): Promise<FirebaseReceipt[]> {
    try {
      // If real-time listener is active, return cached data
      if (this.isListeningToRealtime && this.cachedReceipts.length >= 0) {
        return this.cachedReceipts;
      }
      
      // If cache is valid, return cached data
      if (this.isCacheValid() && this.cachedReceipts.length > 0) {
        return this.cachedReceipts;
      }
      
      // Otherwise, fetch from Firestore and update cache
      const receiptsRef = collection(db, this.COLLECTION_NAME);
      const q = query(receiptsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const receipts: FirebaseReceipt[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        receipts.push({ id: doc.id, ...data } as FirebaseReceipt);
      });
      
      // Update cache
      this.cachedReceipts = receipts;
      this.lastCacheUpdate = Date.now();
      
      return receipts;
    } catch (error) {
      console.error('Error getting receipts from Firebase:', error);
      // Return cached data if available, even if stale
      return this.cachedReceipts || [];
    }
  }

  /**
   * Delete receipt from Firebase
   */
  public async deleteReceipt(receiptId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate receipt exists before attempting deletion
      const receipt = await this.getReceipt(receiptId);
      if (!receipt) {
        throw new Error(`Receipt with ID ${receiptId} not found`);
      }
      
      await this.firebaseService.deleteDocument(this.COLLECTION_NAME, receiptId);
      console.log(`Receipt deleted successfully: ${receiptId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting receipt from Firebase:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Set up real-time listener for receipt changes
   */
  public setupRealtimeListener(): void {
    if (this.isListeningToRealtime || this.realtimeListener) {
      return; // Already listening
    }

    try {
      const receiptsRef = collection(db, this.COLLECTION_NAME);
      const q = query(receiptsRef, orderBy('createdAt', 'desc'));

      this.realtimeListener = onSnapshot(
        q,
        (snapshot) => {
          console.log('Real-time update: Receipt data changed');
          const receipts: FirebaseReceipt[] = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            receipts.push({ id: doc.id, ...data } as FirebaseReceipt);
          });
          
          this.cachedReceipts = receipts;
          this.lastCacheUpdate = Date.now();
          
          // Notify all subscribers
          this.changeCallbacks.forEach(callback => {
            try {
              callback(receipts);
            } catch (error) {
              console.error('Error in receipt change callback:', error);
            }
          });
          
          console.log(`Real-time update: ${receipts.length} receipts loaded`);
        },
        (error) => {
          console.error('Real-time receipt listener error:', error);
          this.isListeningToRealtime = false;
        }
      );

      this.isListeningToRealtime = true;
      console.log('Real-time receipt listener established');
    } catch (error) {
      console.error('Failed to setup real-time receipt listener:', error);
      this.isListeningToRealtime = false;
    }
  }

  /**
   * Stop real-time listener
   */
  public stopRealtimeListener(): void {
    if (this.realtimeListener) {
      this.realtimeListener();
      this.realtimeListener = null;
    }
    this.isListeningToRealtime = false;
    this.changeCallbacks = [];
    console.log('Real-time receipt listener stopped');
  }

  /**
   * Subscribe to receipt changes with real-time updates
   */
  public subscribeToReceipts(
    callback: (receipts: FirebaseReceipt[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    // Add callback to list
    this.changeCallbacks.push(callback);
    
    // Setup real-time listener if not already active
    if (!this.isListeningToRealtime) {
      this.setupRealtimeListener();
    }
    
    // Always call callback immediately with cached data (even if empty)
    // This ensures the UI shows the proper empty state instead of loading
    try {
      callback(this.cachedReceipts);
    } catch (error) {
      console.error('Error in immediate receipt callback:', error);
      if (errorCallback) errorCallback(error as Error);
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index > -1) {
        this.changeCallbacks.splice(index, 1);
      }
      
      // If no more callbacks, stop the listener
      if (this.changeCallbacks.length === 0) {
        this.stopRealtimeListener();
      };
    };
  }

  /**
   * Force refresh receipt data from Firestore
   */
  public async forceRefresh(): Promise<void> {
    console.log('Force refreshing receipt data...');
    this.clearCache();
    
    // If we have a real-time listener, restart it
    if (this.isListeningToRealtime) {
      this.stopRealtimeListener();
      this.setupRealtimeListener();
    } else {
      // Otherwise, do a manual refresh
      await this.getAllReceipts();
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cachedReceipts = [];
    this.lastCacheUpdate = 0;
  }

  /**
   * Generate receipt summary for analytics
   */
  public generateReceiptSummary(receipt: Receipt) {
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      total: receipt.total,
      itemCount: receipt.items.length,
      customerName: receipt.customerName,
      date: receipt.date,
      // Additional analytics fields
      totalItems: receipt.items.reduce((sum, item) => sum + item.quantity, 0),
      averageItemPrice: receipt.subtotal / receipt.items.reduce((sum, item) => sum + item.quantity, 0),
      taxAmount: receipt.tax,
      taxRate: receipt.subtotal > 0 ? (receipt.tax / receipt.subtotal) : 0
    };
  }
}

export default ReceiptFirebaseService.getInstance();
