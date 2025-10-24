import XCTest
import CoreVideo
import CoreMedia
@testable import ScreenRecorder

/// Tests for PassthroughCompositor
final class PassthroughCompositorTests: XCTestCase {

    // MARK: - Test Passthrough Behavior

    func testPassthrough() throws {
        let compositor = PassthroughCompositor()
        let frame = createMockFrame(sourceId: "test-screen")

        let result = try compositor.composite([frame])

        // Should return the exact same buffer
        XCTAssertEqual(result, frame.buffer)
    }

    func testPassthroughPreservesBuffer() throws {
        let compositor = PassthroughCompositor()
        let mockBuffer = createMockPixelBuffer(width: 1920, height: 1080)
        let frame = SourcedFrame(
            buffer: mockBuffer,
            sourceId: "screen",
            timestamp: CMTime(seconds: 1.0, preferredTimescale: 600),
            sequenceNumber: 0
        )

        let result = try compositor.composite([frame])

        // Verify dimensions are preserved
        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)

        // Verify it's the same buffer instance
        XCTAssertTrue(result === mockBuffer)
    }

    // MARK: - Test Error Conditions

    func testRejectsMultipleFrames() {
        let compositor = PassthroughCompositor()
        let frames = [
            createMockFrame(sourceId: "screen-1"),
            createMockFrame(sourceId: "screen-2")
        ]

        XCTAssertThrowsError(try compositor.composite(frames)) { error in
            guard case CompositorError.invalidFrameCount(let expected, let actual) = error else {
                XCTFail("Expected invalidFrameCount error, got \(error)")
                return
            }
            XCTAssertEqual(expected, 1)
            XCTAssertEqual(actual, 2)
        }
    }

    func testRejectsEmptyFrameArray() {
        let compositor = PassthroughCompositor()
        let frames: [SourcedFrame] = []

        XCTAssertThrowsError(try compositor.composite(frames)) { error in
            guard case CompositorError.invalidFrameCount(let expected, let actual) = error else {
                XCTFail("Expected invalidFrameCount error, got \(error)")
                return
            }
            XCTAssertEqual(expected, 1)
            XCTAssertEqual(actual, 0)
        }
    }

    func testRejectsThreeFrames() {
        let compositor = PassthroughCompositor()
        let frames = [
            createMockFrame(sourceId: "screen-1"),
            createMockFrame(sourceId: "screen-2"),
            createMockFrame(sourceId: "screen-3")
        ]

        XCTAssertThrowsError(try compositor.composite(frames)) { error in
            guard case CompositorError.invalidFrameCount(let expected, let actual) = error else {
                XCTFail("Expected invalidFrameCount error, got \(error)")
                return
            }
            XCTAssertEqual(expected, 1)
            XCTAssertEqual(actual, 3)
        }
    }

    // MARK: - Test Different Frame Sizes

    func testPassthrough4K() throws {
        let compositor = PassthroughCompositor()
        let buffer = createMockPixelBuffer(width: 3840, height: 2160)
        let frame = SourcedFrame(
            buffer: buffer,
            sourceId: "4k-screen",
            timestamp: CMTime(seconds: 0.5, preferredTimescale: 600),
            sequenceNumber: 0
        )

        let result = try compositor.composite([frame])

        XCTAssertEqual(CVPixelBufferGetWidth(result), 3840)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 2160)
    }

    func testPassthrough720p() throws {
        let compositor = PassthroughCompositor()
        let buffer = createMockPixelBuffer(width: 1280, height: 720)
        let frame = SourcedFrame(
            buffer: buffer,
            sourceId: "720p-screen",
            timestamp: CMTime.zero,
            sequenceNumber: 0
        )

        let result = try compositor.composite([frame])

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1280)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 720)
    }

    // MARK: - Test Compositor Reusability

    func testCompositorCanBeReused() throws {
        let compositor = PassthroughCompositor()

        // First frame
        let frame1 = createMockFrame(sourceId: "frame-1")
        let result1 = try compositor.composite([frame1])
        XCTAssertEqual(result1, frame1.buffer)

        // Second frame
        let frame2 = createMockFrame(sourceId: "frame-2")
        let result2 = try compositor.composite([frame2])
        XCTAssertEqual(result2, frame2.buffer)

        // Results should be different
        XCTAssertNotEqual(result1, result2)
    }

    // MARK: - Helper Methods

    /// Create a mock pixel buffer with specified dimensions
    private func createMockPixelBuffer(width: Int, height: Int) -> CVPixelBuffer {
        var pixelBuffer: CVPixelBuffer?
        let attributes: [CFString: Any] = [
            kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey: width,
            kCVPixelBufferHeightKey: height,
            kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary
        ]

        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            attributes as CFDictionary,
            &pixelBuffer
        )

        guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
            fatalError("Failed to create mock pixel buffer")
        }

        return buffer
    }

    /// Create a mock SourcedFrame with default 1080p dimensions
    private func createMockFrame(sourceId: String = "mock-source", sequenceNumber: Int = 0) -> SourcedFrame {
        let buffer = createMockPixelBuffer(width: 1920, height: 1080)
        return SourcedFrame(
            buffer: buffer,
            sourceId: sourceId,
            timestamp: CMTime(seconds: 0.0, preferredTimescale: 600),
            sequenceNumber: sequenceNumber
        )
    }
}

// MARK: - CompositorError Tests

final class CompositorErrorTests: XCTestCase {

    func testInvalidFrameCountDescription() {
        let error = CompositorError.invalidFrameCount(expected: 1, actual: 2)
        XCTAssertEqual(error.description, "Invalid frame count: expected 1, got 2")
    }

    func testCompositingFailedDescription() {
        let error = CompositorError.compositingFailed("Metal device not available")
        XCTAssertEqual(error.description, "Compositing failed: Metal device not available")
    }
}

// MARK: - SourcedFrame Tests

final class SourcedFrameTests: XCTestCase {

    func testSourcedFrameInitialization() {
        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            1920,
            1080,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        )
        XCTAssertEqual(status, kCVReturnSuccess)
        guard let buffer = pixelBuffer else {
            XCTFail("Failed to create pixel buffer")
            return
        }

        let timestamp = CMTime(seconds: 1.5, preferredTimescale: 600)
        let frame = SourcedFrame(
            buffer: buffer,
            sourceId: "test-source",
            timestamp: timestamp,
            sequenceNumber: 42
        )

        XCTAssertTrue(frame.buffer === buffer)
        XCTAssertEqual(frame.sourceId, "test-source")
        XCTAssertEqual(frame.timestamp, timestamp)
        XCTAssertEqual(frame.sequenceNumber, 42)
    }

    func testSourcedFrameIsSendable() {
        // This test verifies that SourcedFrame conforms to Sendable
        // If it didn't, this code wouldn't compile
        let frame = createTestFrame()

        Task {
            // Can be sent across concurrency boundaries
            let _ = frame
        }
    }

    private func createTestFrame() -> SourcedFrame {
        var pixelBuffer: CVPixelBuffer?
        CVPixelBufferCreate(
            kCFAllocatorDefault,
            100,
            100,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        )
        return SourcedFrame(
            buffer: pixelBuffer!,
            sourceId: "test",
            timestamp: .zero,
            sequenceNumber: 0
        )
    }
}
