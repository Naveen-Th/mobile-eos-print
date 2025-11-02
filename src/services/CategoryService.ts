import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  where,
} from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import FirebaseService from './FirebaseService';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  itemCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

class CategoryService {
  private static instance: CategoryService;
  private firebaseService: typeof FirebaseService;
  private readonly COLLECTION_NAME = 'categories';
  private cachedCategories: Category[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.firebaseService = FirebaseService;
  }

  public static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<Category[]> {
    try {
      if (this.isCacheValid() && this.cachedCategories.length > 0) {
        return this.cachedCategories;
      }

      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      const categoriesRef = collection(db, this.COLLECTION_NAME);
      const q = query(categoriesRef, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);

      const categories: Category[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        categories.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          color: data.color,
          icon: data.icon,
          itemCount: data.itemCount || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      this.cachedCategories = categories;
      this.lastCacheUpdate = Date.now();

      return categories;
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(categoryData: CreateCategoryData): Promise<Category> {
    try {
      await this.firebaseService.initialize();

      // Check if category name already exists
      const existing = await this.getCategoryByName(categoryData.name);
      if (existing) {
        throw new Error('Category with this name already exists');
      }

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      const categoriesRef = collection(db, this.COLLECTION_NAME);
      const docRef = await addDoc(categoriesRef, {
        ...categoryData,
        itemCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const newCategory: Category = {
        id: docRef.id,
        ...categoryData,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Invalidate cache
      this.invalidateCache();

      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, updates: UpdateCategoryData): Promise<void> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      const categoryRef = doc(db, this.COLLECTION_NAME, categoryId);
      await updateDoc(categoryRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // Invalidate cache
      this.invalidateCache();
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      await this.firebaseService.initialize();

      // Check if any items are using this category
      const itemsWithCategory = await this.getItemsCountByCategory(categoryId);
      if (itemsWithCategory > 0) {
        throw new Error(
          `Cannot delete category. ${itemsWithCategory} items are using this category.`
        );
      }

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      const categoryRef = doc(db, this.COLLECTION_NAME, categoryId);
      await deleteDoc(categoryRef);

      // Invalidate cache
      this.invalidateCache();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Get category by name
   */
  async getCategoryByName(name: string): Promise<Category | null> {
    try {
      await this.firebaseService.initialize();

      const db = getFirebaseDb();
      if (!db) throw new Error('Firestore not initialized');
      const categoriesRef = collection(db, this.COLLECTION_NAME);
      const q = query(categoriesRef, where('name', '==', name));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        itemCount: data.itemCount || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting category by name:', error);
      return null;
    }
  }

  /**
   * Get items count for a category
   */
  async getItemsCountByCategory(categoryId: string): Promise<number> {
    try {
      await this.firebaseService.initialize();

      const category = await this.getAllCategories();
      const cat = category.find(c => c.id === categoryId);
      
      if (!cat) return 0;

      // Query items collection
      const itemsRef = collection(db, 'items');
      const q = query(itemsRef, where('category', '==', cat.name));
      const querySnapshot = await getDocs(q);

      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting items count by category:', error);
      return 0;
    }
  }

  /**
   * Update item count for a category
   */
  async updateCategoryItemCount(categoryName: string): Promise<void> {
    try {
      const category = await this.getCategoryByName(categoryName);
      if (!category) return;

      const itemsRef = collection(db, 'items');
      const q = query(itemsRef, where('category', '==', categoryName));
      const querySnapshot = await getDocs(q);

      const categoryRef = doc(db, this.COLLECTION_NAME, category.id);
      await updateDoc(categoryRef, {
        itemCount: querySnapshot.size,
        updatedAt: serverTimestamp(),
      });

      this.invalidateCache();
    } catch (error) {
      console.error('Error updating category item count:', error);
    }
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_DURATION;
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(): void {
    this.cachedCategories = [];
    this.lastCacheUpdate = 0;
  }
}

export default CategoryService;
