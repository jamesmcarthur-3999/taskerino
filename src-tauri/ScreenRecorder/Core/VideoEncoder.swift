/**
 * VideoEncoder - Standalone video encoding using AVAssetWriter
 *
 * Extracted from monolithic ScreenRecorder.swift to provide:
 * - Reusable video encoding functionality
 * - Clean separation from capture sources
 * - Testable encoding logic
 * - Automatic codec detection (HEVC/H.264)
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import AVFoundation
import CoreMedia

/// Handles video encoding using AVAssetWriter with automatic codec selection
@available(macOS 12.3, *)
public class VideoEncoder {
    // MARK: - Properties

    private var assetWriter: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?

    private let outputURL: URL
    private let width: Int
    private let height: Int
    private let fps: Int
    private var codec: AVVideoCodecType

    private var isConfigured = false
    private var isWriting = false
    private var frameCount: Int64 = 0

    // MARK: - Initialization

    /// Create a new video encoder
    /// - Parameters:
    ///   - outputURL: File URL where the video will be saved
    ///   - width: Video width in pixels
    ///   - height: Video height in pixels
    ///   - fps: Frames per second (default: 30)
    public init(outputURL: URL, width: Int, height: Int, fps: Int = 30) {
        self.outputURL = outputURL
        self.width = width
        self.height = height
        self.fps = fps
        self.codec = Self.detectBestCodec()
    }

    // MARK: - Codec Detection

    /// Detect best available codec (HEVC if available, H.264 fallback)
    /// Extracted from ScreenRecorder.swift lines 214-262
    private static func detectBestCodec() -> AVVideoCodecType {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("hevc_test.mp4")

        do {
            // Clean up any existing test file
            if FileManager.default.fileExists(atPath: tempURL.path) {
                try? FileManager.default.removeItem(at: tempURL)
            }

            // Try to create an asset writer with HEVC
            let testWriter = try AVAssetWriter(url: tempURL, fileType: .mp4)

            let hevcSettings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.hevc,
                AVVideoWidthKey: 1280,
                AVVideoHeightKey: 720
            ]

            let testInput = AVAssetWriterInput(mediaType: .video, outputSettings: hevcSettings)

            if testWriter.canAdd(testInput) {
                // HEVC is supported
                print("✅ [VideoEncoder] HEVC codec available - using HEVC encoding")
                try? FileManager.default.removeItem(at: tempURL)
                return .hevc
            } else {
                // HEVC not supported
                print("⚠️  [VideoEncoder] HEVC not available - using H.264 encoding")
                try? FileManager.default.removeItem(at: tempURL)
                return .h264
            }
        } catch {
            // Error testing HEVC - fall back to H.264
            print("⚠️  [VideoEncoder] Codec test failed: \(error) - using H.264 encoding")
            try? FileManager.default.removeItem(at: tempURL)
            return .h264
        }
    }

    // MARK: - Configuration

    /// Configure the encoder (must be called before start)
    /// Extracted from ScreenRecorder.swift lines 375-437
    public func configure() throws {
        guard !isConfigured else {
            print("⚠️  [VideoEncoder] Already configured")
            return
        }

        // Remove existing file if present
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        // Ensure directory exists
        let directory = outputURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        // Create asset writer
        let writer = try AVAssetWriter(url: outputURL, fileType: .mp4)

        // Build compression properties
        var compressionProperties: [String: Any] = [
            AVVideoAverageBitRateKey: width * height * fps * 4, // Adaptive bitrate
            AVVideoExpectedSourceFrameRateKey: fps
        ]

        // Add profile level only for H.264 (HEVC uses automatic profile selection)
        if codec == .h264 {
            compressionProperties[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel
        }

        // Configure video settings
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: codec,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: compressionProperties
        ]

        // Create video input
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        input.expectsMediaDataInRealTime = true

        // Create pixel buffer adaptor for BGRA format
        let sourcePixelBufferAttributes: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height
        ]

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: sourcePixelBufferAttributes
        )

        guard writer.canAdd(input) else {
            throw VideoEncoderError.cannotAddInput
        }

        writer.add(input)

        self.assetWriter = writer
        self.videoInput = input
        self.pixelBufferAdaptor = adaptor

        isConfigured = true

        print("✅ [VideoEncoder] Configured: \(width)x\(height) @ \(fps)fps, codec: \(codec.rawValue)")
    }

    // MARK: - Encoding Control

    /// Start writing video
    public func start() throws {
        guard isConfigured else {
            throw VideoEncoderError.notConfigured
        }
        guard !isWriting else {
            throw VideoEncoderError.alreadyStarted
        }

        guard let writer = assetWriter else {
            throw VideoEncoderError.notConfigured
        }

        guard writer.startWriting() else {
            throw VideoEncoderError.failedToStart(writer.error)
        }

        writer.startSession(atSourceTime: .zero)
        isWriting = true
        frameCount = 0

        print("✅ [VideoEncoder] Started writing")
    }

    /// Write a single frame to the video
    /// - Parameters:
    ///   - buffer: The pixel buffer to write
    ///   - time: Presentation timestamp (optional - will auto-calculate if nil)
    public func writeFrame(_ buffer: CVPixelBuffer, at time: CMTime? = nil) throws {
        guard isWriting else {
            throw VideoEncoderError.notWriting
        }

        guard let input = videoInput,
              let adaptor = pixelBufferAdaptor,
              let writer = assetWriter else {
            throw VideoEncoderError.notConfigured
        }

        // Ensure writer is in good state
        guard writer.status == .writing else {
            if let error = writer.error {
                throw VideoEncoderError.encodingFailed(error)
            }
            throw VideoEncoderError.encodingFailed(nil)
        }

        // Wait until input is ready (drop frame if not ready)
        guard input.isReadyForMoreMediaData else {
            return
        }

        // Calculate presentation timestamp if not provided
        let presentationTime = time ?? CMTime(value: frameCount, timescale: CMTimeScale(fps))
        frameCount += 1

        // Append pixel buffer
        if !adaptor.append(buffer, withPresentationTime: presentationTime) {
            if let error = writer.error {
                throw VideoEncoderError.encodingFailed(error)
            }
        }

        // Log progress every 30 frames
        if frameCount % 30 == 0 {
            print("✅ [VideoEncoder] Frame \(frameCount) written")
        }
    }

    /// Finish encoding and finalize the video file
    public func finish() async throws {
        guard isWriting else {
            print("⚠️  [VideoEncoder] Not writing")
            return
        }

        isWriting = false

        // Mark input as finished
        videoInput?.markAsFinished()

        // Wait for writer to finish
        if let writer = assetWriter {
            await writer.finishWriting()

            if writer.status == .completed {
                print("✅ [VideoEncoder] Video finishWriting() completed")

                // CRITICAL: Wait for OS to release file lock and flush buffers
                // Even though finishWriting() returned, the OS may still be:
                // 1. Flushing write buffers to disk
                // 2. Finalizing the MP4 moov atom
                // 3. Releasing file handles
                // Without this delay, thumbnail generation will fail with "Cannot Open"
                print("⏳ [VideoEncoder] Waiting 500ms for OS file flush...")
                try await Task.sleep(nanoseconds: 500_000_000) // 500ms
                print("✅ [VideoEncoder] Video saved and flushed: \(outputURL.path)")
            } else if let error = writer.error {
                throw VideoEncoderError.encodingFailed(error)
            }
        }

        // Cleanup
        cleanup()
    }

    // MARK: - Cleanup

    private func cleanup() {
        assetWriter = nil
        videoInput = nil
        pixelBufferAdaptor = nil
        isConfigured = false
        frameCount = 0

        print("✅ [VideoEncoder] Cleanup complete")
    }

    // MARK: - Public Properties

    /// Current frame count
    public var currentFrameCount: Int64 {
        return frameCount
    }

    /// Is encoder currently writing?
    public var isEncodingActive: Bool {
        return isWriting
    }

    /// Output file URL
    public var outputPath: URL {
        return outputURL
    }
}

// MARK: - Errors

/// Video encoder errors
public enum VideoEncoderError: Error {
    case notConfigured
    case alreadyStarted
    case notWriting
    case cannotAddInput
    case failedToStart(Error?)
    case encodingFailed(Error?)
}
