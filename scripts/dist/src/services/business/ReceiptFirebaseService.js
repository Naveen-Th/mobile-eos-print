"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../../config/firebase");
const FirebaseService_1 = __importDefault(require("../auth/FirebaseService"));
class ReceiptFirebaseService {
    constructor() {
        this.COLLECTION_NAME = 'receipts';
        // Real-time caching properties
        this.cachedReceipts = [];
        this.lastCacheUpdate = 0;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.realtimeListener = null;
        this.isListeningToRealtime = false;
        this.changeCallbacks = [];
        // Pagination properties
        this.DEFAULT_PAGE_SIZE = 50;
        this.lastVisible = null;
        this.hasMoreReceipts = true;
        this.firebaseService = FirebaseService_1.default;
    }
    static getInstance() {
        if (!ReceiptFirebaseService.instance) {
            ReceiptFirebaseService.instance = new ReceiptFirebaseService();
        }
        return ReceiptFirebaseService.instance;
    }
    /**
     * Save receipt data to Firebase
     */
    async saveReceipt(receipt, printMethod, pdfPath) {
        try {
            // Input validation
            if (!receipt || !receipt.id) {
                throw new Error('Invalid receipt data: Receipt and ID are required');
            }
            if (!printMethod) {
                throw new Error('Print method is required');
            }
            // Ensure Firebase is initialized
            await this.firebaseService.initialize();
            const now = (0, firestore_1.serverTimestamp)();
            // Validate receipt date
            const receiptDate = receipt.date instanceof Date ? receipt.date : new Date();
            // Convert Receipt to FirebaseReceipt format with proper validation
            const firebaseReceipt = {
                ...receipt,
                // Ensure all required fields are present
                receiptNumber: receipt.receiptNumber || `R-${Date.now()}`,
                customerName: receipt.customerName || 'Walk-in Customer',
                items: receipt.items || [],
                subtotal: receipt.subtotal || 0,
                tax: receipt.tax || 0,
                total: receipt.total || 0,
                date: firestore_1.Timestamp.fromDate(receiptDate),
                createdAt: now,
                updatedAt: now,
                printMethod,
                printed: printMethod === 'thermal',
                status: printMethod === 'pdf' ? 'exported' : 'printed',
                // Balance and payment tracking
                oldBalance: receipt.oldBalance !== undefined ? receipt.oldBalance : 0,
                isPaid: receipt.isPaid !== undefined ? receipt.isPaid : false,
                amountPaid: receipt.amountPaid !== undefined ? receipt.amountPaid : 0,
                newBalance: receipt.newBalance !== undefined ? receipt.newBalance : 0,
            };
            // Only add printedAt if it's thermal (avoid undefined values)
            if (printMethod === 'thermal') {
                firebaseReceipt.printedAt = now;
            }
            // Only add pdfPath if it's provided and valid (avoid undefined values)
            if (pdfPath && typeof pdfPath === 'string' && pdfPath.trim()) {
                firebaseReceipt.pdfPath = pdfPath.trim();
            }
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            // Use receipt ID as document ID for easier retrieval
            const docRef = (0, firestore_1.doc)(db, this.COLLECTION_NAME, receipt.id);
            // Use setDoc with merge option to avoid overwriting existing data accidentally
            await (0, firestore_1.setDoc)(docRef, firebaseReceipt, { merge: false });
            // Minimal logging for performance
            if (__DEV__) {
                console.log(`Receipt saved: ${receipt.id}`);
            }
            return {
                success: true,
                documentId: receipt.id
            };
        }
        catch (error) {
            console.error('Error saving receipt to Firebase:', error);
            let errorMessage = 'Unknown error occurred';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied: Cannot save receipt';
            }
            else if (error.code === 'unavailable') {
                errorMessage = 'Service temporarily unavailable. Please try again later.';
            }
            else if (error.code === 'invalid-argument') {
                errorMessage = 'Invalid receipt data format';
            }
            else if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Update receipt status (e.g., when printed)
     */
    async updateReceiptStatus(receiptId, status, printedAt) {
        try {
            const updateData = {
                status,
                updatedAt: (0, firestore_1.serverTimestamp)()
            };
            if (status === 'printed' && printedAt) {
                updateData.printed = true;
                updateData.printedAt = firestore_1.Timestamp.fromDate(printedAt);
            }
            await this.firebaseService.updateDocument(this.COLLECTION_NAME, receiptId, updateData);
            return { success: true };
        }
        catch (error) {
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
    async getReceipt(receiptId) {
        try {
            const doc = await this.firebaseService.getDocument(this.COLLECTION_NAME, receiptId);
            return doc;
        }
        catch (error) {
            console.error('Error getting receipt from Firebase:', error);
            return null;
        }
    }
    /**
     * Check if cache is still valid
     */
    isCacheValid() {
        return Date.now() - this.lastCacheUpdate < this.CACHE_DURATION;
    }
    /**
     * Get all receipts from Firebase with real-time caching
     * @param pageSize - Optional limit for number of receipts to fetch
     */
    async getAllReceipts(pageSize) {
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
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const receiptsRef = (0, firestore_1.collection)(db, this.COLLECTION_NAME);
            const limitValue = pageSize || this.DEFAULT_PAGE_SIZE;
            const q = (0, firestore_1.query)(receiptsRef, (0, firestore_1.orderBy)('createdAt', 'desc'), (0, firestore_1.limit)(limitValue));
            const querySnapshot = await (0, firestore_1.getDocs)(q);
            const receipts = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                receipts.push({ id: doc.id, ...data });
            });
            // Store last visible document for pagination
            if (querySnapshot.docs.length > 0) {
                this.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                this.hasMoreReceipts = querySnapshot.docs.length === limitValue;
            }
            else {
                this.hasMoreReceipts = false;
            }
            // Update cache
            this.cachedReceipts = receipts;
            this.lastCacheUpdate = Date.now();
            return receipts;
        }
        catch (error) {
            console.error('Error getting receipts from Firebase:', error);
            // Return cached data if available, even if stale
            return this.cachedReceipts || [];
        }
    }
    /**
     * Fetch more receipts (pagination)
     * @param pageSize - Number of receipts to fetch
     */
    async fetchMoreReceipts(pageSize) {
        try {
            if (!this.hasMoreReceipts) {
                return { receipts: [], hasMore: false };
            }
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const receiptsRef = (0, firestore_1.collection)(db, this.COLLECTION_NAME);
            const limitValue = pageSize || this.DEFAULT_PAGE_SIZE;
            // Build query with startAfter for pagination
            const q = this.lastVisible
                ? (0, firestore_1.query)(receiptsRef, (0, firestore_1.orderBy)('createdAt', 'desc'), (0, firestore_1.limit)(limitValue), (0, firestore_1.startAfter)(this.lastVisible))
                : (0, firestore_1.query)(receiptsRef, (0, firestore_1.orderBy)('createdAt', 'desc'), (0, firestore_1.limit)(limitValue));
            const querySnapshot = await (0, firestore_1.getDocs)(q);
            const receipts = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                receipts.push({ id: doc.id, ...data });
            });
            // Update pagination state
            if (querySnapshot.docs.length > 0) {
                this.lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                this.hasMoreReceipts = querySnapshot.docs.length === limitValue;
            }
            else {
                this.hasMoreReceipts = false;
            }
            // Append to cache
            this.cachedReceipts = [...this.cachedReceipts, ...receipts];
            this.lastCacheUpdate = Date.now();
            return { receipts, hasMore: this.hasMoreReceipts };
        }
        catch (error) {
            console.error('Error fetching more receipts:', error);
            return { receipts: [], hasMore: false };
        }
    }
    /**
     * Delete receipt from Firebase
     */
    async deleteReceipt(receiptId) {
        try {
            // Input validation
            if (!receiptId || typeof receiptId !== 'string' || !receiptId.trim()) {
                throw new Error('Valid receipt ID is required');
            }
            const trimmedId = receiptId.trim();
            // Validate receipt exists before attempting deletion
            const receipt = await this.getReceipt(trimmedId);
            if (!receipt) {
                // Return success if receipt doesn't exist (idempotent operation)
                console.log(`Receipt ${trimmedId} not found, treating as already deleted`);
                return { success: true };
            }
            // Delete the document
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const docRef = (0, firestore_1.doc)(db, this.COLLECTION_NAME, trimmedId);
            await (0, firestore_1.deleteDoc)(docRef);
            console.log(`Receipt deleted successfully: ${trimmedId}`);
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting receipt from Firebase:', error);
            let errorMessage = 'Unknown error occurred';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied: Cannot delete receipt';
            }
            else if (error.code === 'unavailable') {
                errorMessage = 'Service temporarily unavailable. Please try again later.';
            }
            else if (error.code === 'not-found') {
                // Treat as success since the goal (receipt not existing) is achieved
                console.log('Receipt not found during deletion, treating as success');
                return { success: true };
            }
            else if (error instanceof Error) {
                errorMessage = error.message;
            }
            else if (typeof error === 'string') {
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
    setupRealtimeListener() {
        if (this.isListeningToRealtime || this.realtimeListener) {
            return; // Already listening
        }
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db) {
                console.error('Firestore not initialized');
                this.isListeningToRealtime = false;
                return;
            }
            const receiptsRef = (0, firestore_1.collection)(db, this.COLLECTION_NAME);
            const q = (0, firestore_1.query)(receiptsRef, (0, firestore_1.orderBy)('createdAt', 'desc'));
            this.realtimeListener = (0, firestore_1.onSnapshot)(q, (snapshot) => {
                console.log('Real-time update: Receipt data changed');
                const receipts = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    receipts.push({ id: doc.id, ...data });
                });
                this.cachedReceipts = receipts;
                this.lastCacheUpdate = Date.now();
                // Notify all subscribers
                this.changeCallbacks.forEach(callback => {
                    try {
                        callback(receipts);
                    }
                    catch (error) {
                        console.error('Error in receipt change callback:', error);
                    }
                });
                // Reduced logging
                if (__DEV__) {
                    console.log(`Real-time update: ${receipts.length} receipts`);
                }
            }, (error) => {
                console.error('Real-time receipt listener error:', error);
                this.isListeningToRealtime = false;
            });
            this.isListeningToRealtime = true;
            console.log('Real-time receipt listener established');
        }
        catch (error) {
            console.error('Failed to setup real-time receipt listener:', error);
            this.isListeningToRealtime = false;
        }
    }
    /**
     * Stop real-time listener
     */
    stopRealtimeListener() {
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
    subscribeToReceipts(callback, errorCallback) {
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
        }
        catch (error) {
            console.error('Error in immediate receipt callback:', error);
            if (errorCallback)
                errorCallback(error);
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
            }
            ;
        };
    }
    /**
     * Force refresh receipt data from Firestore
     */
    async forceRefresh() {
        console.log('Force refreshing receipt data...');
        this.clearCache();
        // If we have a real-time listener, restart it
        if (this.isListeningToRealtime) {
            this.stopRealtimeListener();
            this.setupRealtimeListener();
        }
        else {
            // Otherwise, do a manual refresh
            await this.getAllReceipts();
        }
    }
    /**
     * Get receipts within a date range (optimized for large datasets)
     * @param startDate - Start date for filter
     * @param endDate - End date for filter
     * @param limitCount - Maximum number of receipts to fetch
     */
    async getReceiptsByDateRange(startDate, endDate, limitCount = 100) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const receiptsRef = (0, firestore_1.collection)(db, this.COLLECTION_NAME);
            const q = (0, firestore_1.query)(receiptsRef, (0, firestore_1.where)('createdAt', '>=', firestore_1.Timestamp.fromDate(startDate)), (0, firestore_1.where)('createdAt', '<=', firestore_1.Timestamp.fromDate(endDate)), (0, firestore_1.orderBy)('createdAt', 'desc'), (0, firestore_1.limit)(limitCount));
            const querySnapshot = await (0, firestore_1.getDocs)(q);
            const receipts = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                receipts.push({ id: doc.id, ...data });
            });
            console.log(`Fetched ${receipts.length} receipts between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}`);
            return receipts;
        }
        catch (error) {
            console.error('Error fetching receipts by date range:', error);
            return [];
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cachedReceipts = [];
        this.lastCacheUpdate = 0;
    }
    /**
     * Generate receipt summary for analytics
     */
    generateReceiptSummary(receipt) {
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
    /**
     * Get the latest balance for a customer
     *
     * @deprecated Use BalanceTrackingService.getCustomerBalance() instead
     * This method queries the receipts collection which is inefficient.
     * The new method queries person_details which is the single source of truth.
     *
     * Returns the newBalance from the most recent receipt for this customer
     */
    async getCustomerLatestBalance(customerName) {
        console.warn('⚠️ getCustomerLatestBalance is deprecated. Use BalanceTrackingService.getCustomerBalance() instead');
        try {
            if (!customerName?.trim()) {
                return 0;
            }
            const trimmedName = customerName.trim().toLowerCase();
            // Query receipts for this customer, ordered by creation date (most recent first)
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const receiptsRef = (0, firestore_1.collection)(db, this.COLLECTION_NAME);
            const q = (0, firestore_1.query)(receiptsRef, (0, firestore_1.orderBy)('createdAt', 'desc'), (0, firestore_1.limit)(50) // Get recent receipts to search through
            );
            const querySnapshot = await (0, firestore_1.getDocs)(q);
            // Find the most recent receipt for this customer
            let latestReceipt = null;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Case-insensitive customer name comparison
                if (data.customerName?.trim().toLowerCase() === trimmedName) {
                    if (!latestReceipt) {
                        latestReceipt = data;
                    }
                }
            });
            // Return the newBalance from the latest receipt, or 0 if no receipt found
            if (latestReceipt && latestReceipt.newBalance !== undefined) {
                console.log(`Found latest balance for ${customerName}: ${latestReceipt.newBalance}`);
                return latestReceipt.newBalance;
            }
            console.log(`No previous balance found for ${customerName}, returning 0`);
            return 0;
        }
        catch (error) {
            console.error('Error getting customer latest balance:', error);
            return 0;
        }
    }
}
exports.default = ReceiptFirebaseService.getInstance();
