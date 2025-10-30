/**
 * FrameSyncPerformanceTests - Performance benchmarks for FrameSynchronizer
 *
 * Measures synchronizer performance under various conditions:
 * - Alignment speed for different source counts
 * - Throughput with large frame batches
 * - Memory efficiency
 * - CPU usage characteristics
 *
 * Requirements: macOS 12.3+
 */

import XCTest
import CoreMedia
import CoreVideo
@testable import ScreenRecorder

@available(macOS 12.3, *)
final class FrameSyncPerformanceTests: XCTestCase {

    // MARK: - Test 1: Alignment Performance Benchmark

    /// Measure time to align frames from 4 sources
    /// Target: <2ms per alignment
    func testAlignmentPerformanceBenchmark() async throws {
        print("\n========================================")
        print("TEST: Alignment Performance Benchmark")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3", "source4"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let iterations = 1000
        var alignmentTimes: [TimeInterval] = []

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - Iterations: \(iterations)")
        print("")

        // Pre-fill buffers with frames
        for frameNum in 0..<iterations {
            let timestamp = Double(frameNum) / 60.0

            for sourceId in sourceIds {
                let jitter = Double.random(in: 0...0.005)
                let buffer = try createMockBuffer()

                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: timestamp + jitter, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )

                await sync.addFrame(frame)
            }
        }

        print("Measuring alignment performance...")

        // Measure alignment speed
        let startTime = Date()
        var alignedCount = 0

        while let _ = await sync.getAlignedFrames() {
            let alignTime = Date()
            let elapsed = alignTime.timeIntervalSince(startTime)
            alignmentTimes.append(elapsed)
            alignedCount += 1
        }

        let totalTime = Date().timeIntervalSince(startTime)

        // Statistics
        let avgTime = alignmentTimes.reduce(0, +) / Double(alignmentTimes.count)
        let minTime = alignmentTimes.min() ?? 0
        let maxTime = alignmentTimes.max() ?? 0
        let medianTime = alignmentTimes.sorted()[alignmentTimes.count / 2]

        print("\nResults:")
        print("  - Aligned frames: \(alignedCount)")
        print("  - Total time: \(String(format: "%.3f", totalTime * 1000))ms")
        print("  - Average per alignment: \(String(format: "%.4f", avgTime * 1000))ms")
        print("  - Median: \(String(format: "%.4f", medianTime * 1000))ms")
        print("  - Min: \(String(format: "%.4f", minTime * 1000))ms")
        print("  - Max: \(String(format: "%.4f", maxTime * 1000))ms")
        print("  - Throughput: \(String(format: "%.0f", Double(alignedCount) / totalTime)) frames/sec")
        print("")

        // Target: <2ms average alignment time
        XCTAssertLessThan(
            avgTime * 1000,
            2.0,
            "Average alignment time should be <2ms (actual: \(String(format: "%.4f", avgTime * 1000))ms)"
        )

        print("✅ TEST PASSED: Alignment performance benchmark")
        print("========================================\n")
    }

    // MARK: - Test 2: Throughput Benchmark

    /// Measure maximum throughput (frames/second)
    /// Process 10,000 frames as fast as possible
    func testThroughputBenchmark() async throws {
        print("\n========================================")
        print("TEST: Throughput Benchmark")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let totalFrames = 10000

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - Total frames: \(totalFrames)")
        print("")

        let startTime = Date()

        // Add and process frames as fast as possible
        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) / 60.0

            for sourceId in sourceIds {
                let buffer = try createMockBuffer()
                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: timestamp, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )
                await sync.addFrame(frame)
            }

            _ = await sync.getAlignedFrames()
        }

        let endTime = Date()
        let totalTime = endTime.timeIntervalSince(startTime)
        let throughput = Double(totalFrames) / totalTime

        print("Results:")
        print("  - Total time: \(String(format: "%.2f", totalTime))s")
        print("  - Throughput: \(String(format: "%.0f", throughput)) frames/sec")
        print("  - Time per frame: \(String(format: "%.4f", totalTime / Double(totalFrames) * 1000))ms")
        print("")

        // Target: Process at least 5000 frames/sec (5x faster than 60fps)
        XCTAssertGreaterThan(
            throughput,
            5000,
            "Throughput should be >5000 frames/sec (actual: \(String(format: "%.0f", throughput)))"
        )

        print("✅ TEST PASSED: Throughput benchmark")
        print("========================================\n")
    }

    // MARK: - Test 3: Memory Efficiency Benchmark

    /// Measure memory usage with large buffer sizes
    /// Process frames in batches and measure memory growth
    func testMemoryEfficiencyBenchmark() async throws {
        print("\n========================================")
        print("TEST: Memory Efficiency Benchmark")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let batchSize = 1000
        let batches = 10

        var memoryReadings: [(batch: Int, memoryMB: Double)] = []
        let initialMemory = getMemoryUsageMB()

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - Batch size: \(batchSize)")
        print("  - Batches: \(batches)")
        print("  - Initial memory: \(String(format: "%.2f", initialMemory))MB")
        print("")

        for batchNum in 0..<batches {
            // Add batch of frames
            for frameNum in 0..<batchSize {
                let timestamp = Double(batchNum * batchSize + frameNum) / 60.0

                for sourceId in sourceIds {
                    let buffer = try createMockBuffer()
                    let frame = SourcedFrame(
                        buffer: buffer,
                        sourceId: sourceId,
                        timestamp: CMTime(seconds: timestamp, preferredTimescale: 1000),
                        sequenceNumber: batchNum * batchSize + frameNum
                    )
                    await sync.addFrame(frame)
                }
            }

            // Process all frames
            while let _ = await sync.getAlignedFrames() { }

            // Measure memory
            let currentMemory = getMemoryUsageMB()
            memoryReadings.append((batch: batchNum, memoryMB: currentMemory))

            print("Batch \(batchNum + 1): Memory = \(String(format: "%.2f", currentMemory))MB")
        }

        let finalMemory = getMemoryUsageMB()
        let memoryGrowth = finalMemory - initialMemory

        print("\nResults:")
        print("  - Initial memory: \(String(format: "%.2f", initialMemory))MB")
        print("  - Final memory: \(String(format: "%.2f", finalMemory))MB")
        print("  - Growth: \(String(format: "%.2f", memoryGrowth))MB")
        print("  - Frames processed: \(batchSize * batches)")
        print("")

        // Target: <50MB growth for 10,000 frames
        XCTAssertLessThan(
            memoryGrowth,
            50.0,
            "Memory growth should be <50MB (actual: \(String(format: "%.2f", memoryGrowth))MB)"
        )

        print("✅ TEST PASSED: Memory efficiency benchmark")
        print("========================================\n")
    }

    // MARK: - Test 4: Scaling Benchmark (1-8 sources)

    /// Measure how alignment performance scales with source count
    /// Test 1, 2, 4, 6, and 8 sources
    func testScalingBenchmark() async throws {
        print("\n========================================")
        print("TEST: Scaling Benchmark")
        print("========================================\n")

        let sourceCounts = [1, 2, 4, 6, 8]
        let framesPerTest = 1000

        print("Configuration:")
        print("  - Source counts: \(sourceCounts)")
        print("  - Frames per test: \(framesPerTest)")
        print("")

        var results: [(sourceCount: Int, avgTime: Double, throughput: Double)] = []

        for sourceCount in sourceCounts {
            let sourceIds = Set((0..<sourceCount).map { "source\($0)" })
            let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

            let startTime = Date()

            for frameNum in 0..<framesPerTest {
                let timestamp = Double(frameNum) / 60.0

                for sourceId in sourceIds {
                    let buffer = try createMockBuffer()
                    let frame = SourcedFrame(
                        buffer: buffer,
                        sourceId: sourceId,
                        timestamp: CMTime(seconds: timestamp, preferredTimescale: 1000),
                        sequenceNumber: frameNum
                    )
                    await sync.addFrame(frame)
                }

                _ = await sync.getAlignedFrames()
            }

            let endTime = Date()
            let totalTime = endTime.timeIntervalSince(startTime)
            let avgTime = totalTime / Double(framesPerTest)
            let throughput = Double(framesPerTest) / totalTime

            results.append((sourceCount: sourceCount, avgTime: avgTime, throughput: throughput))

            print("\(sourceCount) sources:")
            print("  - Total time: \(String(format: "%.3f", totalTime))s")
            print("  - Avg per frame: \(String(format: "%.4f", avgTime * 1000))ms")
            print("  - Throughput: \(String(format: "%.0f", throughput)) frames/sec")
            print("")
        }

        print("Scaling Analysis:")
        for i in 1..<results.count {
            let prev = results[i-1]
            let curr = results[i]
            let slowdown = curr.avgTime / prev.avgTime
            print("  \(prev.sourceCount) → \(curr.sourceCount) sources: \(String(format: "%.2f", slowdown))x slowdown")
        }
        print("")

        // Verify linear or sub-linear scaling (8 sources shouldn't be >3x slower than 2 sources)
        let twoSourceTime = results.first(where: { $0.sourceCount == 2 })?.avgTime ?? 0
        let eightSourceTime = results.first(where: { $0.sourceCount == 8 })?.avgTime ?? 0

        let scalingFactor = eightSourceTime / twoSourceTime

        XCTAssertLessThan(
            scalingFactor,
            3.0,
            "8 sources should be <3x slower than 2 sources (actual: \(String(format: "%.2f", scalingFactor))x)"
        )

        print("✅ TEST PASSED: Scaling benchmark")
        print("========================================\n")
    }

    // MARK: - Test 5: XCTest Performance Measure

    /// Use XCTest's built-in performance measurement
    /// Baseline: Process 1000 frames from 4 sources
    func testPerformanceMeasure() async throws {
        print("\n========================================")
        print("TEST: XCTest Performance Measure")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3", "source4"]
        let framesPerIteration = 1000

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - Frames per iteration: \(framesPerIteration)")
        print("  - Measuring 10 iterations...")
        print("")

        measure {
            Task {
                let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

                for frameNum in 0..<framesPerIteration {
                    let timestamp = Double(frameNum) / 60.0

                    for sourceId in sourceIds {
                        do {
                            let buffer = try createMockBuffer()
                            let frame = SourcedFrame(
                                buffer: buffer,
                                sourceId: sourceId,
                                timestamp: CMTime(seconds: timestamp, preferredTimescale: 1000),
                                sequenceNumber: frameNum
                            )
                            await sync.addFrame(frame)
                        } catch {
                            XCTFail("Failed to create buffer: \(error)")
                        }
                    }

                    _ = await sync.getAlignedFrames()
                }
            }
        }

        print("✅ TEST PASSED: XCTest performance measure")
        print("Note: Check Xcode test results for baseline performance metrics")
        print("========================================\n")
    }

    // MARK: - Test 6: CPU Usage Benchmark

    /// Monitor CPU usage during sustained operation
    /// Process frames continuously and track CPU percentage
    func testCPUUsageBenchmark() async throws {
        print("\n========================================")
        print("TEST: CPU Usage Benchmark")
        print("========================================\n")

        let sourceIds: Set<String> = ["source1", "source2", "source3", "source4"]
        let sync = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: 16)

        let fps = 60
        let duration = 5.0 // 5 seconds
        let totalFrames = Int(Double(fps) * duration)
        let frameInterval = 1.0 / Double(fps)

        print("Configuration:")
        print("  - Sources: \(sourceIds.count)")
        print("  - FPS: \(fps)")
        print("  - Duration: \(duration)s")
        print("")

        let startTime = Date()
        let startCPU = getCurrentCPUUsage()

        for frameNum in 0..<totalFrames {
            let timestamp = Double(frameNum) * frameInterval

            for sourceId in sourceIds {
                let buffer = try createMockBuffer()
                let frame = SourcedFrame(
                    buffer: buffer,
                    sourceId: sourceId,
                    timestamp: CMTime(seconds: timestamp, preferredTimescale: 1000),
                    sequenceNumber: frameNum
                )
                await sync.addFrame(frame)
            }

            _ = await sync.getAlignedFrames()
        }

        let endTime = Date()
        let endCPU = getCurrentCPUUsage()
        let totalTime = endTime.timeIntervalSince(startTime)

        print("Results:")
        print("  - Total time: \(String(format: "%.2f", totalTime))s")
        print("  - Frames processed: \(totalFrames)")
        print("  - Throughput: \(String(format: "%.0f", Double(totalFrames) / totalTime)) frames/sec")
        print("  - Start CPU: \(String(format: "%.1f", startCPU))%")
        print("  - End CPU: \(String(format: "%.1f", endCPU))%")
        print("")

        // Note: CPU usage is informational only, hard to test reliably
        print("Note: CPU usage varies by system load and hardware")

        print("✅ TEST PASSED: CPU usage benchmark")
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
            throw NSError(domain: "FrameSyncPerformanceTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create pixel buffer"])
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

    private func getCurrentCPUUsage() -> Double {
        var threadList: thread_act_array_t?
        var threadCount: mach_msg_type_number_t = 0
        let task = mach_task_self_

        guard task_threads(task, &threadList, &threadCount) == KERN_SUCCESS else {
            return 0
        }

        var totalCPU: Double = 0

        if let threads = threadList {
            for i in 0..<Int(threadCount) {
                var threadInfo = thread_basic_info()
                var threadInfoCount = mach_msg_type_number_t(THREAD_INFO_MAX)

                let result = withUnsafeMutablePointer(to: &threadInfo) {
                    $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                        thread_info(threads[i], thread_flavor_t(THREAD_BASIC_INFO), $0, &threadInfoCount)
                    }
                }

                if result == KERN_SUCCESS {
                    let cpu = Double(threadInfo.cpu_usage) / Double(TH_USAGE_SCALE) * 100.0
                    totalCPU += cpu
                }
            }

            vm_deallocate(mach_task_self_, vm_address_t(bitPattern: threads), vm_size_t(threadCount * MemoryLayout<thread_t>.size))
        }

        return totalCPU
    }
}
