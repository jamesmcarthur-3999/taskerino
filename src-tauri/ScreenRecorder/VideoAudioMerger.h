/**
 * VideoAudioMerger.h - C FFI Header
 *
 * C header for VideoAudioMerger Swift module.
 * Use this header in Rust FFI bindings.
 *
 * Implementation: VideoAudioMerger.swift
 * Documentation: TASK_4_BENCHMARK_REPORT.md
 */

#ifndef VIDEO_AUDIO_MERGER_H
#define VIDEO_AUDIO_MERGER_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Merge video and audio files into single MP4
 *
 * @param video_path Path to video file (MP4, MOV, no audio required)
 * @param audio_path Path to audio file (MP3, WAV, M4A, AAC)
 * @param output_path Path for output MP4 file
 * @param quality Quality preset:
 *                - 0 = Low (AVAssetExportPresetMediumQuality) - ~40% size, faster
 *                - 1 = Medium (AVAssetExportPresetHighQuality) - ~60% size, balanced
 *                - 2 = High (AVAssetExportPresetHEVCHighestQuality) - ~80% size, slower
 * @param progress_callback Called periodically with progress (0.0 - 1.0)
 *                          - Frequency: 10Hz (100ms intervals)
 *                          - Accuracy: ±2%
 * @param completion_callback Called on completion:
 *                            - error: C string error message (or NULL on success)
 *                            - success: true if merge succeeded, false otherwise
 *                            - IMPORTANT: Rust must call free_merge_string() for error strings
 *
 * @note This function is asynchronous and returns immediately.
 *       All callbacks are invoked on the main thread.
 *
 * Error Messages:
 * - "Video file not found: <path>"
 * - "Audio file not found: <path>"
 * - "Video file contains no video track"
 * - "Audio file contains no audio track"
 * - "Composition failed: <reason>"
 * - "Export failed: <reason>"
 * - "Export was cancelled"
 * - "Invalid track duration"
 * - "File system error: <reason>"
 *
 * Example (Rust):
 * ```rust
 * extern "C" fn progress(p: f64) {
 *     println!("Progress: {:.1}%", p * 100.0);
 * }
 *
 * extern "C" fn completion(error: *const c_char, success: bool) {
 *     if success {
 *         println!("Merge succeeded!");
 *     } else if !error.is_null() {
 *         let err = unsafe { CStr::from_ptr(error).to_str().unwrap() };
 *         eprintln!("Error: {}", err);
 *         unsafe { free_merge_string(error as *mut c_char); }
 *     }
 * }
 *
 * let video = CString::new("/path/to/video.mp4").unwrap();
 * let audio = CString::new("/path/to/audio.m4a").unwrap();
 * let output = CString::new("/path/to/output.mp4").unwrap();
 *
 * unsafe {
 *     merge_video_and_audio(
 *         video.as_ptr(),
 *         audio.as_ptr(),
 *         output.as_ptr(),
 *         1, // Medium quality
 *         progress,
 *         completion
 *     );
 * }
 * ```
 */
void merge_video_and_audio(
    const char* video_path,
    const char* audio_path,
    const char* output_path,
    int32_t quality,
    void (*progress_callback)(double progress),
    void (*completion_callback)(const char* error, bool success)
);

/**
 * Cancel ongoing merge operation
 *
 * Cancels the current merge operation and invokes the completion callback
 * with error="Export was cancelled" and success=false.
 *
 * @note If no merge is in progress, this function does nothing.
 * @note The completion callback will still be invoked after cancellation.
 *
 * Example (Rust):
 * ```rust
 * unsafe { cancel_merge(); }
 * ```
 */
void cancel_merge(void);

/**
 * Free string allocated by Swift
 *
 * REQUIRED: Rust must call this function for all error strings returned by
 * the completion callback of merge_video_and_audio().
 *
 * @param string Error string returned by completion callback (or NULL)
 *
 * @note Calling with NULL is safe (no-op).
 * @note Do NOT call with strings not allocated by Swift.
 * @note Only call ONCE per string (double-free will crash).
 *
 * Example (Rust):
 * ```rust
 * extern "C" fn completion(error: *const c_char, success: bool) {
 *     if !error.is_null() {
 *         let err = unsafe { CStr::from_ptr(error).to_str().unwrap() };
 *         eprintln!("Error: {}", err);
 *         unsafe { free_merge_string(error as *mut c_char); } // REQUIRED
 *     }
 * }
 * ```
 */
void free_merge_string(char* string);

#ifdef __cplusplus
}
#endif

#endif // VIDEO_AUDIO_MERGER_H
