/**
 * FrameSync4SourceTests - Multi-source stress tests for FrameSynchronizer
 *
 * Tests the synchronizer with 4+ simultaneous sources to verify:
 * - All sources stay synchronized
 * - No deadlocks or thread starvation
 * - Performance remains acceptable with multiple sources
 * - Frame batches contain all sources
 *
 * Requirements: macOS 12.3+
 */

import XCTest
import CoreMedia
import CoreVideo
@testable import ScreenRecorder

@available(macOS 12.3, *)
final class FrameSync4SourceTests: XCTestCase {

    // MARK: - Test 1: 4-Source Simultaneous Recording

    /// Test 4 sources recording simultaneously at 60fps for 60 seconds
    /// Total: 14,400 frames (3,600 per source)
    /// Expected: All sources synchronized, <2ms per batch alignment
    func test4SourcesSimultaneous60fps() async throws {
        print("\n========================================")
        print("TEST: 4 Sources Simultaneous (60fps)")
        print("========================================\n")

        let sourceIds: Set<String> = ["display1", "display2", "window1", "webcam"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let duration = 60.0 // 1 minute
        let totalFrames = Int(Double(fps) * duration) // 3,600 frames per source
        let frameInterval = 1.0 / Double(fps)

        var framesProcessed = 0
        var batchAlignmentTimes: [TimeInterval] = []
        var framesWith4Sources = 0

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - FPS: \(fps)")
        print("  - Duration: \(duration)s")
        print("  - Total frames per source: \(totalFrames)")
        print("")

        let startTime = Date()

        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) * frameInterval

            // Create frames from all 4 sources with varying jitter
            for (index, sourceId) in sourceIds.enumerated() {
                let jitter = Double.random(in: 0...0.008)
                let buffer = try createMockBuffer()

                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: timestamp + jitter, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )

                await sync.addFrame(frame)
            }

            // Measure alignment time
            let alignStart = Date()
            if let aligned = await sync.getAlignedFrames() {
                let alignEnd = Date()
                let alignTime = alignEnd.timeIntervalSince(alignStart)
                batchAlignmentTimes.append(alignTime)

                framesProcessed += 1

                // Verify all 4 sources present
                if aligned.count == 4 {
                    framesWith4Sources += 1
                }
            }

            // Progress update every 15 seconds
            if (frameNum + 1) % (fps * 15) == 0 {
                let stats = await sync.getStats()
                print("Progress: \((frameNum + 1) / fps)s - Aligned: \(framesProcessed), 4-source frames: \(framesWith4Sources)")
            }
        }

        let endTime = Date()
        let executionTime = endTime.timeIntervalSince(startTime)
        let stats = await sync.getStats()

        // Calculate alignment performance
        let avgAlignmentTime = batchAlignmentTimes.reduce(0, +) / Double(batchAlignmentTimes.count)
        let maxAlignmentTime = batchAlignmentTimes.max() ?? 0

        print("\nResults:")
        print("  - Execution time: \(String(format: "%.2f", executionTime))s")
        print("  - Frames processed: \(framesProcessed)")
        print("  - 4-source frames: \(framesWith4Sources)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("  - Avg alignment time: \(String(format: "%.4f", avgAlignmentTime * 1000))ms")
        print("  - Max alignment time: \(String(format: "%.4f", maxAlignmentTime * 1000))ms")
        print("")

        // Assertions
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            totalFrames - 50,
            "Should process nearly all frames"
        )

        XCTAssertEqual(
            framesWith4Sources,
            framesProcessed,
            "All processed frames should contain all 4 sources"
        )

        XCTAssertLessThan(
            avgAlignmentTime * 1000,
            2.0,
            "Average alignment time should be <2ms (actual: \(String(format: "%.4f", avgAlignmentTime * 1000))ms)"
        )

        print("✅ TEST PASSED: 4-source simultaneous test")
        print("========================================\n")
    }

    // MARK: - Test 2: 6-Source High Stress

    /// Test 6 sources at 30fps for 30 seconds (extreme stress)
    /// Total: 5,400 frames (900 per source)
    func test6SourcesHighStress() async throws {
        print("\n========================================")
        print("TEST: 6 Sources High Stress (30fps)")
        print("========================================\n")

        let sourceIds: Set<String> = [
            "display1", "display2", "display3",
            "window1", "window2", "webcam"
        ]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 33)

        let fps = 30
        let duration = 30.0
        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)

        var framesProcessed = 0
        var framesWith6Sources = 0

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - FPS: \(fps)")
        print("  - Duration: \(duration)s")
        print("")

        let startTime = Date()

        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) * frameInterval

            // Add frames from all 6 sources
            for sourceId in sourceIds {
                let jitter = Double.random(in: 0...0.015)
                let buffer = try createMockBuffer()

                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: timestamp + jitter, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )

                await sync.addFrame(frame)
            }

            if let aligned = await sync.getAlignedFrames() {
                framesProcessed += 1
                if aligned.count == 6 {
                    framesWith6Sources += 1
                }
            }

            if (frameNum + 1) % (fps * 10) == 0 {
                print("Progress: \((frameNum + 1) / fps)s - Aligned: \(framesProcessed)")
            }
        }

        let endTime = Date()
        let executionTime = endTime.timeIntervalSince(startTime)
        let stats = await sync.getStats()

        print("\nResults:")
        print("  - Execution time: \(String(format: "%.2f", executionTime))s")
        print("  - Frames processed: \(framesProcessed)")
        print("  - 6-source frames: \(framesWith6Sources)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("")

        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            totalFrames - 30,
            "Should process nearly all frames with 6 sources"
        )

        XCTAssertEqual(
            framesWith6Sources,
            framesProcessed,
            "All processed frames should contain all 6 sources"
        )

        print("✅ TEST PASSED: 6-source high stress test")
        print("========================================\n")
    }

    // MARK: - Test 3: Uneven Source Frame Rates

    /// Test with sources producing frames at different rates
    /// display1: 60fps, display2: 30fps, webcam: 24fps
    func testUnevenSourceFrameRates() async throws {
        print("\n========================================")
        print("TEST: Uneven Source Frame Rates")
        print("========================================\n")

        let sourceIds: Set<String> = ["display1_60fps", "display2_30fps", "webcam_24fps"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 20)

        let duration = 10.0 // 10 seconds

        // Different frame rates per source
        let sourceConfigs: [(id: String, fps: Int)] = [
            ("display1_60fps", 60),
            ("display2_30fps", 30),
            ("webcam_24fps", 24)
        ]

        var framesProcessed = 0
        var framesWith3Sources = 0

        print("Configuration:")
        print("  - display1: 60fps")
        print("  - display2: 30fps")
        print("  - webcam: 24fps")
        print("  - Duration: \(duration)s")
        print("")

        let startTime = Date()

        // Generate frames at different rates
        var frameCounters: [String: Int] = [:]
        var nextFrameTime: [String: Double] = [:]

        for config in sourceConfigs {
            frameCounters[config.id] = 0
            nextFrameTime[config.id] = 0
        }

        // Simulate time progression at 1ms intervals
        let timeStep = 0.001
        var currentTime = 0.0

        while currentTime < duration {
            // Check each source if it should generate a frame
            for config in sourceConfigs {
                if currentTime >= nextFrameTime[config.id]! {
                    let frameNum = frameCounters[config.id]!
                    let buffer = try createMockBuffer()

                    let frame = SourcedFrame(
                        buffer: buffer,
                        sourceId: config.id,
                        timestamp: CMTime(seconds: currentTime, preferredTimescale: 1000),
                        sequenceNumber: frameNum
                    )

                    await sync.addFrame(frame)

                    frameCounters[config.id] = frameNum + 1
                    nextFrameTime[config.id]! += 1.0 / Double(config.fps)
                }
            }

            // Try to align frames
            if let aligned = await sync.getAlignedFrames() {
                framesProcessed += 1
                if aligned.count == 3 {
                    framesWith3Sources += 1
                }
            }

            currentTime += timeStep
        }

        let endTime = Date()
        let executionTime = endTime.timeIntervalSince(startTime)
        let stats = await sync.getStats()

        print("\nResults:")
        print("  - Execution time: \(String(format: "%.2f", executionTime))s")
        print("  - Frames generated per source:")
        for (sourceId, count) in frameCounters.sorted(by: { $0.key < $1.key }) {
            print("    - \(sourceId): \(count)")
        }
        print("  - Frames aligned: \(framesProcessed)")
        print("  - 3-source frames: \(framesWith3Sources)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("")

        // At minimum, should align at 24fps (slowest source) for 10 seconds = 240 frames
        XCTAssertGreaterThanOrEqual(
            framesWith3Sources,
            200,
            "Should align at least 200 frames (near slowest source rate)"
        )

        print("✅ TEST PASSED: Uneven source frame rates test")
        print("========================================\n")
    }

    // MARK: - Test 4: Buffer Management Under Load

    /// Test buffer management with many buffered frames
    /// Rapidly add frames then periodically read aligned frames
    func testBufferManagementUnderLoad() async throws {
        print("\n========================================")
        print("TEST: Buffer Management Under Load")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3", "source4"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let burstSize = 120 // 2 seconds of frames at 60fps
        let totalBursts = 10

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - Burst size: \(burstSize) frames")
        print("  - Total bursts: \(totalBursts)")
        print("")

        var totalFramesProcessed = 0

        for burstNum in 0..<totalBursts {
            // Add burst of frames
            for frameNum in 0..<burstSize {
                let timestamp = Double(burstNum * burstSize + frameNum) / Double(fps)

                for sourceId in sourceIds {
                    let jitter = Double.random(in: 0...0.005)
                    let buffer = try createMockBuffer()

                    let frame = SourcedFrame(
                        buffer: buffer,
                        sourceId: sourceId,
                        timestamp: CMTime(seconds: timestamp + jitter, preferredTimescale: 1000),
                        sequenceNumber: burstNum * burstSize + frameNum
                    )

                    await sync.addFrame(frame)
                }
            }

            // Check buffer sizes
            let statsBeforeRead = await sync.getStats()
            print("Burst \(burstNum + 1): Buffer sizes before read: \(statsBeforeRead.currentBufferSizes)")

            // Process all aligned frames
            var burstProcessed = 0
            while let _ = await sync.getAlignedFrames() {
                burstProcessed += 1
            }

            totalFramesProcessed += burstProcessed

            let statsAfterRead = await sync.getStats()
            print("Burst \(burstNum + 1): Processed \(burstProcessed) frames, buffers after: \(statsAfterRead.currentBufferSizes)")
        }

        let stats = await sync.getStats()
        let expectedFrames = burstSize * totalBursts

        print("\nResults:")
        print("  - Expected frames: \(expectedFrames)")
        print("  - Processed frames: \(totalFramesProcessed)")
        print("  - Dropped frames: \(stats.totalFramesDropped)")
        print("")

        XCTAssertGreaterThanOrEqual(
            totalFramesProcessed,
            expectedFrames - 50,
            "Should process most frames even with burst loading"
        )

        print("✅ TEST PASSED: Buffer management under load test")
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
            throw NSError(domain: "FrameSync4SourceTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create pixel buffer"])
        }

        return buffer
    }
}
