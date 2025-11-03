/**
 * Mock Storage Adapter for Testing
 *
 * Provides an in-memory implementation of StorageAdapter for testing purposes.
 * Supports all storage operations including Phase 2.4 transactions with full ACID guarantees.
 */

import { StorageAdapter } from '@/services/storage/StorageAdapter';
import type {
  StorageInfo,
  BackupInfo,
  TransactionOperation,
} from '@/services/storage/StorageAdapter';
import type { StorageTransaction } from '@/services/storage/types';
import { nanoid } from 'nanoid';
import type { IndexMetadata } from '@/services/storage/IndexingEngine';

interface Phase24Transaction {
  id: string;
  operations: TransactionOperation[];
  snapshots: Map<string, any>; // Collection snapshots for rollback
}

export class MockStorageAdapter extends StorageAdapter {
  private data: Map<string, any> = new Map();
  private indexes: Map<string, any> = new Map();
  private transactions: Map<string, Phase24Transaction> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    this.initialized = true;
  }

  async save<T>(collection: string, data: T): Promise<void> {
    this.data.set(collection, data);
  }

  async load<T>(collection: string): Promise<T | null> {
    return this.data.get(collection) ?? null;
  }

  async delete(collection: string): Promise<void> {
    this.data.delete(collection);
  }

  async exists(collection: string): Promise<boolean> {
    return this.data.has(collection);
  }

  async getStorageInfo(): Promise<StorageInfo> {
    const used = JSON.stringify(Array.from(this.data.entries())).length;
    return {
      used,
      available: Infinity,
      type: 'indexeddb',
      breakdown: {},
    };
  }









  async clear(): Promise<void> {
    this.data.clear();
    this.indexes.clear();
    this.transactions.clear();
  }

  async exportData(): Promise<Blob> {
    const data = JSON.stringify(Array.from(this.data.entries()));
    return new Blob([data], { type: 'application/json' });
  }

  async importData(data: Blob | ArrayBuffer): Promise<void> {
    let text: string;
    if (data instanceof Blob) {
      text = await data.text();
    } else {
      text = new TextDecoder().decode(data);
    }
    const entries = JSON.parse(text);
    this.data = new Map(entries);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async shutdown(): Promise<void> {
    // No-op for mock
  }

  async beginTransaction(): Promise<StorageTransaction> {
    throw new Error('Use beginPhase24Transaction for relationship tests');
  }

  // Phase 2.4 Transaction API (used by RelationshipManager)
  beginPhase24Transaction(): string {
    const txId = nanoid();
    const tx: Phase24Transaction = {
      id: txId,
      operations: [],
      snapshots: new Map(),
    };
    this.transactions.set(txId, tx);
    return txId;
  }

  addOperation(txId: string, operation: TransactionOperation): void {
    const tx = this.transactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction ${txId} not found`);
    }

    // Create snapshot of collection before first modification
    if (!tx.snapshots.has(operation.collection)) {
      const currentData = this.data.get(operation.collection);
      tx.snapshots.set(
        operation.collection,
        currentData ? JSON.parse(JSON.stringify(currentData)) : null
      );
    }

    tx.operations.push(operation);
  }

  async commitPhase24Transaction(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction ${txId} not found`);
    }

    try {
      // Execute all operations
      for (const operation of tx.operations) {
        if (operation.type === 'write') {
          this.data.set(operation.collection, operation.data);
        } else if (operation.type === 'delete') {
          this.data.delete(operation.collection);
        }
      }

      // Clean up transaction
      this.transactions.delete(txId);
    } catch (error) {
      // Rollback on error
      await this.rollbackPhase24Transaction(txId);
      throw error;
    }
  }

  async rollbackPhase24Transaction(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction ${txId} not found`);
    }

    // Restore snapshots
    for (const [collection, snapshot] of tx.snapshots) {
      if (snapshot === null) {
        this.data.delete(collection);
      } else {
        this.data.set(collection, snapshot);
      }
    }

    // Clean up transaction
    this.transactions.delete(txId);
  }

  async saveIndex(
    collection: string,
    indexType: 'date' | 'tag' | 'status' | 'fulltext' | 'metadata',
    index: any,
    metadata: IndexMetadata
  ): Promise<void> {
    const key = `index:${collection}:${indexType}`;
    this.indexes.set(key, { index, metadata });
  }

  async loadIndex<T>(
    collection: string,
    indexType: 'date' | 'tag' | 'status' | 'fulltext' | 'metadata'
  ): Promise<{ index: T; metadata: IndexMetadata } | null> {
    const key = `index:${collection}:${indexType}`;
    return this.indexes.get(key) ?? null;
  }

  async saveEntityCompressed<T extends { id: string }>(
    collection: string,
    entity: T
  ): Promise<void> {
    const data = (await this.load<T[]>(collection)) || [];
    const index = data.findIndex((e) => e.id === entity.id);
    if (index >= 0) {
      data[index] = entity;
    } else {
      data.push(entity);
    }
    await this.save(collection, data);
  }

  async loadEntityCompressed<T extends { id: string }>(
    collection: string,
    id: string
  ): Promise<T | null> {
    const data = await this.load<T[]>(collection);
    if (!data) return null;
    return data.find((e) => e.id === id) ?? null;
  }

  // Helper methods for testing
  reset(): void {
    this.data.clear();
    this.indexes.clear();
    this.transactions.clear();
    this.initialized = false;
  }

  getActiveTransactions(): number {
    return this.transactions.size;
  }

  getDataSnapshot(): Map<string, any> {
    return new Map(this.data);
  }
}

/**
 * Create a new mock storage adapter for testing
 */
export function createMockStorage(): MockStorageAdapter {
  return new MockStorageAdapter();
}
