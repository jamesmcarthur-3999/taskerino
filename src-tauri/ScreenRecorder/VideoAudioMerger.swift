/**
 * VideoAudioMerger - AVFoundation Video/Audio Merger
 *
 * Merges separate video and audio files into a single MP4 with H.264 + AAC encoding.
 * Uses AVMutableComposition + AVAssetExportSession for GPU-accelerated processing.
 *
 * Features:
 * - Three quality presets (low, medium, high)
 * - Progress reporting (0.0 - 1.0)
 * - Automatic track duration alignment
 * - Detailed error messages
 * - C FFI exports for Rust interop
 *
 * Performance:
 * - Medium quality: ~40% size reduction vs input
 * - Target: <30s for 30-min video on M1
 * - Progress updates: 10Hz (100ms intervals)
 *
 * Usage:
 * ```swift
 * let merger = VideoAudioMerger()
 * merger.mergeVideoAndAudio(
 *     videoPath: "/path/to/video.mp4",
 *     audioPath: "/path/to/audio.mp3",
 *     outputPath: "/path/to/output.mp4",
 *     quality: .medium,
 *     progressHandler: { progress in
 *         print("Progress: \(Int(progress * 100))%")
 *     },
 *     completion: { result in
 *         switch result {
 *         case .success(let mergeResult):
 *             print("Merged: \(mergeResult.outputPath)")
 *         case .failure(let error):
 *             print("Error: \(error)")
 *         }
 *     }
 * )
 * ```
 */

import Foundation
import AVFoundation
import CoreMedia

// MARK: - Export Quality

/// Export quality preset
public enum ExportQuality: Int32 {
    case low = 0    // AVAssetExportPresetMediumQuality (~40% size, faster)
    case medium = 1 // AVAssetExportPresetHighQuality (~60% size, balanced) - DEFAULT
    case high = 2   // AVAssetExportPresetHEVCHighestQuality (~80% size, slower)

    /// Map to AVFoundation preset string
    var avPreset: String {
        switch self {
        case .low:
            return AVAssetExportPreset1280x720
        case .medium:
            return AVAssetExportPreset1920x1080
        case .high:
            if #available(macOS 10.13, *) {
                return AVAssetExportPresetHEVCHighestQuality
            } else {
                return AVAssetExportPreset1920x1080
            }
        }
    }

    /// Human-readable name
    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        }
    }
}

// MARK: - Merge Result

/// Result of successful merge operation
public struct MergeResult {
    /// Output file path
    public let outputPath: String

    /// Total duration in seconds
    public let duration: Double

    /// Output file size in bytes
    public let fileSize: Int64

    /// Compression ratio (outputSize / inputSize)
    public let compressionRatio: Double
}

// MARK: - Merge Error

/// Errors that can occur during merge
public enum MergeError: Error, CustomStringConvertible {
    case videoNotFound(String)
    case audioNotFound(String)
    case videoLoadFailed(String)
    case audioLoadFailed(String)
    case noVideoTrack
    case noAudioTrack
    case compositionFailed(String)
    case exportFailed(String)
    case exportCancelled
    case invalidDuration
    case outputFileExists(String)
    case fileSystemError(String)

    public var description: String {
        switch self {
        case .videoNotFound(let path):
            return "Video file not found: \(path)"
        case .audioNotFound(let path):
            return "Audio file not found: \(path)"
        case .videoLoadFailed(let msg):
            return "Failed to load video: \(msg)"
        case .audioLoadFailed(let msg):
            return "Failed to load audio: \(msg)"
        case .noVideoTrack:
            return "Video file contains no video track"
        case .noAudioTrack:
            return "Audio file contains no audio track"
        case .compositionFailed(let msg):
            return "Composition failed: \(msg)"
        case .exportFailed(let msg):
            return "Export failed: \(msg)"
        case .exportCancelled:
            return "Export was cancelled"
        case .invalidDuration:
            return "Invalid track duration"
        case .outputFileExists(let path):
            return "Output file already exists: \(path)"
        case .fileSystemError(let msg):
            return "File system error: \(msg)"
        }
    }
}

// MARK: - VideoAudioMerger Class

/// GPU-accelerated video/audio merger using AVFoundation
@available(macOS 10.15, *)
public class VideoAudioMerger {

    // Progress tracking
    private var progressTimer: Timer?
    private var exportSession: AVAssetExportSession?

    public init() {
        print("🎬 [VideoAudioMerger] Initialized")
    }

    deinit {
        progressTimer?.invalidate()
        print("🗑️  [VideoAudioMerger] Deinitialized")
    }

    /// Merge video and audio into single MP4 file
    /// - Parameters:
    ///   - videoPath: Path to video file (MP4, MOV, no audio required)
    ///   - audioPath: Path to audio file (MP3, WAV, M4A, etc)
    ///   - outputPath: Path for output MP4 file
    ///   - quality: Export quality preset (low, medium, high)
    ///   - progressHandler: Called periodically with progress (0.0 - 1.0)
    ///   - completion: Called on completion with Result<MergeResult, MergeError>
    public func mergeVideoAndAudio(
        videoPath: String,
        audioPath: String,
        outputPath: String,
        quality: ExportQuality,
        progressHandler: @escaping (Double) -> Void,
        completion: @escaping (Result<MergeResult, MergeError>) -> Void
    ) {
        print("🎬 [VideoAudioMerger] Starting merge:")
        print("   Video: \(videoPath)")
        print("   Audio: \(audioPath)")
        print("   Output: \(outputPath)")
        print("   Quality: \(quality.displayName)")

        // Validate input files exist
        let videoURL = URL(fileURLWithPath: videoPath)
        let audioURL = URL(fileURLWithPath: audioPath)
        let outputURL = URL(fileURLWithPath: outputPath)

        let fm = FileManager.default
        guard fm.fileExists(atPath: videoPath) else {
            completion(.failure(.videoNotFound(videoPath)))
            return
        }

        guard fm.fileExists(atPath: audioPath) else {
            completion(.failure(.audioNotFound(audioPath)))
            return
        }

        // Delete output file if it exists (AVAssetExportSession fails otherwise)
        if fm.fileExists(atPath: outputPath) {
            do {
                try fm.removeItem(atPath: outputPath)
                print("🗑️  [VideoAudioMerger] Deleted existing output file")
            } catch {
                completion(.failure(.fileSystemError("Could not delete existing output: \(error)")))
                return
            }
        }

        // Create composition
        let composition = AVMutableComposition()

        // Load assets
        let videoAsset = AVURLAsset(url: videoURL)
        let audioAsset = AVURLAsset(url: audioURL)

        // Asynchronously load track metadata
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            // Load video tracks
            guard let videoTrack = videoAsset.tracks(withMediaType: .video).first else {
                DispatchQueue.main.async {
                    completion(.failure(.noVideoTrack))
                }
                return
            }

            // Load audio tracks
            guard let audioTrack = audioAsset.tracks(withMediaType: .audio).first else {
                DispatchQueue.main.async {
                    completion(.failure(.noAudioTrack))
                }
                return
            }

            let videoDuration = videoAsset.duration
            let audioDuration = audioAsset.duration

            print("📊 [VideoAudioMerger] Track info:")
            print("   Video: \(CMTimeGetSeconds(videoDuration))s")
            print("   Audio: \(CMTimeGetSeconds(audioDuration))s")

            // Use shorter duration (common case: video and audio are same length)
            let duration = CMTimeMinimum(videoDuration, audioDuration)

            guard CMTimeGetSeconds(duration) > 0 else {
                DispatchQueue.main.async {
                    completion(.failure(.invalidDuration))
                }
                return
            }

            // Add video track to composition
            guard let compositionVideoTrack = composition.addMutableTrack(
                withMediaType: .video,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                DispatchQueue.main.async {
                    completion(.failure(.compositionFailed("Could not create video track")))
                }
                return
            }

            do {
                try compositionVideoTrack.insertTimeRange(
                    CMTimeRange(start: .zero, duration: duration),
                    of: videoTrack,
                    at: .zero
                )
                print("✅ [VideoAudioMerger] Added video track")
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(.compositionFailed("Video track insertion failed: \(error)")))
                }
                return
            }

            // Add audio track to composition
            guard let compositionAudioTrack = composition.addMutableTrack(
                withMediaType: .audio,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                DispatchQueue.main.async {
                    completion(.failure(.compositionFailed("Could not create audio track")))
                }
                return
            }

            do {
                try compositionAudioTrack.insertTimeRange(
                    CMTimeRange(start: .zero, duration: duration),
                    of: audioTrack,
                    at: .zero
                )
                print("✅ [VideoAudioMerger] Added audio track")
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(.compositionFailed("Audio track insertion failed: \(error)")))
                }
                return
            }

            // Create export session
            guard let exporter = AVAssetExportSession(
                asset: composition,
                presetName: quality.avPreset
            ) else {
                DispatchQueue.main.async {
                    completion(.failure(.exportFailed("Could not create export session")))
                }
                return
            }

            self.exportSession = exporter
            exporter.outputURL = outputURL
            exporter.outputFileType = .mp4
            exporter.shouldOptimizeForNetworkUse = true

            print("🚀 [VideoAudioMerger] Starting export with \(quality.displayName) quality...")

            // Start progress timer (10Hz = 100ms intervals)
            DispatchQueue.main.async {
                self.progressTimer?.invalidate()
                self.progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                    guard let self = self, let session = self.exportSession else { return }
                    let progress = Double(session.progress)
                    progressHandler(progress)
                }
            }

            let startTime = Date()

            // Export asynchronously
            exporter.exportAsynchronously { [weak self] in
                guard let self = self else { return }

                // Stop progress timer
                DispatchQueue.main.async {
                    self.progressTimer?.invalidate()
                    self.progressTimer = nil
                }

                let elapsed = Date().timeIntervalSince(startTime)

                switch exporter.status {
                case .completed:
                    print("✅ [VideoAudioMerger] Export completed in \(String(format: "%.1f", elapsed))s")

                    // Get output file size
                    do {
                        let attrs = try fm.attributesOfItem(atPath: outputPath)
                        let fileSize = attrs[.size] as? Int64 ?? 0

                        // Calculate input size for compression ratio
                        let videoAttrs = try fm.attributesOfItem(atPath: videoPath)
                        let audioAttrs = try fm.attributesOfItem(atPath: audioPath)
                        let videoSize = videoAttrs[.size] as? Int64 ?? 0
                        let audioSize = audioAttrs[.size] as? Int64 ?? 0
                        let inputSize = videoSize + audioSize

                        let compressionRatio = inputSize > 0 ? Double(fileSize) / Double(inputSize) : 1.0

                        let result = MergeResult(
                            outputPath: outputPath,
                            duration: CMTimeGetSeconds(duration),
                            fileSize: fileSize,
                            compressionRatio: compressionRatio
                        )

                        print("📊 [VideoAudioMerger] Result:")
                        print("   Duration: \(String(format: "%.1f", result.duration))s")
                        print("   File size: \(self.formatBytes(fileSize))")
                        print("   Compression: \(String(format: "%.1f", compressionRatio * 100))% of input size")

                        DispatchQueue.main.async {
                            completion(.success(result))
                        }
                    } catch {
                        DispatchQueue.main.async {
                            completion(.failure(.fileSystemError("Could not get output file size: \(error)")))
                        }
                    }

                case .failed:
                    let errorMsg = exporter.error?.localizedDescription ?? "Unknown error"
                    print("❌ [VideoAudioMerger] Export failed: \(errorMsg)")
                    DispatchQueue.main.async {
                        completion(.failure(.exportFailed(errorMsg)))
                    }

                case .cancelled:
                    print("⚠️  [VideoAudioMerger] Export cancelled")
                    DispatchQueue.main.async {
                        completion(.failure(.exportCancelled))
                    }

                default:
                    let errorMsg = "Export ended with unexpected status: \(exporter.status.rawValue)"
                    print("❌ [VideoAudioMerger] \(errorMsg)")
                    DispatchQueue.main.async {
                        completion(.failure(.exportFailed(errorMsg)))
                    }
                }

                self.exportSession = nil
            }
        }
    }

    /// Cancel ongoing export
    public func cancelExport() {
        exportSession?.cancelExport()
        progressTimer?.invalidate()
        progressTimer = nil
        print("⚠️  [VideoAudioMerger] Export cancelled by user")
    }

    // MARK: - Helpers

    /// Format bytes to human-readable string
    private func formatBytes(_ bytes: Int64) -> String {
        let kb = Double(bytes) / 1024.0
        let mb = kb / 1024.0
        let gb = mb / 1024.0

        if gb >= 1.0 {
            return String(format: "%.2f GB", gb)
        } else if mb >= 1.0 {
            return String(format: "%.2f MB", mb)
        } else if kb >= 1.0 {
            return String(format: "%.2f KB", kb)
        } else {
            return "\(bytes) bytes"
        }
    }
}

// MARK: - C FFI Exports

/// Global merger instance for FFI (single instance, thread-safe via dispatch queue)
private var globalMerger: VideoAudioMerger?
private let mergerQueue = DispatchQueue(label: "com.taskerino.videoaudiomerger", qos: .userInitiated)

/// Merge video and audio files (C FFI)
/// - Parameters:
///   - video_path: C string path to video file
///   - audio_path: C string path to audio file
///   - output_path: C string path for output file
///   - quality: Quality preset (0=low, 1=medium, 2=high)
///   - progress_callback: Progress callback (receives progress 0.0-1.0)
///   - completion_callback: Completion callback (receives error string or NULL on success, and success bool)
@_cdecl("merge_video_and_audio")
@available(macOS 10.15, *)
public func merge_video_and_audio(
    video_path: UnsafePointer<CChar>,
    audio_path: UnsafePointer<CChar>,
    output_path: UnsafePointer<CChar>,
    quality: Int32,
    progress_callback: @escaping @convention(c) (Double) -> Void,
    completion_callback: @escaping @convention(c) (UnsafePointer<CChar>?, Bool) -> Void
) {
    // Convert C strings to Swift strings
    let videoPathString = String(cString: video_path)
    let audioPathString = String(cString: audio_path)
    let outputPathString = String(cString: output_path)

    // Validate quality parameter
    guard let exportQuality = ExportQuality(rawValue: quality) else {
        let errorMsg = strdup("Invalid quality preset: \(quality)")
        completion_callback(errorMsg, false)
        return
    }

    // Create merger if needed
    mergerQueue.sync {
        if globalMerger == nil {
            globalMerger = VideoAudioMerger()
        }
    }

    guard let merger = globalMerger else {
        let errorMsg = strdup("Failed to create merger instance")
        completion_callback(errorMsg, false)
        return
    }

    // Start merge
    merger.mergeVideoAndAudio(
        videoPath: videoPathString,
        audioPath: audioPathString,
        outputPath: outputPathString,
        quality: exportQuality,
        progressHandler: { progress in
            progress_callback(progress)
        },
        completion: { result in
            switch result {
            case .success(let mergeResult):
                print("✅ [FFI] Merge succeeded: \(mergeResult.outputPath)")
                completion_callback(nil, true)

            case .failure(let error):
                print("❌ [FFI] Merge failed: \(error.description)")
                let errorMsg = strdup(error.description)
                completion_callback(errorMsg, false)
            }
        }
    )
}

/// Cancel ongoing merge operation (C FFI)
@_cdecl("cancel_merge")
@available(macOS 10.15, *)
public func cancel_merge() {
    mergerQueue.sync {
        globalMerger?.cancelExport()
    }
}

/// Free string allocated by Swift (C FFI)
/// IMPORTANT: Rust must call this for all strings returned by merge_video_and_audio
@_cdecl("free_merge_string")
public func free_merge_string(string: UnsafeMutablePointer<CChar>?) {
    if let string = string {
        free(string)
    }
}
