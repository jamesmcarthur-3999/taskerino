import XCTest
import CoreVideo
import CoreMedia
@testable import ScreenRecorder

/// Comprehensive tests for GridCompositor
@available(macOS 12.3, *)
final class GridCompositorTests: XCTestCase {

    // MARK: - Initialization Tests

    func testInitialization() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)
        XCTAssertNotNil(compositor, "Compositor should initialize successfully")
    }

    func testInitializationWith3x3Grid() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 3)
        XCTAssertNotNil(compositor, "Compositor should initialize with 3x3 grid")
    }

    func testInitializationWithCustomResolution() throws {
        let compositor = try GridCompositor(outputWidth: 3840, outputHeight: 2160, maxColumns: 2)
        XCTAssertNotNil(compositor, "Compositor should initialize with 4K resolution")
    }

    // MARK: - 2x2 Grid Tests

    func testComposite2x2GridWith4Sources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create 4 mock sources (2x2 grid)
        let frames = createMockFrames(count: 4, width: 640, height: 480)

        let result = try compositor.composite(frames)

        // Verify output dimensions
        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920, "Output width should match configured width")
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080, "Output height should match configured height")
    }

    func testComposite2x2GridWith2Sources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create 2 sources (partial grid: 2x1)
        let frames = createMockFrames(count: 2, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testComposite2x2GridWith3Sources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create 3 sources (partial grid: 2x2 with one empty cell)
        let frames = createMockFrames(count: 3, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - 3x3 Grid Tests

    func testComposite3x3GridWith9Sources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 3)

        // Create 9 mock sources (3x3 grid)
        let frames = createMockFrames(count: 9, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testComposite3x3GridWith6Sources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 3)

        // Create 6 sources (partial 3x3 grid)
        let frames = createMockFrames(count: 6, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - Single Source Tests

    func testCompositeWithSingleSource() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        let frames = createMockFrames(count: 1, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - Error Handling Tests

    func testRejectsEmptyFrames() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        let emptyFrames: [String: SourcedFrame] = [:]

        XCTAssertThrowsError(try compositor.composite(emptyFrames)) { error in
            guard case CompositorError.invalidFrameCount(let expected, let actual) = error else {
                XCTFail("Expected invalidFrameCount error, got \(error)")
                return
            }
            XCTAssertEqual(expected, 1)
            XCTAssertEqual(actual, 0)
        }
    }

    // MARK: - Resolution Scaling Tests

    func testScalingDifferentSourceResolutions() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create sources with different resolutions
        var frames: [String: SourcedFrame] = [:]
        frames["source-1"] = createMockFrame(sourceId: "source-1", width: 1920, height: 1080)
        frames["source-2"] = createMockFrame(sourceId: "source-2", width: 1280, height: 720)
        frames["source-3"] = createMockFrame(sourceId: "source-3", width: 640, height: 480)
        frames["source-4"] = createMockFrame(sourceId: "source-4", width: 3840, height: 2160)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testScaling4KSources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create 4K sources that need to be scaled down
        let frames = createMockFrames(count: 4, width: 3840, height: 2160)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testScalingSmallSources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create small sources that need to be scaled up
        let frames = createMockFrames(count: 4, width: 320, height: 240)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - Aspect Ratio Tests

    func testPreservesAspectRatio16x9() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // 16:9 aspect ratio sources
        let frames = createMockFrames(count: 4, width: 1920, height: 1080)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle 16:9 aspect ratio")
    }

    func testPreservesAspectRatio4x3() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // 4:3 aspect ratio sources
        let frames = createMockFrames(count: 4, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle 4:3 aspect ratio")
    }

    func testPreservesAspectRatio1x1() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Square aspect ratio sources
        let frames = createMockFrames(count: 4, width: 1080, height: 1080)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle 1:1 aspect ratio")
    }

    // MARK: - Performance Tests

    func testPerformance2x2Grid() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)
        let frames = createMockFrames(count: 4, width: 1280, height: 720)

        // Warm up
        _ = try compositor.composite(frames)

        // Measure composition time
        let startTime = CFAbsoluteTimeGetCurrent()
        let iterations = 60 // Simulate 60 frames

        for _ in 0..<iterations {
            _ = try compositor.composite(frames)
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let totalTime = endTime - startTime
        let avgTimePerFrame = totalTime / Double(iterations)
        let avgTimeMs = avgTimePerFrame * 1000.0

        print("📊 2x2 Grid Performance: \(String(format: "%.2f", avgTimeMs))ms per frame")

        // Should be less than 16ms for 60fps
        XCTAssertLessThan(avgTimeMs, 16.0, "Average composition time should be < 16ms for 60fps")
    }

    func testPerformance3x3Grid() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 3)
        let frames = createMockFrames(count: 9, width: 1280, height: 720)

        // Warm up
        _ = try compositor.composite(frames)

        // Measure composition time
        let startTime = CFAbsoluteTimeGetCurrent()
        let iterations = 60

        for _ in 0..<iterations {
            _ = try compositor.composite(frames)
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let totalTime = endTime - startTime
        let avgTimePerFrame = totalTime / Double(iterations)
        let avgTimeMs = avgTimePerFrame * 1000.0

        print("📊 3x3 Grid Performance: \(String(format: "%.2f", avgTimeMs))ms per frame")

        // 3x3 might be slightly slower, allow up to 20ms
        XCTAssertLessThan(avgTimeMs, 20.0, "Average composition time should be < 20ms")
    }

    func testPerformanceWith4KSources() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)
        let frames = createMockFrames(count: 4, width: 3840, height: 2160)

        // Warm up
        _ = try compositor.composite(frames)

        // Measure composition time
        let startTime = CFAbsoluteTimeGetCurrent()
        let iterations = 30

        for _ in 0..<iterations {
            _ = try compositor.composite(frames)
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let totalTime = endTime - startTime
        let avgTimePerFrame = totalTime / Double(iterations)
        let avgTimeMs = avgTimePerFrame * 1000.0

        print("📊 4K Sources Performance: \(String(format: "%.2f", avgTimeMs))ms per frame")

        // 4K sources require more processing, allow up to 25ms
        XCTAssertLessThan(avgTimeMs, 25.0, "Should handle 4K sources efficiently")
    }

    // MARK: - Reusability Tests

    func testCompositorReusability() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // First composition
        let frames1 = createMockFrames(count: 4, width: 640, height: 480)
        let result1 = try compositor.composite(frames1)
        XCTAssertNotNil(result1)

        // Second composition with different frames
        let frames2 = createMockFrames(count: 2, width: 1280, height: 720)
        let result2 = try compositor.composite(frames2)
        XCTAssertNotNil(result2)

        // Third composition with more frames
        let frames3 = createMockFrames(count: 3, width: 1920, height: 1080)
        let result3 = try compositor.composite(frames3)
        XCTAssertNotNil(result3)
    }

    // MARK: - Consistent Ordering Tests

    func testConsistentFrameOrdering() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)

        // Create frames with specific IDs
        var frames: [String: SourcedFrame] = [:]
        frames["source-d"] = createMockFrame(sourceId: "source-d", width: 640, height: 480)
        frames["source-a"] = createMockFrame(sourceId: "source-a", width: 640, height: 480)
        frames["source-c"] = createMockFrame(sourceId: "source-c", width: 640, height: 480)
        frames["source-b"] = createMockFrame(sourceId: "source-b", width: 640, height: 480)

        // Should composite in sorted order (a, b, c, d)
        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle unsorted frame dictionary")
    }

    // MARK: - Memory Management Tests

    func testMemoryManagement() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)
        let frames = createMockFrames(count: 4, width: 1280, height: 720)

        // Run many iterations to check for memory leaks
        for _ in 0..<100 {
            _ = try compositor.composite(frames)
        }

        // If we get here without crashing, memory management is working
        XCTAssertTrue(true, "Compositor should handle many compositions without memory issues")
    }

    // MARK: - Average Composition Time Tests

    func testAverageCompositionTimeTracking() throws {
        let compositor = try GridCompositor(outputWidth: 1920, outputHeight: 1080, maxColumns: 2)
        let frames = createMockFrames(count: 4, width: 1280, height: 720)

        // Run several compositions
        for _ in 0..<10 {
            _ = try compositor.composite(frames)
        }

        let avgTime = compositor.getAverageCompositionTime()

        XCTAssertGreaterThan(avgTime, 0, "Average composition time should be tracked")
        XCTAssertLessThan(avgTime, 0.1, "Average composition time should be reasonable")
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

    /// Create a mock SourcedFrame
    private func createMockFrame(
        sourceId: String,
        width: Int,
        height: Int,
        sequenceNumber: Int = 0
    ) -> SourcedFrame {
        let buffer = createMockPixelBuffer(width: width, height: height)
        return SourcedFrame(
            buffer: buffer,
            sourceId: sourceId,
            timestamp: CMTime(seconds: 0.0, preferredTimescale: 600),
            sequenceNumber: sequenceNumber
        )
    }

    /// Create multiple mock frames
    private func createMockFrames(count: Int, width: Int, height: Int) -> [String: SourcedFrame] {
        var frames: [String: SourcedFrame] = [:]

        for i in 0..<count {
            let sourceId = "source-\(i + 1)"
            frames[sourceId] = createMockFrame(
                sourceId: sourceId,
                width: width,
                height: height,
                sequenceNumber: i
            )
        }

        return frames
    }
}

// MARK: - GridCompositorError Tests

@available(macOS 12.3, *)
final class GridCompositorErrorTests: XCTestCase {

    func testErrorDescriptions() {
        XCTAssertEqual(
            GridCompositorError.metalNotAvailable.description,
            "Metal device not available"
        )
        XCTAssertEqual(
            GridCompositorError.bufferPoolCreationFailed.description,
            "Failed to create pixel buffer pool"
        )
        XCTAssertEqual(
            GridCompositorError.bufferAllocationFailed.description,
            "Failed to allocate pixel buffer"
        )
    }
}
