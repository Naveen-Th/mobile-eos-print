"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Import Firebase modules
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../../config/firebase");
class FirebaseService {
    constructor() {
        this.initialized = false;
    }
    static getInstance() {
        if (!FirebaseService.instance) {
            FirebaseService.instance = new FirebaseService();
        }
        return FirebaseService.instance;
    }
    /**
     * Initialize Firebase if not already initialized
     */
    async initialize() {
        try {
            if (this.initialized) {
                console.log('Firebase already initialized');
                return;
            }
            // Firebase is automatically initialized via config/firebase.ts
            console.log('Firebase initialized automatically');
            this.initialized = true;
        }
        catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }
    /**
     * Get Firestore instance
     */
    getFirestore() {
        return (0, firebase_1.getFirebaseDb)();
    }
    /**
     * Check if Firebase is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Test Firestore connection
     */
    async testConnection() {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db) {
                console.error('Firestore not initialized');
                return false;
            }
            // Try to enable network (this will fail gracefully if already enabled)
            await (0, firestore_1.enableNetwork)(db);
            // Test with a simple operation
            const testCollection = (0, firestore_1.collection)(db, 'test');
            await (0, firestore_1.getDocs)(testCollection);
            console.log('Firestore connection test successful');
            return true;
        }
        catch (error) {
            console.error('Firestore connection test failed:', error);
            return false;
        }
    }
    /**
     * Create a document in Firestore
     */
    async createDocument(collectionName, documentId, data) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const docRef = (0, firestore_1.doc)(db, collectionName, documentId);
            await (0, firestore_1.setDoc)(docRef, data);
            console.log(`Document created in ${collectionName}/${documentId}`);
        }
        catch (error) {
            console.error('Error creating document:', error);
            throw error;
        }
    }
    /**
     * Get a document from Firestore
     */
    async getDocument(collectionName, documentId) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const docRef = (0, firestore_1.doc)(db, collectionName, documentId);
            const docSnap = await (0, firestore_1.getDoc)(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            else {
                return null;
            }
        }
        catch (error) {
            console.error('Error getting document:', error);
            throw error;
        }
    }
    /**
     * Update a document in Firestore
     */
    async updateDocument(collectionName, documentId, data) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const docRef = (0, firestore_1.doc)(db, collectionName, documentId);
            await (0, firestore_1.updateDoc)(docRef, data);
            console.log(`Document updated in ${collectionName}/${documentId}`);
        }
        catch (error) {
            console.error('Error updating document:', error);
            throw error;
        }
    }
    /**
     * Delete a document from Firestore
     */
    async deleteDocument(collectionName, documentId) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const docRef = (0, firestore_1.doc)(db, collectionName, documentId);
            await (0, firestore_1.deleteDoc)(docRef);
            console.log(`Document deleted from ${collectionName}/${documentId}`);
        }
        catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    }
    /**
     * Get all documents from a collection
     */
    async getCollection(collectionName) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db)
                throw new Error('Firestore not initialized');
            const colRef = (0, firestore_1.collection)(db, collectionName);
            const snapshot = await (0, firestore_1.getDocs)(colRef);
            const documents = [];
            snapshot.forEach(doc => {
                documents.push({ id: doc.id, ...doc.data() });
            });
            return documents;
        }
        catch (error) {
            console.error('Error getting collection:', error);
            throw error;
        }
    }
    /**
     * Listen to real-time updates from a collection
     */
    subscribeToCollection(collectionName, callback, errorCallback) {
        try {
            const db = (0, firebase_1.getFirebaseDb)();
            if (!db) {
                console.error('Firestore not initialized');
                return () => { };
            }
            const colRef = (0, firestore_1.collection)(db, collectionName);
            const unsubscribe = (0, firestore_1.onSnapshot)(colRef, (snapshot) => {
                const documents = [];
                snapshot.forEach(doc => {
                    documents.push({ id: doc.id, ...doc.data() });
                });
                callback(documents);
            }, (error) => {
                console.error('Error in collection subscription:', error);
                if (errorCallback) {
                    errorCallback(error);
                }
            });
            return unsubscribe;
        }
        catch (error) {
            console.error('Error subscribing to collection:', error);
            if (errorCallback) {
                errorCallback(error);
            }
            return () => { };
        }
    }
    /**
     * Get all item details from item_details collection
     */
    async getItemDetails() {
        try {
            const items = await this.getCollection('item_details');
            // Ensure stocks field is included with default value
            return items.map(item => ({
                ...item,
                stocks: item.stocks || 0
            }));
        }
        catch (error) {
            console.error('Error fetching item details:', error);
            throw error;
        }
    }
    /**
     * Subscribe to real-time updates from item_details collection
     */
    subscribeToItemDetails(callback, errorCallback) {
        return this.subscribeToCollection('item_details', callback, errorCallback);
    }
    /**
     * Listen to real-time updates from a document
     */
    subscribeToDocument(collectionName, documentId, callback, errorCallback) {
        try {
            const docRef = (0, firestore_1.doc)(db, collectionName, documentId);
            const unsubscribe = (0, firestore_1.onSnapshot)(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    callback({ id: docSnap.id, ...docSnap.data() });
                }
                else {
                    callback(null);
                }
            }, (error) => {
                console.error('Error in document subscription:', error);
                if (errorCallback) {
                    errorCallback(error);
                }
            });
            return unsubscribe;
        }
        catch (error) {
            console.error('Error subscribing to document:', error);
            if (errorCallback) {
                errorCallback(error);
            }
            return () => { };
        }
    }
}
exports.default = FirebaseService.getInstance();
