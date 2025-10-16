/**
 * useLazyImage Hook
 *
 * Lazy load images using IntersectionObserver API for performance optimization.
 * Only loads images when they are about to enter the viewport.
 *
 * Features:
 * - Lazy loading with IntersectionObserver
 * - Configurable root margin and threshold
 * - Loading and error states
 * - Automatic cleanup
 */

import { useState, useEffect, useRef } from 'react';
import { attachmentStorage } from '../services/attachmentStorage';

interface UseLazyImageOptions {
  rootMargin?: string;  // Load images N pixels before visible
  threshold?: number;    // Intersection threshold
  useThumbnail?: boolean; // Use thumbnail vs full image
}

export function useLazyImage(
  attachmentId: string,
  options: UseLazyImageOptions = {}
) {
  const {
    rootMargin = '200px',
    threshold = 0.01,
    useThumbnail = true,
  } = options;

  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Skip if already loaded
    if (src) return;

    // Skip if no element to observe
    if (!imgRef.current) return;

    const loadImage = async () => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const attachment = await attachmentStorage.getAttachment(attachmentId);

        if (!attachment) {
          throw new Error(`Attachment ${attachmentId} not found`);
        }

        // Use thumbnail if available and requested
        const imageData = useThumbnail && attachment.thumbnail
          ? attachment.thumbnail
          : attachment.base64;

        if (!imageData) {
          throw new Error(`No image data for attachment ${attachmentId}`);
        }

        setSrc(imageData);
      } catch (err) {
        console.error(`Failed to load image ${attachmentId}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to load image'));
      } finally {
        setLoading(false);
      }
    };

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            // Stop observing once loaded
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    // Start observing
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [attachmentId, src, loading, rootMargin, threshold, useThumbnail]);

  return {
    src,
    loading,
    error,
    imgRef,
  };
}
