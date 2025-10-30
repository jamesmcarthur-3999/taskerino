/**
 * Image Compression Service
 *
 * WebP compression @ 80% quality for 40-60% size reduction while maintaining
 * visual quality for AI analysis.
 *
 * Key Features:
 * - WebP format: Better compression than JPEG/PNG (40-60% smaller)
 * - Quality: 80% (optimal balance for AI vision APIs)
 * - Max dimension: 1920px (fits Claude's vision API limits)
 * - Canvas-based: Browser-native compression (no external libraries)
 *
 * Usage:
 * - Real-time screenshots: Compress for faster API calls (bandwidth optimization)
 * - Batch analysis: Optional compression (can use original quality)
 *
 * Architecture:
 * 1. Load image from base64
 * 2. Resize if needed (max 1920px)
 * 3. Convert to WebP @ 80% quality
 * 4. Return base64 + metadata
 */

export interface CompressionOptions {
  maxDimension?: number;  // Max width or height (default: 1920)
  quality?: number;       // 0-1 (default: 0.8)
  outputFormat?: 'webp' | 'jpeg' | 'png'; // Default: webp
  _fallbackAttempt?: boolean; // Internal: prevent infinite recursion
}

export interface CompressionResult {
  base64: string;         // Compressed base64 (without data URL prefix)
  mimeType: string;       // Output MIME type (e.g., 'image/webp')
  originalSize: number;   // Original size in bytes
  compressedSize: number; // Compressed size in bytes
  compressionRatio: number; // Reduction percentage (0-1)
  width: number;          // Final width
  height: number;         // Final height
}

export class ImageCompressionService {
  private readonly DEFAULT_MAX_DIMENSION = 1920;
  private readonly DEFAULT_QUALITY = 0.8;
  private readonly DEFAULT_FORMAT = 'webp';
  private webpSupported: boolean | null = null;

  /**
   * Compress image for real-time screenshot analysis
   *
   * Optimized for:
   * - Fast API calls (small payload)
   * - Sufficient quality for AI vision
   * - 40-60% size reduction
   *
   * @param base64 - Base64 image data (with or without data URL prefix)
   * @param mimeType - Original MIME type
   * @returns Compressed image result
   */
  async compressForRealtime(
    base64: string,
    mimeType: string
  ): Promise<CompressionResult> {
    return this.compress(base64, mimeType, {
      maxDimension: this.DEFAULT_MAX_DIMENSION,
      quality: this.DEFAULT_QUALITY,
      outputFormat: 'webp',
    });
  }

  /**
   * Compress image for batch analysis (optional - can use original)
   *
   * Higher quality for archival analysis:
   * - 90% quality (less compression)
   * - Preserves more detail
   * - Still 30-40% reduction
   *
   * @param base64 - Base64 image data
   * @param mimeType - Original MIME type
   * @returns Compressed image result
   */
  async compressForBatch(
    base64: string,
    mimeType: string
  ): Promise<CompressionResult> {
    return this.compress(base64, mimeType, {
      maxDimension: 2560, // Higher resolution for archival
      quality: 0.9,       // Higher quality
      outputFormat: 'webp',
    });
  }

  /**
   * Check if WebP encoding is supported
   */
  private async checkWebPSupport(): Promise<boolean> {
    if (this.webpSupported !== null) {
      return this.webpSupported;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const dataURL = canvas.toDataURL('image/webp');
      this.webpSupported = dataURL.startsWith('data:image/webp');

      if (!this.webpSupported) {
        console.warn('[ImageCompression] WebP encoding not supported, will use JPEG fallback');
      }

      return this.webpSupported;
    } catch (error) {
      console.error('[ImageCompression] Failed to check WebP support:', error);
      this.webpSupported = false;
      return false;
    }
  }

  /**
   * Compress image with custom options
   *
   * @param base64 - Base64 image data (with or without data URL prefix)
   * @param mimeType - Original MIME type
   * @param options - Compression options
   * @returns Compressed image result
   */
  async compress(
    base64: string,
    mimeType: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const startTime = performance.now();

    // Merge with defaults
    const maxDimension = options.maxDimension ?? this.DEFAULT_MAX_DIMENSION;
    const quality = options.quality ?? this.DEFAULT_QUALITY;
    let outputFormat = options.outputFormat ?? this.DEFAULT_FORMAT;

    // Check WebP support and fallback to JPEG if needed
    if (outputFormat === 'webp') {
      const webpSupported = await this.checkWebPSupport();
      if (!webpSupported) {
        outputFormat = 'jpeg';
        console.log('[ImageCompression] Falling back to JPEG (WebP not supported)');
      }
    }

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = base64;
    if (base64.startsWith('data:')) {
      base64Data = base64.split(',')[1];
    }

    // Calculate original size
    const originalSize = this.calculateBase64Size(base64Data);

    // Load image
    const img = await this.loadImage(base64Data, mimeType);

    // Calculate target dimensions (maintain aspect ratio)
    const { width, height } = this.calculateDimensions(
      img.width,
      img.height,
      maxDimension
    );

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Use high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw image
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to target format
    const outputMimeType = `image/${outputFormat}`;
    const dataURL = canvas.toDataURL(outputMimeType, quality);

    // Verify the output format matches what we requested
    // (browser may silently fall back to PNG if format not supported)
    const actualFormat = dataURL.split(';')[0].split(':')[1]; // Extract 'image/webp' from 'data:image/webp;base64,...'
    if (actualFormat !== outputMimeType && !options._fallbackAttempt) {
      console.warn(`[ImageCompression] Browser returned ${actualFormat} instead of ${outputMimeType}, retrying with actual format`);
      // Use the actual format to avoid mismatch errors (only retry once)
      const fallbackFormat = actualFormat.split('/')[1] as 'jpeg' | 'png' | 'webp';
      return this.compress(base64, mimeType, {
        ...options,
        outputFormat: fallbackFormat,
        _fallbackAttempt: true, // Prevent infinite recursion
      });
    } else if (actualFormat !== outputMimeType && options._fallbackAttempt) {
      // Fallback failed - use whatever the browser gave us
      console.error(`[ImageCompression] Format mismatch even after fallback: requested ${outputMimeType}, got ${actualFormat}`);
      // Update outputFormat to match actual to avoid API errors
      outputFormat = actualFormat.split('/')[1] as 'jpeg' | 'png' | 'webp';
    }

    // Extract compressed base64
    const compressedBase64 = dataURL.split(',')[1];
    const compressedSize = this.calculateBase64Size(compressedBase64);

    const duration = performance.now() - startTime;
    const compressionRatio = (originalSize - compressedSize) / originalSize;

    // Use actual format from dataURL for final mimeType (most reliable)
    const finalMimeType = dataURL.split(';')[0].split(':')[1] || `image/${outputFormat}`;

    console.log(`[ImageCompression] Compressed ${mimeType} → ${finalMimeType}`, {
      originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
      compressedSize: `${(compressedSize / 1024).toFixed(1)}KB`,
      reduction: `${(compressionRatio * 100).toFixed(1)}%`,
      dimensions: `${img.width}x${img.height} → ${width}x${height}`,
      duration: `${duration.toFixed(2)}ms`,
    });

    return {
      base64: compressedBase64,
      mimeType: finalMimeType, // Use actual MIME type from canvas output
      originalSize,
      compressedSize,
      compressionRatio,
      width,
      height,
    };
  }

  /**
   * Load image from base64 data
   */
  private async loadImage(base64Data: string, mimeType: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));

      // Create data URL
      img.src = `data:${mimeType};base64,${base64Data}`;
    });
  }

  /**
   * Calculate target dimensions while maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxDimension: number
  ): { width: number; height: number } {
    // Already within limits
    if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
      return { width: originalWidth, height: originalHeight };
    }

    // Calculate scale factor
    const scale = Math.min(
      maxDimension / originalWidth,
      maxDimension / originalHeight
    );

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * Calculate size of base64 string in bytes
   *
   * Base64 encoding increases size by ~33% (4 chars for 3 bytes)
   */
  private calculateBase64Size(base64: string): number {
    // Remove padding characters
    const withoutPadding = base64.replace(/=/g, '');

    // Calculate bytes: 4 base64 chars = 3 bytes
    const bytes = (withoutPadding.length * 3) / 4;

    return Math.round(bytes);
  }

  /**
   * Estimate compression ratio for planning
   *
   * WebP @ 80%: ~40-60% reduction vs JPEG/PNG
   * WebP @ 90%: ~30-40% reduction
   */
  estimateCompressionRatio(
    originalFormat: 'jpeg' | 'png' | 'webp',
    targetQuality: number = 0.8
  ): number {
    // Already WebP - minimal benefit
    if (originalFormat === 'webp') {
      return 0.1; // 10% reduction
    }

    // JPEG → WebP
    if (originalFormat === 'jpeg') {
      if (targetQuality >= 0.9) return 0.3; // 30%
      if (targetQuality >= 0.8) return 0.5; // 50%
      return 0.6; // 60%
    }

    // PNG → WebP (better compression)
    if (originalFormat === 'png') {
      if (targetQuality >= 0.9) return 0.4; // 40%
      if (targetQuality >= 0.8) return 0.6; // 60%
      return 0.7; // 70%
    }

    return 0.5; // Default 50%
  }
}

/**
 * Export singleton instance
 */
export const imageCompressionService = new ImageCompressionService();
