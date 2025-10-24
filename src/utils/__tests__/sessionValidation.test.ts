import { describe, it, expect } from 'vitest';
import {
  validateAudioConfig,
  validateVideoConfig,
  validateSession,
  type ValidationResult,
} from '../sessionValidation';
import type {
  AudioDeviceConfig,
  VideoRecordingConfig,
  Session,
  AudioSourceType,
  VideoSourceType,
} from '../../types';

describe('sessionValidation', () => {
  describe('validateAudioConfig', () => {
    describe('valid configurations', () => {
      it('should validate microphone-only config', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'microphone',
          micDeviceId: 'mic-123',
          micVolume: 0.8,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate system-audio-only config', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'system-audio',
          systemAudioDeviceId: 'sys-456',
          systemVolume: 0.9,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate both sources config with balance', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: 'mic-123',
          systemAudioDeviceId: 'sys-456',
          balance: 50,
          micVolume: 0.8,
          systemVolume: 0.7,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate config with boundary values', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: 'mic-123',
          systemAudioDeviceId: 'sys-456',
          balance: 0, // Min balance
          micVolume: 0.0, // Min volume
          systemVolume: 1.0, // Max volume
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('invalid configurations', () => {
      it('should reject null config', () => {
        const result = validateAudioConfig(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Audio config cannot be null or undefined');
      });

      it('should reject undefined config', () => {
        const result = validateAudioConfig(undefined as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Audio config cannot be null or undefined');
      });

      it('should reject invalid source type', () => {
        const config = {
          sourceType: 'invalid-type' as AudioSourceType,
          micDeviceId: 'mic-123',
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid sourceType'))).toBe(true);
      });

      it('should reject microphone config without device ID', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'microphone',
          micDeviceId: undefined as any,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('micDeviceId'))).toBe(true);
      });

      it('should reject microphone config with empty device ID', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'microphone',
          micDeviceId: '  ', // Empty string
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('micDeviceId'))).toBe(true);
      });

      it('should reject system-audio config without device ID', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'system-audio',
          systemAudioDeviceId: undefined as any,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('systemAudioDeviceId'))).toBe(true);
      });

      it('should reject both config without mic device', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: '',
          systemAudioDeviceId: 'sys-456',
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('micDeviceId'))).toBe(true);
      });

      it('should reject both config without system device', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: 'mic-123',
          systemAudioDeviceId: undefined as any,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('systemAudioDeviceId'))).toBe(true);
      });

      it('should reject balance outside 0-100 range', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: 'mic-123',
          systemAudioDeviceId: 'sys-456',
          balance: 101,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('balance'))).toBe(true);
      });

      it('should reject negative balance', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: 'mic-123',
          systemAudioDeviceId: 'sys-456',
          balance: -1,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('balance'))).toBe(true);
      });

      it('should reject NaN balance', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'both',
          micDeviceId: 'mic-123',
          systemAudioDeviceId: 'sys-456',
          balance: NaN,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('balance'))).toBe(true);
      });

      it('should reject volume outside 0-1 range', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'microphone',
          micDeviceId: 'mic-123',
          micVolume: 1.5,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('micVolume'))).toBe(true);
      });

      it('should reject negative volume', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'system-audio',
          systemAudioDeviceId: 'sys-456',
          systemVolume: -0.1,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('systemVolume'))).toBe(true);
      });

      it('should reject NaN volume', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'microphone',
          micDeviceId: 'mic-123',
          micVolume: NaN,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('micVolume'))).toBe(true);
      });

      it('should reject Infinity volume', () => {
        const config: AudioDeviceConfig = {
          sourceType: 'system-audio',
          systemAudioDeviceId: 'sys-456',
          systemVolume: Infinity,
        };

        const result = validateAudioConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('systemVolume'))).toBe(true);
      });
    });
  });

  describe('validateVideoConfig', () => {
    describe('valid configurations', () => {
      it('should validate display-only config', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate window config', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'window',
          windowId: 'window-123',
          quality: 'high',
          fps: 60,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate webcam config', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'webcam',
          webcamDeviceId: 'cam-456',
          quality: 'low',
          fps: 15,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate display-with-webcam config with PiP', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display-with-webcam',
          displayIds: ['display-1'],
          webcamDeviceId: 'cam-456',
          pipConfig: {
            enabled: true,
            position: 'bottom-right',
            size: 'small',
            borderRadius: 10,
          },
          quality: 'ultra',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate config with resolution', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'high',
          fps: 30,
          resolution: {
            width: 1920,
            height: 1080,
          },
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate config with multiple displays', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1', 'display-2'],
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('invalid configurations', () => {
      it('should reject null config', () => {
        const result = validateVideoConfig(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Video config cannot be null or undefined');
      });

      it('should reject undefined config', () => {
        const result = validateVideoConfig(undefined as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Video config cannot be null or undefined');
      });

      it('should reject invalid source type', () => {
        const config = {
          sourceType: 'invalid-type' as VideoSourceType,
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid sourceType'))).toBe(true);
      });

      it('should reject display config without displayIds', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: undefined,
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('displayId'))).toBe(true);
      });

      it('should reject display config with empty displayIds', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: [],
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('displayId'))).toBe(true);
      });

      it('should reject display config with empty string in displayIds', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1', '', 'display-2'],
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('displayIds cannot contain empty strings'))).toBe(true);
      });

      it('should reject window config without windowId', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'window',
          windowId: undefined as any,
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('windowId'))).toBe(true);
      });

      it('should reject window config with empty windowId', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'window',
          windowId: '   ',
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('windowId'))).toBe(true);
      });

      it('should reject webcam config without webcamDeviceId', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'webcam',
          webcamDeviceId: undefined as any,
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('webcamDeviceId'))).toBe(true);
      });

      it('should reject display-with-webcam without displayIds', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display-with-webcam',
          displayIds: [],
          webcamDeviceId: 'cam-456',
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('displayId'))).toBe(true);
      });

      it('should reject display-with-webcam without webcamDeviceId', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display-with-webcam',
          displayIds: ['display-1'],
          webcamDeviceId: '',
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('webcamDeviceId'))).toBe(true);
      });

      it('should reject invalid PiP position', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display-with-webcam',
          displayIds: ['display-1'],
          webcamDeviceId: 'cam-456',
          pipConfig: {
            enabled: true,
            position: 'invalid-position' as any,
            size: 'small',
          },
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('PiP position'))).toBe(true);
      });

      it('should reject invalid PiP size', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display-with-webcam',
          displayIds: ['display-1'],
          webcamDeviceId: 'cam-456',
          pipConfig: {
            enabled: true,
            position: 'bottom-right',
            size: 'invalid-size' as any,
          },
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('PiP size'))).toBe(true);
      });

      it('should reject negative PiP borderRadius', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display-with-webcam',
          displayIds: ['display-1'],
          webcamDeviceId: 'cam-456',
          pipConfig: {
            enabled: true,
            position: 'bottom-right',
            size: 'small',
            borderRadius: -5,
          },
          quality: 'medium',
          fps: 30,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('PiP borderRadius'))).toBe(true);
      });

      it('should reject invalid quality', () => {
        const config = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'invalid-quality',
          fps: 30,
        } as any;

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Invalid quality'))).toBe(true);
      });

      it('should reject fps below minimum', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: 5,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('fps'))).toBe(true);
      });

      it('should reject fps above maximum', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: 120,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('fps'))).toBe(true);
      });

      it('should reject NaN fps', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: NaN,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('fps'))).toBe(true);
      });

      it('should reject Infinity fps', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: Infinity,
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('fps'))).toBe(true);
      });

      it('should reject resolution width below minimum', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: 30,
          resolution: {
            width: 320,
            height: 1080,
          },
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Resolution width'))).toBe(true);
      });

      it('should reject resolution height below minimum', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: 30,
          resolution: {
            width: 1920,
            height: 240,
          },
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Resolution height'))).toBe(true);
      });

      it('should reject NaN resolution dimensions', () => {
        const config: VideoRecordingConfig = {
          sourceType: 'display',
          displayIds: ['display-1'],
          quality: 'medium',
          fps: 30,
          resolution: {
            width: NaN,
            height: 1080,
          },
        };

        const result = validateVideoConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Resolution width'))).toBe(true);
      });
    });
  });

  describe('validateSession', () => {
    describe('valid sessions', () => {
      it('should validate minimal session', () => {
        const session: Partial<Session> = {
          name: 'Test Session',
          description: 'A test session',
          screenshotInterval: 2,
        };

        const result = validateSession(session);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate session with audio enabled', () => {
        const session: Partial<Session> = {
          name: 'Audio Session',
          audioRecording: true,
          audioConfig: {
            sourceType: 'microphone',
            micDeviceId: 'mic-123',
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate session with video enabled', () => {
        const session: Partial<Session> = {
          name: 'Video Session',
          videoRecording: true,
          videoConfig: {
            sourceType: 'display',
            displayIds: ['display-1'],
            quality: 'high',
            fps: 30,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate session with both audio and video', () => {
        const session: Partial<Session> = {
          name: 'Full Session',
          audioRecording: true,
          audioConfig: {
            sourceType: 'both',
            micDeviceId: 'mic-123',
            systemAudioDeviceId: 'sys-456',
          },
          videoRecording: true,
          videoConfig: {
            sourceType: 'display-with-webcam',
            displayIds: ['display-1'],
            webcamDeviceId: 'cam-789',
            quality: 'ultra',
            fps: 60,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate session with enrichment config', () => {
        const session: Partial<Session> = {
          name: 'Enriched Session',
          enrichmentConfig: {
            includeAudioReview: true,
            includeVideoChapters: true,
            autoEnrichOnComplete: false,
            maxCostThreshold: 5.0,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate session with adaptive screenshots', () => {
        const session: Partial<Session> = {
          name: 'Adaptive Session',
          screenshotInterval: -1, // Adaptive mode
        };

        const result = validateSession(session);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('invalid sessions', () => {
      it('should reject null session', () => {
        const result = validateSession(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Session cannot be null or undefined');
      });

      it('should reject undefined session', () => {
        const result = validateSession(undefined as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Session cannot be null or undefined');
      });

      it('should reject empty session name', () => {
        const session: Partial<Session> = {
          name: '   ',
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Session name'))).toBe(true);
      });

      it('should reject non-string description', () => {
        const session = {
          name: 'Test',
          description: 123 as any,
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('description'))).toBe(true);
      });

      it('should reject invalid screenshot interval', () => {
        const session: Partial<Session> = {
          name: 'Test',
          screenshotInterval: 0,
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('screenshotInterval'))).toBe(true);
      });

      it('should reject NaN screenshot interval', () => {
        const session: Partial<Session> = {
          name: 'Test',
          screenshotInterval: NaN,
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('screenshotInterval'))).toBe(true);
      });

      it('should reject audio recording without config', () => {
        const session: Partial<Session> = {
          name: 'Test',
          audioRecording: true,
          audioConfig: undefined,
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('audioConfig is required'))).toBe(true);
      });

      it('should reject audio recording with invalid config', () => {
        const session: Partial<Session> = {
          name: 'Test',
          audioRecording: true,
          audioConfig: {
            sourceType: 'microphone',
            micDeviceId: '', // Invalid
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Audio config'))).toBe(true);
      });

      it('should reject video recording without config', () => {
        const session: Partial<Session> = {
          name: 'Test',
          videoRecording: true,
          videoConfig: undefined,
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('videoConfig is required'))).toBe(true);
      });

      it('should reject video recording with invalid config', () => {
        const session: Partial<Session> = {
          name: 'Test',
          videoRecording: true,
          videoConfig: {
            sourceType: 'display',
            displayIds: [], // Invalid
            quality: 'medium',
            fps: 30,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Video config'))).toBe(true);
      });

      it('should reject enrichment config with invalid fields', () => {
        const session = {
          name: 'Test',
          enrichmentConfig: {
            includeAudioReview: 'yes' as any, // Should be boolean
            includeVideoChapters: true,
            autoEnrichOnComplete: true,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('includeAudioReview'))).toBe(true);
      });

      it('should reject negative maxCostThreshold', () => {
        const session: Partial<Session> = {
          name: 'Test',
          enrichmentConfig: {
            includeAudioReview: true,
            includeVideoChapters: true,
            autoEnrichOnComplete: true,
            maxCostThreshold: -10,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('maxCostThreshold'))).toBe(true);
      });

      it('should reject NaN maxCostThreshold', () => {
        const session: Partial<Session> = {
          name: 'Test',
          enrichmentConfig: {
            includeAudioReview: true,
            includeVideoChapters: true,
            autoEnrichOnComplete: true,
            maxCostThreshold: NaN,
          },
        };

        const result = validateSession(session);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('maxCostThreshold'))).toBe(true);
      });
    });
  });
});
