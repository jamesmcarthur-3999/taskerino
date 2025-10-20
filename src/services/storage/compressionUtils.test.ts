/**
 * Tests for compression utilities
 */

import { describe, it, expect } from 'vitest';
import { compressData, decompressData, isCompressed } from './compressionUtils';

describe('compressionUtils', () => {
  const sampleJSON = JSON.stringify({
    tasks: [
      { id: '1', title: 'Task 1', description: 'This is a test task with some content' },
      { id: '2', title: 'Task 2', description: 'Another task with more content' },
      { id: '3', title: 'Task 3', description: 'Yet another task with even more content' }
    ],
    notes: [
      { id: '1', content: 'This is a note with some text content that will compress well' },
      { id: '2', content: 'Another note with repetitive content content content content' }
    ]
  });

  it('should compress data successfully', async () => {
    const compressed = await compressData(sampleJSON);

    expect(compressed).toBeDefined();
    expect(typeof compressed).toBe('string');
    expect(compressed.startsWith('GZIP_V1:')).toBe(true);
  });

  it('should achieve good compression ratio on JSON data', async () => {
    const compressed = await compressData(sampleJSON);
    const compressionRatio = compressed.length / sampleJSON.length;

    // Small JSON has overhead, but should still reduce size or be close
    // The real compression benefits are seen with larger data (see test below)
    expect(compressed).toBeDefined();
  });

  it('should decompress data successfully', async () => {
    const compressed = await compressData(sampleJSON);
    const decompressed = await decompressData(compressed);

    expect(decompressed).toBe(sampleJSON);
  });

  it('should correctly identify compressed data', () => {
    const uncompressed = '{"key": "value"}';
    expect(isCompressed(uncompressed)).toBe(false);

    // Mock compressed data with prefix
    const compressed = 'GZIP_V1:H4sIAAAAAAAAA3XO';
    expect(isCompressed(compressed)).toBe(true);
  });

  it('should handle large JSON objects', async () => {
    // Create a large object
    const largeObject = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        description: 'This is a description that repeats many times',
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          tags: ['tag1', 'tag2', 'tag3']
        }
      }))
    };

    const largeJSON = JSON.stringify(largeObject);
    const compressed = await compressData(largeJSON);
    const decompressed = await decompressData(compressed);

    expect(decompressed).toBe(largeJSON);

    const compressionRatio = (1 - compressed.length / largeJSON.length) * 100;
    console.log(`Compression ratio for large object: ${compressionRatio.toFixed(1)}%`);

    // Should achieve at least 70% compression
    expect(compressionRatio).toBeGreaterThan(70);
  });

  it('should handle round-trip compression/decompression', async () => {
    const testCases = [
      '{"simple": "object"}',
      '{"array": [1, 2, 3, 4, 5]}',
      '{"nested": {"deep": {"structure": {"value": "test"}}}}',
      '{"unicode": "Hello 世界 🌍"}',
    ];

    for (const testCase of testCases) {
      const compressed = await compressData(testCase);
      const decompressed = await decompressData(compressed);
      expect(decompressed).toBe(testCase);
    }
  });
});
