const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGuGiCZbGt9Acl2XR6v1CmlWYgx4hQWHI",
  authDomain: "bill-printing-21ea4.firebaseapp.com",
  projectId: "bill-printing-21ea4",
  storageBucket: "bill-printing-21ea4.firebasestorage.app",
  messagingSenderId: "890975566565",
  appId: "1:890975566565:ios:fd5cc64b694d16a9f8f20c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample items data
const sampleItems = [
  {
    item_name: "Coffee - Espresso",
    price: 2.50,
    stocks: 50,
    description: "Rich, bold espresso shot",
    category: "Beverages",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    item_name: "Coffee - Latte",
    price: 4.00,
    stocks: 30,
    description: "Smooth espresso with steamed milk",
    category: "Beverages",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    item_name: "Sandwich - Club",
    price: 8.50,
    stocks: 15,
    description: "Triple-layer club sandwich",
    category: "Food",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    item_name: "Muffin - Blueberry",
    price: 3.25,
    stocks: 20,
    description: "Fresh blueberry muffin",
    category: "Food",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    item_name: "Tea - Earl Grey",
    price: 2.75,
    stocks: 40,
    description: "Classic Earl Grey tea",
    category: "Beverages",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

async function populateFirebase() {
  try {
    console.log('🔥 Starting Firebase population...');
    
    const itemsCollection = collection(db, 'item_details');
    
    for (const item of sampleItems) {
      const docRef = await addDoc(itemsCollection, item);
      console.log(`✅ Added item "${item.item_name}" with ID: ${docRef.id}`);
    }
    
    console.log('🎉 Firebase population completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating Firebase:', error);
    process.exit(1);
  }
}

populateFirebase();
