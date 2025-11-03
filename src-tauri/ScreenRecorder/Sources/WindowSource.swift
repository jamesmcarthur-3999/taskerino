/**
 * WindowSource - Window capture using ScreenCaptureKit
 *
 * Captures a single window using ScreenCaptureKit with efficient frame streaming.
 * Extracted from ScreenRecorder.swift (lines 717-776) for modularity and testability.
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import ScreenCaptureKit
import CoreMedia
import CoreVideo

/// Captures a single window using ScreenCaptureKit
@available(macOS 12.3, *)
public final class WindowSource: RecordingSource {
    // MARK: - Properties

    public let sourceId: String
    private let windowID: CGWindowID

    private var stream: SCStream?
    private var streamOutput: WindowStreamOutput?

    private var width: Int = 1920
    private var height: Int = 1080
    private var fps: Int = 30

    private var _isCapturing: Bool = false

    // MARK: - Initialization

    /// Create a window source for the specified window
    /// - Parameter windowID: The window ID to capture
    public init(windowID: CGWindowID) {
        self.windowID = windowID
        self.sourceId = "window-\(windowID)"
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

        print("⚙️  [WindowSource] Configuring window \(windowID): \(width)x\(height) @ \(fps)fps")

        // Get shareable content
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        guard let window = content.windows.first(where: { $0.windowID == windowID }) else {
            throw WindowSourceError.windowNotFound(windowID)
        }

        print("✅ [WindowSource] Found window: \(window.title ?? "Untitled") (\(window.windowID))")

        // Create SCStreamConfiguration
        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
        config.queueDepth = 5
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true

        // Create filter (capture specific window)
        let filter = SCContentFilter(desktopIndependentWindow: window)

        // Create stream
        let newStream = SCStream(filter: filter, configuration: config, delegate: nil)

        // Create output handler
        let output = WindowStreamOutput(sourceId: sourceId)

        self.stream = newStream
        self.streamOutput = output

        print("✅ [WindowSource] Configured successfully")
    }

    public func start() async throws {
        guard let stream = stream, let streamOutput = streamOutput else {
            throw RecordingSourceError.notConfigured
        }

        guard !_isCapturing else {
            throw RecordingSourceError.alreadyCapturing
        }

        print("▶️  [WindowSource] Starting capture...")

        // Add stream output
        let outputQueue = DispatchQueue(label: "com.taskerino.windowsource.\(windowID)")
        try stream.addStreamOutput(streamOutput, type: .screen, sampleHandlerQueue: outputQueue)

        // Start capture
        try await stream.startCapture()

        _isCapturing = true

        print("✅ [WindowSource] Capture started")
    }

    public func stop() async throws {
        guard _isCapturing else {
            throw RecordingSourceError.notCapturing
        }

        print("⏹️  [WindowSource] Stopping capture...")

        _isCapturing = false

        // Stop stream
        if let stream = stream {
            try await stream.stopCapture()
        }

        // Cleanup
        self.stream = nil
        self.streamOutput = nil

        print("✅ [WindowSource] Capture stopped")
    }
}

// MARK: - Stream Output Handler

@available(macOS 12.3, *)
private class WindowStreamOutput: NSObject, SCStreamOutput {
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
        print("🎬 [WindowStreamOutput] Initialized for \(sourceId)")
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
        print("🗑️  [WindowStreamOutput] Deinitialized for \(sourceId)")
    }
}

// MARK: - Errors

enum WindowSourceError: Error {
    case windowNotFound(CGWindowID)
}
