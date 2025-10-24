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
        const constraints: MediaStreamConstraints = {
          video: webcamDeviceId
            ? { deviceId: { exact: webcamDeviceId } }
            : true,
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!mounted) {
          // Component unmounted, stop stream
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
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

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-xl ${className}`}>
        <AlertCircle size={32} className="text-red-500 mb-2" />
        <p className="text-sm font-medium text-gray-700">{error}</p>
        <p className="text-xs text-gray-500 mt-1">Check camera permissions in System Settings</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-xl ${className}`}>
        <Camera size={32} className="text-gray-400 mb-2 animate-pulse" />
        <p className="text-sm font-medium text-gray-600">Loading webcam...</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
    </div>
  );
}
