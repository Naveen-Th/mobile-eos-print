import { 
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseService from './FirebaseService';
import { debounce } from '../utils';

export interface CustomerInfo {
  customerName: string;
  businessName?: string;
  businessPhone?: string;
  lastUsed?: Date;
}

export interface UniqueCustomer extends CustomerInfo {
  receiptCount: number;
}

class CustomerService {
  private static instance: CustomerService;
  private firebaseService: typeof FirebaseService;
  private readonly COLLECTION_NAME = 'receipts';
  private cachedCustomers: UniqueCustomer[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private realtimeListener: Unsubscribe | null = null;
  private isListeningToRealtime: boolean = false;

  private constructor() {
    this.firebaseService = FirebaseService;
    // Ensure cachedCustomers is always initialized as an array
    this.cachedCustomers = [];
    this.lastCacheUpdate = 0;
  }

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Search for customers by name with debouncing
   */
  public searchCustomers = debounce(this.searchCustomersInternal.bind(this), 300);
  
  private async searchCustomersInternal(searchTerm: string): Promise<UniqueCustomer[]> {
    try {
      // Set up real-time listener if not already active
      if (!this.isListeningToRealtime) {
        this.setupRealtimeListener();
      }

      if (!searchTerm || !searchTerm.trim()) {
        const recentCustomers = await this.getRecentCustomers();
        return Array.isArray(recentCustomers) ? recentCustomers : [];
      }

      // If we have real-time data or valid cache, use cache search
      if (this.isListeningToRealtime || this.isCacheValid()) {
        const cachedResults = this.searchInCache(searchTerm);
        return Array.isArray(cachedResults) ? cachedResults : [];
      }

      // If cache is invalid and no real-time listener, fetch from Firestore
      await this.refreshCustomersCache();
      const searchResults = this.searchInCache(searchTerm);
      return Array.isArray(searchResults) ? searchResults : [];
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  /**
   * Search in cached customers
   */
  private searchInCache(searchTerm: string): UniqueCustomer[] {
    if (!this.cachedCustomers || !Array.isArray(this.cachedCustomers)) {
      return [];
    }
    
    const term = searchTerm.toLowerCase().trim();
    return this.cachedCustomers.filter(customer => 
      customer && customer.customerName && (
        customer.customerName.toLowerCase().includes(term) ||
        (customer.businessName && customer.businessName.toLowerCase().includes(term))
      )
    ).slice(0, 10); // Limit to top 10 results
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_DURATION;
  }

  /**
   * Get recent customers (most frequently used)
   */
  public async getRecentCustomers(limitCount: number = 10): Promise<UniqueCustomer[]> {
    try {
      if (this.isCacheValid() && this.cachedCustomers && this.cachedCustomers.length > 0) {
        return this.cachedCustomers
          .sort((a, b) => b.receiptCount - a.receiptCount)
          .slice(0, limitCount);
      }

      await this.refreshCustomersCache();
      
      // Ensure we have a valid array after refresh
      if (!this.cachedCustomers || !Array.isArray(this.cachedCustomers)) {
        this.cachedCustomers = [];
        return [];
      }
      
      return this.cachedCustomers
        .sort((a, b) => b.receiptCount - a.receiptCount)
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error getting recent customers:', error);
      return [];
    }
  }

  /**
   * Refresh customers cache from Firestore
   */
  private async refreshCustomersCache(): Promise<void> {
    try {
      await this.firebaseService.initialize();
      
      // Get all receipts with customer information
      const receiptsRef = collection(db, this.COLLECTION_NAME);
      
      // Try with composite index first, fallback if not available
      let q;
      try {
        q = query(
          receiptsRef,
          where('customerName', '!=', null),
          orderBy('customerName'),
          orderBy('createdAt', 'desc')
        );
      } catch (indexError) {
        console.log('Composite index not available, using simple query:', indexError);
        q = query(
          receiptsRef,
          where('customerName', '!=', null)
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      // Group customers by name and aggregate their information
      const customerMap = new Map<string, UniqueCustomer>();
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const customerName = data.customerName?.trim();
        
        if (!customerName) return;
        
        const key = customerName.toLowerCase();
        
        if (customerMap.has(key)) {
          const existing = customerMap.get(key)!;
          existing.receiptCount++;
          
          // Update business info if current record has more complete information
          if (data.businessName && !existing.businessName) {
            existing.businessName = data.businessName;
          }
          if (data.businessPhone && !existing.businessPhone) {
            existing.businessPhone = data.businessPhone;
          }
          
          // Update last used date if this receipt is more recent
          const receiptDate = data.createdAt?.toDate() || data.date?.toDate();
          if (receiptDate && (!existing.lastUsed || receiptDate > existing.lastUsed)) {
            existing.lastUsed = receiptDate;
          }
        } else {
          customerMap.set(key, {
            customerName: customerName,
            businessName: data.businessName?.trim() || undefined,
            businessPhone: data.businessPhone?.trim() || undefined,
            lastUsed: data.createdAt?.toDate() || data.date?.toDate() || new Date(),
            receiptCount: 1
          });
        }
      });
      
      // Convert map to array and sort by usage frequency and recency
      this.cachedCustomers = Array.from(customerMap.values())
        .sort((a, b) => {
          // First sort by receipt count (frequency)
          if (b.receiptCount !== a.receiptCount) {
            return b.receiptCount - a.receiptCount;
          }
          // Then by last used date (recency)
          const aDate = a.lastUsed || new Date(0);
          const bDate = b.lastUsed || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
      
      this.lastCacheUpdate = Date.now();
      console.log(`Customer cache refreshed with ${this.cachedCustomers.length} unique customers`);
    } catch (error) {
      console.error('Error refreshing customer cache:', error);
      // Ensure we have a valid empty array on error
      this.cachedCustomers = [];
      this.lastCacheUpdate = 0;
      // Don't throw - allow fallback to empty cache
    }
  }

  /**
   * Get customer details by exact name match
   */
  public async getCustomerByName(customerName: string): Promise<UniqueCustomer | null> {
    try {
      const trimmedName = customerName.trim();
      if (!trimmedName) return null;

      // First check cache
      const cachedCustomer = this.cachedCustomers.find(
        c => c.customerName.toLowerCase() === trimmedName.toLowerCase()
      );

      if (cachedCustomer) {
        return cachedCustomer;
      }

      // If not in cache, try direct Firestore query
      await this.firebaseService.initialize();
      
      const receiptsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        receiptsRef,
        where('customerName', '==', trimmedName),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const data = querySnapshot.docs[0].data();
      return {
        customerName: trimmedName,
        businessName: data.businessName?.trim() || undefined,
        businessPhone: data.businessPhone?.trim() || undefined,
        lastUsed: data.createdAt?.toDate() || data.date?.toDate() || new Date(),
        receiptCount: 1 // We only got one result, actual count would need another query
      };
    } catch (error) {
      console.error('Error getting customer by name:', error);
      return null;
    }
  }

  /**
   * Set up real-time listener for customer data changes
   */
  public setupRealtimeListener(): void {
    if (this.isListeningToRealtime || this.realtimeListener) {
      return; // Already listening
    }

    try {
      const receiptsRef = collection(db, this.COLLECTION_NAME);
      
      // Try with composite index first (customerName + createdAt)
      let q;
      try {
        q = query(
          receiptsRef,
          where('customerName', '!=', null),
          orderBy('customerName'),
          orderBy('createdAt', 'desc')
        );
      } catch (indexError) {
        console.log('Composite index not available, using simple query:', indexError);
        // Fallback to simple query if composite index not available
        q = query(
          receiptsRef,
          where('customerName', '!=', null)
        );
      }

      this.realtimeListener = onSnapshot(
        q,
        (snapshot) => {
          console.log('Real-time update: Customer data changed');
          this.processCustomerDataFromSnapshot(snapshot);
        },
        (error) => {
          console.error('Real-time listener error:', error);
          this.isListeningToRealtime = false;
          // Fall back to cache-based approach on error
        }
      );

      this.isListeningToRealtime = true;
      console.log('Real-time customer listener established');
    } catch (error) {
      console.error('Failed to setup real-time listener:', error);
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
    console.log('Real-time customer listener stopped');
  }

  /**
   * Process customer data from Firestore snapshot
   */
  private processCustomerDataFromSnapshot(snapshot: any): void {
    try {
      const customerMap = new Map<string, UniqueCustomer>();
      
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        const customerName = data.customerName?.trim();
        
        if (!customerName) return;
        
        const key = customerName.toLowerCase();
        
        if (customerMap.has(key)) {
          const existing = customerMap.get(key)!;
          existing.receiptCount++;
          
          // Update business info if current record has more complete information
          if (data.businessName && !existing.businessName) {
            existing.businessName = data.businessName;
          }
          if (data.businessPhone && !existing.businessPhone) {
            existing.businessPhone = data.businessPhone;
          }
          
          // Update last used date if this receipt is more recent
          const receiptDate = data.createdAt?.toDate() || data.date?.toDate();
          if (receiptDate && (!existing.lastUsed || receiptDate > existing.lastUsed)) {
            existing.lastUsed = receiptDate;
          }
        } else {
          customerMap.set(key, {
            customerName: customerName,
            businessName: data.businessName?.trim() || undefined,
            businessPhone: data.businessPhone?.trim() || undefined,
            lastUsed: data.createdAt?.toDate() || data.date?.toDate() || new Date(),
            receiptCount: 1
          });
        }
      });
      
      // Convert map to array and sort by usage frequency and recency
      this.cachedCustomers = Array.from(customerMap.values())
        .sort((a, b) => {
          // First sort by receipt count (frequency)
          if (b.receiptCount !== a.receiptCount) {
            return b.receiptCount - a.receiptCount;
          }
          // Then by last used date (recency)
          const aDate = a.lastUsed || new Date(0);
          const bDate = b.lastUsed || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
      
      this.lastCacheUpdate = Date.now();
      console.log(`Real-time update: Customer cache updated with ${this.cachedCustomers.length} unique customers`);
    } catch (error) {
      console.error('Error processing customer data from snapshot:', error);
    }
  }

  /**
   * Force refresh customer data from Firestore
   */
  public async forceRefresh(): Promise<void> {
    console.log('Force refreshing customer data...');
    this.clearCache();
    
    // If we have a real-time listener, restart it
    if (this.isListeningToRealtime) {
      this.stopRealtimeListener();
      this.setupRealtimeListener();
    } else {
      // Otherwise, do a manual refresh
      await this.refreshCustomersCache();
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  public clearCache(): void {
    this.cachedCustomers = [];
    this.lastCacheUpdate = 0;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { count: number; lastUpdate: Date; isValid: boolean } {
    return {
      count: this.cachedCustomers.length,
      lastUpdate: new Date(this.lastCacheUpdate),
      isValid: this.isCacheValid()
    };
  }
}

export default CustomerService.getInstance();
