import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import FirebaseService from './FirebaseService';

export interface SalesAnalytics {
  totalSales: number;
  totalTransactions: number;
  totalItems: number;
  averageOrderValue: number;
  topSellingItems: TopSellingItem[];
  salesByDay: DailySales[];
  salesByCategory: CategorySales[];
  customerStats: CustomerStats;
}

export interface TopSellingItem {
  itemName: string;
  quantitySold: number;
  revenue: number;
}

export interface DailySales {
  date: string;
  sales: number;
  transactions: number;
}

export interface CategorySales {
  category: string;
  sales: number;
  itemCount: number;
}

export interface CustomerStats {
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private firebaseService: typeof FirebaseService;

  private constructor() {
    this.firebaseService = FirebaseService;
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Get sales analytics for a date range
   */
  async getSalesAnalytics(dateRange: DateRange): Promise<SalesAnalytics> {
    try {
      await this.firebaseService.initialize();

      const receiptsRef = collection(db, 'receipts');
      const q = query(
        receiptsRef,
        where('date', '>=', Timestamp.fromDate(dateRange.startDate)),
        where('date', '<=', Timestamp.fromDate(dateRange.endDate)),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const receipts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      // Calculate metrics
      const totalSales = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
      const totalTransactions = receipts.length;
      const totalItems = receipts.reduce(
        (sum, r) => sum + (r.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0),
        0
      );
      const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      // Top selling items
      const topSellingItems = this.calculateTopSellingItems(receipts);

      // Sales by day
      const salesByDay = this.calculateSalesByDay(receipts, dateRange);

      // Sales by category
      const salesByCategory = this.calculateSalesByCategory(receipts);

      // Customer stats
      const customerStats = await this.calculateCustomerStats(receipts, dateRange);

      return {
        totalSales,
        totalTransactions,
        totalItems,
        averageOrderValue,
        topSellingItems,
        salesByDay,
        salesByCategory,
        customerStats,
      };
    } catch (error) {
      console.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate top selling items
   */
  private calculateTopSellingItems(receipts: any[]): TopSellingItem[] {
    const itemsMap = new Map<string, { quantity: number; revenue: number }>();

    receipts.forEach(receipt => {
      receipt.items?.forEach((item: any) => {
        const existing = itemsMap.get(item.name) || { quantity: 0, revenue: 0 };
        itemsMap.set(item.name, {
          quantity: existing.quantity + (item.quantity || 0),
          revenue: existing.revenue + (item.price * item.quantity || 0),
        });
      });
    });

    return Array.from(itemsMap.entries())
      .map(([itemName, data]) => ({
        itemName,
        quantitySold: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);
  }

  /**
   * Calculate sales by day
   */
  private calculateSalesByDay(receipts: any[], dateRange: DateRange): DailySales[] {
    const salesMap = new Map<string, { sales: number; transactions: number }>();

    receipts.forEach(receipt => {
      const date = receipt.date?.toDate?.() || new Date(receipt.date);
      const dateKey = date.toISOString().split('T')[0];
      
      const existing = salesMap.get(dateKey) || { sales: 0, transactions: 0 };
      salesMap.set(dateKey, {
        sales: existing.sales + (receipt.total || 0),
        transactions: existing.transactions + 1,
      });
    });

    // Fill in missing dates with 0
    const result: DailySales[] = [];
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const data = salesMap.get(dateKey) || { sales: 0, transactions: 0 };
      result.push({
        date: dateKey,
        sales: data.sales,
        transactions: data.transactions,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * Calculate sales by category
   */
  private calculateSalesByCategory(receipts: any[]): CategorySales[] {
    const categoryMap = new Map<string, { sales: number; itemCount: number }>();

    receipts.forEach(receipt => {
      receipt.items?.forEach((item: any) => {
        const category = item.category || 'Uncategorized';
        const existing = categoryMap.get(category) || { sales: 0, itemCount: 0 };
        categoryMap.set(category, {
          sales: existing.sales + (item.price * item.quantity || 0),
          itemCount: existing.itemCount + (item.quantity || 0),
        });
      });
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        sales: data.sales,
        itemCount: data.itemCount,
      }))
      .sort((a, b) => b.sales - a.sales);
  }

  /**
   * Calculate customer statistics
   */
  private async calculateCustomerStats(
    receipts: any[],
    dateRange: DateRange
  ): Promise<CustomerStats> {
    const customerNames = new Set<string>();
    const customerFrequency = new Map<string, number>();

    receipts.forEach(receipt => {
      if (receipt.customerName) {
        customerNames.add(receipt.customerName);
        const count = customerFrequency.get(receipt.customerName) || 0;
        customerFrequency.set(receipt.customerName, count + 1);
      }
    });

    const totalCustomers = customerNames.size;
    const repeatCustomers = Array.from(customerFrequency.values()).filter(count => count > 1).length;
    const newCustomers = totalCustomers - repeatCustomers;

    return {
      totalCustomers,
      repeatCustomers,
      newCustomers,
    };
  }

  /**
   * Get today's quick stats
   */
  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getSalesAnalytics({
      startDate: today,
      endDate: tomorrow,
    });
  }

  /**
   * Get this week's stats
   */
  async getWeekStats() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return this.getSalesAnalytics({
      startDate: startOfWeek,
      endDate: today,
    });
  }

  /**
   * Get this month's stats
   */
  async getMonthStats() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.getSalesAnalytics({
      startDate: startOfMonth,
      endDate: today,
    });
  }
}

export default AnalyticsService;
