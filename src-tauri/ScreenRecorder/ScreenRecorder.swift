/**
 * ScreenRecorder - Screen Recording via ScreenCaptureKit
 *
 * Provides screen recording functionality using Apple's ScreenCaptureKit framework.
 * Exposes C-compatible functions for Rust FFI integration.
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import ScreenCaptureKit
import AVFoundation

// MARK: - C-Compatible Global Functions (for Rust FFI)

/// Create a new ScreenRecorder instance
@_cdecl("screen_recorder_create")
public func screen_recorder_create() -> UnsafeMutableRawPointer {
    let recorder = ScreenRecorder()
    return Unmanaged.passRetained(recorder).toOpaque()
}

/// Start screen recording
@_cdecl("screen_recorder_start")
public func screen_recorder_start(
    recorder: UnsafeMutableRawPointer,
    path: UnsafePointer<CChar>,
    width: Int32,
    height: Int32,
    fps: Int32
) -> Bool {
    let instance = Unmanaged<ScreenRecorder>.fromOpaque(recorder).takeUnretainedValue()
    let pathString = String(cString: path)

    print("🎬 ScreenRecorder.start called with path: \(pathString)")

    let semaphore = DispatchSemaphore(value: 0)
    var success = false

    instance.width = width
    instance.height = height
    instance.fps = fps

    Task {
        do {
            try await instance.startRecording(path: pathString)
            success = true
        } catch {
            print("❌ Failed to start recording: \(error)")
            success = false
        }
        semaphore.signal()
    }

    semaphore.wait()
    return success
}

/// Stop screen recording
@_cdecl("screen_recorder_stop")
public func screen_recorder_stop(recorder: UnsafeMutableRawPointer) -> Bool {
    let instance = Unmanaged<ScreenRecorder>.fromOpaque(recorder).takeUnretainedValue()

    print("⏹️  ScreenRecorder.stop called")

    let semaphore = DispatchSemaphore(value: 0)
    var success = false

    Task {
        do {
            try await instance.stopRecording()
            success = true
        } catch {
            print("❌ Failed to stop recording: \(error)")
            success = false
        }
        semaphore.signal()
    }

    semaphore.wait()
    return success
}

/// Check if currently recording
@_cdecl("screen_recorder_is_recording")
public func screen_recorder_is_recording(recorder: UnsafeMutableRawPointer) -> Bool {
    let instance = Unmanaged<ScreenRecorder>.fromOpaque(recorder).takeUnretainedValue()
    return instance.isRecording
}

/// Destroy recorder instance
@_cdecl("screen_recorder_destroy")
public func screen_recorder_destroy(recorder: UnsafeMutableRawPointer) {
    let instance = Unmanaged<ScreenRecorder>.fromOpaque(recorder).takeRetainedValue()

    // Ensure recording is stopped
    if instance.isRecording {
        _ = screen_recorder_stop(recorder: recorder)
    }

    // instance will be deallocated after this scope
    print("🗑️  ScreenRecorder destroyed")
}

/// Check if screen recording permission is granted
@_cdecl("screen_recorder_check_permission")
public func screen_recorder_check_permission() -> Bool {
    print("🔐 Checking screen recording permission...")

    // Try to get shareable content - this will fail if permission is not granted
    let semaphore = DispatchSemaphore(value: 0)
    var hasPermission = false

    Task {
        do {
            _ = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            hasPermission = true
            print("✅ Screen recording permission granted")
        } catch {
            print("❌ Screen recording permission denied or error: \(error)")
            hasPermission = false
        }
        semaphore.signal()
    }

    semaphore.wait()
    return hasPermission
}

/// Request screen recording permission
@_cdecl("screen_recorder_request_permission")
public func screen_recorder_request_permission() {
    // On macOS 12.3-13.x, permission is automatically requested on first capture attempt
    // There's no explicit API to request it beforehand
    print("⚠️  Permission will be requested on first recording attempt")
    print("   If denied, user must grant permission in System Settings > Privacy & Security > Screen Recording")
}

/// Get video duration in seconds
@_cdecl("screen_recorder_get_duration")
public func screen_recorder_get_duration(path: UnsafePointer<CChar>) -> Double {
    let pathString = String(cString: path)
    let url = URL(fileURLWithPath: pathString)

    let asset = AVURLAsset(url: url)
    let duration = asset.duration
    let seconds = CMTimeGetSeconds(duration)

    print("📊 Video duration: \(seconds) seconds")
    return seconds
}

/// Generate video thumbnail as base64 PNG
@_cdecl("screen_recorder_generate_thumbnail")
public func screen_recorder_generate_thumbnail(
    path: UnsafePointer<CChar>,
    time: Double
) -> UnsafePointer<CChar>? {
    let pathString = String(cString: path)
    let url = URL(fileURLWithPath: pathString)

    do {
        let asset = AVURLAsset(url: url)
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.maximumSize = CGSize(width: 320, height: 180) // 16:9 thumbnail

        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        let cgImage = try imageGenerator.copyCGImage(at: cmTime, actualTime: nil)

        // Convert to PNG data
        let nsImage = NSImage(cgImage: cgImage, size: .zero)
        guard let tiffData = nsImage.tiffRepresentation,
              let bitmapImage = NSBitmapImageRep(data: tiffData),
              let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
            print("❌ Failed to generate PNG data")
            return nil
        }

        // Convert to base64
        let base64String = "data:image/png;base64," + pngData.base64EncodedString()

        print("✅ Generated thumbnail (\(pngData.count) bytes)")

        // Return as C string (caller must free)
        let cString = strdup(base64String)
        return UnsafePointer(cString)
    } catch {
        print("❌ Failed to generate thumbnail: \(error)")
        return nil
    }
}

// MARK: - ScreenRecorder Class

@available(macOS 12.3, *)
public class ScreenRecorder: NSObject {
    private var stream: SCStream?
    private var assetWriter: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var streamOutput: ScreenRecorderStreamOutput? // Keep output handler alive
    fileprivate var isRecording = false
    private var outputURL: URL?
    private var startTime: CMTime?
    private var frameCount: Int64 = 0

    // Configuration
    fileprivate var width: Int32 = 1280
    fileprivate var height: Int32 = 720
    fileprivate var fps: Int32 = 15

    // Codec detection - lazy property to test HEVC availability once
    private lazy var codecConfiguration: (codec: AVVideoCodecType, profile: String) = {
        // Test HEVC availability by attempting to create a test AVAssetWriter
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
                print("✅ HEVC codec is available - will use HEVC encoding for reduced file sizes")

                // Clean up test file
                try? FileManager.default.removeItem(at: tempURL)

                // HEVC doesn't use AVVideoProfileLevelKey - encoder chooses optimal profile
                return (.hevc, "")
            } else {
                // HEVC not supported
                print("⚠️  HEVC codec not available - falling back to H.264 encoding")

                // Clean up test file
                try? FileManager.default.removeItem(at: tempURL)

                return (.h264, AVVideoProfileLevelH264HighAutoLevel)
            }
        } catch {
            // Error testing HEVC - fall back to H.264
            print("⚠️  Error testing HEVC codec: \(error) - falling back to H.264 encoding")

            // Clean up test file
            try? FileManager.default.removeItem(at: tempURL)

            return (.h264, AVVideoProfileLevelH264HighAutoLevel)
        }
    }()

    fileprivate func startRecording(path: String) async throws {
        guard !isRecording else {
            print("⚠️  Already recording")
            return
        }

        // Convert path to URL
        let url = URL(fileURLWithPath: path)
        self.outputURL = url

        // Ensure directory exists
        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        // Get shareable content (displays, windows, etc.)
        print("📋 Getting shareable content...")
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        guard let display = content.displays.first else {
            throw ScreenRecorderError.noDisplayFound
        }

        print("🖥️  Found display: \(display.displayID)")

        // Create content filter (capture entire display)
        let filter = SCContentFilter(display: display, excludingWindows: [])

        // Configure stream settings
        let config = SCStreamConfiguration()
        config.width = Int(width)
        config.height = Int(height)
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
        config.queueDepth = 5
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true

        print("⚙️  Configuration: \(width)x\(height) @ \(fps)fps")

        // Set up AVAssetWriter
        try setupAssetWriter(url: url)

        // Create stream
        print("🔧 Creating SCStream with filter and config...")
        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        self.stream = stream
        print("✅ SCStream created")

        // Add stream output (store as property to keep it alive!)
        print("🔧 Adding stream output handler...")
        let output = ScreenRecorderStreamOutput(recorder: self)
        self.streamOutput = output // Keep strong reference to prevent deallocation
        let queue = DispatchQueue(label: "com.taskerino.screenrecorder")
        try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: queue)
        print("✅ Stream output handler added on queue: \(queue.label)")

        // Set recording flag BEFORE starting capture to avoid race condition
        // (frames can arrive on background thread immediately after startCapture)
        isRecording = true
        startTime = CMTime.zero
        print("🎬 Set isRecording = true BEFORE starting capture")

        // Start capture
        print("🔧 Starting capture...")
        try await stream.startCapture()
        print("✅ Capture started")

        print("✅ Recording started successfully - isRecording: \(isRecording)")
    }

    fileprivate func stopRecording() async throws {
        guard isRecording else {
            print("⚠️  Not currently recording")
            return
        }

        isRecording = false

        // Stop stream
        if let stream = stream {
            try await stream.stopCapture()
            self.stream = nil
        }

        // Finalize video file
        if let videoInput = videoInput {
            videoInput.markAsFinished()
        }

        if let assetWriter = assetWriter {
            await assetWriter.finishWriting()

            if assetWriter.status == .completed {
                print("✅ Video saved to: \(outputURL?.path ?? "unknown")")
            } else if let error = assetWriter.error {
                print("❌ Asset writer failed: \(error)")
                throw error
            }
        }

        // Cleanup
        self.assetWriter = nil
        self.videoInput = nil
        self.pixelBufferAdaptor = nil
        self.outputURL = nil
        self.startTime = nil
        self.streamOutput = nil // Release output handler
        self.frameCount = 0

        print("✅ Recording stopped successfully")
    }

    private func setupAssetWriter(url: URL) throws {
        // Remove existing file if present
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }

        // Create asset writer
        let writer = try AVAssetWriter(url: url, fileType: .mp4)

        // Configure video settings with detected codec (HEVC or H.264 fallback)
        let codecConfig = codecConfiguration
        print("📹 Using codec: \(codecConfig.codec.rawValue)")

        // Build compression properties - only add profile level for H.264
        var compressionProperties: [String: Any] = [
            AVVideoAverageBitRateKey: 1_200_000, // 1.2 Mbps
            AVVideoExpectedSourceFrameRateKey: fps
        ]

        // Add profile level only for H.264 (HEVC uses automatic profile selection)
        if !codecConfig.profile.isEmpty {
            compressionProperties[AVVideoProfileLevelKey] = codecConfig.profile
        }

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: codecConfig.codec,
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
            throw ScreenRecorderError.cannotAddInput
        }

        writer.add(input)

        self.assetWriter = writer
        self.videoInput = input
        self.pixelBufferAdaptor = adaptor

        // Start writing session
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        print("✅ Asset writer configured with pixel buffer adaptor")
    }

    fileprivate func processFrame(sampleBuffer: CMSampleBuffer) {
        guard isRecording,
              let videoInput = videoInput,
              let assetWriter = assetWriter,
              let adaptor = pixelBufferAdaptor else {
            return
        }

        // Ensure writer is ready
        guard assetWriter.status == .writing else {
            if let error = assetWriter.error {
                print("❌ Asset writer error: \(error)")
            }
            return
        }

        // Wait until input is ready
        guard videoInput.isReadyForMoreMediaData else {
            return
        }

        // Get IOSurface from sample buffer attachments (ScreenCaptureKit uses IOSurface-backed buffers)
        guard let attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[CFString: Any]],
              let attachments = attachmentsArray.first else {
            if frameCount == 0 {
                print("❌ No attachments in sample buffer")
            }
            return
        }

        // Try to get pixel buffer from sample buffer
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            if frameCount == 0 {
                print("❌ Failed to get pixel buffer from sample - attachments: \(attachments.keys)")
            }
            return
        }

        // Calculate presentation timestamp
        let presentationTime = CMTime(value: frameCount, timescale: CMTimeScale(fps))
        frameCount += 1

        // Append pixel buffer
        if !adaptor.append(pixelBuffer, withPresentationTime: presentationTime) {
            if let error = assetWriter.error {
                print("❌ Failed to append pixel buffer: \(error)")
            }
        } else {
            if frameCount % 30 == 0 { // Log every 30 frames to reduce spam
                print("✅ [PROCESS FRAME] Frame \(frameCount) written successfully")
            }
        }
    }
}

// MARK: - Stream Output Handler

@available(macOS 12.3, *)
private class ScreenRecorderStreamOutput: NSObject, SCStreamOutput {
    weak var recorder: ScreenRecorder?

    init(recorder: ScreenRecorder) {
        self.recorder = recorder
        super.init()
        print("🎬 ScreenRecorderStreamOutput initialized")
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen else {
            return
        }
        recorder?.processFrame(sampleBuffer: sampleBuffer)
    }
}

// MARK: - Stream Delegate

@available(macOS 12.3, *)
extension ScreenRecorder: SCStreamDelegate {
    public func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("❌ [STREAM DELEGATE] Stream stopped with error: \(error)")
        print("❌ [STREAM DELEGATE] Error details: \(error.localizedDescription)")
        isRecording = false
    }

    // This method might be called on some macOS versions
    public func streamDidBecomeActive(_ stream: SCStream) {
        print("✅ [STREAM DELEGATE] Stream became active")
    }
}

// MARK: - Errors

enum ScreenRecorderError: Error {
    case noDisplayFound
    case cannotAddInput
    case alreadyRecording
    case notRecording
    case noWebcamFound
    case invalidConfiguration
    case compositorNotAvailable
    case bufferSynchronizationFailed
}

// MARK: - GlobalScreenRecorder Singleton

/// Thread-safe singleton for managing advanced recording modes
@available(macOS 12.3, *)
public class GlobalScreenRecorder: NSObject {
    // Singleton instance
    public static let shared = GlobalScreenRecorder()

    // Thread safety queue
    private let queue = DispatchQueue(label: "com.taskerino.globalrecorder", qos: .userInitiated)

    // Recording state
    private var currentMode: RecordingMode = .idle
    private var isRecording = false

    // Screen capture components
    private var screenStream: SCStream?
    private var screenOutput: (any SCStreamOutput)?

    // Window capture components
    private var windowStream: SCStream?
    private var windowOutput: (any SCStreamOutput)?

    // Webcam capture components
    private var webcamSession: AVCaptureSession?
    private var webcamOutput: AVCaptureVideoDataOutput?
    private var webcamDevice: AVCaptureDevice?
    private var webcamDelegate: AnyObject?

    // PiP compositor for display+webcam mode
    private var pipCompositor: PiPCompositor?

    // Video writer
    private var assetWriter: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?

    // Output configuration
    private var outputURL: URL?
    private var width: Int = 1280
    private var height: Int = 720
    private var fps: Int = 15

    // Frame tracking
    private var frameCount: Int64 = 0
    private var startTime: Date?

    // Frame synchronization for PiP mode
    private var lastScreenBuffer: CVPixelBuffer?
    private var lastWebcamBuffer: CVPixelBuffer?
    private let syncQueue = DispatchQueue(label: "com.taskerino.framesync")

    // Codec configuration
    private lazy var codecConfiguration: (codec: AVVideoCodecType, profile: String) = {
        let tempURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("hevc_test.mp4")

        do {
            if FileManager.default.fileExists(atPath: tempURL.path) {
                try? FileManager.default.removeItem(at: tempURL)
            }

            let testWriter = try AVAssetWriter(url: tempURL, fileType: .mp4)
            let hevcSettings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.hevc,
                AVVideoWidthKey: 1280,
                AVVideoHeightKey: 720
            ]

            let testInput = AVAssetWriterInput(mediaType: .video, outputSettings: hevcSettings)

            if testWriter.canAdd(testInput) {
                print("✅ [VIDEO] HEVC codec available")
                try? FileManager.default.removeItem(at: tempURL)
                return (.hevc, "")
            } else {
                print("⚠️  [VIDEO] HEVC unavailable, using H.264")
                try? FileManager.default.removeItem(at: tempURL)
                return (.h264, AVVideoProfileLevelH264HighAutoLevel)
            }
        } catch {
            print("⚠️  [VIDEO] Codec test failed: \(error), using H.264")
            try? FileManager.default.removeItem(at: tempURL)
            return (.h264, AVVideoProfileLevelH264HighAutoLevel)
        }
    }()

    private override init() {
        super.init()
        print("✅ [VIDEO] GlobalScreenRecorder initialized")
    }

    // MARK: - Recording Mode Management

    enum RecordingMode {
        case idle
        case display
        case window
        case webcam
        case displayWithPiP
    }

    // MARK: - Display Recording

    func startDisplayRecording(displayIDs: [String], outputPath: String, fps: Int, width: Int, height: Int) throws {
        try queue.sync {
            guard !isRecording else {
                throw ScreenRecorderError.alreadyRecording
            }

            print("📹 [VIDEO] Starting display recording: \(displayIDs.isEmpty ? "primary" : displayIDs.joined(separator: ", "))")

            self.width = width
            self.height = height
            self.fps = fps
            self.outputURL = URL(fileURLWithPath: outputPath)

            let semaphore = DispatchSemaphore(value: 0)
            var setupError: Error?

            Task {
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

                    let display: SCDisplay
                    if displayIDs.isEmpty {
                        guard let primaryDisplay = content.displays.first else {
                            throw ScreenRecorderError.noDisplayFound
                        }
                        display = primaryDisplay
                    } else {
                        guard let targetDisplay = content.displays.first(where: { displayIDs.contains("\($0.displayID)") }) else {
                            throw ScreenRecorderError.noDisplayFound
                        }
                        display = targetDisplay
                    }

                    print("✅ [VIDEO] Found display: \(display.displayID)")

                    let filter = SCContentFilter(display: display, excludingWindows: [])
                    let config = self.createStreamConfiguration()

                    try self.setupAssetWriter(url: URL(fileURLWithPath: outputPath))

                    let stream = SCStream(filter: filter, configuration: config, delegate: self)
                    let output = ScreenStreamOutput(recorder: self)
                    let outputQueue = DispatchQueue(label: "com.taskerino.screen.output")

                    try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: outputQueue)

                    self.screenStream = stream
                    self.screenOutput = output
                    self.currentMode = .display
                    self.isRecording = true
                    self.startTime = Date()
                    self.frameCount = 0

                    try await stream.startCapture()
                    print("✅ [VIDEO] Display recording started")

                } catch {
                    setupError = error
                }
                semaphore.signal()
            }

            semaphore.wait()
            if let error = setupError {
                throw error
            }
        }
    }

    // MARK: - Window Recording

    func startWindowRecording(windowID: String, outputPath: String, fps: Int, width: Int, height: Int) throws {
        try queue.sync {
            guard !isRecording else {
                throw ScreenRecorderError.alreadyRecording
            }

            print("📹 [VIDEO] Starting window recording: \(windowID)")

            self.width = width
            self.height = height
            self.fps = fps
            self.outputURL = URL(fileURLWithPath: outputPath)

            let semaphore = DispatchSemaphore(value: 0)
            var setupError: Error?

            Task {
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

                    guard let windowIDInt = UInt32(windowID),
                          let window = content.windows.first(where: { $0.windowID == windowIDInt }) else {
                        throw ScreenRecorderError.noDisplayFound
                    }

                    print("✅ [VIDEO] Found window: \(window.title ?? "Untitled") (\(window.windowID))")

                    let filter = SCContentFilter(desktopIndependentWindow: window)
                    let config = self.createStreamConfiguration()

                    try self.setupAssetWriter(url: URL(fileURLWithPath: outputPath))

                    let stream = SCStream(filter: filter, configuration: config, delegate: self)
                    let output = WindowStreamOutput(recorder: self)
                    let outputQueue = DispatchQueue(label: "com.taskerino.window.output")

                    try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: outputQueue)

                    self.windowStream = stream
                    self.windowOutput = output
                    self.currentMode = .window
                    self.isRecording = true
                    self.startTime = Date()
                    self.frameCount = 0

                    try await stream.startCapture()
                    print("✅ [VIDEO] Window recording started")

                } catch {
                    setupError = error
                }
                semaphore.signal()
            }

            semaphore.wait()
            if let error = setupError {
                throw error
            }
        }
    }

    // MARK: - Webcam Recording

    func startWebcamRecording(webcamID: String, outputPath: String, fps: Int, width: Int, height: Int) throws {
        try queue.sync {
            guard !isRecording else {
                throw ScreenRecorderError.alreadyRecording
            }

            print("📹 [VIDEO] Starting webcam recording: \(webcamID)")

            self.width = width
            self.height = height
            self.fps = fps
            self.outputURL = URL(fileURLWithPath: outputPath)

            let devices = AVCaptureDevice.DiscoverySession(
                deviceTypes: [.builtInWideAngleCamera],
                mediaType: .video,
                position: .unspecified
            ).devices

            guard let device = devices.first(where: { $0.uniqueID == webcamID }) else {
                throw ScreenRecorderError.noWebcamFound
            }

            print("✅ [VIDEO] Found webcam: \(device.localizedName)")

            let session = AVCaptureSession()
            session.sessionPreset = .high

            let input = try AVCaptureDeviceInput(device: device)
            guard session.canAddInput(input) else {
                throw ScreenRecorderError.invalidConfiguration
            }
            session.addInput(input)

            let output = AVCaptureVideoDataOutput()
            output.videoSettings = [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
            ]
            output.alwaysDiscardsLateVideoFrames = true

            let outputQueue = DispatchQueue(label: "com.taskerino.webcam.output")
            let delegate = WebcamOutputDelegate(recorder: self)
            output.setSampleBufferDelegate(delegate, queue: outputQueue)

            guard session.canAddOutput(output) else {
                throw ScreenRecorderError.invalidConfiguration
            }
            session.addOutput(output)

            try setupAssetWriter(url: URL(fileURLWithPath: outputPath))

            self.webcamSession = session
            self.webcamOutput = output
            self.webcamDevice = device
            self.webcamDelegate = delegate
            self.currentMode = .webcam
            self.isRecording = true
            self.startTime = Date()
            self.frameCount = 0

            session.startRunning()
            print("✅ [VIDEO] Webcam recording started")
        }
    }

    // MARK: - Display + PiP Recording

    func startPiPRecording(configJSON: String, outputPath: String) throws {
        try queue.sync {
            guard !isRecording else {
                throw ScreenRecorderError.alreadyRecording
            }

            print("📹 [VIDEO] Starting display + PiP recording")

            guard let configData = configJSON.data(using: .utf8),
                  let config = try? JSONDecoder().decode(PiPRecordingConfig.self, from: configData) else {
                throw ScreenRecorderError.invalidConfiguration
            }

            self.width = config.width
            self.height = config.height
            self.fps = config.fps
            self.outputURL = URL(fileURLWithPath: outputPath)

            let semaphore = DispatchSemaphore(value: 0)
            var setupError: Error?

            Task {
                do {
                    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

                    let display: SCDisplay
                    if let displayIDs = config.displayIDs, !displayIDs.isEmpty {
                        guard let targetDisplay = content.displays.first(where: { displayIDs.contains("\($0.displayID)") }) else {
                            throw ScreenRecorderError.noDisplayFound
                        }
                        display = targetDisplay
                    } else {
                        guard let primaryDisplay = content.displays.first else {
                            throw ScreenRecorderError.noDisplayFound
                        }
                        display = primaryDisplay
                    }

                    print("✅ [VIDEO] Found display: \(display.displayID)")

                    guard let webcamID = config.webcamDeviceID else {
                        throw ScreenRecorderError.invalidConfiguration
                    }

                    let devices = AVCaptureDevice.DiscoverySession(
                        deviceTypes: [.builtInWideAngleCamera],
                        mediaType: .video,
                        position: .unspecified
                    ).devices

                    guard let webcamDevice = devices.first(where: { $0.uniqueID == webcamID }) else {
                        throw ScreenRecorderError.noWebcamFound
                    }

                    print("✅ [VIDEO] Found webcam: \(webcamDevice.localizedName)")

                    try self.setupPiPCompositor(config: config.pipConfig)

                    let filter = SCContentFilter(display: display, excludingWindows: [])
                    let streamConfig = self.createStreamConfiguration()

                    try self.setupAssetWriter(url: URL(fileURLWithPath: outputPath))

                    let screenStream = SCStream(filter: filter, configuration: streamConfig, delegate: self)
                    let screenOutput = PiPScreenOutput(recorder: self)
                    let screenQueue = DispatchQueue(label: "com.taskerino.pip.screen")

                    try screenStream.addStreamOutput(screenOutput, type: .screen, sampleHandlerQueue: screenQueue)

                    let webcamSession = AVCaptureSession()
                    webcamSession.sessionPreset = .high

                    let webcamInput = try AVCaptureDeviceInput(device: webcamDevice)
                    guard webcamSession.canAddInput(webcamInput) else {
                        throw ScreenRecorderError.invalidConfiguration
                    }
                    webcamSession.addInput(webcamInput)

                    let webcamOutput = AVCaptureVideoDataOutput()
                    webcamOutput.videoSettings = [
                        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
                    ]
                    webcamOutput.alwaysDiscardsLateVideoFrames = true

                    let webcamQueue = DispatchQueue(label: "com.taskerino.pip.webcam")
                    let webcamDelegate = PiPWebcamDelegate(recorder: self)
                    webcamOutput.setSampleBufferDelegate(webcamDelegate, queue: webcamQueue)

                    guard webcamSession.canAddOutput(webcamOutput) else {
                        throw ScreenRecorderError.invalidConfiguration
                    }
                    webcamSession.addOutput(webcamOutput)

                    self.screenStream = screenStream
                    self.screenOutput = screenOutput
                    self.webcamSession = webcamSession
                    self.webcamOutput = webcamOutput
                    self.webcamDevice = webcamDevice
                    self.webcamDelegate = webcamDelegate
                    self.currentMode = .displayWithPiP
                    self.isRecording = true
                    self.startTime = Date()
                    self.frameCount = 0

                    try await screenStream.startCapture()
                    webcamSession.startRunning()

                    print("✅ [VIDEO] Display + PiP recording started")

                } catch {
                    setupError = error
                }
                semaphore.signal()
            }

            semaphore.wait()
            if let error = setupError {
                throw error
            }
        }
    }

    // MARK: - Hot-Swap Methods

    func switchDisplay(displayID: String) throws {
        guard isRecording, currentMode == .display || currentMode == .displayWithPiP else {
            throw ScreenRecorderError.notRecording
        }

        print("🔄 [VIDEO] Switching display to: \(displayID)")

        let semaphore = DispatchSemaphore(value: 0)
        var switchError: Error?

        Task {
            do {
                if let stream = self.screenStream {
                    try await stream.stopCapture()
                }

                let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

                guard let displayIDInt = UInt32(displayID),
                      let display = content.displays.first(where: { $0.displayID == displayIDInt }) else {
                    throw ScreenRecorderError.noDisplayFound
                }

                print("✅ [VIDEO] Found new display: \(display.displayID)")

                let filter = SCContentFilter(display: display, excludingWindows: [])
                let config = self.createStreamConfiguration()

                let newStream = SCStream(filter: filter, configuration: config, delegate: self)

                let output: SCStreamOutput
                let outputQueue: DispatchQueue

                if self.currentMode == .displayWithPiP {
                    output = PiPScreenOutput(recorder: self)
                    outputQueue = DispatchQueue(label: "com.taskerino.pip.screen")
                } else {
                    output = ScreenStreamOutput(recorder: self)
                    outputQueue = DispatchQueue(label: "com.taskerino.screen.output")
                }

                try newStream.addStreamOutput(output, type: .screen, sampleHandlerQueue: outputQueue)

                self.screenStream = newStream
                self.screenOutput = output

                try await newStream.startCapture()

                print("✅ [VIDEO] Display switched successfully")

            } catch {
                switchError = error
            }
            semaphore.signal()
        }

        semaphore.wait()
        if let error = switchError {
            throw error
        }
    }

    func updateWebcamMode(configJSON: String) throws {
        guard isRecording, currentMode == .displayWithPiP else {
            throw ScreenRecorderError.notRecording
        }

        print("🔄 [VIDEO] Updating PiP configuration")

        guard let configData = configJSON.data(using: .utf8),
              let pipConfig = try? JSONDecoder().decode(PiPConfigData.self, from: configData) else {
            throw ScreenRecorderError.invalidConfiguration
        }

        try setupPiPCompositor(config: pipConfig)
        print("✅ [VIDEO] PiP configuration updated")
    }

    // MARK: - Stop Recording

    func stopRecording() throws {
        try queue.sync {
            guard isRecording else {
                throw ScreenRecorderError.notRecording
            }

            print("⏹️  [VIDEO] Stopping recording...")

            isRecording = false

            let semaphore = DispatchSemaphore(value: 0)
            var stopError: Error?

            Task {
                do {
                    if let stream = self.screenStream {
                        try await stream.stopCapture()
                        self.screenStream = nil
                        self.screenOutput = nil
                    }

                    if let stream = self.windowStream {
                        try await stream.stopCapture()
                        self.windowStream = nil
                        self.windowOutput = nil
                    }

                    if let session = self.webcamSession {
                        session.stopRunning()
                        self.webcamSession = nil
                        self.webcamOutput = nil
                        self.webcamDevice = nil
                        self.webcamDelegate = nil
                    }

                    if let input = self.videoInput {
                        input.markAsFinished()
                    }

                    if let writer = self.assetWriter {
                        await writer.finishWriting()

                        if writer.status == .completed {
                            print("✅ [VIDEO] Recording saved: \(self.outputURL?.path ?? "unknown")")
                        } else if let error = writer.error {
                            throw error
                        }
                    }

                    self.cleanup()

                } catch {
                    stopError = error
                }
                semaphore.signal()
            }

            semaphore.wait()
            if let error = stopError {
                throw error
            }
        }
    }

    // MARK: - Frame Processing

    fileprivate func processScreenFrame(_ buffer: CVPixelBuffer) {
        guard isRecording else { return }

        switch currentMode {
        case .display, .window:
            writeFrame(buffer)

        case .displayWithPiP:
            syncQueue.async {
                self.lastScreenBuffer = buffer
                self.compositeAndWritePiPFrame()
            }

        default:
            break
        }
    }

    fileprivate func processWebcamFrame(_ buffer: CVPixelBuffer) {
        guard isRecording else { return }

        switch currentMode {
        case .webcam:
            writeFrame(buffer)

        case .displayWithPiP:
            syncQueue.async {
                self.lastWebcamBuffer = buffer
                self.compositeAndWritePiPFrame()
            }

        default:
            break
        }
    }

    private func compositeAndWritePiPFrame() {
        guard let screenBuffer = lastScreenBuffer,
              let webcamBuffer = lastWebcamBuffer,
              let compositor = pipCompositor else {
            return
        }

        do {
            let composited = try compositor.composite(screenBuffer: screenBuffer, webcamBuffer: webcamBuffer)
            writeFrame(composited)

            lastScreenBuffer = nil
            lastWebcamBuffer = nil
        } catch {
            print("❌ [VIDEO] PiP composition failed: \(error)")
        }
    }

    private func writeFrame(_ buffer: CVPixelBuffer) {
        guard let input = videoInput,
              let adaptor = pixelBufferAdaptor,
              let writer = assetWriter else {
            return
        }

        guard writer.status == .writing else {
            if let error = writer.error {
                print("❌ [VIDEO] Writer error: \(error)")
            }
            return
        }

        guard input.isReadyForMoreMediaData else {
            return
        }

        let presentationTime = CMTime(value: frameCount, timescale: CMTimeScale(fps))
        frameCount += 1

        if adaptor.append(buffer, withPresentationTime: presentationTime) {
            if frameCount % 30 == 0 {
                print("✅ [VIDEO] Frame \(frameCount) written")
            }
        } else if let error = writer.error {
            print("❌ [VIDEO] Failed to write frame: \(error)")
        }
    }

    // MARK: - Helper Methods

    private func createStreamConfiguration() -> SCStreamConfiguration {
        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
        config.queueDepth = 5
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true
        return config
    }

    private func setupAssetWriter(url: URL) throws {
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }

        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let writer = try AVAssetWriter(url: url, fileType: .mp4)

        let codecConfig = codecConfiguration
        print("📹 [VIDEO] Using codec: \(codecConfig.codec.rawValue)")

        var compressionProperties: [String: Any] = [
            AVVideoAverageBitRateKey: 1_200_000,
            AVVideoExpectedSourceFrameRateKey: fps
        ]

        if !codecConfig.profile.isEmpty {
            compressionProperties[AVVideoProfileLevelKey] = codecConfig.profile
        }

        let videoSettings: [String: Any] = [
            AVVideoCodecKey: codecConfig.codec,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: compressionProperties
        ]

        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        input.expectsMediaDataInRealTime = true

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
            throw ScreenRecorderError.cannotAddInput
        }

        writer.add(input)

        self.assetWriter = writer
        self.videoInput = input
        self.pixelBufferAdaptor = adaptor

        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        print("✅ [VIDEO] Asset writer configured")
    }

    private func setupPiPCompositor(config: PiPConfigData?) throws {
        if pipCompositor == nil {
            pipCompositor = try PiPCompositor()
        }

        guard let config = config, config.enabled else {
            return
        }

        let position: PiPPosition
        switch config.position {
        case "top-left": position = .topLeft
        case "top-right": position = .topRight
        case "bottom-left": position = .bottomLeft
        case "bottom-right": position = .bottomRight
        default: position = .bottomRight
        }

        let size: PiPSize
        switch config.size {
        case "small": size = .small
        case "medium": size = .medium
        case "large": size = .large
        default: size = .small
        }

        let borderRadius = CGFloat(config.borderRadius ?? 10)

        pipCompositor?.configure(position: position, size: size, borderRadius: borderRadius)
    }

    private func cleanup() {
        assetWriter = nil
        videoInput = nil
        pixelBufferAdaptor = nil
        outputURL = nil
        startTime = nil
        frameCount = 0
        lastScreenBuffer = nil
        lastWebcamBuffer = nil
        pipCompositor = nil
        currentMode = .idle

        print("✅ [VIDEO] Cleanup complete")
    }
}

// MARK: - Stream Delegates

@available(macOS 12.3, *)
extension GlobalScreenRecorder: SCStreamDelegate {
    public func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("❌ [VIDEO] Stream stopped with error: \(error)")
        isRecording = false
    }
}

// MARK: - Stream Output Handlers

@available(macOS 12.3, *)
private class ScreenStreamOutput: NSObject, SCStreamOutput {
    weak var recorder: GlobalScreenRecorder?

    init(recorder: GlobalScreenRecorder) {
        self.recorder = recorder
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        recorder?.processScreenFrame(pixelBuffer)
    }
}

@available(macOS 12.3, *)
private class WindowStreamOutput: NSObject, SCStreamOutput {
    weak var recorder: GlobalScreenRecorder?

    init(recorder: GlobalScreenRecorder) {
        self.recorder = recorder
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        recorder?.processScreenFrame(pixelBuffer)
    }
}

@available(macOS 12.3, *)
private class PiPScreenOutput: NSObject, SCStreamOutput {
    weak var recorder: GlobalScreenRecorder?

    init(recorder: GlobalScreenRecorder) {
        self.recorder = recorder
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        recorder?.processScreenFrame(pixelBuffer)
    }
}

@available(macOS 12.3, *)
private class WebcamOutputDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    weak var recorder: GlobalScreenRecorder?

    init(recorder: GlobalScreenRecorder) {
        self.recorder = recorder
        super.init()
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        recorder?.processWebcamFrame(pixelBuffer)
    }
}

@available(macOS 12.3, *)
private class PiPWebcamDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    weak var recorder: GlobalScreenRecorder?

    init(recorder: GlobalScreenRecorder) {
        self.recorder = recorder
        super.init()
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        recorder?.processWebcamFrame(pixelBuffer)
    }
}

// MARK: - Configuration Data Structures

private struct PiPRecordingConfig: Codable {
    let displayIDs: [String]?
    let webcamDeviceID: String?
    let pipConfig: PiPConfigData?
    let width: Int
    let height: Int
    let fps: Int

    enum CodingKeys: String, CodingKey {
        case displayIDs = "displayIds"
        case webcamDeviceID = "webcamDeviceId"
        case pipConfig
        case width
        case height
        case fps
    }
}

private struct PiPConfigData: Codable {
    let enabled: Bool
    let position: String
    let size: String
    let borderRadius: UInt32?
}

// MARK: - C-Compatible FFI Functions for Advanced Recording

@_cdecl("screen_recorder_start_display_recording")
public func screen_recorder_start_display_recording(
    display_ids_json: UnsafePointer<CChar>,
    output_path: UnsafePointer<CChar>,
    fps: Int32,
    width: Int32,
    height: Int32
) -> Int32 {
    let displayIDsJSON = String(cString: display_ids_json)
    let pathString = String(cString: output_path)

    guard let displayIDs = try? JSONDecoder().decode([String].self, from: Data(displayIDsJSON.utf8)) else {
        print("❌ [VIDEO] Invalid display IDs JSON")
        return -1
    }

    do {
        try GlobalScreenRecorder.shared.startDisplayRecording(
            displayIDs: displayIDs,
            outputPath: pathString,
            fps: Int(fps),
            width: Int(width),
            height: Int(height)
        )
        return 0
    } catch {
        print("❌ [VIDEO] Failed to start display recording: \(error)")
        return -2
    }
}

@_cdecl("screen_recorder_start_window_recording")
public func screen_recorder_start_window_recording(
    window_id: UnsafePointer<CChar>,
    output_path: UnsafePointer<CChar>,
    fps: Int32,
    width: Int32,
    height: Int32
) -> Int32 {
    let windowID = String(cString: window_id)
    let pathString = String(cString: output_path)

    do {
        try GlobalScreenRecorder.shared.startWindowRecording(
            windowID: windowID,
            outputPath: pathString,
            fps: Int(fps),
            width: Int(width),
            height: Int(height)
        )
        return 0
    } catch {
        print("❌ [VIDEO] Failed to start window recording: \(error)")
        return -2
    }
}

@_cdecl("screen_recorder_start_webcam_recording")
public func screen_recorder_start_webcam_recording(
    webcam_id: UnsafePointer<CChar>,
    output_path: UnsafePointer<CChar>,
    fps: Int32,
    width: Int32,
    height: Int32
) -> Int32 {
    let webcamID = String(cString: webcam_id)
    let pathString = String(cString: output_path)

    do {
        try GlobalScreenRecorder.shared.startWebcamRecording(
            webcamID: webcamID,
            outputPath: pathString,
            fps: Int(fps),
            width: Int(width),
            height: Int(height)
        )
        return 0
    } catch {
        print("❌ [VIDEO] Failed to start webcam recording: \(error)")
        return -2
    }
}

@_cdecl("screen_recorder_start_pip_recording")
public func screen_recorder_start_pip_recording(
    config_json: UnsafePointer<CChar>,
    output_path: UnsafePointer<CChar>
) -> Int32 {
    let configJSON = String(cString: config_json)
    let pathString = String(cString: output_path)

    do {
        try GlobalScreenRecorder.shared.startPiPRecording(
            configJSON: configJSON,
            outputPath: pathString
        )
        return 0
    } catch {
        print("❌ [VIDEO] Failed to start PiP recording: \(error)")
        return -2
    }
}

@_cdecl("screen_recorder_switch_display")
public func screen_recorder_switch_display(display_id: UnsafePointer<CChar>) -> Int32 {
    let displayID = String(cString: display_id)

    do {
        try GlobalScreenRecorder.shared.switchDisplay(displayID: displayID)
        return 0
    } catch {
        print("❌ [VIDEO] Failed to switch display: \(error)")
        return -2
    }
}

@_cdecl("screen_recorder_update_pip_config")
public func screen_recorder_update_pip_config(config_json: UnsafePointer<CChar>) -> Int32 {
    let configJSON = String(cString: config_json)

    do {
        try GlobalScreenRecorder.shared.updateWebcamMode(configJSON: configJSON)
        return 0
    } catch {
        print("❌ [VIDEO] Failed to update PiP config: \(error)")
        return -2
    }
}

@_cdecl("screen_recorder_stop_all")
public func screen_recorder_stop_all() -> Int32 {
    do {
        try GlobalScreenRecorder.shared.stopRecording()
        return 0
    } catch {
        print("❌ [VIDEO] Failed to stop recording: \(error)")
        return -2
    }
}

// MARK: - Audio Capture

/// Audio format for captured samples
public struct AudioFormat {
    let sampleRate: Double
    let channelCount: UInt32
    let formatID: AudioFormatID

    static let target16kHz = AudioFormat(
        sampleRate: 16000.0,
        channelCount: 1,
        formatID: kAudioFormatLinearPCM
    )
}

/// Ring buffer for efficient sample storage
private class RingBuffer {
    private var buffer: [Float]
    private var writeIndex: Int = 0
    private var readIndex: Int = 0
    private var availableSamples: Int = 0
    private let capacity: Int
    private let lock = NSLock()

    init(capacity: Int) {
        self.capacity = capacity
        self.buffer = [Float](repeating: 0.0, count: capacity)
    }

    /// Write samples to ring buffer
    func write(_ samples: [Float]) {
        lock.lock()
        defer { lock.unlock() }

        let samplesToWrite = min(samples.count, capacity - availableSamples)

        for i in 0..<samplesToWrite {
            buffer[writeIndex] = samples[i]
            writeIndex = (writeIndex + 1) % capacity
            availableSamples += 1
        }

        if samplesToWrite < samples.count {
            print("⚠️ [AUDIO] Ring buffer overflow - dropped \(samples.count - samplesToWrite) samples")
        }
    }

    /// Read samples from ring buffer
    func read(count: Int) -> [Float] {
        lock.lock()
        defer { lock.unlock() }

        let samplesToRead = min(count, availableSamples)
        var result = [Float]()
        result.reserveCapacity(samplesToRead)

        for _ in 0..<samplesToRead {
            result.append(buffer[readIndex])
            readIndex = (readIndex + 1) % capacity
            availableSamples -= 1
        }

        return result
    }

    /// Get number of available samples
    func available() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return availableSamples
    }

    /// Clear all samples
    func clear() {
        lock.lock()
        defer { lock.unlock() }
        writeIndex = 0
        readIndex = 0
        availableSamples = 0
    }
}

/// Audio sample converter - handles format conversion and resampling
private class AudioConverter {
    /// Convert audio buffer to Float32 PCM
    static func convertToFloat32(_ buffer: CMSampleBuffer) -> [Float]? {
        guard let blockBuffer = CMSampleBufferGetDataBuffer(buffer) else {
            return nil
        }

        guard let formatDesc = CMSampleBufferGetFormatDescription(buffer) else {
            return nil
        }

        guard let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc) else {
            return nil
        }

        let channelCount = Int(asbd.pointee.mChannelsPerFrame)
        let numSamples = CMSampleBufferGetNumSamples(buffer)

        var length: Int = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        let status = CMBlockBufferGetDataPointer(blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)

        guard status == kCMBlockBufferNoErr, let data = dataPointer else {
            return nil
        }

        var floatSamples = [Float]()
        floatSamples.reserveCapacity(numSamples * channelCount)

        switch asbd.pointee.mFormatID {
        case kAudioFormatLinearPCM:
            let formatFlags = asbd.pointee.mFormatFlags
            let bytesPerSample = Int(asbd.pointee.mBitsPerChannel / 8)

            if formatFlags & kAudioFormatFlagIsFloat != 0 {
                if bytesPerSample == 4 {
                    let floatData = data.withMemoryRebound(to: Float.self, capacity: numSamples * channelCount) { $0 }
                    for i in 0..<(numSamples * channelCount) {
                        floatSamples.append(floatData[i])
                    }
                } else if bytesPerSample == 8 {
                    let doubleData = data.withMemoryRebound(to: Double.self, capacity: numSamples * channelCount) { $0 }
                    for i in 0..<(numSamples * channelCount) {
                        floatSamples.append(Float(doubleData[i]))
                    }
                }
            } else if formatFlags & kAudioFormatFlagIsSignedInteger != 0 {
                if bytesPerSample == 2 {
                    let int16Data = data.withMemoryRebound(to: Int16.self, capacity: numSamples * channelCount) { $0 }
                    for i in 0..<(numSamples * channelCount) {
                        floatSamples.append(Float(int16Data[i]) / 32768.0)
                    }
                } else if bytesPerSample == 4 {
                    let int32Data = data.withMemoryRebound(to: Int32.self, capacity: numSamples * channelCount) { $0 }
                    for i in 0..<(numSamples * channelCount) {
                        floatSamples.append(Float(int32Data[i]) / 2147483648.0)
                    }
                }
            }

        default:
            print("⚠️ [AUDIO] Unsupported audio format: \(asbd.pointee.mFormatID)")
            return nil
        }

        return floatSamples
    }

    /// Convert stereo to mono by averaging channels
    static func stereoToMono(_ samples: [Float], channelCount: Int) -> [Float] {
        guard channelCount > 1 else {
            return samples
        }

        let frameCount = samples.count / channelCount
        var monoSamples = [Float]()
        monoSamples.reserveCapacity(frameCount)

        for frame in 0..<frameCount {
            var sum: Float = 0.0
            for channel in 0..<channelCount {
                sum += samples[frame * channelCount + channel]
            }
            monoSamples.append(sum / Float(channelCount))
        }

        return monoSamples
    }

    /// Resample audio to target sample rate using linear interpolation
    static func resample(_ samples: [Float], fromRate: Double, toRate: Double) -> [Float] {
        guard fromRate != toRate else {
            return samples
        }

        let ratio = fromRate / toRate
        let outputSampleCount = Int(Double(samples.count) / ratio)
        var resampled = [Float]()
        resampled.reserveCapacity(outputSampleCount)

        for i in 0..<outputSampleCount {
            let srcIndex = Double(i) * ratio
            let index0 = Int(srcIndex)
            let index1 = min(index0 + 1, samples.count - 1)
            let fraction = Float(srcIndex - Double(index0))

            let sample = samples[index0] * (1.0 - fraction) + samples[index1] * fraction
            resampled.append(sample)
        }

        return resampled
    }
}

/// System Audio Capture using ScreenCaptureKit
@available(macOS 13.0, *)
public class AudioCapture: NSObject {
    private var stream: SCStream?
    private var streamOutput: AudioCaptureStreamOutput?
    private var ringBuffer: RingBuffer
    fileprivate var isCapturing = false
    private var sourceSampleRate: Double = 48000.0

    private let targetSampleRate: Double = 16000.0
    private let targetChannelCount: UInt32 = 1

    private var totalSamplesReceived: Int64 = 0
    private var totalSamplesProcessed: Int64 = 0
    private var lastLogTime: Date = Date()

    public override init() {
        let bufferCapacity = Int(targetSampleRate * 60)
        self.ringBuffer = RingBuffer(capacity: bufferCapacity)
        super.init()
        print("✅ [AUDIO] AudioCapture initialized with \(bufferCapacity) sample buffer")
    }

    /// Start capturing system audio from specified display
    public func startCapture(displayID: CGDirectDisplayID) async throws {
        guard !isCapturing else {
            print("⚠️ [AUDIO] Already capturing")
            return
        }

        print("🎤 [AUDIO] Starting system audio capture for display \(displayID)")

        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
            throw AudioCaptureError.displayNotFound
        }

        print("✅ [AUDIO] Found display: \(display.displayID)")

        let filter = SCContentFilter(display: display, excludingWindows: [])

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = 48000
        config.channelCount = 2
        config.excludesCurrentProcessAudio = false

        config.width = 1
        config.height = 1
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.queueDepth = 5

        print("⚙️ [AUDIO] Audio configuration: \(config.sampleRate)Hz, \(config.channelCount) channels")

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        self.stream = stream
        self.sourceSampleRate = Double(config.sampleRate)

        let output = AudioCaptureStreamOutput(capture: self)
        self.streamOutput = output

        let audioQueue = DispatchQueue(label: "com.taskerino.audiocapture.audio", qos: .userInitiated)
        try stream.addStreamOutput(output, type: .audio, sampleHandlerQueue: audioQueue)

        print("✅ [AUDIO] Stream output handler added")

        ringBuffer.clear()
        isCapturing = true
        totalSamplesReceived = 0
        totalSamplesProcessed = 0
        lastLogTime = Date()

        try await stream.startCapture()

        print("✅ [AUDIO] Audio capture started successfully")
    }

    /// Stop capturing audio
    public func stopCapture() async throws {
        guard isCapturing else {
            print("⚠️ [AUDIO] Not currently capturing")
            return
        }

        print("⏹️ [AUDIO] Stopping audio capture...")

        isCapturing = false

        if let stream = stream {
            try await stream.stopCapture()
            self.stream = nil
        }

        self.streamOutput = nil

        print("✅ [AUDIO] Audio capture stopped - Total samples: received=\(totalSamplesReceived), processed=\(totalSamplesProcessed)")
    }

    /// Get available samples from buffer
    public func getSamples(maxCount: Int) -> [Float] {
        let samples = ringBuffer.read(count: maxCount)

        if !samples.isEmpty {
            totalSamplesProcessed += Int64(samples.count)
        }

        return samples
    }

    /// Get number of available samples in buffer
    public func availableSamples() -> Int {
        return ringBuffer.available()
    }

    /// Process incoming audio sample buffer
    fileprivate func processSample(sampleBuffer: CMSampleBuffer) {
        guard isCapturing else { return }

        guard let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc) else {
            print("⚠️ [AUDIO] Failed to get audio format description")
            return
        }

        let sourceChannels = Int(asbd.pointee.mChannelsPerFrame)
        let sourceSampleRate = asbd.pointee.mSampleRate

        guard var samples = AudioConverter.convertToFloat32(sampleBuffer) else {
            print("⚠️ [AUDIO] Failed to convert audio to Float32")
            return
        }

        totalSamplesReceived += Int64(samples.count / sourceChannels)

        if sourceChannels > 1 {
            samples = AudioConverter.stereoToMono(samples, channelCount: sourceChannels)
        }

        if abs(sourceSampleRate - targetSampleRate) > 0.1 {
            samples = AudioConverter.resample(samples, fromRate: sourceSampleRate, toRate: targetSampleRate)
        }

        ringBuffer.write(samples)

        logPerformanceMetrics()
    }

    /// Log performance metrics periodically
    private func logPerformanceMetrics() {
        let now = Date()
        let elapsed = now.timeIntervalSince(lastLogTime)

        if elapsed >= 10.0 {
            let bufferedSamples = ringBuffer.available()
            let bufferedSeconds = Double(bufferedSamples) / targetSampleRate
            let receivedSeconds = Double(totalSamplesReceived) / sourceSampleRate
            let processedSeconds = Double(totalSamplesProcessed) / targetSampleRate

            print("📊 [AUDIO] Status: buffered=\(String(format: "%.1f", bufferedSeconds))s, received=\(String(format: "%.1f", receivedSeconds))s, processed=\(String(format: "%.1f", processedSeconds))s")

            lastLogTime = now
        }
    }
}

/// Stream output handler for audio
@available(macOS 13.0, *)
private class AudioCaptureStreamOutput: NSObject, SCStreamOutput {
    weak var capture: AudioCapture?

    init(capture: AudioCapture) {
        self.capture = capture
        super.init()
        print("🎤 [AUDIO] AudioCaptureStreamOutput initialized")
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        capture?.processSample(sampleBuffer: sampleBuffer)
    }
}

/// Stream delegate for audio capture
@available(macOS 13.0, *)
extension AudioCapture: SCStreamDelegate {
    public func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("❌ [AUDIO] Stream stopped with error: \(error)")
        print("❌ [AUDIO] Error details: \(error.localizedDescription)")
        isCapturing = false
    }
}

/// Audio capture errors
enum AudioCaptureError: Error {
    case displayNotFound
    case alreadyCapturing
    case notCapturing
    case conversionFailed
}

// MARK: - Audio Capture FFI Functions

/// Create audio capture instance
@_cdecl("audio_capture_create")
public func audio_capture_create() -> UnsafeMutableRawPointer? {
    if #available(macOS 13.0, *) {
        let capture = AudioCapture()
        return Unmanaged.passRetained(capture).toOpaque()
    } else {
        print("❌ [AUDIO] Audio capture requires macOS 13.0+")
        return nil
    }
}

/// Start audio capture for specified display
@_cdecl("audio_capture_start")
public func audio_capture_start(
    capture: UnsafeMutableRawPointer,
    displayID: UInt32
) -> Bool {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeUnretainedValue()

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        Task {
            do {
                try await instance.startCapture(displayID: CGDirectDisplayID(displayID))
                success = true
            } catch {
                print("❌ [AUDIO] Failed to start capture: \(error)")
                success = false
            }
            semaphore.signal()
        }

        semaphore.wait()
        return success
    } else {
        print("❌ [AUDIO] Audio capture requires macOS 13.0+")
        return false
    }
}

/// Stop audio capture
@_cdecl("audio_capture_stop")
public func audio_capture_stop(capture: UnsafeMutableRawPointer) -> Bool {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeUnretainedValue()

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        Task {
            do {
                try await instance.stopCapture()
                success = true
            } catch {
                print("❌ [AUDIO] Failed to stop capture: \(error)")
                success = false
            }
            semaphore.signal()
        }

        semaphore.wait()
        return success
    } else {
        return false
    }
}

/// Get audio samples from buffer
/// Returns pointer to Float array that must be freed by caller
@_cdecl("audio_capture_get_samples")
public func audio_capture_get_samples(
    capture: UnsafeMutableRawPointer,
    maxCount: Int32,
    outCount: UnsafeMutablePointer<Int32>
) -> UnsafeMutablePointer<Float>? {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeUnretainedValue()

        let samples = instance.getSamples(maxCount: Int(maxCount))

        guard !samples.isEmpty else {
            outCount.pointee = 0
            return nil
        }

        let buffer = UnsafeMutablePointer<Float>.allocate(capacity: samples.count)
        buffer.initialize(from: samples, count: samples.count)

        outCount.pointee = Int32(samples.count)
        return buffer
    } else {
        outCount.pointee = 0
        return nil
    }
}

/// Get number of available samples in buffer
@_cdecl("audio_capture_available_samples")
public func audio_capture_available_samples(capture: UnsafeMutableRawPointer) -> Int32 {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeUnretainedValue()
        return Int32(instance.availableSamples())
    } else {
        return 0
    }
}

/// Destroy audio capture instance
@_cdecl("audio_capture_destroy")
public func audio_capture_destroy(capture: UnsafeMutableRawPointer) {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeRetainedValue()

        if instance.isCapturing {
            _ = audio_capture_stop(capture: capture)
        }

        print("🗑️ [AUDIO] AudioCapture destroyed")
    }
}

// MARK: - System Audio Capture FFI (for macos_audio.rs)

/// Create system audio capture instance
@_cdecl("system_audio_capture_create")
public func system_audio_capture_create() -> UnsafeMutableRawPointer? {
    if #available(macOS 13.0, *) {
        let capture = AudioCapture()
        return Unmanaged.passRetained(capture).toOpaque()
    } else {
        print("❌ [SYSTEM AUDIO] System audio capture requires macOS 13.0+")
        return nil
    }
}

/// Check if system audio capture is available (macOS 13.0+)
@_cdecl("system_audio_capture_is_available")
public func system_audio_capture_is_available() -> Bool {
    if #available(macOS 13.0, *) {
        return true
    } else {
        return false
    }
}

/// Start system audio capture with callback
@_cdecl("system_audio_capture_start")
public func system_audio_capture_start(
    capture: UnsafeMutableRawPointer,
    callback: @escaping @convention(c) (UnsafePointer<Float>, Int32, UInt32, UInt16, UnsafeMutableRawPointer?) -> Void,
    context: UnsafeMutableRawPointer?
) -> Bool {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeUnretainedValue()

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        Task {
            do {
                // Start capture on primary display (use CGMainDisplayID())
                try await instance.startCapture(displayID: CGMainDisplayID())

                // Start background thread to periodically call callback with audio samples
                DispatchQueue.global(qos: .userInitiated).async {
                    while instance.isCapturing {
                        let availableSamples = instance.availableSamples()

                        if availableSamples > 0 {
                            // Read samples in chunks of 16000 (1 second at 16kHz)
                            let chunkSize = min(availableSamples, 16000)
                            let samples = instance.getSamples(maxCount: chunkSize)

                            if !samples.isEmpty {
                                samples.withUnsafeBufferPointer { bufferPointer in
                                    if let baseAddress = bufferPointer.baseAddress {
                                        callback(baseAddress, Int32(samples.count), 16000, 1, context)
                                    }
                                }
                            }
                        }

                        // Sleep for 100ms between checks
                        Thread.sleep(forTimeInterval: 0.1)
                    }
                }

                success = true
            } catch {
                print("❌ [SYSTEM AUDIO] Failed to start capture: \(error)")
                success = false
            }
            semaphore.signal()
        }

        semaphore.wait()
        return success
    } else {
        print("❌ [SYSTEM AUDIO] System audio capture requires macOS 13.0+")
        return false
    }
}

/// Stop system audio capture
@_cdecl("system_audio_capture_stop")
public func system_audio_capture_stop(capture: UnsafeMutableRawPointer) -> Bool {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeUnretainedValue()

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        Task {
            do {
                try await instance.stopCapture()
                success = true
            } catch {
                print("❌ [SYSTEM AUDIO] Failed to stop capture: \(error)")
                success = false
            }
            semaphore.signal()
        }

        semaphore.wait()
        return success
    } else {
        return false
    }
}

/// Destroy system audio capture instance
@_cdecl("system_audio_capture_destroy")
public func system_audio_capture_destroy(capture: UnsafeMutableRawPointer) {
    if #available(macOS 13.0, *) {
        let instance = Unmanaged<AudioCapture>.fromOpaque(capture).takeRetainedValue()

        if instance.isCapturing {
            _ = system_audio_capture_stop(capture: capture)
        }

        print("🗑️ [SYSTEM AUDIO] System audio capture destroyed")
    }
}

// MARK: - Webcam Enumeration FFI

/// Enumerate available webcams and return as JSON string
/// Returns JSON array of webcam info objects
@_cdecl("screen_recorder_enumerate_displays")
public func screen_recorder_enumerate_displays() -> UnsafePointer<CChar>? {
    print("🖥️ [DISPLAY] Enumerating displays...")

    let semaphore = DispatchSemaphore(value: 0)
    var displayInfos: [[String: Any]] = []

    Task {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            let displays = content.displays
            print("🖥️ [DISPLAY] Found \(displays.count) display(s)")

            for (index, display) in displays.enumerated() {
                let displayInfo: [String: Any] = [
                    "displayId": String(display.displayID),
                    "displayName": "Display \(display.displayID)",
                    "width": display.width,
                    "height": display.height,
                    "isPrimary": index == 0  // First display is primary
                ]
                displayInfos.append(displayInfo)
                print("   - Display (ID: \(display.displayID), \(display.width)x\(display.height), Primary: \(index == 0))")
            }
        } catch {
            print("❌ [DISPLAY] Failed to enumerate displays: \(error)")
        }
        semaphore.signal()
    }

    semaphore.wait()

    // Serialize to JSON
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: displayInfos, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ [DISPLAY] Failed to convert JSON data to string")
            return nil
        }

        print("✅ [DISPLAY] Returning display info JSON")

        // Return as C string (caller must free)
        let cString = strdup(jsonString)
        return UnsafePointer(cString)
    } catch {
        print("❌ [DISPLAY] Failed to serialize display info: \(error)")
        return nil
    }
}

@_cdecl("screen_recorder_enumerate_windows")
public func screen_recorder_enumerate_windows() -> UnsafePointer<CChar>? {
    print("🪟 [WINDOW] Enumerating windows...")

    let semaphore = DispatchSemaphore(value: 0)
    var windowInfos: [[String: Any]] = []

    Task {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            let windows = content.windows
            print("🪟 [WINDOW] Found \(windows.count) window(s)")

            for window in windows {
                // Skip windows without titles or from system processes
                guard let title = window.title, !title.isEmpty else { continue }
                guard let app = window.owningApplication else { continue }

                let windowInfo: [String: Any] = [
                    "windowId": String(window.windowID),
                    "title": title,
                    "owningApp": app.applicationName,
                    "bundleId": app.bundleIdentifier ?? "",
                    "bounds": [
                        "x": window.frame.origin.x,
                        "y": window.frame.origin.y,
                        "width": window.frame.width,
                        "height": window.frame.height
                    ] as [String: Any],
                    "layer": window.windowLayer
                ]
                windowInfos.append(windowInfo)
                print("   - \(title) (\(app.applicationName), \(window.frame.width)x\(window.frame.height))")
            }
        } catch {
            print("❌ [WINDOW] Failed to enumerate windows: \(error)")
        }
        semaphore.signal()
    }

    semaphore.wait()

    // Serialize to JSON
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: windowInfos, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ [WINDOW] Failed to convert JSON data to string")
            return nil
        }

        print("✅ [WINDOW] Returning window info JSON")

        // Return as C string (caller must free)
        let cString = strdup(jsonString)
        return UnsafePointer(cString)
    } catch {
        print("❌ [WINDOW] Failed to serialize window info: \(error)")
        return nil
    }
}

@_cdecl("screen_recorder_enumerate_webcams")
public func screen_recorder_enumerate_webcams() -> UnsafePointer<CChar>? {
    print("📹 [WEBCAM] Enumerating webcams...")

    // Discover all available video capture devices
    let discoverySession = AVCaptureDevice.DiscoverySession(
        deviceTypes: [.builtInWideAngleCamera, .externalUnknown],
        mediaType: .video,
        position: .unspecified
    )

    let devices = discoverySession.devices
    print("📹 [WEBCAM] Found \(devices.count) webcam device(s)")

    // Build webcam info array
    var webcamInfos: [[String: Any]] = []

    for device in devices {
        // Map camera position to string
        let positionString: String
        switch device.position {
        case .front:
            positionString = "front"
        case .back:
            positionString = "back"
        default:
            positionString = "unspecified"
        }

        let webcamInfo: [String: Any] = [
            "deviceId": device.uniqueID,
            "deviceName": device.localizedName,
            "position": positionString,
            "manufacturer": device.manufacturer ?? "Unknown"
        ]
        webcamInfos.append(webcamInfo)
        print("   - \(device.localizedName) (ID: \(device.uniqueID), Position: \(positionString))")
    }

    // Serialize to JSON
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: webcamInfos, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ [WEBCAM] Failed to convert JSON data to string")
            return nil
        }

        print("✅ [WEBCAM] Returning webcam info JSON")

        // Return as C string (caller must free)
        let cString = strdup(jsonString)
        return UnsafePointer(cString)
    } catch {
        print("❌ [WEBCAM] Failed to serialize webcam info: \(error)")
        return nil
    }
}

// MARK: - Display & Window Thumbnail Capture

/// Capture thumbnail of a display as base64 PNG
@_cdecl("screen_recorder_capture_display_thumbnail")
public func screen_recorder_capture_display_thumbnail(
    _ displayId: UnsafePointer<CChar>
) -> UnsafePointer<CChar>? {
    let displayIdStr = String(cString: displayId)

    print("📸 [THUMBNAIL] Capturing display thumbnail: \(displayIdStr)")

    // Parse display ID (format: "display_<number>")
    guard let displayNumber = UInt32(displayIdStr.replacingOccurrences(of: "display_", with: "")) else {
        print("❌ [THUMBNAIL] Invalid display ID format")
        return nil
    }

    // Capture the display
    guard let cgImage = CGDisplayCreateImage(displayNumber) else {
        print("❌ [THUMBNAIL] Failed to capture display image")
        return nil
    }

    // Create NSImage and resize to thumbnail
    let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))

    // Calculate thumbnail size (max 320x180, maintaining aspect ratio)
    let maxWidth: CGFloat = 320
    let maxHeight: CGFloat = 180
    let aspectRatio = CGFloat(cgImage.width) / CGFloat(cgImage.height)

    var thumbnailSize: NSSize
    if aspectRatio > maxWidth / maxHeight {
        thumbnailSize = NSSize(width: maxWidth, height: maxWidth / aspectRatio)
    } else {
        thumbnailSize = NSSize(width: maxHeight * aspectRatio, height: maxHeight)
    }

    // Create thumbnail
    let thumbnail = NSImage(size: thumbnailSize)
    thumbnail.lockFocus()
    nsImage.draw(in: NSRect(origin: .zero, size: thumbnailSize))
    thumbnail.unlockFocus()

    // Convert to PNG data
    guard let tiffData = thumbnail.tiffRepresentation,
          let bitmapImage = NSBitmapImageRep(data: tiffData),
          let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
        print("❌ [THUMBNAIL] Failed to create PNG data")
        return nil
    }

    // Convert to base64 data URI
    let base64String = pngData.base64EncodedString()
    let dataUri = "data:image/png;base64,\(base64String)"

    print("✅ [THUMBNAIL] Display thumbnail captured (\(pngData.count) bytes)")

    // Return as C string (caller must free)
    let cString = strdup(dataUri)
    return UnsafePointer(cString)
}

/// Capture thumbnail of a window as base64 PNG
@_cdecl("screen_recorder_capture_window_thumbnail")
public func screen_recorder_capture_window_thumbnail(
    _ windowId: UnsafePointer<CChar>
) -> UnsafePointer<CChar>? {
    let windowIdStr = String(cString: windowId)

    print("📸 [THUMBNAIL] Capturing window thumbnail: \(windowIdStr)")

    // Parse window ID (format: "window_<number>")
    guard let windowNumber = UInt32(windowIdStr.replacingOccurrences(of: "window_", with: "")) else {
        print("❌ [THUMBNAIL] Invalid window ID format")
        return nil
    }

    // Capture window image using CGWindowListCreateImage
    let cgWindowId = CGWindowID(windowNumber)

    guard let cgImage = CGWindowListCreateImage(
        .null,
        .optionIncludingWindow,
        cgWindowId,
        [.boundsIgnoreFraming, .bestResolution]
    ) else {
        print("❌ [THUMBNAIL] Failed to capture window image")
        return nil
    }

    // Create NSImage and resize to thumbnail
    let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))

    // Calculate thumbnail size (max 320x180, maintaining aspect ratio)
    let maxWidth: CGFloat = 320
    let maxHeight: CGFloat = 180
    let aspectRatio = CGFloat(cgImage.width) / CGFloat(cgImage.height)

    var thumbnailSize: NSSize
    if aspectRatio > maxWidth / maxHeight {
        thumbnailSize = NSSize(width: maxWidth, height: maxWidth / aspectRatio)
    } else {
        thumbnailSize = NSSize(width: maxHeight * aspectRatio, height: maxHeight)
    }

    // Create thumbnail
    let thumbnail = NSImage(size: thumbnailSize)
    thumbnail.lockFocus()
    nsImage.draw(in: NSRect(origin: .zero, size: thumbnailSize))
    thumbnail.unlockFocus()

    // Convert to PNG data
    guard let tiffData = thumbnail.tiffRepresentation,
          let bitmapImage = NSBitmapImageRep(data: tiffData),
          let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
        print("❌ [THUMBNAIL] Failed to create PNG data")
        return nil
    }

    // Convert to base64 data URI
    let base64String = pngData.base64EncodedString()
    let dataUri = "data:image/png;base64,\(base64String)"

    print("✅ [THUMBNAIL] Window thumbnail captured (\(pngData.count) bytes)")

    // Return as C string (caller must free)
    let cString = strdup(dataUri)
    return UnsafePointer(cString)
}
