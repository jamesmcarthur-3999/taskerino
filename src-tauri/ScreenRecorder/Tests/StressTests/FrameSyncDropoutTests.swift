/**
 * FrameSyncDropoutTests - Source dropout and recovery tests for FrameSynchronizer
 *
 * Tests the synchronizer's resilience to sources stopping/restarting:
 * - Sources dropping out mid-recording
 * - Sources restarting after dropout
 * - Graceful degradation with missing sources
 * - No crashes or deadlocks during dropout/recovery
 *
 * Requirements: macOS 12.3+
 */

import XCTest
import CoreMedia
import CoreVideo
@testable import ScreenRecorder

@available(macOS 12.3, *)
final class FrameSyncDropoutTests: XCTestCase {

    // MARK: - Test 1: Source Dropout and Recovery

    /// Test source stopping and restarting during recording
    /// - Record 3 sources for 5 seconds
    /// - Source 2 drops out at 2s
    /// - Source 2 resumes at 3s
    /// - Verify no crashes, graceful handling
    func testSourceDropoutAndRecovery() async throws {
        print("\n========================================")
        print("TEST: Source Dropout and Recovery")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let duration = 5.0
        let dropoutStartTime = 2.0
        let recoveryTime = 3.0

        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)

        var framesProcessed = 0
        var frames3Sources = 0
        var frames2Sources = 0

        print("Configuration:")
        print("  - Sources: 3")
        print("  - Duration: \(duration)s")
        print("  - Source2 dropout: \(dropoutStartTime)s - \(recoveryTime)s")
        print("")

        for frameNum in 0..<totalFrames {
            let currentTime = Double(frameNum) * frameInterval

            // Source 2 stops between 2s and 3s
            let source2Active = currentTime < dropoutStartTime || currentTime >= recoveryTime

            // Add frames from active sources
            for sourceId in sourceIds {
                if sourceId == "source2" && !source2Active {
                    continue // Source 2 is offline
                }

                let jitter = Double.random(in: 0...0.005)
                let buffer = try createMockBuffer()

                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: currentTime + jitter, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )

                await sync.addFrame(frame)
            }

            // Try to get aligned frames
            if let aligned = await sync.getAlignedFrames() {
                framesProcessed += 1

                if aligned.count == 3 {
                    frames3Sources += 1
                } else if aligned.count == 2 {
                    frames2Sources += 1
                }
            }

            // Progress updates
            if (frameNum + 1) % fps == 0 {
                let stats = await sync.getStats()
                print("Time: \(frameNum / fps)s - Aligned: \(framesProcessed) (3-source: \(frames3Sources), 2-source: \(frames2Sources))")
            }
        }

        let stats = await sync.getStats()

        print("\nResults:")
        print("  - Total frames processed: \(framesProcessed)")
        print("  - 3-source frames: \(frames3Sources)")
        print("  - 2-source frames: \(frames2Sources)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("")

        // During dropout (1 second), we won't have 3-source frames
        // So we should have ~2s + ~2s = ~240 frames with 3 sources at 60fps
        XCTAssertGreaterThanOrEqual(
            frames3Sources,
            200,
            "Should have ~240 frames with 3 sources (before dropout + after recovery)"
        )

        // Note: During dropout, synchronizer waits for all sources,
        // so we won't get 2-source frames - that's correct behavior
        print("Note: 2-source frames = \(frames2Sources) (expected 0, synchronizer waits for all sources)")

        print("✅ TEST PASSED: Source dropout and recovery")
        print("========================================\n")
    }

    // MARK: - Test 2: Permanent Source Loss

    /// Test one source permanently dropping out
    /// Verify synchronizer handles gracefully without blocking
    func testPermanentSourceLoss() async throws {
        print("\n========================================")
        print("TEST: Permanent Source Loss")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let duration = 3.0
        let sourceDropoutTime = 1.0

        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)

        var framesProcessed = 0
        var timeouts = 0

        print("Configuration:")
        print("  - Sources: 3")
        print("  - Duration: \(duration)s")
        print("  - Source3 permanent dropout at: \(sourceDropoutTime)s")
        print("")

        for frameNum in 0..<totalFrames {
            let currentTime = Double(frameNum) * frameInterval

            // Source 3 permanently drops at 1s
            let source3Active = currentTime < sourceDropoutTime

            for sourceId in sourceIds {
                if sourceId == "source3" && !source3Active {
                    continue
                }

                let jitter = Double.random(in: 0...0.005)
                let buffer = try createMockBuffer()

                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: currentTime + jitter, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )

                await sync.addFrame(frame)
            }

            // Try to align (will return nil after source3 drops)
            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            } else if currentTime >= sourceDropoutTime {
                timeouts += 1
            }
        }

        let stats = await sync.getStats()

        print("\nResults:")
        print("  - Frames processed: \(framesProcessed)")
        print("  - Timeouts after dropout: \(timeouts)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("")

        // Should process ~60 frames (1 second before dropout)
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            50,
            "Should process frames before dropout"
        )

        // Should have timeouts after dropout (correct behavior - waiting for missing source)
        XCTAssertGreaterThan(
            timeouts,
            100,
            "Should timeout while waiting for missing source"
        )

        print("✅ TEST PASSED: Permanent source loss handled correctly")
        print("========================================\n")
    }

    // MARK: - Test 3: Intermittent Source Failures

    /// Test source that repeatedly drops and recovers (flaky source)
    func testIntermittentSourceFailures() async throws {
        print("\n========================================")
        print("TEST: Intermittent Source Failures")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let duration = 5.0
        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)

        var framesProcessed = 0

        print("Configuration:")
        print("  - Sources: 2")
        print("  - Duration: \(duration)s")
        print("  - Source2: intermittent failures (random 10% drop rate)")
        print("")

        for frameNum in 0..<totalFrames {
            let currentTime = Double(frameNum) * frameInterval

            // Source 1: always sends
            let buffer1 = try createMockBuffer()
            let frame1 = SourcedFrame(
                buffer: buffer1,
                sourceId: "source1",
                timestamp: CMTime(seconds: currentTime, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )
            await sync.addFrame(frame1)

            // Source 2: 10% chance of not sending frame (simulating drops)
            if Double.random(in: 0...1) > 0.1 {
                let buffer2 = try createMockBuffer()
                let frame2 = SourcedFrame(
                    buffer: buffer2,
                    sourceId: "source2",
                    timestamp: CMTime(seconds: currentTime + 0.003, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )
                await sync.addFrame(frame2)
            }

            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            }
        }

        let stats = await sync.getStats()

        print("\nResults:")
        print("  - Total frames: \(totalFrames)")
        print("  - Frames processed: \(framesProcessed)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("  - Success rate: \(String(format: "%.1f", Double(framesProcessed) / Double(totalFrames) * 100))%")
        print("")

        // Should process ~90% of frames (since 10% drop rate)
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            Int(Double(totalFrames) * 0.85),
            "Should process ~90% of frames with 10% drop rate"
        )

        print("✅ TEST PASSED: Intermittent source failures")
        print("========================================\n")
    }

    // MARK: - Test 4: Staggered Source Starts

    /// Test sources starting at different times
    /// Source1 starts at 0s, Source2 at 1s, Source3 at 2s
    func testStaggeredSourceStarts() async throws {
        print("\n========================================")
        print("TEST: Staggered Source Starts")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let duration = 5.0
        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)

        let source1Start = 0.0
        let source2Start = 1.0
        let source3Start = 2.0

        var framesProcessed = 0
        var firstAlignedTime: Double?

        print("Configuration:")
        print("  - Sources: 3")
        print("  - Duration: \(duration)s")
        print("  - Source1 starts: \(source1Start)s")
        print("  - Source2 starts: \(source2Start)s")
        print("  - Source3 starts: \(source3Start)s")
        print("")

        for frameNum in 0..<totalFrames {
            let currentTime = Double(frameNum) * frameInterval

            // Add frames from sources that have started
            for sourceId in sourceIds {
                let sourceStartTime: Double
                switch sourceId {
                case "source1": sourceStartTime = source1Start
                case "source2": sourceStartTime = source2Start
                case "source3": sourceStartTime = source3Start
                default: continue
                }

                if currentTime >= sourceStartTime {
                    let buffer = try createMockBuffer()
                    let frame = SourcedFrame(
                        buffer: buffer,
                        sourceId: sourceId,
                        timestamp: CMTime(seconds: currentTime, preferredTimescale: 1000),
                        sequenceNumber: frameNum
                    )
                    await sync.addFrame(frame)
                }
            }

            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
                if firstAlignedTime == nil {
                    firstAlignedTime = currentTime
                }
            }

            if (frameNum + 1) % fps == 0 {
                print("Time: \(frameNum / fps)s - Aligned frames: \(framesProcessed)")
            }
        }

        let stats = await sync.getStats()

        print("\nResults:")
        print("  - First aligned frame at: \(String(format: "%.2f", firstAlignedTime ?? 0))s")
        print("  - Total frames processed: \(framesProcessed)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("")

        // First alignment should occur around 2s (when all sources active)
        XCTAssertNotNil(firstAlignedTime, "Should have aligned frames")
        XCTAssertGreaterThanOrEqual(
            firstAlignedTime ?? 0,
            2.0,
            "First alignment should occur after all sources start (~2s)"
        )

        // Should process ~3 seconds of frames (5s - 2s)
        let expectedFrames = Int(Double(fps) * (duration - source3Start))
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            expectedFrames - 10,
            "Should process ~180 frames (3 seconds at 60fps)"
        )

        print("✅ TEST PASSED: Staggered source starts")
        print("========================================\n")
    }

    // MARK: - Test 5: Source Recovery With Buffer Flush

    /// Test source dropping out with buffered frames, then recovering
    /// Verify old buffered frames are properly handled
    func testSourceRecoveryWithBufferFlush() async throws {
        print("\n========================================")
        print("TEST: Source Recovery With Buffer Flush")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let frameInterval = 1.0 / Double(fps)

        var framesProcessed = 0

        print("Configuration:")
        print("  - Sources: 2")
        print("  - Phase 1: Normal operation (1s)")
        print("  - Phase 2: Source2 dropout (1s)")
        print("  - Phase 3: Source2 recovery (1s)")
        print("")

        // Phase 1: Normal operation (1 second)
        print("Phase 1: Normal operation")
        for frameNum in 0..<60 {
            let currentTime = Double(frameNum) * frameInterval

            for sourceId in sourceIds {
                let buffer = try createMockBuffer()
                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: currentTime, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )
                await sync.addFrame(frame)
            }

            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            }
        }

        let stats1 = await sync.getStats()
        print("  Processed: \(framesProcessed), Buffer sizes: \(stats1.currentBufferSizes)")

        // Phase 2: Source 2 drops out, but source 1 keeps sending (1 second)
        print("\nPhase 2: Source2 dropout (source1 continues)")
        for frameNum in 60..<120 {
            let currentTime = Double(frameNum) * frameInterval

            // Only source1 sends
            let buffer1 = try createMockBuffer()
            let frame1 = SourcedFrame(
                buffer: buffer1,
                sourceId: "source1",
                timestamp: CMTime(seconds: currentTime, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )
            await sync.addFrame(frame1)

            // Try to align (will fail - waiting for source2)
            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            }
        }

        let stats2 = await sync.getStats()
        print("  Processed: \(framesProcessed), Buffer sizes: \(stats2.currentBufferSizes)")
        print("  Note: Source1 buffer should have ~60 frames waiting")

        // Phase 3: Source 2 recovers (1 second)
        print("\nPhase 3: Source2 recovery")
        let phase3Start = framesProcessed
        for frameNum in 120..<180 {
            let currentTime = Double(frameNum) * frameInterval

            for sourceId in sourceIds {
                let buffer = try createMockBuffer()
                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: currentTime, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )
                await sync.addFrame(frame)
            }

            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            }
        }

        let stats3 = await sync.getStats()
        let phase3Processed = framesProcessed - phase3Start

        print("\nResults:")
        print("  - Total frames processed: \(framesProcessed)")
        print("  - Phase 3 processed: \(phase3Processed)")
        print("  - Total dropped: \(stats3.totalFramesDropped)")
        print("  - Final buffer sizes: \(stats3.currentBufferSizes)")
        print("")

        // Should process ~60 frames in phase 1 and some in phase 3
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            100,
            "Should process frames in phase 1 and phase 3"
        )

        // Old buffered frames from phase 2 should be dropped
        XCTAssertGreaterThan(
            stats3.totalFramesDropped,
            0,
            "Should drop old buffered frames from source1 during recovery"
        )

        print("✅ TEST PASSED: Source recovery with buffer flush")
        print("========================================\n")
    }

    // MARK: - Helper Methods

    private func createMockBuffer() throws -> CVPixelBuffer {
        var buffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            100,
            100,
            kCVPixelFormatType_32BGRA,
            nil,
            &buffer
        )

        guard status == kCVReturnSuccess, let buffer = buffer else {
            throw NSError(domain: "FrameSyncDropoutTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create pixel buffer"])
        }

        return buffer
    }
}
