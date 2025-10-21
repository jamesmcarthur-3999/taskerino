/**
 * CanvasImageGallery - Data Display Component
 *
 * Image grid/carousel with lightbox support.
 * Displays screenshots and other images with captions and timestamps.
 *
 * Supports both direct URLs and attachment IDs - automatically loads
 * attachment data from storage when needed.
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { ImageGalleryProps } from '../types';
import type { Attachment } from '../../../types';
import { getRadiusClass } from '../../../design-system/theme';
import { attachmentStorage } from '../../../services/attachmentStorage';

/**
 * Detect if a URL is actually an attachment ID that needs to be loaded
 */
function isAttachmentId(url: string): boolean {
  // UUID format or short ID without protocol
  return !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:');
}

export function CanvasImageGallery({
  images,
  layout = 'grid',
  columns = 3,
  showCaptions = true,
  clickable = true,
}: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<string, string>>({}); // attachmentId -> dataUrl
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [errorImages, setErrorImages] = useState<Record<string, boolean>>({});

  // Load attachments for images that need it
  useEffect(() => {
    const loadAttachments = async () => {
      for (const image of images) {
        // Skip if already loaded, loading, errored, or is a direct URL
        if (
          loadedImages[image.url] ||
          loadingImages[image.url] ||
          errorImages[image.url] ||
          !isAttachmentId(image.url)
        ) {
          continue;
        }

        // Mark as loading
        setLoadingImages((prev) => ({ ...prev, [image.url]: true }));

        try {
          const attachment = await attachmentStorage.getAttachment(image.url);
          if (attachment && attachment.base64) {
            setLoadedImages((prev) => ({ ...prev, [image.url]: attachment.base64! }));
          } else {
            console.warn('[CanvasImageGallery] No base64 data for attachment:', image.url);
            setErrorImages((prev) => ({ ...prev, [image.url]: true }));
          }
        } catch (error) {
          console.error('[CanvasImageGallery] Failed to load attachment:', image.url, error);
          setErrorImages((prev) => ({ ...prev, [image.url]: true }));
        } finally {
          setLoadingImages((prev) => ({ ...prev, [image.url]: false }));
        }
      }
    };

    loadAttachments();
  }, [images, loadedImages, loadingImages, errorImages]);

  // Get the actual URL to use for rendering (loaded attachment or original URL)
  const getImageUrl = (image: typeof images[0]) => {
    if (loadedImages[image.url]) {
      return loadedImages[image.url];
    }
    if (isAttachmentId(image.url)) {
      return null; // Still loading or errored
    }
    return image.url; // Direct URL
  };

  const openLightbox = (index: number) => {
    if (clickable) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const closeLightbox = () => setLightboxOpen(false);

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (layout === 'carousel') {
    // Carousel layout (horizontal scroll)
    return (
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4">
          {images.map((image, index) => {
            const imageUrl = getImageUrl(image);
            const isLoading = loadingImages[image.url];
            const hasError = errorImages[image.url];

            return (
              <div
                key={image.id}
                className="flex-shrink-0 cursor-pointer"
                onClick={() => !isLoading && !hasError && openLightbox(index)}
              >
                <div className={`w-64 h-40 ${getRadiusClass('card')} shadow-md hover:shadow-lg transition-shadow flex items-center justify-center bg-gray-100 overflow-hidden`}>
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  ) : hasError || !imageUrl ? (
                    <div className="text-gray-400 text-sm">Image unavailable</div>
                  ) : (
                    <img
                      src={imageUrl}
                      alt={image.caption || `Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {showCaptions && (image.caption || image.timestamp) && (
                  <div className="mt-2 text-sm text-gray-600">
                    {image.caption && <div>{image.caption}</div>}
                    {image.timestamp && <div className="text-xs text-gray-400">{image.timestamp}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (layout === 'masonry') {
    // Masonry layout (Pinterest-style)
    return (
      <>
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
          {images.map((image, index) => {
            const imageUrl = getImageUrl(image);
            const isLoading = loadingImages[image.url];
            const hasError = errorImages[image.url];

            return (
              <div
                key={image.id}
                className="break-inside-avoid mb-4 cursor-pointer"
                onClick={() => !isLoading && !hasError && openLightbox(index)}
              >
                <div className={`w-full ${getRadiusClass('card')} shadow-md hover:shadow-lg transition-shadow bg-gray-100 overflow-hidden flex items-center justify-center min-h-[12rem]`}>
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  ) : hasError || !imageUrl ? (
                    <div className="text-gray-400 text-sm p-4">Image unavailable</div>
                  ) : (
                    <img
                      src={imageUrl}
                      alt={image.caption || `Image ${index + 1}`}
                      className="w-full"
                    />
                  )}
                </div>
                {showCaptions && (image.caption || image.timestamp) && (
                  <div className="mt-2 text-sm text-gray-600">
                    {image.caption && <div>{image.caption}</div>}
                    {image.timestamp && <div className="text-xs text-gray-400">{image.timestamp}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {lightboxOpen && <Lightbox />}
      </>
    );
  }

  // Grid layout (default)
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  function Lightbox() {
    const currentImage = images[lightboxIndex];
    const currentImageUrl = getImageUrl(currentImage);

    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={closeLightbox}
      >
        {/* Close button */}
        <button
          onClick={closeLightbox}
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-4 text-white hover:text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-12 h-12" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-4 text-white hover:text-gray-300 transition-colors"
            >
              <ChevronRight className="w-12 h-12" />
            </button>
          </>
        )}

        {/* Image */}
        <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={currentImage.caption || `Image ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-white text-center">Image unavailable</div>
          )}
          {(currentImage.caption || currentImage.timestamp) && (
            <div className="mt-4 text-center text-white">
              {currentImage.caption && <div className="text-lg">{currentImage.caption}</div>}
              {currentImage.timestamp && (
                <div className="text-sm text-gray-300">{currentImage.timestamp}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {images.map((image, index) => {
          const imageUrl = getImageUrl(image);
          const isLoading = loadingImages[image.url];
          const hasError = errorImages[image.url];

          return (
            <div
              key={image.id}
              className={`cursor-pointer ${clickable ? 'hover:opacity-90 transition-opacity' : ''}`}
              onClick={() => !isLoading && !hasError && openLightbox(index)}
            >
              <div className={`w-full h-48 ${getRadiusClass('card')} shadow-md hover:shadow-lg transition-shadow bg-gray-100 overflow-hidden flex items-center justify-center`}>
                {isLoading ? (
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                ) : hasError || !imageUrl ? (
                  <div className="text-gray-400 text-sm">Image unavailable</div>
                ) : (
                  <img
                    src={imageUrl}
                    alt={image.caption || `Image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {showCaptions && (image.caption || image.timestamp) && (
                <div className="mt-2 text-sm text-gray-600">
                  {image.caption && <div>{image.caption}</div>}
                  {image.timestamp && <div className="text-xs text-gray-400">{image.timestamp}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {lightboxOpen && <Lightbox />}
    </>
  );
}
