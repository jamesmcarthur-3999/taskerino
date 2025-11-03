/**
 * ScreenRecorder C Header
 *
 * C-compatible function declarations for Rust FFI integration.
 * These functions are implemented in ScreenRecorder.swift using @_cdecl.
 */

#ifndef SCREEN_RECORDER_H
#define SCREEN_RECORDER_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Create a new ScreenRecorder instance
 * @return Opaque pointer to ScreenRecorder instance
 */
void* screen_recorder_create(void);

/**
 * Start screen recording
 * @param recorder Pointer to ScreenRecorder instance
 * @param path Output file path (null-terminated C string)
 * @param width Video width in pixels
 * @param height Video height in pixels
 * @param fps Frames per second
 * @return true if recording started successfully, false otherwise
 */
bool screen_recorder_start(void* recorder, const char* path, int32_t width, int32_t height, int32_t fps);

/**
 * Stop screen recording
 * @param recorder Pointer to ScreenRecorder instance
 * @return true if recording stopped successfully, false otherwise
 */
bool screen_recorder_stop(void* recorder);

/**
 * Check if currently recording
 * @param recorder Pointer to ScreenRecorder instance
 * @return true if recording, false otherwise
 */
bool screen_recorder_is_recording(void* recorder);

/**
 * Destroy ScreenRecorder instance and free memory
 * @param recorder Pointer to ScreenRecorder instance
 */
void screen_recorder_destroy(void* recorder);

/**
 * Check if screen recording permission is granted
 * @return true if permission granted, false otherwise
 */
bool screen_recorder_check_permission(void);

/**
 * Request screen recording permission from user
 * This may show a system permission dialog.
 */
void screen_recorder_request_permission(void);

/**
 * Create audio capture instance
 * @return Opaque pointer to AudioCapture instance (requires macOS 13.0+)
 */
void* audio_capture_create(void);

/**
 * Start audio capture for specified display
 * @param capture Pointer to AudioCapture instance
 * @param displayID Display ID to capture audio from
 * @return true if capture started successfully, false otherwise
 */
bool audio_capture_start(void* capture, uint32_t displayID);

/**
 * Stop audio capture
 * @param capture Pointer to AudioCapture instance
 * @return true if capture stopped successfully, false otherwise
 */
bool audio_capture_stop(void* capture);

/**
 * Get audio samples from buffer
 * @param capture Pointer to AudioCapture instance
 * @param maxCount Maximum number of samples to retrieve
 * @param outCount Output parameter for actual number of samples returned
 * @return Pointer to Float array (must be freed by caller using free())
 */
float* audio_capture_get_samples(void* capture, int32_t maxCount, int32_t* outCount);

/**
 * Get number of available samples in buffer
 * @param capture Pointer to AudioCapture instance
 * @return Number of available samples
 */
int32_t audio_capture_available_samples(void* capture);

/**
 * Destroy audio capture instance and free memory
 * @param capture Pointer to AudioCapture instance
 */
void audio_capture_destroy(void* capture);

#ifdef __cplusplus
}
#endif

#endif /* SCREEN_RECORDER_H */
