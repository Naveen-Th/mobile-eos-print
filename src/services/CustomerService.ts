import { 
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseService from './FirebaseService';
import { debounce } from '../utils';
import PersonDetailsService, { PersonDetail, CreatePersonDetailData, UpdatePersonDetailData } from './PersonDetailsService';

export interface CustomerInfo {
  customerName: string;
  businessName?: string;
  businessPhone?: string;
  balanceDue?: number;
  lastUsed?: Date;
}

export interface UniqueCustomer extends CustomerInfo {
  id?: string;
  receiptCount?: number;
}

class CustomerService {
  private static instance: CustomerService;
  private firebaseService: typeof FirebaseService;
  private readonly COLLECTION_NAME = 'person_details';
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
  public searchCustomers = debounce(this.searchCustomersInternal.bind(this), 150);
  
  /**
   * Immediate search without debouncing (useful for single character searches)
   */
  public searchCustomersImmediate(searchTerm: string): Promise<UniqueCustomer[]> {
    return this.searchCustomersInternal(searchTerm);
  }
  
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
   * Search in cached customers (case-insensitive)
   */
  private searchInCache(searchTerm: string): UniqueCustomer[] {
    if (!this.cachedCustomers || !Array.isArray(this.cachedCustomers)) {
      console.log('No cached customers available for search');
      return [];
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      console.log('Empty search term, returning recent customers');
      return this.cachedCustomers.slice(0, 10); // Return top 10 recent customers for empty search
    }
    
    const results = this.cachedCustomers.filter(customer => {
      if (!customer || !customer.customerName) {
        return false;
      }
      
      // Search by customer name (case-insensitive)
      const customerName = customer.customerName.toLowerCase().trim();
      if (customerName.includes(term)) {
        return true;
      }
      
      // Search by business name (case-insensitive)
      if (customer.businessName) {
        const businessName = customer.businessName.toLowerCase().trim();
        if (businessName.includes(term)) {
          return true;
        }
      }
      
      // Search by business phone (remove spaces and special characters for better matching)
      if (customer.businessPhone) {
        const cleanPhone = customer.businessPhone.replace(/[\s\-\(\)\+]/g, '').toLowerCase();
        const cleanTerm = term.replace(/[\s\-\(\)\+]/g, '');
        if (cleanPhone.includes(cleanTerm) || customer.businessPhone.toLowerCase().includes(term)) {
          return true;
        }
      }
      
      return false;
    }).slice(0, 20); // Increase limit to show more results
    
    console.log(`Search for '${searchTerm}' returned ${results.length} results`);
    return results;
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
   * Refresh customers cache from Firestore person_details collection
   */
  private async refreshCustomersCache(): Promise<void> {
    try {
      await this.firebaseService.initialize();
      
      // Get all person details
      const personDetailsRef = collection(db, this.COLLECTION_NAME);
      const q = query(personDetailsRef, orderBy('updatedAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      
      // Convert person details to customer format
      const customers: UniqueCustomer[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data() as PersonDetail;
        
        if (!data.personName?.trim()) return;
        
        customers.push({
          id: doc.id,
          customerName: data.personName.trim(),
          businessName: data.businessName?.trim() || undefined,
          businessPhone: data.phoneNumber?.trim() || undefined,
          balanceDue: data.balanceDue || 0,
          lastUsed: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
          receiptCount: 0 // Will be calculated separately if needed
        });
      });
      
      // Sort by last used date (most recent first)
      this.cachedCustomers = customers.sort((a, b) => {
        const aDate = a.lastUsed || new Date(0);
        const bDate = b.lastUsed || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      
      this.lastCacheUpdate = Date.now();
      console.log(`Customer cache refreshed with ${this.cachedCustomers.length} customers from person_details`);
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

      // If not in cache, try direct search using PersonDetailsService
      const searchResults = await PersonDetailsService.searchPersonDetails(trimmedName);
      const exactMatch = searchResults.find(person => 
        person.personName.toLowerCase() === trimmedName.toLowerCase()
      );

      if (!exactMatch) {
        return null;
      }

      return {
        id: exactMatch.id,
        customerName: exactMatch.personName.trim(),
        businessName: exactMatch.businessName?.trim() || undefined,
        businessPhone: exactMatch.phoneNumber?.trim() || undefined,
        balanceDue: exactMatch.balanceDue || 0,
        lastUsed: exactMatch.updatedAt?.toDate() || exactMatch.createdAt?.toDate() || new Date(),
        receiptCount: 0
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
      const personDetailsRef = collection(db, this.COLLECTION_NAME);
      const q = query(personDetailsRef, orderBy('updatedAt', 'desc'));

      this.realtimeListener = onSnapshot(
        q,
        (snapshot) => {
          console.log('Real-time update: Person details data changed');
          this.processCustomerDataFromSnapshot(snapshot);
        },
        (error) => {
          console.error('Real-time listener error:', error);
          this.isListeningToRealtime = false;
          // Fall back to cache-based approach on error
        }
      );

      this.isListeningToRealtime = true;
      console.log('Real-time customer listener established for person_details');
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
   * Process customer data from Firestore snapshot (person_details)
   */
  private processCustomerDataFromSnapshot(snapshot: any): void {
    try {
      const customers: UniqueCustomer[] = [];
      
      snapshot.forEach((doc: any) => {
        const data = doc.data() as PersonDetail;
        
        if (!data.personName?.trim()) return;
        
        customers.push({
          id: doc.id,
          customerName: data.personName.trim(),
          businessName: data.businessName?.trim() || undefined,
          businessPhone: data.phoneNumber?.trim() || undefined,
          balanceDue: data.balanceDue || 0,
          lastUsed: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
          receiptCount: 0
        });
      });
      
      // Sort by last used date (most recent first)
      this.cachedCustomers = customers.sort((a, b) => {
        const aDate = a.lastUsed || new Date(0);
        const bDate = b.lastUsed || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      
      this.lastCacheUpdate = Date.now();
      console.log(`Real-time update: Customer cache updated with ${this.cachedCustomers.length} customers from person_details`);
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
