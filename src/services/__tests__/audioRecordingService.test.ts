/**
 * Integration Tests for AudioRecordingService
 *
 * Tests the complete audio recording pipeline integration with Tauri backend.
 * Task 3.9 - Phase 2: TypeScript Integration Tests
 *
 * PRODUCTION QUALITY: These tests verify actual service behavior, TypeScript
 * type safety, and integration with the Tauri audio system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioRecordingService } from '../audioRecordingService';
import type { Session, SessionAudioSegment, AudioDevice, AudioDeviceConfig } from '../../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock Tauri event listener
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

// Mock OpenAI service
vi.mock('../openAIService', () => ({
  openAIService: {
    hasApiKey: vi.fn(),
    transcribeAudio: vi.fn(),
  },
}));

// Mock audio storage service
vi.mock('../audioStorageService', () => ({
  audioStorageService: {
    saveAudioChunk: vi.fn(),
  },
}));

// Mock audio compression service
vi.mock('../audioCompressionService', () => ({
  audioCompressionService: {
    compressForAPI: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openAIService } from '../openAIService';
import { audioStorageService } from '../audioStorageService';
import { audioCompressionService } from '../audioCompressionService';

describe('AudioRecordingService - Integration Tests', () => {
  let service: AudioRecordingService;
  let mockSession: Session;
  let mockOnAudioSegmentProcessed: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AudioRecordingService();
    mockOnAudioSegmentProcessed = vi.fn();

    // Mock session
    mockSession = {
      id: 'test-session-123',
      name: 'Test Session',
      audioRecording: true,
      audioConfig: {
        sourceType: 'microphone', // Important: determines enableMicrophone/enableSystemAudio
        balance: 50,
      },
    } as Session;

    // Default mock implementations
    (openAIService.hasApiKey as any).mockResolvedValue(true);
    (openAIService.transcribeAudio as any).mockResolvedValue('Test transcription');
    (audioStorageService.saveAudioChunk as any).mockResolvedValue({
      id: 'attachment-123',
      name: 'audio-segment.wav',
      type: 'audio',
    });
    (audioCompressionService.compressForAPI as any).mockResolvedValue('compressed-audio-base64');
  });

  afterEach(() => {
    // Clean up any active recordings
    service.stopRecording();
  });

  // =========================================================================
  // Suite 1: Service Integration - Basic Lifecycle
  // =========================================================================

  describe('Service Integration - Basic Lifecycle', () => {
    it('should start microphone recording', async () => {
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});

      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      // Verify Tauri command invoked correctly (no chunkDurationSecs - defaults to 10s)
      expect(invoke).toHaveBeenCalledWith('start_audio_recording_with_config', {
        sessionId: mockSession.id,
        config: {
          enableMicrophone: true,
          enableSystemAudio: false,
          balance: 50,
          microphoneDeviceName: null,
          systemAudioDeviceName: null,
        },
      });

      // Verify service state updated
      expect(service.isCurrentlyRecording()).toBe(true);
      expect(service.getActiveSessionId()).toBe(mockSession.id);

      // Verify event listener registered
      expect(listen).toHaveBeenCalledWith('audio-chunk', expect.any(Function));
    });

    it('should stop recording and return to idle state', async () => {
      // Start recording first
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});

      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      // Now stop
      (invoke as any).mockResolvedValueOnce(undefined);
      await service.stopRecording();

      // Verify stop command called
      expect(invoke).toHaveBeenCalledWith('stop_audio_recording');

      // Verify service state updated
      expect(service.isCurrentlyRecording()).toBe(false);

      // Note: activeSessionId is cleared after 5s grace period for pending chunks
    });

    it('should pause and resume recording', async () => {
      // Start
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      // Pause
      (invoke as any).mockResolvedValueOnce(undefined);
      await service.pauseRecording();

      expect(invoke).toHaveBeenCalledWith('pause_audio_recording');
      expect(service.isCurrentlyRecording()).toBe(false);

      // Resume
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.resumeRecording(mockSession, mockOnAudioSegmentProcessed);

      expect(invoke).toHaveBeenCalledWith('start_audio_recording_with_config', expect.any(Object));
      expect(service.isCurrentlyRecording()).toBe(true);
    });

    it('should not start recording if audio is disabled in session', async () => {
      const sessionWithoutAudio = { ...mockSession, audioRecording: false };

      await service.startRecording(sessionWithoutAudio, mockOnAudioSegmentProcessed);

      // Should not invoke Tauri command
      expect(invoke).not.toHaveBeenCalled();
      expect(service.isCurrentlyRecording()).toBe(false);
    });

    it('should throw error if OpenAI API key not set', async () => {
      (openAIService.hasApiKey as any).mockResolvedValue(false);

      await expect(
        service.startRecording(mockSession, mockOnAudioSegmentProcessed)
      ).rejects.toThrow('OpenAI API key not set');

      expect(invoke).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Suite 2: Audio Processing Pipeline
  // =========================================================================

  describe('Audio Processing Pipeline', () => {
    it('should process audio chunk and create audio segment', async () => {
      // Start recording to set active session
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      const audioBase64 = 'base64-audio-data';
      const duration = 30; // seconds

      // Process chunk
      await service.processAudioChunk(
        audioBase64,
        duration,
        mockSession.id,
        mockOnAudioSegmentProcessed
      );

      // Verify storage was called
      expect(audioStorageService.saveAudioChunk).toHaveBeenCalledWith(
        audioBase64,
        mockSession.id,
        0, // first chunk
        duration
      );

      // Verify compression was called
      expect(audioCompressionService.compressForAPI).toHaveBeenCalledWith(
        audioBase64,
        'transcription'
      );

      // Verify transcription was called
      expect(openAIService.transcribeAudio).toHaveBeenCalledWith('compressed-audio-base64');

      // Verify callback was called with audio segment
      expect(mockOnAudioSegmentProcessed).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          sessionId: mockSession.id,
          timestamp: expect.any(String),
          duration: duration,
          transcription: 'Test transcription',
          attachmentId: 'attachment-123',
        })
      );
    });

    it('should ignore audio chunks for inactive sessions', async () => {
      const audioBase64 = 'base64-audio-data';
      const duration = 30;

      // Process chunk without starting recording
      await service.processAudioChunk(
        audioBase64,
        duration,
        'different-session-id',
        mockOnAudioSegmentProcessed
      );

      // Should not process
      expect(audioStorageService.saveAudioChunk).not.toHaveBeenCalled();
      expect(mockOnAudioSegmentProcessed).not.toHaveBeenCalled();
    });

    it('should handle audio processing errors gracefully', async () => {
      // Start recording
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      // Mock storage error
      (audioStorageService.saveAudioChunk as any).mockRejectedValue(
        new Error('Storage failed')
      );

      const audioBase64 = 'base64-audio-data';
      const duration = 30;

      // Should not throw - errors are logged
      await expect(
        service.processAudioChunk(audioBase64, duration, mockSession.id, mockOnAudioSegmentProcessed)
      ).resolves.not.toThrow();

      // Callback should not be called on error
      expect(mockOnAudioSegmentProcessed).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Suite 3: Device Management
  // =========================================================================

  describe('Device Management', () => {
    it('should enumerate audio devices', async () => {
      const mockDevices: AudioDevice[] = [
        {
          id: 'device-1',
          name: 'MacBook Pro Microphone',
          deviceType: 'Input',
          isDefault: true,
          sampleRate: 48000,
          channels: 2,
        },
        {
          id: 'device-2',
          name: 'External USB Mic',
          deviceType: 'Input',
          isDefault: false,
          sampleRate: 44100,
          channels: 1,
        },
      ];

      (invoke as any).mockResolvedValueOnce(mockDevices);

      const devices = await service.getAudioDevices();

      expect(invoke).toHaveBeenCalledWith('get_audio_devices');
      expect(devices).toEqual(mockDevices);
      expect(devices).toHaveLength(2);
      expect(devices[0].isDefault).toBe(true);
    });

    it('should handle device enumeration errors', async () => {
      (invoke as any).mockRejectedValueOnce(new Error('No audio devices found'));

      await expect(service.getAudioDevices()).rejects.toThrow(
        'Failed to enumerate audio devices'
      );
    });

    it('should validate device enumeration response format', async () => {
      // Mock invalid response (not an array)
      (invoke as any).mockResolvedValueOnce({ invalid: 'response' });

      await expect(service.getAudioDevices()).rejects.toThrow(
        'Invalid response from get_audio_devices - expected array'
      );
    });
  });

  // =========================================================================
  // Suite 4: Mix Configuration
  // =========================================================================

  describe('Mix Configuration', () => {
    it('should set audio mix balance', async () => {
      const config: AudioDeviceConfig = {
        enableMicrophone: true,
        enableSystemAudio: true,
        balance: 70, // 70% system audio
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await service.setMixConfig(config);

      expect(invoke).toHaveBeenCalledWith('update_audio_balance', {
        balance: 70,
      });
    });

    it('should handle mix config errors', async () => {
      const config: AudioDeviceConfig = {
        enableMicrophone: true,
        enableSystemAudio: true,
        balance: 50,
      };

      (invoke as any).mockRejectedValueOnce(new Error('Failed to update balance'));

      await expect(service.setMixConfig(config)).rejects.toThrow();
    });
  });

  // =========================================================================
  // Suite 5: Type Safety and API Contract
  // =========================================================================

  describe('Type Safety and API Contract', () => {
    it('should return correct types from getAudioDevices', async () => {
      const mockDevices: AudioDevice[] = [
        {
          id: 'device-1',
          name: 'Test Mic',
          deviceType: 'Input',
          isDefault: true,
          sampleRate: 48000,
          channels: 2,
        },
      ];

      (invoke as any).mockResolvedValueOnce(mockDevices);

      const devices = await service.getAudioDevices();

      // TypeScript compile-time check ensures type safety
      const device = devices[0];
      expect(device.id).toBe('device-1');
      expect(device.name).toBe('Test Mic');
      expect(device.deviceType).toBe('Input');
      expect(device.isDefault).toBe(true);
      expect(device.sampleRate).toBe(48000);
      expect(device.channels).toBe(2);
    });

    it('should create SessionAudioSegment with correct structure', async () => {
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      await service.processAudioChunk(
        'audio-data',
        30,
        mockSession.id,
        mockOnAudioSegmentProcessed
      );

      const segment = mockOnAudioSegmentProcessed.mock.calls[0][0] as SessionAudioSegment;

      // Verify all required fields are present
      expect(segment).toHaveProperty('id');
      expect(segment).toHaveProperty('sessionId');
      expect(segment).toHaveProperty('timestamp');
      expect(segment).toHaveProperty('duration');
      expect(segment).toHaveProperty('transcription');
      expect(segment).toHaveProperty('attachmentId');

      // Verify field types
      expect(typeof segment.id).toBe('string');
      expect(segment.sessionId).toBe(mockSession.id);
      expect(typeof segment.timestamp).toBe('string');
      expect(typeof segment.duration).toBe('number');
      expect(typeof segment.transcription).toBe('string');
      expect(typeof segment.attachmentId).toBe('string');
    });
  });

  // =========================================================================
  // Suite 6: Edge Cases and Error Handling
  // =========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle stop when not recording', async () => {
      // Should not throw
      await expect(service.stopRecording()).resolves.not.toThrow();

      // Should not call Tauri command
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should handle pause when not recording', async () => {
      await expect(service.pauseRecording()).resolves.not.toThrow();
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should handle resume when already recording', async () => {
      // Start recording
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      vi.clearAllMocks();

      // Try to resume while already recording
      await service.resumeRecording(mockSession, mockOnAudioSegmentProcessed);

      // Should not start again
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should handle Tauri command failures gracefully', async () => {
      (invoke as any).mockRejectedValueOnce(new Error('Tauri command failed'));

      await expect(
        service.startRecording(mockSession, mockOnAudioSegmentProcessed)
      ).rejects.toThrow();

      // Service should remain in stopped state
      expect(service.isCurrentlyRecording()).toBe(false);
    });

    it('should maintain segment counter across multiple chunks', async () => {
      // Start recording
      (invoke as any).mockResolvedValueOnce(undefined);
      (listen as any).mockResolvedValueOnce(() => {});
      await service.startRecording(mockSession, mockOnAudioSegmentProcessed);

      // Process multiple chunks
      for (let i = 0; i < 3; i++) {
        await service.processAudioChunk(
          'audio-data',
          30,
          mockSession.id,
          mockOnAudioSegmentProcessed
        );
      }

      // Verify storage was called with incrementing indices
      expect(audioStorageService.saveAudioChunk).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        mockSession.id,
        0,
        30
      );
      expect(audioStorageService.saveAudioChunk).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        mockSession.id,
        1,
        30
      );
      expect(audioStorageService.saveAudioChunk).toHaveBeenNthCalledWith(
        3,
        expect.any(String),
        mockSession.id,
        2,
        30
      );
    });
  });
});
