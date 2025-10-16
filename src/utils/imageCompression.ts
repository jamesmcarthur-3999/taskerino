/**
 * Image Compression Utilities
 *
 * Provides functions to compress and resize images to reduce file size
 * for storage and API transmission.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
}

/**
 * Compress a base64 image to reduce file size
 * @param base64Data - Base64 data URL (e.g., "data:image/png;base64,...")
 * @param options - Compression options
 * @returns Compressed base64 data URL
 */
export async function compressBase64Image(
  base64Data: string,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = 'image/jpeg', // JPEG compresses better than PNG
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = Math.min(width, maxWidth);
            height = Math.round(width / aspectRatio);
          } else {
            height = Math.min(height, maxHeight);
            width = Math.round(height * aspectRatio);
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed base64
        const compressedBase64 = canvas.toDataURL(format, quality);

        console.log(`📊 Image compression: ${Math.round(base64Data.length / 1024)}KB → ${Math.round(compressedBase64.length / 1024)}KB`);

        resolve(compressedBase64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = base64Data;
  });
}

/**
 * Create a thumbnail from a base64 image
 * @param base64Data - Base64 data URL
 * @param maxSize - Maximum width/height (default 400px)
 * @returns Thumbnail base64 data URL
 */
export async function createThumbnail(
  base64Data: string,
  maxSize: number = 400
): Promise<string> {
  return compressBase64Image(base64Data, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    quality: 0.7,
    format: 'image/jpeg',
  });
}

/**
 * Get the approximate size of a base64 string in bytes
 * @param base64Data - Base64 data URL
 * @returns Size in bytes
 */
export function getBase64Size(base64Data: string): number {
  // Remove data URL prefix if present
  const base64String = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  // Calculate size accounting for base64 padding
  const padding = (base64String.match(/=/g) || []).length;
  return Math.round((base64String.length * 0.75) - padding);
}

/**
 * Check if a base64 image exceeds a size limit
 * @param base64Data - Base64 data URL
 * @param maxSizeBytes - Maximum size in bytes (default 5MB)
 * @returns True if image exceeds limit
 */
export function exceedsMaxSize(base64Data: string, maxSizeBytes: number = 5 * 1024 * 1024): boolean {
  return getBase64Size(base64Data) > maxSizeBytes;
}

/**
 * Compress an image until it fits within a size limit
 * Progressively reduces quality if needed
 * @param base64Data - Base64 data URL
 * @param maxSizeBytes - Maximum size in bytes (default 5MB)
 * @returns Compressed base64 data URL
 */
export async function compressToSize(
  base64Data: string,
  maxSizeBytes: number = 5 * 1024 * 1024
): Promise<string> {
  // Start with high quality
  let quality = 0.9;
  let compressed = base64Data;
  let attempts = 0;
  const maxAttempts = 5;

  while (exceedsMaxSize(compressed, maxSizeBytes) && attempts < maxAttempts) {
    console.log(`🔄 Attempt ${attempts + 1}: Compressing with quality ${quality}...`);

    compressed = await compressBase64Image(base64Data, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality,
      format: 'image/jpeg',
    });

    quality -= 0.15; // Reduce quality for next attempt
    attempts++;
  }

  if (exceedsMaxSize(compressed, maxSizeBytes)) {
    // If still too large, try more aggressive compression
    console.log('⚠️ Still too large, trying more aggressive compression...');
    compressed = await compressBase64Image(base64Data, {
      maxWidth: 1280,
      maxHeight: 720,
      quality: 0.5,
      format: 'image/jpeg',
    });
  }

  const finalSize = getBase64Size(compressed);
  console.log(`✅ Final size: ${Math.round(finalSize / 1024)}KB (limit: ${Math.round(maxSizeBytes / 1024)}KB)`);

  return compressed;
}
