/**
 * WebcamSource - Webcam capture using AVFoundation
 *
 * Captures from a webcam using AVCaptureSession with efficient frame streaming.
 * Extracted from ScreenRecorder.swift (lines 780-843) for modularity and testability.
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import AVFoundation
import CoreMedia
import CoreVideo

/// Captures from a webcam using AVCaptureSession
@available(macOS 12.3, *)
public final class WebcamSource: RecordingSource {
    // MARK: - Properties

    public let sourceId: String
    private let deviceID: String

    private var captureSession: AVCaptureSession?
    private var captureDevice: AVCaptureDevice?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var outputDelegate: WebcamOutputDelegate?

    private var width: Int = 1280
    private var height: Int = 720
    private var fps: Int = 30

    private var _isCapturing: Bool = false

    // MARK: - Initialization

    /// Create a webcam source for the specified device
    /// - Parameter deviceID: The unique device ID (from AVCaptureDevice.uniqueID)
    public init(deviceID: String) {
        self.deviceID = deviceID
        self.sourceId = "webcam-\(deviceID)"
    }

    // MARK: - RecordingSource Protocol

    public var isCapturing: Bool {
        return _isCapturing
    }

    public var frameStream: AsyncStream<SourcedFrame> {
        guard let delegate = outputDelegate else {
            return AsyncStream { continuation in
                continuation.finish()
            }
        }
        return delegate.frameStream
    }

    public func configure(width: Int, height: Int, fps: Int) async throws {
        guard !_isCapturing else {
            throw RecordingSourceError.alreadyCapturing
        }

        self.width = width
        self.height = height
        self.fps = fps

        print("⚙️  [WebcamSource] Configuring webcam \(deviceID): \(width)x\(height) @ \(fps)fps")

        // Discover available video devices
        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .externalUnknown],
            mediaType: .video,
            position: .unspecified
        )

        guard let device = discoverySession.devices.first(where: { $0.uniqueID == deviceID }) else {
            throw WebcamSourceError.deviceNotFound(deviceID)
        }

        print("✅ [WebcamSource] Found device: \(device.localizedName)")

        // Create capture session
        let session = AVCaptureSession()
        session.sessionPreset = .high

        // Create device input
        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else {
            throw WebcamSourceError.cannotAddInput
        }
        session.addInput(input)

        // Create video output
        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.alwaysDiscardsLateVideoFrames = true

        guard session.canAddOutput(output) else {
            throw WebcamSourceError.cannotAddOutput
        }
        session.addOutput(output)

        // Create delegate
        let delegate = WebcamOutputDelegate(sourceId: sourceId)

        // Set delegate and queue
        let outputQueue = DispatchQueue(label: "com.taskerino.webcamsource.\(deviceID)")
        output.setSampleBufferDelegate(delegate, queue: outputQueue)

        self.captureSession = session
        self.captureDevice = device
        self.videoOutput = output
        self.outputDelegate = delegate

        print("✅ [WebcamSource] Configured successfully")
    }

    public func start() async throws {
        guard let session = captureSession else {
            throw RecordingSourceError.notConfigured
        }

        guard !_isCapturing else {
            throw RecordingSourceError.alreadyCapturing
        }

        print("▶️  [WebcamSource] Starting capture...")

        // Start capture session on background queue
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
                continuation.resume()
            }
        }

        _isCapturing = true

        print("✅ [WebcamSource] Capture started")
    }

    public func stop() async throws {
        guard let session = captureSession else {
            throw RecordingSourceError.notConfigured
        }

        guard _isCapturing else {
            throw RecordingSourceError.notCapturing
        }

        print("⏹️  [WebcamSource] Stopping capture...")

        _isCapturing = false

        // Stop capture session on background queue
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                session.stopRunning()
                continuation.resume()
            }
        }

        // Cleanup
        self.captureSession = nil
        self.captureDevice = nil
        self.videoOutput = nil
        self.outputDelegate = nil

        print("✅ [WebcamSource] Capture stopped")
    }
}

// MARK: - Output Delegate

@available(macOS 12.3, *)
private class WebcamOutputDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
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
        print("🎬 [WebcamOutputDelegate] Initialized for \(sourceId)")
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
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
        print("🗑️  [WebcamOutputDelegate] Deinitialized for \(sourceId)")
    }
}

// MARK: - Errors

enum WebcamSourceError: Error {
    case deviceNotFound(String)
    case cannotAddInput
    case cannotAddOutput
}
