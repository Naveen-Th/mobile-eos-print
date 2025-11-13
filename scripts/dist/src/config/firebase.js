"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseConnectionStatus = exports.isFirebaseInitialized = exports.isFirebaseConnected = exports.auth = exports.db = exports.getFirebaseAuth = exports.getFirebaseDb = exports.getFirebaseApp = exports.initializeFirebase = void 0;
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const auth_1 = require("firebase/auth");
const react_native_1 = require("react-native");
// Firebase configuration (same as shared config but adapted for mobile)
const firebaseConfig = {
    apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
    authDomain: "bill-printing-21ea4.firebaseapp.com",
    projectId: "bill-printing-21ea4",
    storageBucket: "bill-printing-21ea4.firebasestorage.app",
    messagingSenderId: "890975566565",
    appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};
// Lazy initialization - only initialize Firebase when actually needed
let app = null;
let db = null;
exports.db = db;
let auth = null;
exports.auth = auth;
let isInitialized = false;
let initializationError = null;
/**
 * Initialize Firebase services (call this only when online)
 * @returns true if successful, false if already initialized or error
 */
const initializeFirebase = () => {
    if (isInitialized) {
        console.log('📱 Firebase already initialized');
        return true;
    }
    try {
        console.log('🚀 Initializing Firebase for mobile...');
        // Initialize Firebase app
        app = !(0, app_1.getApps)().length ? (0, app_1.initializeApp)(firebaseConfig) : (0, app_1.getApp)();
        // Initialize Firestore
        try {
            exports.db = db = (0, firestore_1.initializeFirestore)(app, {
                localCache: react_native_1.Platform.OS === 'web'
                    ? (0, firestore_1.persistentLocalCache)({
                        tabManager: (0, firestore_1.persistentSingleTabManager)(undefined),
                    })
                    : (0, firestore_1.memoryLocalCache)(),
                experimentalForceLongPolling: react_native_1.Platform.OS !== 'web',
            });
        }
        catch (error) {
            // Fallback if already initialized
            exports.db = db = (0, firestore_1.getFirestore)(app);
        }
        // Initialize Auth
        try {
            exports.auth = auth = (0, auth_1.initializeAuth)(app, {
            // Note: React Native persistence is handled automatically by the SDK
            });
        }
        catch (error) {
            // Fallback if already initialized
            exports.auth = auth = (0, auth_1.getAuth)(app);
        }
        isInitialized = true;
        initializationError = null;
        if (__DEV__) {
            console.log('✅ Firebase initialized for mobile development mode');
        }
        else {
            console.log('✅ Firebase initialized for mobile production mode');
        }
        return true;
    }
    catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        initializationError = error;
        isInitialized = false;
        return false;
    }
};
exports.initializeFirebase = initializeFirebase;
/**
 * Get Firebase app instance (initializes if needed)
 */
const getFirebaseApp = () => {
    if (!isInitialized && !initializationError) {
        (0, exports.initializeFirebase)();
    }
    return app;
};
exports.getFirebaseApp = getFirebaseApp;
/**
 * Get Firestore instance (initializes if needed)
 */
const getFirebaseDb = () => {
    if (!isInitialized && !initializationError) {
        (0, exports.initializeFirebase)();
    }
    return db;
};
exports.getFirebaseDb = getFirebaseDb;
/**
 * Get Auth instance (initializes if needed)
 */
const getFirebaseAuth = () => {
    if (!isInitialized && !initializationError) {
        (0, exports.initializeFirebase)();
    }
    return auth;
};
exports.getFirebaseAuth = getFirebaseAuth;
exports.default = app;
// Mobile-specific Firebase utilities
const isFirebaseConnected = () => {
    return isInitialized && !!app && !!auth && !!db;
};
exports.isFirebaseConnected = isFirebaseConnected;
const isFirebaseInitialized = () => {
    return isInitialized;
};
exports.isFirebaseInitialized = isFirebaseInitialized;
const getFirebaseConnectionStatus = () => {
    return {
        initialized: isInitialized,
        app: !!app,
        auth: !!auth,
        firestore: !!db,
        error: initializationError?.message,
        platform: react_native_1.Platform.OS
    };
};
exports.getFirebaseConnectionStatus = getFirebaseConnectionStatus;
