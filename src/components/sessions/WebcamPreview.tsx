import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertCircle } from 'lucide-react';

interface WebcamPreviewProps {
  webcamDeviceId?: string;
  className?: string;
}

/**
 * WebcamPreview - Live webcam feed preview
 *
 * Uses browser's getUserMedia API to show live webcam feed
 * Falls back to placeholder if permission denied or device unavailable
 */
export function WebcamPreview({ webcamDeviceId, className = '' }: WebcamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const startWebcam = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Stop existing stream if any
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Request webcam access
        // Only use deviceId constraint if we have a valid non-empty device ID
        const hasValidDeviceId = webcamDeviceId && webcamDeviceId.trim() !== '';

        console.log(`🎥 [WEBCAM PREVIEW] Starting webcam with deviceId:`, {
          webcamDeviceId,
          hasValidDeviceId,
        });

        // Use 'ideal' instead of 'exact' to gracefully fall back if device unavailable
        // This prevents OverconstrainedError when device ID is stale or device disconnected
        const constraints: MediaStreamConstraints = {
          video: hasValidDeviceId
            ? { deviceId: { ideal: webcamDeviceId } }
            : true,
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!mounted) {
          // Component unmounted, stop stream
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Log which camera was actually selected
        const videoTrack = stream.getVideoTracks()[0];
        const actualDeviceId = videoTrack?.getSettings().deviceId;
        const actualLabel = videoTrack?.label;
        console.log(`✅ [WEBCAM PREVIEW] Webcam started:`, {
          requested: webcamDeviceId,
          actual: actualDeviceId,
          label: actualLabel,
          matchesRequested: actualDeviceId === webcamDeviceId
        });

        streamRef.current = stream;

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log(`📺 [WEBCAM PREVIEW] Stream attached to video element`, {
            videoElement: videoRef.current,
            stream,
            tracks: stream.getTracks().length
          });

          // Force video to play (some browsers need this)
          videoRef.current.play().catch(err => {
            console.warn('⚠️ [WEBCAM PREVIEW] Video play() failed (might be autoplay policy):', err);
          });
        } else {
          console.error('❌ [WEBCAM PREVIEW] Video ref is null, cannot attach stream');
        }

        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;

        console.error('❌ [WEBCAM PREVIEW] Failed to access webcam:', err);

        if (err instanceof Error) {
          if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setError('No webcam found');
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setError('Camera permission denied');
          } else if (err.name === 'NotReadableError') {
            setError('Webcam in use by another app');
          } else if (err.name === 'OverconstrainedError') {
            console.error('❌ [WEBCAM PREVIEW] OverconstrainedError - invalid deviceId:', webcamDeviceId);
            setError('Selected camera not available');
          } else {
            setError('Failed to access webcam');
          }
        } else {
          setError('Failed to access webcam');
        }

        setIsLoading(false);
      }
    };

    startWebcam();

    // Cleanup
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [webcamDeviceId]);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
      {/* Always render video element so ref is available */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isLoading || error ? 'hidden' : ''}`}
        style={{
          minHeight: '200px',
          transform: 'scaleX(-1)' // Mirror the video (common for front-facing cameras)
        }}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          console.log('🎬 [WEBCAM PREVIEW] Video metadata loaded:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            paused: video.paused
          });
        }}
        onPlaying={() => {
          console.log('▶️ [WEBCAM PREVIEW] Video is now playing');
        }}
        onError={(e) => {
          console.error('❌ [WEBCAM PREVIEW] Video element error:', e);
        }}
      />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <AlertCircle size={32} className="text-red-500 mb-2" />
          <p className="text-sm font-medium text-gray-700">{error}</p>
          <p className="text-xs text-gray-500 mt-1">Check camera permissions in System Settings</p>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <Camera size={32} className="text-gray-400 mb-2 animate-pulse" />
          <p className="text-sm font-medium text-gray-600">Loading webcam...</p>
        </div>
      )}
    </div>
  );
}
