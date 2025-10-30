/**
 * CompressionWorker - Web Worker for background compression
 *
 * Handles background compression of:
 * - JSON chunks (gzip compression, 60-70% reduction)
 * - Screenshots (WebP conversion, 20-40% reduction)
 *
 * Runs in a separate thread to avoid blocking the UI.
 * Uses pako for gzip compression and canvas API for WebP conversion.
 *
 * @example
 * ```typescript
 * // In main thread:
 * const worker = new Worker(new URL('./CompressionWorker.ts', import.meta.url), { type: 'module' });
 *
 * worker.postMessage({
 *   type: 'compress-json',
 *   data: { id: '123', content: jsonString }
 * });
 *
 * worker.onmessage = (event) => {
 *   const { type, data } = event.data;
 *   if (type === 'compressed') {
 *     console.log(`Compressed ${data.id}: ${data.ratio * 100}% of original`);
 *   }
 * };
 * ```
 */

import pako from 'pako';

// ========================================
// MESSAGE TYPES
// ========================================

/**
 * Job message sent to worker
 */
export interface CompressJobMessage {
  type: 'compress-json' | 'compress-image' | 'decompress-json' | 'decompress-image';
  data: {
    id: string;
    content: string | ArrayBuffer;
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number; // 0-1 for WebP quality
  };
}

/**
 * Result message sent from worker
 */
export interface CompressResultMessage {
  type: 'compressed' | 'decompressed' | 'error';
  data: {
    id: string;
    compressed?: ArrayBuffer;
    decompressed?: string;
    originalSize: number;
    compressedSize?: number;
    ratio?: number; // e.g. 0.65 = 65% of original
    error?: string;
  };
}

/**
 * Progress message sent from worker
 */
export interface ProgressMessage {
  type: 'progress';
  data: {
    id: string;
    bytesProcessed: number;
    totalBytes: number;
    percent: number;
  };
}

export type WorkerMessage = CompressResultMessage | ProgressMessage;

// ========================================
// COMPRESSION FUNCTIONS
// ========================================

/**
 * Compress JSON string using gzip
 */
function compressJSON(content: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(content);
  const compressed = pako.gzip(uint8Array, { level: 9 }); // Max compression
  return compressed.buffer;
}

/**
 * Decompress gzip data to JSON string
 */
function decompressJSON(compressed: ArrayBuffer): string {
  const uint8Array = new Uint8Array(compressed);
  const decompressed = pako.ungzip(uint8Array);
  const decoder = new TextDecoder();
  return decoder.decode(decompressed);
}

/**
 * Convert image to WebP format
 *
 * Uses OffscreenCanvas in worker for zero main thread impact.
 * Falls back to data URL conversion if OffscreenCanvas is not available.
 */
async function convertToWebP(
  imageData: ArrayBuffer,
  sourceFormat: string = 'png',
  quality: number = 0.8
): Promise<ArrayBuffer> {
  // Create blob from ArrayBuffer
  const blob = new Blob([imageData], { type: `image/${sourceFormat}` });

  // Create ImageBitmap (worker-safe)
  const imageBitmap = await createImageBitmap(blob);

  // Use OffscreenCanvas for WebP conversion (required in Web Worker)
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas not available in this environment');
  }

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2d context from OffscreenCanvas');
  }

  // Draw image
  ctx.drawImage(imageBitmap, 0, 0);

  // Convert to WebP
  const webpBlob = await canvas.convertToBlob({
    type: 'image/webp',
    quality,
  });

  // Convert blob to ArrayBuffer
  return await webpBlob.arrayBuffer();
}

/**
 * Convert image from WebP back to original format
 */
async function convertFromWebP(
  webpData: ArrayBuffer,
  targetFormat: string = 'png'
): Promise<ArrayBuffer> {
  const blob = new Blob([webpData], { type: 'image/webp' });
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2d context from OffscreenCanvas');
  }

  ctx.drawImage(imageBitmap, 0, 0);

  const outputBlob = await canvas.convertToBlob({
    type: `image/${targetFormat}`,
  });

  return await outputBlob.arrayBuffer();
}

// ========================================
// HELPER FUNCTIONS
// ========================================


/**
 * Report progress (for large files)
 */
function reportProgress(id: string, bytesProcessed: number, totalBytes: number) {
  const percent = (bytesProcessed / totalBytes) * 100;
  const message: ProgressMessage = {
    type: 'progress',
    data: { id, bytesProcessed, totalBytes, percent },
  };
  self.postMessage(message);
}

// ========================================
// WORKER MESSAGE HANDLER
// ========================================

/**
 * Handle incoming messages from main thread
 */
self.addEventListener('message', async (event: MessageEvent<CompressJobMessage>) => {
  const { type, data } = event.data;
  const { id, content, format = 'png', quality = 0.8 } = data;

  try {
    const startTime = performance.now();

    if (type === 'compress-json') {
      // Compress JSON string
      if (typeof content !== 'string') {
        throw new Error('compress-json expects string content');
      }

      const originalSize = content.length;

      // Report initial progress
      reportProgress(id, 0, originalSize);

      // Compress
      const compressed = compressJSON(content);
      const compressedSize = compressed.byteLength;

      // Report completion
      reportProgress(id, originalSize, originalSize);

      // Calculate ratio
      const ratio = compressedSize / originalSize;

      // Send result
      const result: CompressResultMessage = {
        type: 'compressed',
        data: {
          id,
          compressed,
          originalSize,
          compressedSize,
          ratio,
        },
      };

      const duration = performance.now() - startTime;
      console.log(
        `[Worker] Compressed JSON ${id}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} ` +
          `(${((1 - ratio) * 100).toFixed(1)}% reduction) in ${duration.toFixed(2)}ms`
      );

      self.postMessage(result);
    } else if (type === 'decompress-json') {
      // Decompress JSON
      if (!(content instanceof ArrayBuffer)) {
        throw new Error('decompress-json expects ArrayBuffer content');
      }

      const compressedSize = content.byteLength;
      reportProgress(id, 0, compressedSize);

      const decompressed = decompressJSON(content);
      const decompressedSize = decompressed.length;

      reportProgress(id, compressedSize, compressedSize);

      const result: CompressResultMessage = {
        type: 'decompressed',
        data: {
          id,
          decompressed,
          originalSize: compressedSize,
          compressedSize: decompressedSize,
        },
      };

      const duration = performance.now() - startTime;
      console.log(
        `[Worker] Decompressed JSON ${id}: ${formatBytes(compressedSize)} → ${formatBytes(decompressedSize)} ` +
          `in ${duration.toFixed(2)}ms`
      );

      self.postMessage(result);
    } else if (type === 'compress-image') {
      // Convert image to WebP
      if (!(content instanceof ArrayBuffer)) {
        throw new Error('compress-image expects ArrayBuffer content');
      }

      const originalSize = content.byteLength;
      reportProgress(id, 0, originalSize);

      const webpData = await convertToWebP(content, format, quality);
      const compressedSize = webpData.byteLength;

      reportProgress(id, originalSize, originalSize);

      const ratio = compressedSize / originalSize;

      const result: CompressResultMessage = {
        type: 'compressed',
        data: {
          id,
          compressed: webpData,
          originalSize,
          compressedSize,
          ratio,
        },
      };

      const duration = performance.now() - startTime;
      console.log(
        `[Worker] Converted ${format} to WebP ${id}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} ` +
          `(${((1 - ratio) * 100).toFixed(1)}% reduction) in ${duration.toFixed(2)}ms`
      );

      self.postMessage(result);
    } else if (type === 'decompress-image') {
      // Convert WebP back to original format
      if (!(content instanceof ArrayBuffer)) {
        throw new Error('decompress-image expects ArrayBuffer content');
      }

      const originalSize = content.byteLength;
      reportProgress(id, 0, originalSize);

      const imageData = await convertFromWebP(content, format);
      const decompressedSize = imageData.byteLength;

      reportProgress(id, originalSize, originalSize);

      const result: CompressResultMessage = {
        type: 'decompressed',
        data: {
          id,
          compressed: imageData,
          originalSize,
          compressedSize: decompressedSize,
        },
      };

      const duration = performance.now() - startTime;
      console.log(
        `[Worker] Converted WebP to ${format} ${id}: ${formatBytes(originalSize)} → ${formatBytes(decompressedSize)} ` +
          `in ${duration.toFixed(2)}ms`
      );

      self.postMessage(result);
    } else {
      throw new Error(`Unknown compression type: ${type}`);
    }
  } catch (error) {
    // Send error message
    const errorMessage: CompressResultMessage = {
      type: 'error',
      data: {
        id,
        originalSize: 0,
        error: error instanceof Error ? error.message : String(error),
      },
    };

    console.error(`[Worker] Error processing ${id}:`, error);
    self.postMessage(errorMessage);
  }
});

/**
 * Format bytes for logging
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Worker is ready
console.log('[CompressionWorker] Worker initialized and ready');
