const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
  authDomain: "bill-printing-21ea4.firebaseapp.com",
  projectId: "bill-printing-21ea4",
  storageBucket: "bill-printing-21ea4.firebasestorage.app",
  messagingSenderId: "890975566565",
  appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};

async function testFirebaseConnection() {
  try {
    console.log('🔥 Testing Firebase connection...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('✅ Firebase initialized successfully');
    
    // Test collection reference
    const itemsCollection = collection(db, 'item_details');
    console.log('✅ Collection reference created');
    
    // Fetch all documents
    console.log('📥 Fetching documents...');
    const querySnapshot = await getDocs(itemsCollection);
    console.log(`✅ Found ${querySnapshot.size} documents`);
    
    // Log all documents
    querySnapshot.forEach((doc) => {
      console.log(`📄 Document ${doc.id}:`, doc.data());
    });
    
    console.log('🎉 Firebase connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    process.exit(1);
  }
}

testFirebaseConnection();
