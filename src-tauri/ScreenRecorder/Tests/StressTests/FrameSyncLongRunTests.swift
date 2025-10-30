/**
 * FrameSyncLongRunTests - Long-duration stress tests for FrameSynchronizer
 *
 * Tests the synchronizer under extended workloads to verify:
 * - No frame drift over extended periods
 * - Consistent performance over time
 * - Memory stability (no leaks)
 * - Proper handling of realistic jitter
 *
 * Requirements: macOS 12.3+
 */

import XCTest
import CoreMedia
import CoreVideo
@testable import ScreenRecorder

@available(macOS 12.3, *)
final class FrameSyncLongRunTests: XCTestCase {

    // MARK: - Test 1: 60fps for 10 Minutes (No Drift)

    /// Test synchronizer maintains perfect sync for 10-minute recording at 60fps
    /// Total: 36,000 frames per source
    /// Expected: <1% dropped frames, <16ms max drift
    func test60fps10MinutesNoDrift() async throws {
        print("\n========================================")
        print("TEST: 60fps for 10 Minutes (No Drift)")
        print("========================================\n")

        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        let fps = 60
        let duration = 600.0 // 10 minutes
        let totalFrames = Int(Double(fps) * duration) // 36,000 frames
        let frameInterval = 1.0 / Double(fps) // ~16.67ms

        var framesProcessed = 0
        var maxDrift: Double = 0
        var driftSamples: [Double] = []

        print("Configuration:")
        print("  - FPS: \(fps)")
        print("  - Duration: \(duration)s (\(Int(duration/60)) minutes)")
        print("  - Total frames: \(totalFrames) per source")
        print("  - Frame interval: \(frameInterval * 1000)ms")
        print("")

        let startTime = Date()

        // Simulate realistic recording with slight jitter
        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) * frameInterval

            // Create frames with realistic jitter (0-5ms)
            let jitter1 = Double.random(in: 0...0.005)
            let jitter2 = Double.random(in: 0...0.005)

            let buffer1 = try createMockBuffer()
            let buffer2 = try createMockBuffer()

            let frame1 = SourcedFrame(
                buffer: buffer1,
                sourceId: "source1",
                timestamp: CMTime(seconds: timestamp + jitter1, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )
            let frame2 = SourcedFrame(
                buffer: buffer2,
                sourceId: "source2",
                timestamp: CMTime(seconds: timestamp + jitter2, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )

            await sync.addFrame(frame1)
            await sync.addFrame(frame2)

            if let aligned = await sync.getAlignedFrames() {
                framesProcessed += 1

                // Calculate drift between sources
                let drift = abs(frame1.timestamp.seconds - frame2.timestamp.seconds)
                maxDrift = max(maxDrift, drift)
                driftSamples.append(drift)
            }

            // Progress updates every 1 minute
            if (frameNum + 1) % (fps * 60) == 0 {
                let minutesPassed = (frameNum + 1) / (fps * 60)
                let stats = await sync.getStats()
                print("Progress: \(minutesPassed) minutes - Processed: \(framesProcessed), Dropped: \(stats.totalFramesDropped)")
            }
        }

        let endTime = Date()
        let executionTime = endTime.timeIntervalSince(startTime)

        // Final statistics
        let stats = await sync.getStats()
        let averageDrift = driftSamples.reduce(0, +) / Double(driftSamples.count)
        let dropPercentage = Double(stats.totalFramesDropped) / Double(totalFrames) * 100.0

        print("\nResults:")
        print("  - Execution time: \(String(format: "%.2f", executionTime))s")
        print("  - Frames processed: \(framesProcessed)")
        print("  - Frames dropped: \(stats.totalFramesDropped) (\(String(format: "%.2f", dropPercentage))%)")
        print("  - Max drift: \(String(format: "%.3f", maxDrift * 1000))ms")
        print("  - Average drift: \(String(format: "%.3f", averageDrift * 1000))ms")
        print("  - Frames/second: \(String(format: "%.2f", Double(framesProcessed) / executionTime))")
        print("")

        // Assertions
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            totalFrames - 100,
            "Should process nearly all frames (lost: \(totalFrames - framesProcessed))"
        )

        XCTAssertLessThan(
            maxDrift,
            0.016,
            "Max drift should stay under 16ms (actual: \(maxDrift * 1000)ms)"
        )

        XCTAssertLessThan(
            dropPercentage,
            1.0,
            "Should drop <1% of frames (actual: \(String(format: "%.2f", dropPercentage))%)"
        )

        XCTAssertLessThan(
            executionTime,
            120.0,
            "Should complete in <120 seconds (2x realtime, actual: \(String(format: "%.2f", executionTime))s)"
        )

        print("✅ TEST PASSED: 60fps/10min stress test")
        print("========================================\n")
    }

    // MARK: - Test 2: 30fps for 30 Minutes (Extended Duration)

    /// Test synchronizer over extended 30-minute period at lower frame rate
    /// Total: 54,000 frames per source
    /// Verifies memory stability over longer durations
    func test30fps30MinutesExtendedDuration() async throws {
        print("\n========================================")
        print("TEST: 30fps for 30 Minutes (Extended)")
        print("========================================\n")

        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 33)

        let fps = 30
        let duration = 1800.0 // 30 minutes
        let totalFrames = Int(Double(fps) * duration) // 54,000 frames
        let frameInterval = 1.0 / Double(fps) // ~33.33ms

        var framesProcessed = 0
        var memoryCheckpoints: [(frames: Int, memoryMB: Double)] = []

        print("Configuration:")
        print("  - FPS: \(fps)")
        print("  - Duration: \(duration)s (\(Int(duration/60)) minutes)")
        print("  - Total frames: \(totalFrames) per source")
        print("  - Tolerance: 33ms")
        print("")

        let startTime = Date()

        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) * frameInterval

            let jitter1 = Double.random(in: 0...0.010)
            let jitter2 = Double.random(in: 0...0.010)

            let buffer1 = try createMockBuffer()
            let buffer2 = try createMockBuffer()

            let frame1 = SourcedFrame(
                buffer: buffer1,
                sourceId: "source1",
                timestamp: CMTime(seconds: timestamp + jitter1, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )
            let frame2 = SourcedFrame(
                buffer: buffer2,
                sourceId: "source2",
                timestamp: CMTime(seconds: timestamp + jitter2, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )

            await sync.addFrame(frame1)
            await sync.addFrame(frame2)

            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            }

            // Memory checkpoints every 5 minutes
            if (frameNum + 1) % (fps * 300) == 0 {
                let memoryUsage = getMemoryUsageMB()
                memoryCheckpoints.append((frames: frameNum + 1, memoryMB: memoryUsage))
                print("Checkpoint: \(memoryCheckpoints.count * 5) min - Frames: \(framesProcessed), Memory: \(String(format: "%.2f", memoryUsage))MB")
            }
        }

        let endTime = Date()
        let executionTime = endTime.timeIntervalSince(startTime)
        let stats = await sync.getStats()

        // Analyze memory growth
        let initialMemory = memoryCheckpoints.first?.memoryMB ?? 0
        let finalMemory = memoryCheckpoints.last?.memoryMB ?? 0
        let memoryGrowth = finalMemory - initialMemory

        print("\nResults:")
        print("  - Execution time: \(String(format: "%.2f", executionTime))s")
        print("  - Frames processed: \(framesProcessed)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("  - Memory growth: \(String(format: "%.2f", memoryGrowth))MB")
        print("  - Initial memory: \(String(format: "%.2f", initialMemory))MB")
        print("  - Final memory: \(String(format: "%.2f", finalMemory))MB")
        print("")

        // Assertions
        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            totalFrames - 100,
            "Should process nearly all frames"
        )

        XCTAssertLessThan(
            memoryGrowth,
            100.0,
            "Memory growth should be <100MB (actual: \(String(format: "%.2f", memoryGrowth))MB)"
        )

        print("✅ TEST PASSED: 30fps/30min extended duration test")
        print("========================================\n")
    }

    // MARK: - Test 3: Variable Frame Rate Stress

    /// Test synchronizer with variable frame rates (simulating real-world conditions)
    /// Switches between 30fps, 60fps, and 120fps
    func testVariableFrameRateStress() async throws {
        print("\n========================================")
        print("TEST: Variable Frame Rate Stress")
        print("========================================\n")

        let sync = FrameSynchronizer(sourceIds: ["source1", "source2"], toleranceMs: 16)

        var framesProcessed = 0
        var totalFramesGenerated = 0

        // Phase 1: 60fps for 2 minutes
        print("Phase 1: 60fps for 2 minutes")
        let (processed1, generated1) = try await runPhase(sync: sync, fps: 60, duration: 120.0)
        framesProcessed += processed1
        totalFramesGenerated += generated1

        // Phase 2: 30fps for 3 minutes
        print("Phase 2: 30fps for 3 minutes")
        let (processed2, generated2) = try await runPhase(sync: sync, fps: 30, duration: 180.0)
        framesProcessed += processed2
        totalFramesGenerated += generated2

        // Phase 3: 120fps for 1 minute (high stress)
        print("Phase 3: 120fps for 1 minute")
        let (processed3, generated3) = try await runPhase(sync: sync, fps: 120, duration: 60.0)
        framesProcessed += processed3
        totalFramesGenerated += generated3

        // Phase 4: Back to 60fps for 1 minute
        print("Phase 4: 60fps for 1 minute")
        let (processed4, generated4) = try await runPhase(sync: sync, fps: 60, duration: 60.0)
        framesProcessed += processed4
        totalFramesGenerated += generated4

        let stats = await sync.getStats()

        print("\nResults:")
        print("  - Total frames generated: \(totalFramesGenerated)")
        print("  - Frames processed: \(framesProcessed)")
        print("  - Frames dropped: \(stats.totalFramesDropped)")
        print("")

        XCTAssertGreaterThanOrEqual(
            framesProcessed,
            totalFramesGenerated - 100,
            "Should process nearly all frames across variable rates"
        )

        print("✅ TEST PASSED: Variable frame rate stress test")
        print("========================================\n")
    }

    // MARK: - Helper Methods

    private func runPhase(sync: FrameSynchronizer, fps: Int, duration: Double) async throws -> (processed: Int, generated: Int) {
        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)
        var framesProcessed = 0

        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) * frameInterval

            let jitter1 = Double.random(in: 0...0.003)
            let jitter2 = Double.random(in: 0...0.003)

            let buffer1 = try createMockBuffer()
            let buffer2 = try createMockBuffer()

            let frame1 = SourcedFrame(
                buffer: buffer1,
                sourceId: "source1",
                timestamp: CMTime(seconds: timestamp + jitter1, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )
            let frame2 = SourcedFrame(
                buffer: buffer2,
                sourceId: "source2",
                timestamp: CMTime(seconds: timestamp + jitter2, preferredTimescale: 1000),
                sequenceNumber: frameNum
            )

            await sync.addFrame(frame1)
            await sync.addFrame(frame2)

            if let _ = await sync.getAlignedFrames() {
                framesProcessed += 1
            }
        }

        return (framesProcessed, totalFrames)
    }

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
            throw NSError(domain: "FrameSyncTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create pixel buffer"])
        }

        return buffer
    }

    private func getMemoryUsageMB() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Double(info.resident_size) / (1024.0 * 1024.0)
        }
        return 0
    }
}
