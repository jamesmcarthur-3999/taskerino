/**
 * DisplaySource - Display capture using ScreenCaptureKit
 *
 * Captures a single display using ScreenCaptureKit with efficient frame streaming.
 * Extracted from ScreenRecorder.swift (lines 664-713) for modularity and testability.
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import ScreenCaptureKit
import CoreMedia
import CoreVideo

/// Captures a single display using ScreenCaptureKit
@available(macOS 12.3, *)
public final class DisplaySource: RecordingSource {
    // MARK: - Properties

    public let sourceId: String
    private let displayID: CGDirectDisplayID

    private var stream: SCStream?
    private var streamOutput: DisplayStreamOutput?

    private var width: Int = 1920
    private var height: Int = 1080
    private var fps: Int = 30

    private var _isCapturing: Bool = false

    // MARK: - Initialization

    /// Create a display source for the specified display
    /// - Parameter displayID: The display ID to capture (use CGMainDisplayID() for primary)
    public init(displayID: CGDirectDisplayID) {
        self.displayID = displayID
        self.sourceId = "display-\(displayID)"
    }

    // MARK: - RecordingSource Protocol

    public var isCapturing: Bool {
        return _isCapturing
    }

    public var frameStream: AsyncStream<SourcedFrame> {
        guard let streamOutput = streamOutput else {
            return AsyncStream { continuation in
                continuation.finish()
            }
        }
        return streamOutput.frameStream
    }

    public func configure(width: Int, height: Int, fps: Int) async throws {
        guard !_isCapturing else {
            throw RecordingSourceError.alreadyCapturing
        }

        self.width = width
        self.height = height
        self.fps = fps

        print("⚙️  [DisplaySource] Configuring display \(displayID): \(width)x\(height) @ \(fps)fps")

        // Get shareable content
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
            throw DisplaySourceError.displayNotFound(displayID)
        }

        print("✅ [DisplaySource] Found display: \(display.displayID)")

        // Create SCStreamConfiguration
        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
        config.queueDepth = 5
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true

        // Create filter (capture entire display)
        let filter = SCContentFilter(display: display, excludingWindows: [])

        // Create stream
        let newStream = SCStream(filter: filter, configuration: config, delegate: nil)

        // Create output handler
        let output = DisplayStreamOutput(sourceId: sourceId)

        self.stream = newStream
        self.streamOutput = output

        print("✅ [DisplaySource] Configured successfully")
    }

    public func start() async throws {
        guard let stream = stream, let streamOutput = streamOutput else {
            throw RecordingSourceError.notConfigured
        }

        guard !_isCapturing else {
            throw RecordingSourceError.alreadyCapturing
        }

        print("▶️  [DisplaySource] Starting capture...")

        // Add stream output
        let outputQueue = DispatchQueue(label: "com.taskerino.displaysource.\(displayID)")
        try stream.addStreamOutput(streamOutput, type: .screen, sampleHandlerQueue: outputQueue)

        // Start capture
        try await stream.startCapture()

        _isCapturing = true

        print("✅ [DisplaySource] Capture started")
    }

    public func stop() async throws {
        guard _isCapturing else {
            throw RecordingSourceError.notCapturing
        }

        print("⏹️  [DisplaySource] Stopping capture...")

        _isCapturing = false

        // Stop stream
        if let stream = stream {
            try await stream.stopCapture()
        }

        // Cleanup
        self.stream = nil
        self.streamOutput = nil

        print("✅ [DisplaySource] Capture stopped")
    }
}

// MARK: - Stream Output Handler

@available(macOS 12.3, *)
private class DisplayStreamOutput: NSObject, SCStreamOutput {
    let sourceId: String
    private var sequenceNumber = 0
    private var continuation: AsyncStream<SourcedFrame>.Continuation?

    lazy var frameStream: AsyncStream<SourcedFrame> = {
        AsyncStream { continuation in
            self.continuation = continuation
        }
    }()

    init(sourceId: String) {
        self.sourceId = sourceId
        super.init()
        print("🎬 [DisplayStreamOutput] Initialized for \(sourceId)")
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        sequenceNumber += 1

        let frame = SourcedFrame(
            buffer: pixelBuffer,
            sourceId: sourceId,
            timestamp: timestamp,
            sequenceNumber: sequenceNumber
        )

        continuation?.yield(frame)
    }

    deinit {
        continuation?.finish()
        print("🗑️  [DisplayStreamOutput] Deinitialized for \(sourceId)")
    }
}

// MARK: - Errors

enum DisplaySourceError: Error {
    case displayNotFound(CGDirectDisplayID)
}
