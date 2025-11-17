/**
 * Conflict Resolution Utility
 * Handles data conflicts when same record is edited on multiple devices while offline
 */

import Logger from './Logger';

export type ConflictStrategy = 'server-wins' | 'client-wins' | 'merge' | 'newest-wins';

export interface TimestampedData {
  updatedAt?: any;
  createdAt?: any;
  [key: string]: any;
}

/**
 * Resolve conflict between server and client data
 */
export function resolveConflict<T extends TimestampedData>(
  serverData: T,
  clientData: T,
  strategy: ConflictStrategy = 'newest-wins'
): T {
  Logger.debug(`Resolving conflict with strategy: ${strategy}`);

  switch (strategy) {
    case 'server-wins':
      Logger.info('Conflict resolved: Server wins');
      return serverData;

    case 'client-wins':
      Logger.info('Conflict resolved: Client wins');
      return clientData;

    case 'newest-wins':
      return resolveByTimestamp(serverData, clientData);

    case 'merge':
      return mergeByFields(serverData, clientData);

    default:
      Logger.warn('Unknown conflict strategy, using server-wins');
      return serverData;
  }
}

/**
 * Resolve by comparing timestamps
 */
function resolveByTimestamp<T extends TimestampedData>(
  serverData: T,
  clientData: T
): T {
  const serverTime = extractTimestamp(serverData.updatedAt);
  const clientTime = extractTimestamp(clientData.updatedAt);

  if (!serverTime && !clientTime) {
    Logger.warn('No timestamps found, using server data');
    return serverData;
  }

  const winner = (clientTime || 0) > (serverTime || 0) ? 'client' : 'server';
  Logger.info(`Conflict resolved: ${winner} has newer timestamp`);

  return winner === 'client' ? clientData : serverData;
}

/**
 * Merge fields by timestamp
 */
function mergeByFields<T extends TimestampedData>(
  serverData: T,
  clientData: T
): T {
  const merged = { ...serverData };
  const serverTime = extractTimestamp(serverData.updatedAt) || 0;
  const clientTime = extractTimestamp(clientData.updatedAt) || 0;

  if (clientTime > serverTime) {
    // Client is newer - use client fields but keep server metadata
    Object.keys(clientData).forEach(key => {
      if (key !== 'id' && key !== 'createdAt') {
        merged[key as keyof T] = clientData[key as keyof T];
      }
    });
    Logger.info('Conflict resolved: Merged with client fields');
  } else {
    // Server is newer but check for client-only fields
    Object.keys(clientData).forEach(key => {
      const clientValue = clientData[key as keyof T];
      const serverValue = merged[key as keyof T];

      // If server doesn't have this field but client does, use client
      if ((serverValue === null || serverValue === undefined) &&
          clientValue !== null && clientValue !== undefined) {
        merged[key as keyof T] = clientValue;
      }
    });
    Logger.info('Conflict resolved: Merged with server fields');
  }

  return merged;
}

/**
 * Smart merge for receipts (never lose payment data)
 */
export function mergeReceipt<T extends {
  paid?: boolean;
  amountPaid?: number;
  updatedAt?: any;
}>(serverData: T, clientData: T): T {
  const serverTime = extractTimestamp(serverData.updatedAt) || 0;
  const clientTime = extractTimestamp(clientData.updatedAt) || 0;

  // CRITICAL: Never lose payment information
  const serverHasPayment = serverData.paid === true || (serverData.amountPaid || 0) > 0;
  const clientHasPayment = clientData.paid === true || (clientData.amountPaid || 0) > 0;

  if (serverHasPayment && !clientHasPayment) {
    Logger.warn('Server has payment, client doesn\'t - using server');
    return serverData;
  }

  if (clientHasPayment && !serverHasPayment) {
    Logger.warn('Client has payment, server doesn\'t - using client');
    return clientData;
  }

  // Both have or both don't have payment - use newest
  const result = clientTime > serverTime ? clientData : serverData;
  Logger.info(`Receipt conflict: Using ${clientTime > serverTime ? 'client' : 'server'} (newer)`);
  return result;
}

/**
 * Smart merge for items (conservative stock handling)
 */
export function mergeItem<T extends {
  stocks?: number;
  price?: number;
  updatedAt?: any;
}>(serverData: T, clientData: T): T {
  const serverTime = extractTimestamp(serverData.updatedAt) || 0;
  const clientTime = extractTimestamp(clientData.updatedAt) || 0;

  const merged = clientTime > serverTime ? { ...clientData } : { ...serverData };

  // CRITICAL: If stock changed on both, use lower value (conservative)
  const serverStock = serverData.stocks || 0;
  const clientStock = clientData.stocks || 0;

  if (serverStock !== clientStock) {
    merged.stocks = Math.min(serverStock, clientStock);
    Logger.warn(`Stock conflict: Using lower value (${merged.stocks})`);
  }

  return merged;
}

/**
 * Detect if conflict exists
 */
export function hasConflict<T extends TimestampedData>(
  serverData: T,
  clientData: T
): boolean {
  const serverTime = extractTimestamp(serverData.updatedAt);
  const clientTime = extractTimestamp(clientData.updatedAt);

  if (!serverTime || !clientTime) {
    return false;
  }

  // Conflict if both were updated within 5 seconds
  const timeDiff = Math.abs(serverTime - clientTime);
  const CONFLICT_WINDOW = 5000;

  if (timeDiff < CONFLICT_WINDOW) {
    // Check if data actually differs
    return hasDataDifference(serverData, clientData);
  }

  return false;
}

/**
 * Check if data differs (ignoring metadata)
 */
function hasDataDifference<T>(obj1: T, obj2: T): boolean {
  const keys1 = Object.keys(obj1 || {}).filter(
    k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt'
  );
  const keys2 = Object.keys(obj2 || {}).filter(
    k => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt'
  );

  if (keys1.length !== keys2.length) return true;

  return keys1.some(key => {
    const val1 = (obj1 as any)[key];
    const val2 = (obj2 as any)[key];

    if (Array.isArray(val1) && Array.isArray(val2)) {
      return JSON.stringify(val1) !== JSON.stringify(val2);
    }

    return val1 !== val2;
  });
}

/**
 * Extract timestamp from various formats
 */
function extractTimestamp(timestamp: any): number | null {
  if (!timestamp) return null;

  // Firestore Timestamp
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }

  // Date object
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  // Number (epoch)
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  // String (ISO date)
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
