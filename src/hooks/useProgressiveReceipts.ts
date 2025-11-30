import { useState, useCallback, useMemo } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';
import { useReceipts } from './useSyncManager';

/**
 * Progressive loading for receipts
 * 
 * Strategy:
 * 1. Real-time listener loads initial 25 (fast, always fresh)
 * 2. Infinite scroll automatically fetches older receipts
 * 3. Loaded receipts are cached in memory for this session
 * 
 * Benefits:
 * - Fast initial load (25 receipts)
 * - Smooth infinite scroll experience
 * - Real-time updates for recent receipts
 * - Modern app-like pagination
 */
export function useProgressiveReceipts() {
  // Get initial 25 from real-time listener
  const { data: realtimeReceipts = [], isLoading, error } = useReceipts();

  // Additional receipts loaded manually
  const [olderReceipts, setOlderReceipts] = useState<FirebaseReceipt[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Combine real-time + manually loaded receipts
  const allReceipts = useMemo(() => {
    // Deduplicate by ID (real-time receipts take precedence)
    const realtimeIds = new Set(realtimeReceipts.map(r => r.id));
    const uniqueOlder = olderReceipts.filter(r => !realtimeIds.has(r.id));
    return [...realtimeReceipts, ...uniqueOlder];
  }, [realtimeReceipts, olderReceipts]);

  /**
   * Load next batch of receipts (25 at a time)
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const receiptsRef = collection(db, 'receipts');

      // Find the last document from real-time receipts or previously loaded
      let queryRef = query(
        receiptsRef,
        orderBy('createdAt', 'desc'),
        limit(25)
      );

      // If we have a last document, start after it
      if (lastDoc) {
        queryRef = query(
          receiptsRef,
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(25)
        );
      } else if (realtimeReceipts.length > 0) {
        // Start after the last real-time receipt
        const lastRealtimeDoc = realtimeReceipts[realtimeReceipts.length - 1];
        const docSnap = await getDocs(query(
          receiptsRef,
          orderBy('createdAt', 'desc'),
          limit(25)
        ));

        if (docSnap.docs.length > 0) {
          setLastDoc(docSnap.docs[docSnap.docs.length - 1]);
        }
      }

      const snapshot = await getDocs(queryRef);

      if (snapshot.docs.length === 0) {
        setHasMore(false);
        if (__DEV__) console.log('✅ All receipts loaded');
        return;
      }

      const newReceipts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as FirebaseReceipt));

      setOlderReceipts(prev => [...prev, ...newReceipts]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

      if (snapshot.docs.length < 25) {
        setHasMore(false);
      }

      if (__DEV__) {
        console.log(`📥 Loaded ${newReceipts.length} more receipts (Total: ${allReceipts.length + newReceipts.length})`);
      }
    } catch (error) {
      console.error('❌ Error loading more receipts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, lastDoc, realtimeReceipts, allReceipts.length]);

  /**
   * Load ALL remaining receipts at once
   * Use with caution - can be slow for 1000+ receipts
   */
  const loadAll = useCallback(async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const receiptsRef = collection(db, 'receipts');
      const queryRef = query(
        receiptsRef,
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(queryRef);
      const allDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as FirebaseReceipt));

      // Filter out real-time receipts (already have them)
      const realtimeIds = new Set(realtimeReceipts.map(r => r.id));
      const uniqueOlder = allDocs.filter(r => !realtimeIds.has(r.id));

      setOlderReceipts(uniqueOlder);
      setHasMore(false);

      if (__DEV__) {
        console.log(`📥 Loaded ALL receipts (Total: ${allDocs.length})`);
      }
    } catch (error) {
      console.error('❌ Error loading all receipts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, realtimeReceipts]);

  /**
   * Reset to initial 50 receipts
   */
  const reset = useCallback(() => {
    setOlderReceipts([]);
    setLastDoc(null);
    setHasMore(true);
  }, []);

  return {
    receipts: allReceipts,
    isLoading,
    error,
    isLoadingMore,
    hasMore,
    loadMore,
    loadAll,
    reset,
    stats: {
      realtime: realtimeReceipts.length,
      loaded: olderReceipts.length,
      total: allReceipts.length,
    },
  };
}
