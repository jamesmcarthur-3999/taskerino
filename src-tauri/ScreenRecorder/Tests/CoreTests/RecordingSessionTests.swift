import XCTest
import CoreMedia
import CoreVideo
import AVFoundation
@testable import ScreenRecorder

@available(macOS 12.3, *)
final class RecordingSessionTests: XCTestCase {

    // MARK: - Single Source Recording Tests

    func testSingleSourceRecording() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        // Create mock source
        let source = MockRecordingSource(sourceId: "screen", fps: 30)

        // Create compositor and encoder
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        // Create session
        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder,
            toleranceMs: 16
        )

        // Start recording
        try await session.start()

        // Generate some frames
        source.startGeneratingFrames(count: 10, intervalMs: 33)

        // Wait for frames to process
        try await Task.sleep(nanoseconds: 500_000_000) // 500ms

        // Stop recording
        try await session.stop()

        // Verify stats
        let stats = await session.getStats()
        XCTAssertGreaterThan(stats.framesProcessed, 0, "Should have processed frames")
        XCTAssertGreaterThan(stats.framesReceived, 0, "Should have received frames")

        // Verify video file exists
        XCTAssertTrue(FileManager.default.fileExists(atPath: tempURL.path), "Video file should exist")
    }

    func testSingleSourceLifecycle() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let source = MockRecordingSource(sourceId: "display", fps: 30)
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder
        )

        // Initially not recording
        var detailedStats = await session.getDetailedStats()
        XCTAssertFalse(detailedStats.isRecording)

        // Start
        try await session.start()
        detailedStats = await session.getDetailedStats()
        XCTAssertTrue(detailedStats.isRecording)
        XCTAssertTrue(source.isCapturing)

        // Stop
        try await session.stop()
        detailedStats = await session.getDetailedStats()
        XCTAssertFalse(detailedStats.isRecording)
        XCTAssertFalse(source.isCapturing)
    }

    // MARK: - Multi-Source (2 Sources) Tests

    func testTwoSourceSynchronization() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        // Create two sources
        let screenSource = MockRecordingSource(sourceId: "screen", fps: 30)
        let webcamSource = MockRecordingSource(sourceId: "webcam", fps: 30)

        // Create compositor and encoder
        let compositor = MockMultiSourceCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        // Create session with tight tolerance
        let session = RecordingSession(
            sources: [screenSource, webcamSource],
            compositor: compositor,
            encoder: encoder,
            toleranceMs: 16
        )

        // Start recording
        try await session.start()

        // Generate synchronized frames (same timestamps)
        screenSource.startGeneratingFrames(count: 10, intervalMs: 33, startTimeMs: 0)
        webcamSource.startGeneratingFrames(count: 10, intervalMs: 33, startTimeMs: 5) // 5ms offset

        // Wait for processing
        try await Task.sleep(nanoseconds: 500_000_000) // 500ms

        // Stop
        try await session.stop()

        // Verify synchronization
        let detailedStats = await session.getDetailedStats()
        XCTAssertGreaterThan(detailedStats.synchronizerStats.totalFramesSynchronized, 0, "Should have synchronized frames")
        XCTAssertGreaterThan(detailedStats.framesProcessed, 0, "Should have processed synchronized frames")

        // Verify both sources were used
        XCTAssertEqual(detailedStats.sourceCount, 2)
    }

    func testTwoSourceFrameAlignment() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let source1 = MockRecordingSource(sourceId: "source1", fps: 30)
        let source2 = MockRecordingSource(sourceId: "source2", fps: 30)

        let compositor = MockMultiSourceCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source1, source2],
            compositor: compositor,
            encoder: encoder,
            toleranceMs: 16
        )

        try await session.start()

        // Generate frames with slight timing variance
        source1.startGeneratingFrames(count: 5, intervalMs: 33, startTimeMs: 0)
        source2.startGeneratingFrames(count: 5, intervalMs: 33, startTimeMs: 8) // 8ms offset (within tolerance)

        try await Task.sleep(nanoseconds: 300_000_000) // 300ms

        try await session.stop()

        // Should have aligned and processed frames despite timing variance
        let stats = await session.getStats()
        XCTAssertGreaterThan(stats.framesProcessed, 0)
        XCTAssertEqual(stats.framesDropped, 0, "No frames should be dropped with proper synchronization")
    }

    // MARK: - Multi-Source (3+ Sources) Tests

    func testThreeSourceRecording() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let display = MockRecordingSource(sourceId: "display", fps: 30)
        let webcam = MockRecordingSource(sourceId: "webcam", fps: 30)
        let window = MockRecordingSource(sourceId: "window", fps: 30)

        let compositor = MockMultiSourceCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [display, webcam, window],
            compositor: compositor,
            encoder: encoder,
            toleranceMs: 16
        )

        try await session.start()

        // Generate synchronized frames from all three sources
        display.startGeneratingFrames(count: 8, intervalMs: 33, startTimeMs: 0)
        webcam.startGeneratingFrames(count: 8, intervalMs: 33, startTimeMs: 5)
        window.startGeneratingFrames(count: 8, intervalMs: 33, startTimeMs: 10)

        try await Task.sleep(nanoseconds: 400_000_000) // 400ms

        try await session.stop()

        let detailedStats = await session.getDetailedStats()
        XCTAssertEqual(detailedStats.sourceCount, 3)
        XCTAssertGreaterThan(detailedStats.synchronizerStats.totalFramesSynchronized, 0)
        XCTAssertGreaterThan(detailedStats.framesProcessed, 0)
    }

    func testFourSourceStressTest() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        // Create 4 sources
        let sources = (1...4).map { MockRecordingSource(sourceId: "source\($0)", fps: 30) }

        let compositor = MockMultiSourceCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: sources,
            compositor: compositor,
            encoder: encoder,
            toleranceMs: 20 // Slightly looser tolerance for stress test
        )

        try await session.start()

        // Start all sources with slight offsets
        for (index, source) in sources.enumerated() {
            source.startGeneratingFrames(count: 15, intervalMs: 33, startTimeMs: Int64(index * 5))
        }

        try await Task.sleep(nanoseconds: 600_000_000) // 600ms

        try await session.stop()

        let stats = await session.getStats()
        XCTAssertGreaterThan(stats.framesProcessed, 0, "Should process frames from 4 sources")
    }

    // MARK: - Error Handling Tests

    func testSourceStartFailure() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let goodSource = MockRecordingSource(sourceId: "good", fps: 30)
        let badSource = FailingMockSource(sourceId: "bad", fps: 30)

        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [goodSource, badSource],
            compositor: compositor,
            encoder: encoder
        )

        // Should throw when starting because badSource fails
        do {
            try await session.start()
            XCTFail("Should have thrown error when source fails to start")
        } catch {
            // Expected error
            XCTAssertTrue(true, "Correctly threw error on source start failure")
        }
    }

    func testEncoderFailure() async throws {
        let tempURL = URL(fileURLWithPath: "/invalid/path/that/does/not/exist/video.mp4")

        let source = MockRecordingSource(sourceId: "screen", fps: 30)
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder
        )

        // Should fail during encoder configuration
        do {
            try await session.start()
            XCTFail("Should fail with invalid output path")
        } catch {
            // Expected
            XCTAssertTrue(true)
        }
    }

    func testAlreadyRecordingError() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let source = MockRecordingSource(sourceId: "screen", fps: 30)
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder
        )

        try await session.start()

        // Try to start again - should fail
        do {
            try await session.start()
            XCTFail("Should not allow starting while already recording")
        } catch RecordingSessionError.alreadyRecording {
            // Expected
            XCTAssertTrue(true)
        } catch {
            XCTFail("Wrong error type: \(error)")
        }

        try await session.stop()
    }

    // MARK: - Statistics Tests

    func testStatisticsTracking() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let source = MockRecordingSource(sourceId: "screen", fps: 30)
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder
        )

        // Initial stats should be zero
        var stats = await session.getStats()
        XCTAssertEqual(stats.framesReceived, 0)
        XCTAssertEqual(stats.framesProcessed, 0)
        XCTAssertEqual(stats.framesDropped, 0)

        try await session.start()

        source.startGeneratingFrames(count: 15, intervalMs: 33)

        try await Task.sleep(nanoseconds: 600_000_000) // 600ms

        try await session.stop()

        // Verify stats updated
        stats = await session.getStats()
        XCTAssertGreaterThan(stats.framesReceived, 0)
        XCTAssertGreaterThan(stats.framesProcessed, 0)
    }

    func testDetailedStatistics() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let source1 = MockRecordingSource(sourceId: "source1", fps: 30)
        let source2 = MockRecordingSource(sourceId: "source2", fps: 30)

        let compositor = MockMultiSourceCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source1, source2],
            compositor: compositor,
            encoder: encoder
        )

        try await session.start()

        source1.startGeneratingFrames(count: 10, intervalMs: 33)
        source2.startGeneratingFrames(count: 10, intervalMs: 33)

        try await Task.sleep(nanoseconds: 400_000_000)

        let detailedStats = await session.getDetailedStats()

        // Verify detailed stats structure
        XCTAssertEqual(detailedStats.sourceCount, 2)
        XCTAssertTrue(detailedStats.isRecording)
        XCTAssertGreaterThan(detailedStats.framesReceived, 0)
        XCTAssertGreaterThan(detailedStats.synchronizerStats.totalFramesReceived, 0)
        XCTAssertGreaterThanOrEqual(detailedStats.encoderFrameCount, 0)

        try await session.stop()
    }

    // MARK: - Cleanup Tests

    func testStopWhenNotRecording() async throws {
        let tempURL = createTempURL()
        let source = MockRecordingSource(sourceId: "screen", fps: 30)
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder
        )

        // Stop without starting - should not throw
        try await session.stop()

        // Should still not be recording
        let stats = await session.getDetailedStats()
        XCTAssertFalse(stats.isRecording)
    }

    func testProperCleanup() async throws {
        let tempURL = createTempURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let source = MockRecordingSource(sourceId: "screen", fps: 30)
        let compositor = PassthroughCompositor()
        let encoder = VideoEncoder(outputURL: tempURL, width: 1920, height: 1080, fps: 30)

        let session = RecordingSession(
            sources: [source],
            compositor: compositor,
            encoder: encoder
        )

        try await session.start()
        XCTAssertTrue(source.isCapturing)

        source.startGeneratingFrames(count: 5, intervalMs: 33)
        try await Task.sleep(nanoseconds: 200_000_000)

        try await session.stop()

        // Verify source was stopped
        XCTAssertFalse(source.isCapturing)

        // Verify video file was finalized
        XCTAssertTrue(FileManager.default.fileExists(atPath: tempURL.path))
    }

    // MARK: - Helper Methods

    private func createTempURL() -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let filename = "test_recording_\(UUID().uuidString).mp4"
        return tempDir.appendingPathComponent(filename)
    }

    private func createMockPixelBuffer(width: Int = 1920, height: Int = 1080) -> CVPixelBuffer {
        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        )

        guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
            fatalError("Failed to create pixel buffer")
        }

        return buffer
    }
}

// MARK: - Mock Recording Source

@available(macOS 12.3, *)
final class MockRecordingSource: RecordingSource, @unchecked Sendable {
    let sourceId: String
    private let fps: Int

    private var _isCapturing = false
    var isCapturing: Bool { _isCapturing }

    private var streamContinuation: AsyncStream<SourcedFrame>.Continuation?
    private var _frameStream: AsyncStream<SourcedFrame>?

    var frameStream: AsyncStream<SourcedFrame> {
        if let stream = _frameStream {
            return stream
        }

        let stream = AsyncStream<SourcedFrame> { continuation in
            self.streamContinuation = continuation
        }
        _frameStream = stream
        return stream
    }

    private var sequenceNumber = 0

    init(sourceId: String, fps: Int) {
        self.sourceId = sourceId
        self.fps = fps
    }

    func configure(width: Int, height: Int, fps: Int) async throws {
        // Mock configuration
    }

    func start() async throws {
        _isCapturing = true
    }

    func stop() async throws {
        _isCapturing = false
        streamContinuation?.finish()
    }

    /// Generate frames for testing
    func startGeneratingFrames(count: Int, intervalMs: Int64, startTimeMs: Int64 = 0) {
        Task {
            for i in 0..<count {
                let timestampMs = startTimeMs + (Int64(i) * intervalMs)
                let timestamp = CMTime(value: timestampMs, timescale: 1000)

                let buffer = createMockPixelBuffer()
                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: timestamp,
                    sequenceNumber: sequenceNumber
                )

                sequenceNumber += 1
                streamContinuation?.yield(frame)

                // Wait interval
                try? await Task.sleep(nanoseconds: UInt64(intervalMs * 1_000_000))
            }
        }
    }

    private func createMockPixelBuffer() -> CVPixelBuffer {
        var pixelBuffer: CVPixelBuffer?
        CVPixelBufferCreate(
            kCFAllocatorDefault,
            1920,
            1080,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        )
        return pixelBuffer!
    }
}

// MARK: - Failing Mock Source (for error testing)

@available(macOS 12.3, *)
final class FailingMockSource: RecordingSource, @unchecked Sendable {
    let sourceId: String
    private let fps: Int

    var isCapturing: Bool { false }

    var frameStream: AsyncStream<SourcedFrame> {
        AsyncStream { _ in }
    }

    init(sourceId: String, fps: Int) {
        self.sourceId = sourceId
        self.fps = fps
    }

    func configure(width: Int, height: Int, fps: Int) async throws {
        // Mock
    }

    func start() async throws {
        throw RecordingSourceError.captureFailed(NSError(domain: "TestError", code: -1))
    }

    func stop() async throws {
        // Mock
    }
}

// MARK: - Mock Multi-Source Compositor

@available(macOS 12.3, *)
final class MockMultiSourceCompositor: FrameCompositor {
    func composite(_ frames: [String: SourcedFrame]) throws -> CVPixelBuffer {
        // Just return the first frame's buffer for testing
        guard let firstFrame = frames.values.first else {
            throw CompositorError.invalidFrameCount(expected: 1, got: 0)
        }
        return firstFrame.buffer
    }
}
