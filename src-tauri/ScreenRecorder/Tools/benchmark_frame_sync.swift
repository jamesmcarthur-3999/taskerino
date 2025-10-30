#!/usr/bin/env swift

/**
 * benchmark_frame_sync.swift - Performance Benchmark Tool for Frame Synchronization
 *
 * Executable Swift tool that benchmarks FrameSynchronizer performance over
 * configurable durations at 60fps.
 *
 * Usage:
 *   swift benchmark_frame_sync.swift [duration_seconds] [fps] [num_sources]
 *
 * Examples:
 *   swift benchmark_frame_sync.swift 600 60 2    # 10 minutes, 60fps, 2 sources
 *   swift benchmark_frame_sync.swift 60 60 4     # 1 minute, 60fps, 4 sources
 *
 * Exit codes:
 *   0 - All metrics passed
 *   1 - One or more metrics failed
 *
 * Metrics tracked:
 *   - Max drift (must be < 16ms)
 *   - Average drift
 *   - Frames synchronized vs expected
 *   - Frame drop rate (must be < 2%)
 *   - Sync rate (must be > 98%)
 *
 * Requirements: macOS 12.3+, Swift 5.5+
 */

import Foundation
import CoreMedia
import CoreVideo

#if os(macOS)
import Cocoa
#endif

// MARK: - Configuration

struct BenchmarkConfig {
    let duration: TimeInterval
    let fps: Int
    let numSources: Int
    let toleranceMs: Int
    let maxDriftThreshold: TimeInterval // 16ms = 1 frame at 60fps
    let maxDropRateThreshold: Double     // 2%
    let minSyncRateThreshold: Double     // 98%

    init(
        duration: TimeInterval = 600,
        fps: Int = 60,
        numSources: Int = 2,
        toleranceMs: Int = 16
    ) {
        self.duration = duration
        self.fps = fps
        self.numSources = numSources
        self.toleranceMs = toleranceMs
        self.maxDriftThreshold = 0.016 // 16ms
        self.maxDropRateThreshold = 2.0 // 2%
        self.minSyncRateThreshold = 98.0 // 98%
    }
}

// MARK: - Statistics

struct BenchmarkStatistics {
    var maxDrift: TimeInterval = 0
    var totalDrift: TimeInterval = 0
    var framesSynchronized: Int = 0
    var framesDropped: Int = 0
    var framesReceived: Int = 0
    var driftSamples: [TimeInterval] = []

    var averageDrift: TimeInterval {
        guard framesSynchronized > 0 else { return 0 }
        return totalDrift / Double(framesSynchronized)
    }

    var dropRate: Double {
        guard framesReceived > 0 else { return 0 }
        return Double(framesDropped) / Double(framesReceived) * 100
    }

    var syncRate: Double {
        let expectedFrames = framesReceived / 2 // Assuming 2 sources
        guard expectedFrames > 0 else { return 0 }
        return Double(framesSynchronized) / Double(expectedFrames) * 100
    }
}

// MARK: - Mock Frame Synchronizer (Embedded for standalone execution)

actor FrameSynchronizer {
    private var buffers: [String: [SourcedFrame]] = [:]
    private var toleranceMs: Int
    private let sourceIds: Set<String>

    private var totalFramesReceived: Int = 0
    private var totalFramesSynchronized: Int = 0
    private var totalFramesDropped: Int = 0

    init(sourceIds: Set<String>, toleranceMs: Int = 16) {
        self.sourceIds = sourceIds
        self.toleranceMs = toleranceMs

        for sourceId in sourceIds {
            buffers[sourceId] = []
        }
    }

    func addFrame(_ frame: SourcedFrame) {
        guard sourceIds.contains(frame.sourceId) else { return }
        buffers[frame.sourceId, default: []].append(frame)
        totalFramesReceived += 1
    }

    func getAlignedFrames() -> [String: SourcedFrame]? {
        guard buffers.values.allSatisfy({ !$0.isEmpty }) else {
            return nil
        }

        let timestamps = buffers.values.compactMap { $0.first?.timestamp }
        guard let baseTime = timestamps.min() else {
            return nil
        }

        var aligned: [String: SourcedFrame] = [:]
        var framesToRemove: [String: Int] = [:]

        let toleranceSeconds = Double(toleranceMs) / 1000.0

        for (sourceId, frames) in buffers {
            if let matchingFrame = frames.first(where: {
                abs($0.timestamp.seconds - baseTime.seconds) < toleranceSeconds
            }) {
                aligned[sourceId] = matchingFrame
                framesToRemove[sourceId] = matchingFrame.sequenceNumber
            } else {
                let tooOldFrames = frames.filter { $0.timestamp < baseTime }
                if !tooOldFrames.isEmpty {
                    totalFramesDropped += tooOldFrames.count
                    buffers[sourceId] = frames.filter { $0.timestamp >= baseTime }
                }
            }
        }

        guard aligned.count == sourceIds.count else {
            return nil
        }

        for (sourceId, maxSequence) in framesToRemove {
            buffers[sourceId] = buffers[sourceId]?.filter { $0.sequenceNumber > maxSequence } ?? []
        }

        totalFramesSynchronized += 1

        return aligned
    }

    func getStats() -> (received: Int, synchronized: Int, dropped: Int) {
        return (totalFramesReceived, totalFramesSynchronized, totalFramesDropped)
    }
}

struct SourcedFrame {
    let buffer: CVPixelBuffer
    let sourceId: String
    let timestamp: CMTime
    let sequenceNumber: Int
}

// MARK: - Benchmark Runner

class BenchmarkRunner {
    let config: BenchmarkConfig
    var stats = BenchmarkStatistics()

    init(config: BenchmarkConfig) {
        self.config = config
    }

    func run() async -> Bool {
        printHeader()

        let expectedFrames = Int(config.duration * Double(config.fps))
        let frameDuration = 1.0 / Double(config.fps)

        // Generate source IDs
        let sourceIds = (0..<config.numSources).map { "source\($0)" }
        let sync = FrameSynchronizer(sourceIds: Set(sourceIds), toleranceMs: config.toleranceMs)

        let startTime = CMTime(seconds: 0, preferredTimescale: 1000000)
        var lastReportTime = Date()

        print("🚀 Starting benchmark...")
        print("   Duration: \(formatDuration(config.duration))")
        print("   FPS: \(config.fps)")
        print("   Sources: \(config.numSources)")
        print("   Expected frames: \(expectedFrames)")
        print("")

        // Simulate frames
        for frameIndex in 0..<expectedFrames {
            let expectedTimestamp = startTime + CMTime(seconds: Double(frameIndex) * frameDuration, preferredTimescale: 1000000)

            // Add frames from all sources with realistic jitter
            for sourceId in sourceIds {
                let jitterMs = Double.random(in: -1.0...1.0)
                let actualTimestamp = expectedTimestamp + CMTime(seconds: jitterMs / 1000.0, preferredTimescale: 1000000)

                let frame = createMockFrame(
                    sourceId: sourceId,
                    timestamp: actualTimestamp,
                    sequenceNumber: frameIndex
                )

                await sync.addFrame(frame)
            }

            // Try to get aligned frames
            if let aligned = await sync.getAlignedFrames() {
                stats.framesSynchronized += 1

                // Calculate drift
                var maxFrameDrift: TimeInterval = 0
                for (_, frame) in aligned {
                    let drift = abs(frame.timestamp.seconds - expectedTimestamp.seconds)
                    maxFrameDrift = max(maxFrameDrift, drift)
                }

                stats.maxDrift = max(stats.maxDrift, maxFrameDrift)
                stats.totalDrift += maxFrameDrift
                stats.driftSamples.append(maxFrameDrift)
            }

            // Progress report every second
            let now = Date()
            if now.timeIntervalSince(lastReportTime) >= 1.0 {
                let syncStats = await sync.getStats()
                stats.framesReceived = syncStats.received
                stats.framesDropped = syncStats.dropped

                let progress = Double(frameIndex) / Double(expectedFrames) * 100
                let elapsed = Double(frameIndex) / Double(config.fps)
                printProgress(progress: progress, elapsed: elapsed)

                lastReportTime = now
            }
        }

        // Final statistics
        let finalStats = await sync.getStats()
        stats.framesReceived = finalStats.received
        stats.framesDropped = finalStats.dropped

        printResults()

        return validateResults()
    }

    private func printHeader() {
        print("╔═══════════════════════════════════════════════════════════════╗")
        print("║         FRAME SYNCHRONIZER PERFORMANCE BENCHMARK             ║")
        print("╚═══════════════════════════════════════════════════════════════╝")
        print("")
    }

    private func printProgress(progress: Double, elapsed: TimeInterval) {
        let maxDriftMs = Int(stats.maxDrift * 1000)
        let avgDriftMs = Int(stats.averageDrift * 1000)
        let dropRate = stats.dropRate

        print(String(format: "⏱️  %.1f%% | %@ elapsed | Synced: %d | Max drift: %dms | Avg drift: %dms | Drops: %.2f%%",
                     progress,
                     formatDuration(elapsed),
                     stats.framesSynchronized,
                     maxDriftMs,
                     avgDriftMs,
                     dropRate))
    }

    private func printResults() {
        print("")
        print("╔═══════════════════════════════════════════════════════════════╗")
        print("║                      BENCHMARK RESULTS                        ║")
        print("╚═══════════════════════════════════════════════════════════════╝")
        print("")

        let expectedFrames = Int(config.duration * Double(config.fps))

        print("📊 Frame Statistics:")
        print("   Total frames expected:     \(expectedFrames)")
        print("   Frames received:           \(stats.framesReceived)")
        print("   Frames synchronized:       \(stats.framesSynchronized)")
        print("   Frames dropped:            \(stats.framesDropped)")
        print("")

        print("📈 Synchronization Metrics:")
        print("   Sync rate:                 \(String(format: "%.2f%%", stats.syncRate))")
        print("   Drop rate:                 \(String(format: "%.2f%%", stats.dropRate))")
        print("")

        print("⏱️  Drift Analysis:")
        print("   Max drift:                 \(Int(stats.maxDrift * 1000))ms")
        print("   Average drift:             \(Int(stats.averageDrift * 1000))ms")
        print("")

        print("🎯 Thresholds:")
        print("   Max drift threshold:       < \(Int(config.maxDriftThreshold * 1000))ms")
        print("   Drop rate threshold:       < \(String(format: "%.1f%%", config.maxDropRateThreshold))")
        print("   Sync rate threshold:       > \(String(format: "%.1f%%", config.minSyncRateThreshold))")
        print("")
    }

    private func validateResults() -> Bool {
        var allPassed = true

        print("✅ Validation:")

        // Check max drift
        if stats.maxDrift < config.maxDriftThreshold {
            print("   ✓ Max drift: \(Int(stats.maxDrift * 1000))ms < \(Int(config.maxDriftThreshold * 1000))ms")
        } else {
            print("   ✗ Max drift: \(Int(stats.maxDrift * 1000))ms >= \(Int(config.maxDriftThreshold * 1000))ms (FAILED)")
            allPassed = false
        }

        // Check drop rate
        if stats.dropRate < config.maxDropRateThreshold {
            print("   ✓ Drop rate: \(String(format: "%.2f%%", stats.dropRate)) < \(String(format: "%.1f%%", config.maxDropRateThreshold))")
        } else {
            print("   ✗ Drop rate: \(String(format: "%.2f%%", stats.dropRate)) >= \(String(format: "%.1f%%", config.maxDropRateThreshold)) (FAILED)")
            allPassed = false
        }

        // Check sync rate
        if stats.syncRate > config.minSyncRateThreshold {
            print("   ✓ Sync rate: \(String(format: "%.2f%%", stats.syncRate)) > \(String(format: "%.1f%%", config.minSyncRateThreshold))")
        } else {
            print("   ✗ Sync rate: \(String(format: "%.2f%%", stats.syncRate)) <= \(String(format: "%.1f%%", config.minSyncRateThreshold)) (FAILED)")
            allPassed = false
        }

        print("")

        if allPassed {
            print("🎉 ALL METRICS PASSED")
        } else {
            print("❌ SOME METRICS FAILED")
        }

        return allPassed
    }

    private func createMockFrame(sourceId: String, timestamp: CMTime, sequenceNumber: Int) -> SourcedFrame {
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
            sourceId: sourceId,
            timestamp: timestamp,
            sequenceNumber: sequenceNumber
        )
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }
}

// MARK: - Main Entry Point

// Parse command-line arguments
let args = CommandLine.arguments
let duration: TimeInterval = args.count > 1 ? TimeInterval(args[1]) ?? 600 : 600
let fps: Int = args.count > 2 ? Int(args[2]) ?? 60 : 60
let numSources: Int = args.count > 3 ? Int(args[3]) ?? 2 : 2

let config = BenchmarkConfig(
    duration: duration,
    fps: fps,
    numSources: numSources
)

let runner = BenchmarkRunner(config: config)

// Run the benchmark
Task {
    let success = await runner.run()
    exit(success ? 0 : 1)
}

// Keep the script running
RunLoop.main.run()
