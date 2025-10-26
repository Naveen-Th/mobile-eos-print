import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseService from './FirebaseService';
import { ItemDetails } from '../types';

export interface LowStockItem {
  id: string;
  item_name: string;
  stocks: number;
  minStock: number;
  maxStock?: number;
  category?: string;
  price: number;
  stockLevel: 'critical' | 'low' | 'normal';
  percentageRemaining: number;
}

export interface StockAlert {
  type: 'critical' | 'low';
  message: string;
  items: LowStockItem[];
  timestamp: Date;
}

class LowStockAlertService {
  private static instance: LowStockAlertService;
  private firebaseService: typeof FirebaseService;
  private readonly ITEMS_COLLECTION = 'items';

  private constructor() {
    this.firebaseService = FirebaseService;
  }

  public static getInstance(): LowStockAlertService {
    if (!LowStockAlertService.instance) {
      LowStockAlertService.instance = new LowStockAlertService();
    }
    return LowStockAlertService.instance;
  }

  /**
   * Get all low stock items
   */
  async getLowStockItems(): Promise<LowStockItem[]> {
    try {
      await this.firebaseService.initialize();

      const itemsRef = collection(db, this.ITEMS_COLLECTION);
      const querySnapshot = await getDocs(itemsRef);

      const lowStockItems: LowStockItem[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data() as ItemDetails;
        const minStock = data.minStock || 10; // Default min stock
        const maxStock = data.maxStock || 100; // Default max stock

        // Check if item is low on stock
        if (data.stocks <= minStock) {
          const percentageRemaining = maxStock > 0 ? (data.stocks / maxStock) * 100 : 0;
          const stockLevel = this.getStockLevel(data.stocks, minStock);

          lowStockItems.push({
            id: doc.id,
            item_name: data.item_name,
            stocks: data.stocks,
            minStock,
            maxStock,
            category: data.category,
            price: data.price,
            stockLevel,
            percentageRemaining,
          });
        }
      });

      // Sort by stock level (critical first, then low)
      return lowStockItems.sort((a, b) => {
        if (a.stockLevel === 'critical' && b.stockLevel !== 'critical') return -1;
        if (a.stockLevel !== 'critical' && b.stockLevel === 'critical') return 1;
        return a.stocks - b.stocks;
      });
    } catch (error) {
      console.error('Error getting low stock items:', error);
      throw error;
    }
  }

  /**
   * Get critical stock items (0 or very low stock)
   */
  async getCriticalStockItems(): Promise<LowStockItem[]> {
    try {
      const lowStockItems = await this.getLowStockItems();
      return lowStockItems.filter(item => item.stockLevel === 'critical');
    } catch (error) {
      console.error('Error getting critical stock items:', error);
      return [];
    }
  }

  /**
   * Check if there are any low stock alerts
   */
  async hasLowStockAlerts(): Promise<boolean> {
    try {
      const lowStockItems = await this.getLowStockItems();
      return lowStockItems.length > 0;
    } catch (error) {
      console.error('Error checking low stock alerts:', error);
      return false;
    }
  }

  /**
   * Get stock alerts
   */
  async getStockAlerts(): Promise<StockAlert[]> {
    try {
      const lowStockItems = await this.getLowStockItems();
      
      if (lowStockItems.length === 0) {
        return [];
      }

      const criticalItems = lowStockItems.filter(item => item.stockLevel === 'critical');
      const lowItems = lowStockItems.filter(item => item.stockLevel === 'low');

      const alerts: StockAlert[] = [];

      if (criticalItems.length > 0) {
        alerts.push({
          type: 'critical',
          message: `${criticalItems.length} item(s) are critically low or out of stock`,
          items: criticalItems,
          timestamp: new Date(),
        });
      }

      if (lowItems.length > 0) {
        alerts.push({
          type: 'low',
          message: `${lowItems.length} item(s) are running low on stock`,
          items: lowItems,
          timestamp: new Date(),
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error getting stock alerts:', error);
      return [];
    }
  }

  /**
   * Get stock statistics
   */
  async getStockStatistics() {
    try {
      const lowStockItems = await this.getLowStockItems();
      const criticalCount = lowStockItems.filter(item => item.stockLevel === 'critical').length;
      const lowCount = lowStockItems.filter(item => item.stockLevel === 'low').length;

      return {
        totalLowStock: lowStockItems.length,
        criticalStock: criticalCount,
        lowStock: lowCount,
        itemsNeedingRestock: lowStockItems.map(item => ({
          name: item.item_name,
          current: item.stocks,
          min: item.minStock,
          recommended: item.maxStock,
        })),
      };
    } catch (error) {
      console.error('Error getting stock statistics:', error);
      return {
        totalLowStock: 0,
        criticalStock: 0,
        lowStock: 0,
        itemsNeedingRestock: [],
      };
    }
  }

  /**
   * Determine stock level
   */
  private getStockLevel(currentStock: number, minStock: number): 'critical' | 'low' | 'normal' {
    if (currentStock === 0) return 'critical';
    if (currentStock <= minStock / 2) return 'critical';
    if (currentStock <= minStock) return 'low';
    return 'normal';
  }

  /**
   * Update item min/max stock thresholds
   */
  async updateStockThresholds(itemId: string, minStock: number, maxStock: number): Promise<void> {
    try {
      await this.firebaseService.initialize();

      const itemRef = doc(db, this.ITEMS_COLLECTION, itemId);
      await updateDoc(itemRef, {
        minStock,
        maxStock,
      });
    } catch (error) {
      console.error('Error updating stock thresholds:', error);
      throw error;
    }
  }

  /**
   * Get restock suggestions
   */
  async getRestockSuggestions(): Promise<Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    suggestedOrder: number;
    estimatedCost: number;
  }>> {
    try {
      const lowStockItems = await this.getLowStockItems();

      return lowStockItems.map(item => {
        const suggestedOrder = item.maxStock ? item.maxStock - item.stocks : item.minStock * 2;
        const estimatedCost = suggestedOrder * item.price;

        return {
          itemId: item.id,
          itemName: item.item_name,
          currentStock: item.stocks,
          suggestedOrder,
          estimatedCost,
        };
      });
    } catch (error) {
      console.error('Error getting restock suggestions:', error);
      return [];
    }
  }
}

export default LowStockAlertService;
