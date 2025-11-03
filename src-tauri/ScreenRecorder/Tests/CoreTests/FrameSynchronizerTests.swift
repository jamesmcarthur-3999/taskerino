import XCTest
import CoreMedia
import CoreVideo
@testable import ScreenRecorder

@available(macOS 12.3, *)
class FrameSynchronizerTests: XCTestCase {

    // MARK: - Basic Alignment Tests

    func testAlignmentWithinTolerance() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Create mock frames from two sources within tolerance
        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame2 = createMockFrame(sourceId: "source2", timestampMs: 10) // Within 16ms

        await sync.addFrame(frame1)
        await sync.addFrame(frame2)

        let aligned = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned, "Should align frames within tolerance")
        XCTAssertEqual(aligned?.count, 2, "Should return frames from both sources")

        // Verify correct frames were returned
        XCTAssertNotNil(aligned?["source1"])
        XCTAssertNotNil(aligned?["source2"])
    }

    func testNoAlignmentOutsideTolerance() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame2 = createMockFrame(sourceId: "source2", timestampMs: 50) // Outside 16ms tolerance

        await sync.addFrame(frame1)
        await sync.addFrame(frame2)

        let aligned = await sync.getAlignedFrames()
        XCTAssertNil(aligned, "Should not align frames outside tolerance")
    }

    func testWaitsForAllSources() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"])

        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        await sync.addFrame(frame1)

        // Only one source has data - should not align yet
        let aligned = await sync.getAlignedFrames()
        XCTAssertNil(aligned, "Should wait for all sources before aligning")
    }

    // MARK: - Multiple Frame Tests

    func testMultipleFramesSelectsClosest() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Source 1 has frames at 0ms and 20ms
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 0, sequenceNumber: 1))
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 20, sequenceNumber: 2))

        // Source 2 has frame at 5ms (closer to 0ms than 20ms)
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 5, sequenceNumber: 1))

        let aligned = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned)
        XCTAssertEqual(aligned?.count, 2)

        // Should select 0ms frame from source1 (closest to 5ms within tolerance)
        let source1Frame = aligned?["source1"]
        XCTAssertEqual(source1Frame?.sequenceNumber, 1)
    }

    func testConsumedFramesAreRemoved() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Add two frames from each source
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 0, sequenceNumber: 1))
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 50, sequenceNumber: 2))
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 5, sequenceNumber: 1))
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 55, sequenceNumber: 2))

        // First alignment should get frames at 0ms and 5ms
        let aligned1 = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned1)

        // After consuming, should still have buffered frames
        let stats = await sync.getStats()
        XCTAssertEqual(stats.currentBufferSizes.values.reduce(0, +), 2, "Should have 2 frames left (50ms and 55ms)")

        // Second alignment should get frames at 50ms and 55ms
        let aligned2 = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned2)

        // Now buffers should be empty
        let finalStats = await sync.getStats()
        XCTAssertEqual(finalStats.currentBufferSizes.values.reduce(0, +), 0, "All frames should be consumed")
    }

    // MARK: - Three Source Tests

    func testThreeSourceAlignment() async {
        let sync = FrameSynchronizer(sourceIds: ["display", "webcam", "window"], toleranceMs: 16)

        // Three sources with frames within tolerance
        await sync.addFrame(createMockFrame(sourceId: "display", timestampMs: 0))
        await sync.addFrame(createMockFrame(sourceId: "webcam", timestampMs: 8))
        await sync.addFrame(createMockFrame(sourceId: "window", timestampMs: 12))

        let aligned = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned, "Should align three sources within tolerance")
        XCTAssertEqual(aligned?.count, 3, "Should return frames from all three sources")

        // Verify all sources present
        XCTAssertNotNil(aligned?["display"])
        XCTAssertNotNil(aligned?["webcam"])
        XCTAssertNotNil(aligned?["window"])
    }

    func testThreeSourcesWaitForAll() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2", "source3"], toleranceMs: 16)

        // Only two of three sources have frames
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 0))
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 5))

        let aligned = await sync.getAlignedFrames()
        XCTAssertNil(aligned, "Should wait for all three sources")

        // Add third source
        await sync.addFrame(createMockFrame(sourceId: "source3", timestampMs: 10))

        let aligned2 = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned2, "Should align after all sources have frames")
        XCTAssertEqual(aligned2?.count, 3)
    }

    // MARK: - Frame Dropping Tests

    func testDropsOldFrames() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Source 1 has old frame at 0ms
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 0, sequenceNumber: 1))

        // Source 2 has much newer frame at 100ms (way outside tolerance)
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 100, sequenceNumber: 1))

        // Should not align and should drop old frame
        let aligned = await sync.getAlignedFrames()
        XCTAssertNil(aligned, "Should not align frames too far apart")

        let stats = await sync.getStats()
        XCTAssertEqual(stats.totalFramesDropped, 1, "Should drop the old frame")
        XCTAssertEqual(stats.currentBufferSizes.values.reduce(0, +), 1, "Should only have the newer frame buffered")
    }

    // MARK: - Statistics Tests

    func testStatsTracking() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        var stats = await sync.getStats()
        XCTAssertEqual(stats.totalFramesDropped, 0)
        XCTAssertEqual(stats.totalFramesSynchronized, 0)
        XCTAssertEqual(stats.totalFramesReceived, 0)
        XCTAssertEqual(stats.currentBufferSizes.values.reduce(0, +), 0)

        // Add and align frames
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 0))
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 5))

        stats = await sync.getStats()
        XCTAssertEqual(stats.totalFramesReceived, 2, "Should have received 2 frames")
        XCTAssertEqual(stats.currentBufferSizes.values.reduce(0, +), 2, "Should have 2 buffered frames")

        _ = await sync.getAlignedFrames()

        stats = await sync.getStats()
        XCTAssertEqual(stats.totalFramesSynchronized, 1, "Should have synchronized 1 frame set")
        XCTAssertEqual(stats.currentBufferSizes.values.reduce(0, +), 0, "Buffers should be empty after alignment")
    }

    func testClear() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Add frames and align
        await sync.addFrame(createMockFrame(sourceId: "source1", timestampMs: 0))
        await sync.addFrame(createMockFrame(sourceId: "source2", timestampMs: 5))
        _ = await sync.getAlignedFrames()

        // Clear
        await sync.clear()

        let stats = await sync.getStats()
        // Note: clear() only clears buffers, not statistics
        XCTAssertEqual(stats.currentBufferSizes.values.reduce(0, +), 0, "Buffers should be cleared")
    }

    // MARK: - Tolerance Configuration Tests

    func testCustomTolerance() async {
        // Very strict tolerance (5ms)
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 5)

        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame2 = createMockFrame(sourceId: "source2", timestampMs: 4) // Within 5ms

        await sync.addFrame(frame1)
        await sync.addFrame(frame2)

        let aligned = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned, "Should align with 4ms difference when tolerance is 5ms")

        // Now try with 6ms difference (outside tolerance)
        await sync.clear()

        let frame3 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame4 = createMockFrame(sourceId: "source2", timestampMs: 6) // Outside 5ms

        await sync.addFrame(frame3)
        await sync.addFrame(frame4)

        let aligned2 = await sync.getAlignedFrames()
        XCTAssertNil(aligned2, "Should not align with 6ms difference when tolerance is 5ms")
    }

    func testSetTolerance() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Change tolerance to 5ms
        await sync.setTolerance(5)

        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame2 = createMockFrame(sourceId: "source2", timestampMs: 6)

        await sync.addFrame(frame1)
        await sync.addFrame(frame2)

        let aligned = await sync.getAlignedFrames()
        XCTAssertNil(aligned, "Should respect updated tolerance of 5ms")
    }

    // MARK: - Source Filtering Tests

    func testIgnoresUnknownSources() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        // Add frame from unknown source
        await sync.addFrame(createMockFrame(sourceId: "unknown-source", timestampMs: 0))

        let stats = await sync.getStats()
        XCTAssertEqual(stats.totalFramesReceived, 0, "Should ignore frames from unknown sources")
    }

    // MARK: - Edge Case Tests

    func testExactToleranceBoundary() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame2 = createMockFrame(sourceId: "source2", timestampMs: 15) // Just under 16ms

        await sync.addFrame(frame1)
        await sync.addFrame(frame2)

        let aligned = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned, "Should align frames just under tolerance boundary")
    }

    func testZeroTimestamp() async {
        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        let frame1 = createMockFrame(sourceId: "source1", timestampMs: 0)
        let frame2 = createMockFrame(sourceId: "source2", timestampMs: 0)

        await sync.addFrame(frame1)
        await sync.addFrame(frame2)

        let aligned = await sync.getAlignedFrames()
        XCTAssertNotNil(aligned, "Should align frames with zero timestamps")
    }

    // MARK: - Helper Methods

    /// Create a mock SourcedFrame for testing
    private func createMockFrame(
        sourceId: String,
        timestampMs: Int64,
        sequenceNumber: Int? = nil
    ) -> SourcedFrame {
        let pixelBuffer = createMockPixelBuffer()
        let timestamp = CMTime(value: timestampMs, timescale: 1000)

        return SourcedFrame(
            buffer: pixelBuffer,
            sourceId: sourceId,
            timestamp: timestamp,
            sequenceNumber: sequenceNumber ?? Int(timestampMs)
        )
    }

    /// Create a mock CVPixelBuffer for testing
    private func createMockPixelBuffer() -> CVPixelBuffer {
        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            100,
            100,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        )

        XCTAssertEqual(status, kCVReturnSuccess, "Failed to create pixel buffer")
        XCTAssertNotNil(pixelBuffer, "Pixel buffer should not be nil")

        return pixelBuffer!
    }
}
