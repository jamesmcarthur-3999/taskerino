/**
 * Compression Utilities for Storage
 *
 * Provides transparent compression/decompression using fflate (gzip)
 * to reduce storage usage by 70-80% for JSON data.
 *
 * Features:
 * - Backward compatible with uncompressed data
 * - Version prefix for future format changes
 * - Automatic detection of compressed vs uncompressed data
 * - Error handling with graceful fallback
 */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

/**
 * Version prefix for compressed data
 * This allows us to detect compressed data and handle format changes
 */
const COMPRESSION_PREFIX = 'GZIP_V1:';

/**
 * Compress a JSON string using gzip
 *
 * @param data - The JSON string to compress
 * @returns Base64-encoded compressed data with version prefix
 * @throws Error if compression fails or data is invalid
 */
export async function compressData(data: string): Promise<string> {
  // Validate input
  if (data === undefined || data === null) {
    throw new Error(`Cannot compress invalid data: ${data}`);
  }

  if (typeof data !== 'string') {
    throw new Error(`Data must be a string, got ${typeof data}`);
  }

  try {
    // Convert string to Uint8Array
    const uint8Data = strToU8(data);

    // Compress using gzip (level 9 for maximum compression)
    const compressed = gzipSync(uint8Data, { level: 9 });

    // Convert to base64 for safe storage
    // Use loop instead of .apply() to avoid stack overflow on large arrays (>65K elements)
    let binaryString = '';
    for (let i = 0; i < compressed.length; i++) {
      binaryString += String.fromCharCode(compressed[i]);
    }
    const base64 = btoa(binaryString);

    // Add version prefix
    const result = COMPRESSION_PREFIX + base64;

    // Log compression ratio for monitoring
    const originalSize = data.length;
    const compressedSize = result.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);


    return result;
  } catch (error) {
    console.error('Compression failed:', error);
    throw new Error(`Failed to compress data: ${error}`);
  }
}

/**
 * Decompress a base64-encoded gzipped string
 *
 * @param data - The compressed data (with or without prefix)
 * @returns Decompressed JSON string
 * @throws Error if decompression fails
 */
export async function decompressData(data: string): Promise<string> {
  try {
    // Remove prefix if present
    let base64Data = data;
    if (data.startsWith(COMPRESSION_PREFIX)) {
      base64Data = data.slice(COMPRESSION_PREFIX.length);
    }

    // Decode from base64
    const binaryString = atob(base64Data);
    const uint8Data = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Data[i] = binaryString.charCodeAt(i);
    }

    // Decompress using gunzip
    const decompressed = gunzipSync(uint8Data);

    // Convert back to string
    const result = strFromU8(decompressed);


    return result;
  } catch (error) {
    console.error('Decompression failed:', error);
    throw new Error(`Failed to decompress data: ${error}`);
  }
}

/**
 * Check if data is compressed
 *
 * @param data - The data to check
 * @returns true if data appears to be compressed
 */
export function isCompressed(data: string): boolean {
  // Check for our version prefix
  if (data.startsWith(COMPRESSION_PREFIX)) {
    return true;
  }

  // Additional heuristic: compressed data won't start with '{' or '[' (JSON)
  // and won't be valid JSON
  if (data.length > 0) {
    const firstChar = data.charAt(0);
    // If it starts with JSON characters, it's likely uncompressed
    if (firstChar === '{' || firstChar === '[') {
      return false;
    }

    // If it looks like base64 and doesn't parse as JSON, might be compressed
    // This is a fallback for data compressed without prefix (shouldn't happen)
    if (/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 100))) {
      try {
        JSON.parse(data);
        return false; // It's valid JSON, so not compressed
      } catch {
        // Not valid JSON, might be compressed without prefix
        // We'll treat it as uncompressed to be safe
        return false;
      }
    }
  }

  return false;
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
