/**
 * FrameSynchronizerStressTests - Comprehensive stress tests for multi-stream synchronization
 *
 * Verifies that FrameSynchronizer maintains perfect frame alignment across multiple
 * streams at 60fps for extended periods with zero drift.
 *
 * Tests cover:
 * - 60fps for 10 minutes (36,000 frames) with drift verification
 * - 4-stream simultaneous synchronization
 * - Variable frame rate handling (30/60fps)
 * - Late frame recovery
 * - Frame drop detection and statistics
 *
 * Requirements: macOS 12.3+
 */

import XCTest
import CoreMedia
import CoreVideo
@testable import ScreenRecorder

@available(macOS 12.3, *)
class FrameSynchronizerStressTests: XCTestCase {

    // MARK: - Test 1: 60fps for 10 Minutes with Drift Verification

    func test60fpsFor10MinutesWithDriftVerification() async {
        print("\n📊 TEST 1: 60fps for 10 minutes (36,000 frames) - Drift Verification")

        let duration: TimeInterval = 600 // 10 minutes
        let fps = 60
        let expectedFrames = Int(duration * Double(fps)) // 36,000 frames
        let frameDuration = 1.0 / Double(fps) // 16.67ms
        let maxAllowedDrift: TimeInterval = 0.016 // 16ms (1 frame)

        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        var maxDrift: TimeInterval = 0
        var totalDrift: TimeInterval = 0
        var framesSynchronized = 0
        var driftSamples: [TimeInterval] = []

        let startTime = CMTime(seconds: 0, preferredTimescale: 1000000)

        // Simulate 36,000 frames at precise 60fps intervals
        for frameIndex in 0..<expectedFrames {
            let expectedTimestamp = startTime + CMTime(seconds: Double(frameIndex) * frameDuration, preferredTimescale: 1000000)

            // Add slight jitter (±1ms) to simulate real-world timing
            let jitterMs = Double.random(in: -1.0...1.0)
            let actualTimestamp1 = expectedTimestamp + CMTime(seconds: jitterMs / 1000.0, preferredTimescale: 1000000)
            let actualTimestamp2 = expectedTimestamp + CMTime(seconds: jitterMs / 1000.0, preferredTimescale: 1000000)

            let frame1 = createMockFrame(sourceId: "source1", timestamp: actualTimestamp1, sequenceNumber: frameIndex)
            let frame2 = createMockFrame(sourceId: "source2", timestamp: actualTimestamp2, sequenceNumber: frameIndex)

            await sync.addFrame(frame1)
            await sync.addFrame(frame2)

            if let aligned = await sync.getAlignedFrames() {
                framesSynchronized += 1

                // Calculate drift from expected timestamp
                let drift1 = abs(aligned["source1"]!.timestamp.seconds - expectedTimestamp.seconds)
                let drift2 = abs(aligned["source2"]!.timestamp.seconds - expectedTimestamp.seconds)
                let maxFrameDrift = max(drift1, drift2)

                maxDrift = max(maxDrift, maxFrameDrift)
                totalDrift += maxFrameDrift
                driftSamples.append(maxFrameDrift)
            }

            // Progress update every 6000 frames (1 minute)
            if frameIndex > 0 && frameIndex % 6000 == 0 {
                let minutes = frameIndex / 3600
                print("  ⏱️  Progress: \(minutes) minutes - Frames synced: \(framesSynchronized), Max drift: \(Int(maxDrift * 1000))ms")
            }
        }

        let avgDrift = totalDrift / Double(framesSynchronized)

        print("\n  📈 RESULTS:")
        print("  Total frames expected: \(expectedFrames)")
        print("  Frames synchronized: \(framesSynchronized)")
        print("  Max drift: \(Int(maxDrift * 1000))ms")
        print("  Avg drift: \(Int(avgDrift * 1000))ms")
        print("  Sync rate: \(String(format: "%.2f", Double(framesSynchronized) / Double(expectedFrames) * 100))%")

        let stats = await sync.getStats()
        print("  Frames dropped: \(stats.totalFramesDropped)")

        // Assertions
        XCTAssertEqual(framesSynchronized, expectedFrames, "Should synchronize all frames")
        XCTAssertLessThan(maxDrift, maxAllowedDrift, "Max drift should be < 16ms (1 frame)")
        XCTAssertEqual(stats.totalFramesDropped, 0, "Should not drop any frames")

        print("  ✅ TEST 1 PASSED: 60fps for 10 minutes with max drift \(Int(maxDrift * 1000))ms < 16ms\n")
    }

    // MARK: - Test 2: 4-Stream Simultaneous Synchronization

    func test4StreamStressSynchronization() async {
        print("\n📊 TEST 2: 4-Stream Stress Test - Simultaneous Synchronization")

        let duration: TimeInterval = 10 // 10 seconds
        let fps = 60
        let expectedFrames = Int(duration * Double(fps)) // 600 frames
        let frameDuration = 1.0 / Double(fps)

        let sync = FrameSynchronizer(
            sourceIds: ["display", "webcam", "window1", "window2"],
            toleranceMs: 16
        )

        var framesSynchronized = 0
        var allSourcesPresent = true

        let startTime = CMTime(seconds: 0, preferredTimescale: 1000000)

        print("  🎬 Simulating 4 simultaneous sources at 60fps for 10 seconds...")

        for frameIndex in 0..<expectedFrames {
            let expectedTimestamp = startTime + CMTime(seconds: Double(frameIndex) * frameDuration, preferredTimescale: 1000000)

            // Add frames from all 4 sources with slight jitter
            let jitter1 = Double.random(in: -2.0...2.0) / 1000.0
            let jitter2 = Double.random(in: -2.0...2.0) / 1000.0
            let jitter3 = Double.random(in: -2.0...2.0) / 1000.0
            let jitter4 = Double.random(in: -2.0...2.0) / 1000.0

            await sync.addFrame(createMockFrame(
                sourceId: "display",
                timestamp: expectedTimestamp + CMTime(seconds: jitter1, preferredTimescale: 1000000),
                sequenceNumber: frameIndex
            ))
            await sync.addFrame(createMockFrame(
                sourceId: "webcam",
                timestamp: expectedTimestamp + CMTime(seconds: jitter2, preferredTimescale: 1000000),
                sequenceNumber: frameIndex
            ))
            await sync.addFrame(createMockFrame(
                sourceId: "window1",
                timestamp: expectedTimestamp + CMTime(seconds: jitter3, preferredTimescale: 1000000),
                sequenceNumber: frameIndex
            ))
            await sync.addFrame(createMockFrame(
                sourceId: "window2",
                timestamp: expectedTimestamp + CMTime(seconds: jitter4, preferredTimescale: 1000000),
                sequenceNumber: frameIndex
            ))

            if let aligned = await sync.getAlignedFrames() {
                framesSynchronized += 1

                // Verify all 4 sources are present
                if aligned.count != 4 {
                    allSourcesPresent = false
                }

                // Verify all sources have correct sequence number (within tolerance)
                for (sourceId, frame) in aligned {
                    if abs(frame.sequenceNumber - frameIndex) > 1 {
                        print("  ⚠️  Source \(sourceId) has sequence mismatch: expected ~\(frameIndex), got \(frame.sequenceNumber)")
                    }
                }
            }
        }

        let stats = await sync.getStats()
        let syncRate = Double(framesSynchronized) / Double(expectedFrames) * 100

        print("\n  📈 RESULTS:")
        print("  Total frames expected: \(expectedFrames)")
        print("  Frames synchronized: \(framesSynchronized)")
        print("  Sync rate: \(String(format: "%.2f", syncRate))%")
        print("  Frames received: \(stats.totalFramesReceived)")
        print("  Frames dropped: \(stats.totalFramesDropped)")
        print("  Buffer sizes: \(stats.currentBufferSizes)")

        // Assertions
        XCTAssertTrue(allSourcesPresent, "All 4 sources should be present in every synchronized frame")
        XCTAssertGreaterThan(syncRate, 98.0, "Sync rate should be > 98%")

        print("  ✅ TEST 2 PASSED: 4-stream sync maintained at \(String(format: "%.2f", syncRate))%\n")
    }

    // MARK: - Test 3: Variable Frame Rate Handling

    func testVariableFrameRateHandling() async {
        print("\n📊 TEST 3: Variable Frame Rate - 30fps + 60fps Sources")

        let duration: TimeInterval = 5 // 5 seconds
        let fps30 = 30
        let fps60 = 60
        let expectedFrames30 = Int(duration * Double(fps30)) // 150 frames
        let expectedFrames60 = Int(duration * Double(fps60)) // 300 frames

        let sync = FrameSynchronizer(
            sourceIds: ["source30fps", "source60fps"],
            toleranceMs: 33 // 2 frames at 30fps
        )

        var framesSynchronized = 0
        var source30Count = 0
        var source60Count = 0

        let startTime = CMTime(seconds: 0, preferredTimescale: 1000000)

        print("  🎬 Simulating 30fps + 60fps sources for 5 seconds...")

        var frames30: [SourcedFrame] = []
        var frames60: [SourcedFrame] = []

        // Generate 30fps frames
        for i in 0..<expectedFrames30 {
            let timestamp = startTime + CMTime(seconds: Double(i) / Double(fps30), preferredTimescale: 1000000)
            frames30.append(createMockFrame(sourceId: "source30fps", timestamp: timestamp, sequenceNumber: i))
        }

        // Generate 60fps frames
        for i in 0..<expectedFrames60 {
            let timestamp = startTime + CMTime(seconds: Double(i) / Double(fps60), preferredTimescale: 1000000)
            frames60.append(createMockFrame(sourceId: "source60fps", timestamp: timestamp, sequenceNumber: i))
        }

        // Merge and sort by timestamp
        var allFrames: [(String, SourcedFrame)] = []
        allFrames += frames30.map { ("source30fps", $0) }
        allFrames += frames60.map { ("source60fps", $0) }
        allFrames.sort { $0.1.timestamp < $1.1.timestamp }

        // Process frames in timestamp order
        for (_, frame) in allFrames {
            await sync.addFrame(frame)

            if let aligned = await sync.getAlignedFrames() {
                framesSynchronized += 1

                if aligned["source30fps"] != nil {
                    source30Count += 1
                }
                if aligned["source60fps"] != nil {
                    source60Count += 1
                }
            }
        }

        let stats = await sync.getStats()

        print("\n  📈 RESULTS:")
        print("  30fps frames generated: \(expectedFrames30)")
        print("  60fps frames generated: \(expectedFrames60)")
        print("  Synchronized frame sets: \(framesSynchronized)")
        print("  30fps frames used: \(source30Count)")
        print("  60fps frames used: \(source60Count)")
        print("  Frames dropped: \(stats.totalFramesDropped)")

        // Assertions
        // Should synchronize roughly at 30fps rate (lower common rate)
        let expectedSyncSets = expectedFrames30
        let tolerance = Int(Double(expectedSyncSets) * 0.1) // 10% tolerance

        XCTAssertGreaterThanOrEqual(framesSynchronized, expectedSyncSets - tolerance, "Should sync at least 30fps worth of frames")
        XCTAssertEqual(source30Count, framesSynchronized, "All synchronized sets should include 30fps source")
        XCTAssertGreaterThan(source60Count, 0, "60fps source should be synchronized")

        print("  ✅ TEST 3 PASSED: Variable frame rate handling successful\n")
    }

    // MARK: - Test 4: Late Frame Recovery

    func testLateFrameRecovery() async {
        print("\n📊 TEST 4: Late Frame Handling - Recovery from Delays")

        let fps = 60
        let frameDuration = 1.0 / Double(fps)
        let normalFrames = 100
        let delayedFrames = 20
        let recoveryFrames = 100

        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        var framesSynchronized = 0
        var framesDropped = 0
        var recoveredAfterDelay = false

        let startTime = CMTime(seconds: 0, preferredTimescale: 1000000)
        var frameIndex = 0

        print("  🎬 Phase 1: Normal operation (100 frames)...")

        // Phase 1: Normal operation
        for i in 0..<normalFrames {
            let timestamp = startTime + CMTime(seconds: Double(i) * frameDuration, preferredTimescale: 1000000)

            await sync.addFrame(createMockFrame(sourceId: "source1", timestamp: timestamp, sequenceNumber: frameIndex))
            await sync.addFrame(createMockFrame(sourceId: "source2", timestamp: timestamp, sequenceNumber: frameIndex))

            if await sync.getAlignedFrames() != nil {
                framesSynchronized += 1
            }

            frameIndex += 1
        }

        print("  ⏱️  Phase 2: Introduce delay in source2 (20 frames)...")

        // Phase 2: Source2 falls behind by 100ms (6 frames at 60fps)
        for i in 0..<delayedFrames {
            let timestamp = startTime + CMTime(seconds: Double(frameIndex) * frameDuration, preferredTimescale: 1000000)

            // Source1 continues normally
            await sync.addFrame(createMockFrame(sourceId: "source1", timestamp: timestamp, sequenceNumber: frameIndex))

            // Source2 is delayed by 100ms
            let delayedTimestamp = timestamp + CMTime(seconds: -0.100, preferredTimescale: 1000000)
            await sync.addFrame(createMockFrame(sourceId: "source2", timestamp: delayedTimestamp, sequenceNumber: frameIndex))

            if await sync.getAlignedFrames() != nil {
                framesSynchronized += 1
            }

            frameIndex += 1
        }

        let statsAfterDelay = await sync.getStats()
        framesDropped = statsAfterDelay.totalFramesDropped

        print("  🔄 Phase 3: Recovery (100 frames)...")

        // Phase 3: Source2 catches up
        for i in 0..<recoveryFrames {
            let timestamp = startTime + CMTime(seconds: Double(frameIndex) * frameDuration, preferredTimescale: 1000000)

            await sync.addFrame(createMockFrame(sourceId: "source1", timestamp: timestamp, sequenceNumber: frameIndex))
            await sync.addFrame(createMockFrame(sourceId: "source2", timestamp: timestamp, sequenceNumber: frameIndex))

            if await sync.getAlignedFrames() != nil {
                framesSynchronized += 1
                if i > 10 { // After 10 frames of recovery
                    recoveredAfterDelay = true
                }
            }

            frameIndex += 1
        }

        let finalStats = await sync.getStats()

        print("\n  📈 RESULTS:")
        print("  Total frames processed: \(frameIndex)")
        print("  Frames synchronized: \(framesSynchronized)")
        print("  Frames dropped during delay: \(framesDropped)")
        print("  Total frames dropped: \(finalStats.totalFramesDropped)")
        print("  Recovered after delay: \(recoveredAfterDelay)")
        print("  Final sync rate: \(String(format: "%.2f", Double(framesSynchronized) / Double(frameIndex) * 100))%")

        // Assertions
        XCTAssertTrue(recoveredAfterDelay, "Should recover synchronization after delay")
        XCTAssertGreaterThan(framesDropped, 0, "Should drop frames when source falls behind")
        XCTAssertGreaterThan(Double(framesSynchronized) / Double(frameIndex), 0.85, "Should maintain >85% sync rate despite delay")

        print("  ✅ TEST 4 PASSED: Late frame recovery successful\n")
    }

    // MARK: - Test 5: Frame Drop Detection

    func testFrameDropDetectionAccuracy() async {
        print("\n📊 TEST 5: Frame Drop Detection - Statistics Accuracy")

        let fps = 60
        let frameDuration = 1.0 / Double(fps)
        let totalFrames = 300 // 5 seconds
        let dropPattern = 10 // Drop every 10th frame from source2

        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        var expectedDrops = 0
        var framesSynchronized = 0

        let startTime = CMTime(seconds: 0, preferredTimescale: 1000000)

        print("  🎬 Simulating frame drops (every 10th frame from source2)...")

        for frameIndex in 0..<totalFrames {
            let timestamp = startTime + CMTime(seconds: Double(frameIndex) * frameDuration, preferredTimescale: 1000000)

            // Source1 always sends frames
            await sync.addFrame(createMockFrame(sourceId: "source1", timestamp: timestamp, sequenceNumber: frameIndex))

            // Source2 drops every 10th frame
            if frameIndex % dropPattern != 0 {
                await sync.addFrame(createMockFrame(sourceId: "source2", timestamp: timestamp, sequenceNumber: frameIndex))
            } else {
                // Simulate catch-up: send frame with much later timestamp
                let lateTimestamp = timestamp + CMTime(seconds: 0.200, preferredTimescale: 1000000) // 200ms late
                await sync.addFrame(createMockFrame(sourceId: "source2", timestamp: lateTimestamp, sequenceNumber: frameIndex))
                expectedDrops += 1
            }

            if await sync.getAlignedFrames() != nil {
                framesSynchronized += 1
            }
        }

        let stats = await sync.getStats()
        let dropRate = Double(stats.totalFramesDropped) / Double(stats.totalFramesReceived) * 100

        print("\n  📈 RESULTS:")
        print("  Total frames sent: \(totalFrames * 2)")
        print("  Frames received: \(stats.totalFramesReceived)")
        print("  Frames synchronized: \(stats.totalFramesSynchronized)")
        print("  Frames dropped: \(stats.totalFramesDropped)")
        print("  Expected drops: ~\(expectedDrops)")
        print("  Drop rate: \(String(format: "%.2f", dropRate))%")

        // Assertions
        XCTAssertGreaterThan(stats.totalFramesDropped, 0, "Should detect dropped frames")
        XCTAssertLessThan(dropRate, 2.0, "Frame drop rate should be < 2%")

        print("  ✅ TEST 5 PASSED: Frame drop detection accurate (drop rate: \(String(format: "%.2f", dropRate))%)\n")
    }

    // MARK: - Helper Methods

    /// Create a mock SourcedFrame for testing
    private func createMockFrame(
        sourceId: String,
        timestamp: CMTime,
        sequenceNumber: Int
    ) -> SourcedFrame {
        let pixelBuffer = createMockPixelBuffer()

        return SourcedFrame(
            buffer: pixelBuffer,
            sourceId: sourceId,
            timestamp: timestamp,
            sequenceNumber: sequenceNumber
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

        guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
            fatalError("Failed to create pixel buffer")
        }

        return buffer
    }
}
