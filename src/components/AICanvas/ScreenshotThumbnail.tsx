/**
 * Screenshot Thumbnail Component
 *
 * Reusable thumbnail component for displaying screenshots in canvas cards.
 * Handles async loading of screenshot attachments and displays images with proper error/loading states.
 */

import React, { useState, useEffect } from 'react';
import { Camera, Loader2, ImageOff } from 'lucide-react';
import type { SessionScreenshot, Attachment } from '../../types';
import { attachmentStorage } from '../../services/attachmentStorage';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface ScreenshotThumbnailProps {
  screenshot: SessionScreenshot;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  showIcon?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function ScreenshotThumbnail({
  screenshot,
  size = 'sm',
  onClick,
  className = '',
  showIcon = false,
}: ScreenshotThumbnailProps) {
  const [imageError, setImageError] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(true);

  // Load screenshot attachment
  useEffect(() => {
    if (!screenshot) {
      console.warn('[ScreenshotThumbnail] No screenshot provided');
      setLoading(false);
      setImageError(true);
      return;
    }

    if (screenshot.attachmentId) {
      setLoading(true);

      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn('[ScreenshotThumbnail] Load timeout for screenshot:', screenshot.id);
        setLoading(false);
        setImageError(true);
      }, 5000); // 5 second timeout

      attachmentStorage
        .getAttachment(screenshot.attachmentId)
        .then((att) => {
          clearTimeout(timeout);
          setAttachment(att || null);
          setLoading(false);

          // If attachment doesn't exist but we have a legacy path, that's okay
          if (!att && !screenshot.path) {
            console.warn('[ScreenshotThumbnail] No attachment found and no legacy path for screenshot:', screenshot.id);
            setImageError(true);
          }
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error('[ScreenshotThumbnail] Failed to load screenshot attachment:', screenshot.id, err);
          setLoading(false);
          setImageError(true);
        });
    } else if (screenshot.path) {
      // Legacy screenshot with only path field
      console.log('[ScreenshotThumbnail] Using legacy path for screenshot:', screenshot.id);
      setLoading(false);
    } else {
      // No attachmentId and no path - this screenshot has no image data
      console.warn('[ScreenshotThumbnail] Screenshot has no attachmentId or path:', screenshot.id);
      setLoading(false);
      setImageError(true);
    }
  }, [screenshot]);

  // Get image URL from attachment (new) or legacy path (fallback)
  const imageUrl = attachment?.base64 || (screenshot.path ? convertFileSrc(screenshot.path) : null);

  const sizeClass = sizeClasses[size];

  return (
    <button
      onClick={onClick}
      className={`
        ${sizeClass}
        rounded
        overflow-hidden
        bg-white/20
        hover:bg-white/30
        hover:scale-105
        transition-all
        duration-200
        cursor-pointer
        border border-white/20
        relative
        group
        ${className}
      `}
      title="View screenshot"
      type="button"
    >
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={12} className="text-gray-400 animate-spin" />
        </div>
      ) : imageUrl && !imageError ? (
        <>
          <img
            src={imageUrl}
            alt="Screenshot thumbnail"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
            onError={() => setImageError(true)}
          />
          {showIcon && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
              <Camera
                size={size === 'sm' ? 10 : size === 'md' ? 12 : 14}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <ImageOff size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} className="text-gray-400" />
        </div>
      )}
    </button>
  );
}
