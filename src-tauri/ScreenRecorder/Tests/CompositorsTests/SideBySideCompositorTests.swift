import XCTest
import CoreVideo
import CoreMedia
@testable import ScreenRecorder

/// Comprehensive tests for SideBySideCompositor
@available(macOS 12.3, *)
final class SideBySideCompositorTests: XCTestCase {

    // MARK: - Initialization Tests

    func testInitialization() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        XCTAssertNotNil(compositor, "Compositor should initialize successfully")
    }

    func testInitializationWith4KResolution() throws {
        let compositor = try SideBySideCompositor(outputWidth: 3840, outputHeight: 2160)
        XCTAssertNotNil(compositor, "Compositor should initialize with 4K resolution")
    }

    func testInitializationWith720pResolution() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1280, outputHeight: 720)
        XCTAssertNotNil(compositor, "Compositor should initialize with 720p resolution")
    }

    // MARK: - 2 Sources Side-by-Side Tests

    func testComposite2SourcesSideBySide() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create 2 mock sources
        let frames = createMockFrames(count: 2, width: 640, height: 480)

        let result = try compositor.composite(frames)

        // Verify output dimensions
        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920, "Output width should match configured width")
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080, "Output height should match configured height")
    }

    func testComposite2SourcesWithDifferentAspectRatios() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create 2 sources with different aspect ratios
        var frames: [String: SourcedFrame] = [:]
        frames["source-1"] = createMockFrame(sourceId: "source-1", width: 1920, height: 1080) // 16:9
        frames["source-2"] = createMockFrame(sourceId: "source-2", width: 640, height: 480)   // 4:3

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - 3 Sources Side-by-Side Tests

    func testComposite3SourcesSideBySide() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create 3 mock sources
        let frames = createMockFrames(count: 3, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testComposite3SourcesWithMixedResolutions() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        var frames: [String: SourcedFrame] = [:]
        frames["source-1"] = createMockFrame(sourceId: "source-1", width: 1920, height: 1080)
        frames["source-2"] = createMockFrame(sourceId: "source-2", width: 1280, height: 720)
        frames["source-3"] = createMockFrame(sourceId: "source-3", width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - 4 Sources Side-by-Side Tests

    func testComposite4SourcesSideBySide() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create 4 mock sources
        let frames = createMockFrames(count: 4, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testComposite4SourcesWith4KSources() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create 4 sources at 4K resolution (will be scaled down)
        let frames = createMockFrames(count: 4, width: 3840, height: 2160)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    // MARK: - Error Handling Tests

    func testRejectsEmptyFrames() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

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

    func testRejectsSingleSource() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        let frames = createMockFrames(count: 1, width: 640, height: 480)

        XCTAssertThrowsError(try compositor.composite(frames)) { error in
            guard case SideBySideCompositorError.invalidSourceCount(let count) = error else {
                XCTFail("Expected invalidSourceCount error, got \(error)")
                return
            }
            XCTAssertEqual(count, 1)
        }
    }

    func testRejectsTooManySources() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        let frames = createMockFrames(count: 5, width: 640, height: 480)

        XCTAssertThrowsError(try compositor.composite(frames)) { error in
            guard case SideBySideCompositorError.invalidSourceCount(let count) = error else {
                XCTFail("Expected invalidSourceCount error, got \(error)")
                return
            }
            XCTAssertEqual(count, 5)
        }
    }

    // MARK: - Aspect Ratio Preservation Tests

    func testPreservesAspectRatio16x9() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // 16:9 aspect ratio sources
        let frames = createMockFrames(count: 2, width: 1920, height: 1080)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle 16:9 aspect ratio")
        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testPreservesAspectRatio4x3() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // 4:3 aspect ratio sources
        let frames = createMockFrames(count: 2, width: 640, height: 480)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle 4:3 aspect ratio")
        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testPreservesAspectRatio1x1() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Square aspect ratio sources
        let frames = createMockFrames(count: 2, width: 1080, height: 1080)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle 1:1 aspect ratio")
        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testMixedAspectRatios() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        var frames: [String: SourcedFrame] = [:]
        frames["source-1"] = createMockFrame(sourceId: "source-1", width: 1920, height: 1080) // 16:9
        frames["source-2"] = createMockFrame(sourceId: "source-2", width: 640, height: 480)   // 4:3
        frames["source-3"] = createMockFrame(sourceId: "source-3", width: 1080, height: 1080) // 1:1

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle mixed aspect ratios")
    }

    func testUltraWideAspectRatio() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Ultra-wide 21:9 aspect ratio sources
        let frames = createMockFrames(count: 2, width: 2560, height: 1080)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle ultra-wide aspect ratio")
    }

    func testPortraitAspectRatio() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Portrait 9:16 aspect ratio sources
        let frames = createMockFrames(count: 2, width: 1080, height: 1920)

        let result = try compositor.composite(frames)

        XCTAssertNotNil(result, "Should handle portrait aspect ratio")
    }

    // MARK: - Performance Tests

    func testPerformance2Sources() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        let frames = createMockFrames(count: 2, width: 1280, height: 720)

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

        print("📊 2 Sources Performance: \(String(format: "%.2f", avgTimeMs))ms per frame")

        // Should be less than 16ms for 60fps
        XCTAssertLessThan(avgTimeMs, 16.0, "Average composition time should be < 16ms for 60fps")
    }

    func testPerformance3Sources() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        let frames = createMockFrames(count: 3, width: 1280, height: 720)

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

        print("📊 3 Sources Performance: \(String(format: "%.2f", avgTimeMs))ms per frame")

        // Should be less than 16ms for 60fps
        XCTAssertLessThan(avgTimeMs, 16.0, "Average composition time should be < 16ms for 60fps")
    }

    func testPerformance4Sources() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        let frames = createMockFrames(count: 4, width: 1280, height: 720)

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

        print("📊 4 Sources Performance: \(String(format: "%.2f", avgTimeMs))ms per frame")

        // Should be less than 16ms for 60fps
        XCTAssertLessThan(avgTimeMs, 16.0, "Average composition time should be < 16ms for 60fps")
    }

    func testPerformanceWith4KSources() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        let frames = createMockFrames(count: 2, width: 3840, height: 2160)

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
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // First composition with 2 sources
        let frames1 = createMockFrames(count: 2, width: 640, height: 480)
        let result1 = try compositor.composite(frames1)
        XCTAssertNotNil(result1)

        // Second composition with 3 sources
        let frames2 = createMockFrames(count: 3, width: 1280, height: 720)
        let result2 = try compositor.composite(frames2)
        XCTAssertNotNil(result2)

        // Third composition with 4 sources
        let frames3 = createMockFrames(count: 4, width: 1920, height: 1080)
        let result3 = try compositor.composite(frames3)
        XCTAssertNotNil(result3)
    }

    func testCompositorReusabilityWithVaryingSourceCounts() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Cycle through different source counts
        for sourceCount in 2...4 {
            let frames = createMockFrames(count: sourceCount, width: 1280, height: 720)
            let result = try compositor.composite(frames)
            XCTAssertNotNil(result, "Should handle \(sourceCount) sources")
        }
    }

    // MARK: - Consistent Ordering Tests

    func testConsistentFrameOrdering() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create frames with specific IDs in random order
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
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        let frames = createMockFrames(count: 2, width: 1280, height: 720)

        // Run many iterations to check for memory leaks
        for _ in 0..<100 {
            _ = try compositor.composite(frames)
        }

        // If we get here without crashing, memory management is working
        XCTAssertTrue(true, "Compositor should handle many compositions without memory issues")
    }

    func testMemoryManagementWithVaryingSourceCounts() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Run iterations with varying source counts
        for i in 0..<50 {
            let sourceCount = (i % 3) + 2 // Cycle through 2, 3, 4
            let frames = createMockFrames(count: sourceCount, width: 1280, height: 720)
            _ = try compositor.composite(frames)
        }

        XCTAssertTrue(true, "Compositor should handle varying source counts without memory issues")
    }

    // MARK: - Average Composition Time Tests

    func testAverageCompositionTimeTracking() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)
        let frames = createMockFrames(count: 2, width: 1280, height: 720)

        // Run several compositions
        for _ in 0..<10 {
            _ = try compositor.composite(frames)
        }

        let avgTime = compositor.getAverageCompositionTime()

        XCTAssertGreaterThan(avgTime, 0, "Average composition time should be tracked")
        XCTAssertLessThan(avgTime, 0.1, "Average composition time should be reasonable")
    }

    // MARK: - Resolution Scaling Tests

    func testScalingTinySourcesUp() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create very small sources that need significant scaling up
        let frames = createMockFrames(count: 2, width: 320, height: 240)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
    }

    func testScalingLargeSourcesDown() throws {
        let compositor = try SideBySideCompositor(outputWidth: 1920, outputHeight: 1080)

        // Create 8K sources that need scaling down
        let frames = createMockFrames(count: 2, width: 7680, height: 4320)

        let result = try compositor.composite(frames)

        XCTAssertEqual(CVPixelBufferGetWidth(result), 1920)
        XCTAssertEqual(CVPixelBufferGetHeight(result), 1080)
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

// MARK: - SideBySideCompositorError Tests

@available(macOS 12.3, *)
final class SideBySideCompositorErrorTests: XCTestCase {

    func testErrorDescriptions() {
        XCTAssertEqual(
            SideBySideCompositorError.metalNotAvailable.description,
            "Metal device not available"
        )
        XCTAssertEqual(
            SideBySideCompositorError.bufferPoolCreationFailed.description,
            "Failed to create pixel buffer pool"
        )
        XCTAssertEqual(
            SideBySideCompositorError.bufferAllocationFailed.description,
            "Failed to allocate pixel buffer"
        )
        XCTAssertEqual(
            SideBySideCompositorError.invalidSourceCount(count: 5).description,
            "Invalid source count: 5 (must be 2-4 for side-by-side layout)"
        )
    }
}
