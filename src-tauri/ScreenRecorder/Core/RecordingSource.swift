/**
 * RecordingSource - Protocol for all recording sources
 *
 * Provides a unified interface for different capture sources:
 * - Display capture (ScreenCaptureKit)
 * - Window capture (ScreenCaptureKit)
 * - Webcam capture (AVFoundation)
 *
 * Enables composition of multiple sources with frame synchronization.
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import CoreVideo
import CoreMedia

/// Protocol for all recording sources (display, window, webcam)
@available(macOS 12.3, *)
public protocol RecordingSource: Sendable {
    /// Unique identifier for this source
    var sourceId: String { get }

    /// Configure the source with desired output parameters
    /// - Parameters:
    ///   - width: Desired output width in pixels
    ///   - height: Desired output height in pixels
    ///   - fps: Desired frames per second
    func configure(width: Int, height: Int, fps: Int) async throws

    /// Start capturing frames
    func start() async throws

    /// Stop capturing frames
    func stop() async throws

    /// Stream of captured frames with metadata
    var frameStream: AsyncStream<SourcedFrame> { get }

    /// Is the source currently capturing?
    var isCapturing: Bool { get }
}

// MARK: - Sourced Frame

/// Frame with source metadata for synchronization and compositing
public struct SourcedFrame: Sendable {
    /// The pixel buffer containing the frame data
    public let buffer: CVPixelBuffer

    /// Unique identifier of the source that produced this frame
    public let sourceId: String

    /// Presentation timestamp for synchronization
    public let timestamp: CMTime

    /// Monotonic sequence number (per-source)
    public let sequenceNumber: Int

    /// Frame width in pixels
    public var width: Int {
        return CVPixelBufferGetWidth(buffer)
    }

    /// Frame height in pixels
    public var height: Int {
        return CVPixelBufferGetHeight(buffer)
    }

    public init(buffer: CVPixelBuffer, sourceId: String, timestamp: CMTime, sequenceNumber: Int) {
        self.buffer = buffer
        self.sourceId = sourceId
        self.timestamp = timestamp
        self.sequenceNumber = sequenceNumber
    }
}

// MARK: - Recording Source Errors

/// Common errors for recording sources
public enum RecordingSourceError: Error {
    case notConfigured
    case alreadyCapturing
    case notCapturing
    case configurationFailed(String)
    case captureFailed(Error)
    case permissionDenied
}
