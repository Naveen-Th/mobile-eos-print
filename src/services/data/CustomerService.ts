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
import { getFirebaseDb } from '../../config/firebase';
import FirebaseService from '../auth/FirebaseService';
import { debounce } from '../../utils';
import PersonDetailsService, { PersonDetail, CreatePersonDetailData, UpdatePersonDetailData } from '../data/PersonDetailsService';

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
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased from 5)
  private realtimeListener: Unsubscribe | null = null;
  private isListeningToRealtime: boolean = false;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  // Index for faster search by first character
  private searchIndex: Map<string, UniqueCustomer[]> = new Map();
  // Prefetch flag
  private isPrefetched: boolean = false;

  private constructor() {
    this.firebaseService = FirebaseService;
    // Ensure cachedCustomers is always initialized as an array
    this.cachedCustomers = [];
    this.lastCacheUpdate = 0;
    this.searchIndex = new Map();
  }

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Initialize the service (prefetch and setup real-time listener)
   * Call this when the app starts or when customer search screen opens
   */
  public async initialize(): Promise<void> {
    if (this.isInitializing || this.initializationPromise) {
      return this.initializationPromise || Promise.resolve();
    }

    this.isInitializing = true;
    this.initializationPromise = (async () => {
      try {
        // If already cached and valid, skip expensive operations
        if (this.isPrefetched && this.isCacheValid() && this.cachedCustomers.length > 0) {
          console.log('✅ Using cached customers (already prefetched)');
          return;
        }
        
        // Setup real-time listener first (non-blocking)
        this.setupRealtimeListener();
        
        // Fetch initial data if needed
        if (!this.isCacheValid() || this.cachedCustomers.length === 0) {
          await this.refreshCustomersCache();
          this.isPrefetched = true;
        }
      } catch (error) {
        console.error('Error initializing CustomerService:', error);
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Search for customers by name with debouncing
   */
  public searchCustomers = debounce(this.searchCustomersInternal.bind(this), 100);
  
  /**
   * Search customers with pagination support
   * @param searchTerm - Search query
   * @param limit - Number of results to return
   * @param offset - Starting position
   * @returns Paginated customer results
   */
  public async searchCustomersPaginated(
    searchTerm: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ customers: UniqueCustomer[]; hasMore: boolean; total: number }> {
    try {
      // Ensure initialization
      if (!this.isListeningToRealtime && !this.isInitializing) {
        this.initialize().catch(err => console.error('Background initialization failed:', err));
      }

      let allResults: UniqueCustomer[];

      if (!searchTerm || !searchTerm.trim()) {
        // Return recent customers
        allResults = this.cachedCustomers.length > 0 
          ? this.cachedCustomers.slice(0, 50) // Get top 50 recent
          : await this.getRecentCustomers(50);
      } else {
        // Use cache if available
        if (this.cachedCustomers.length > 0) {
          allResults = this.searchInCache(searchTerm);
        } else {
          await this.refreshCustomersCache();
          allResults = this.searchInCache(searchTerm);
        }
      }

      const total = allResults.length;
      const customers = allResults.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return { customers, hasMore, total };
    } catch (error) {
      console.error('Error in paginated search:', error);
      return { customers: [], hasMore: false, total: 0 };
    }
  }
  
  /**
   * Immediate search without debouncing (useful for single character searches)
   */
  public searchCustomersImmediate(searchTerm: string): Promise<UniqueCustomer[]> {
    return this.searchCustomersInternal(searchTerm);
  }
  
  private async searchCustomersInternal(searchTerm: string): Promise<UniqueCustomer[]> {
    try {
      // Ensure initialization has started (non-blocking)
      if (!this.isPrefetched && !this.isInitializing) {
        this.initialize().catch(err => console.error('Background initialization failed:', err));
      }

      if (!searchTerm || !searchTerm.trim()) {
        // Return ALL cached customers immediately if available
        if (this.cachedCustomers.length > 0) {
          return this.cachedCustomers;
        }
        // Otherwise fetch
        const recentCustomers = await this.getRecentCustomers(1000);
        return Array.isArray(recentCustomers) ? recentCustomers : [];
      }

      // ALWAYS use cache if available (prioritize speed)
      if (this.cachedCustomers.length > 0) {
        const cachedResults = this.searchInCache(searchTerm);
        return Array.isArray(cachedResults) ? cachedResults : [];
      }

      // If cache is empty, fetch once
      await this.refreshCustomersCache();
      const searchResults = this.searchInCache(searchTerm);
      return Array.isArray(searchResults) ? searchResults : [];
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  /**
   * Build search index for faster lookups
   */
  private buildSearchIndex(): void {
    this.searchIndex.clear();
    
    if (!this.cachedCustomers || this.cachedCustomers.length === 0) {
      return;
    }
    
    // Index by first character of customer name
    for (const customer of this.cachedCustomers) {
      if (!customer.customerName) continue;
      
      const firstChar = customer.customerName[0].toLowerCase();
      if (!this.searchIndex.has(firstChar)) {
        this.searchIndex.set(firstChar, []);
      }
      this.searchIndex.get(firstChar)!.push(customer);
      
      // Also index by first character of business name
      if (customer.businessName) {
        const businessFirstChar = customer.businessName[0].toLowerCase();
        if (!this.searchIndex.has(businessFirstChar)) {
          this.searchIndex.set(businessFirstChar, []);
        }
        // Avoid duplicates
        const existing = this.searchIndex.get(businessFirstChar)!;
        if (!existing.some(c => c.id === customer.id)) {
          existing.push(customer);
        }
      }
    }
  }

  /**
   * Search in cached customers (case-insensitive) with index optimization
   */
  private searchInCache(searchTerm: string): UniqueCustomer[] {
    if (!this.cachedCustomers || !Array.isArray(this.cachedCustomers)) {
      return [];
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      return this.cachedCustomers; // Return ALL customers for empty search
    }
    
    // Use index for single character searches
    let searchPool: UniqueCustomer[];
    if (term.length === 1 && this.searchIndex.size > 0) {
      searchPool = this.searchIndex.get(term) || [];
    } else if (term.length > 1 && this.searchIndex.size > 0) {
      // For multi-character, use index to narrow down search pool
      const firstChar = term[0];
      searchPool = this.searchIndex.get(firstChar) || this.cachedCustomers;
    } else {
      searchPool = this.cachedCustomers;
    }
    
    const results = searchPool.filter(customer => {
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
    }).slice(0, 100); // Return up to 100 results
    
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
   * If limitCount is high (>100), returns all cached customers
   */
  public async getRecentCustomers(limitCount: number = 10): Promise<UniqueCustomer[]> {
    try {
      if (this.isCacheValid() && this.cachedCustomers && this.cachedCustomers.length > 0) {
        // If requesting a high limit, just return all customers sorted by most recent
        if (limitCount >= 100) {
          return this.cachedCustomers; // Already sorted by lastUsed date in refreshCustomersCache
        }
        return this.cachedCustomers
          .sort((a, b) => {
            const aDate = a.lastUsed || new Date(0);
            const bDate = b.lastUsed || new Date(0);
            return bDate.getTime() - aDate.getTime();
          })
          .slice(0, limitCount);
      }

      await this.refreshCustomersCache();
      
      // Ensure we have a valid array after refresh
      if (!this.cachedCustomers || !Array.isArray(this.cachedCustomers)) {
        this.cachedCustomers = [];
        return [];
      }
      
      // If requesting a high limit, just return all customers
      if (limitCount >= 100) {
        return this.cachedCustomers; // Already sorted by lastUsed date
      }
      
      return this.cachedCustomers
        .sort((a, b) => {
          const aDate = a.lastUsed || new Date(0);
          const bDate = b.lastUsed || new Date(0);
          return bDate.getTime() - aDate.getTime();
        })
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error getting recent customers:', error);
      return [];
    }
  }

  /**
   * Refresh customers cache from Firestore person_details collection
   * Optimized for performance with batching
   */
  private async refreshCustomersCache(): Promise<void> {
    const startTime = Date.now();
    try {
      await this.firebaseService.initialize();
      
      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      
      // Get all person details with limit for faster initial load
      const personDetailsRef = collection(db, this.COLLECTION_NAME);
      const q = query(personDetailsRef, orderBy('updatedAt', 'desc'), limit(500)); // Limit to 500 most recent
      
      const querySnapshot = await getDocs(q);
      
      // Convert person details to customer format (optimized)
      const customers: UniqueCustomer[] = querySnapshot.docs
        .map(doc => {
          const data = doc.data() as PersonDetail;
          
          if (!data.personName?.trim()) return null;
          
          return {
            id: doc.id,
            customerName: data.personName.trim(),
            businessName: data.businessName?.trim() || undefined,
            businessPhone: data.phoneNumber?.trim() || undefined,
            balanceDue: data.balanceDue || 0,
            lastUsed: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
            receiptCount: 0
          };
        })
        .filter((customer): customer is UniqueCustomer => customer !== null);
      
      // Already sorted by updatedAt desc from query
      this.cachedCustomers = customers;
      
      // Build search index for faster lookups
      this.buildSearchIndex();
      
      this.lastCacheUpdate = Date.now();
      const duration = Date.now() - startTime;
      console.log(`✅ Customer cache refreshed with ${this.cachedCustomers.length} customers in ${duration}ms`);
    } catch (error) {
      console.error('❌ Error refreshing customer cache:', error);
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
      const db = getFirebaseDb();
      if (!db) {
        console.error('Firestore not initialized');
        this.isListeningToRealtime = false;
        return;
      }
      
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
      
      // Rebuild search index
      this.buildSearchIndex();
      
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
    this.searchIndex.clear();
    this.isPrefetched = false;
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
