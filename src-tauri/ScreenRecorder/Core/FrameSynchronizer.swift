/**
 * FrameSynchronizer - Thread-safe frame synchronization for multi-source recording
 *
 * Synchronizes frames from multiple sources based on timestamps to ensure
 * aligned composition (e.g., display + webcam PiP).
 *
 * Uses Swift actors for thread-safe access to frame buffers.
 *
 * Based on architecture specification in ARCHITECTURE.md (lines 586-617)
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import CoreMedia
import CoreVideo

/// Thread-safe frame synchronization using actors
@available(macOS 12.3, *)
public actor FrameSynchronizer {
    // MARK: - Properties

    /// Frame buffers per source (sourceId -> frames)
    private var buffers: [String: [SourcedFrame]] = [:]

    /// Timestamp tolerance in milliseconds (default: 16ms = one frame at 60fps)
    private var toleranceMs: Int

    /// Expected source IDs (mutable to support hot-swapping)
    private var sourceIds: Set<String>

    /// Statistics
    private var totalFramesReceived: Int = 0
    private var totalFramesSynchronized: Int = 0
    private var totalFramesDropped: Int = 0

    // MARK: - Initialization

    /// Create a frame synchronizer
    /// - Parameters:
    ///   - sourceIds: Set of expected source IDs
    ///   - toleranceMs: Timestamp tolerance in milliseconds (default: 16ms)
    public init(sourceIds: Set<String>, toleranceMs: Int = 16) {
        self.sourceIds = sourceIds
        self.toleranceMs = toleranceMs

        // Initialize buffers
        for sourceId in sourceIds {
            buffers[sourceId] = []
        }

        print("✅ [FrameSynchronizer] Initialized with sources: \(sourceIds.joined(separator: ", ")), tolerance: \(toleranceMs)ms")
    }

    // MARK: - Frame Management

    /// Add a frame from a source
    /// - Parameter frame: The frame to add
    public func addFrame(_ frame: SourcedFrame) {
        guard sourceIds.contains(frame.sourceId) else {
            print("⚠️  [FrameSynchronizer] Ignoring frame from unknown source: \(frame.sourceId)")
            return
        }

        buffers[frame.sourceId, default: []].append(frame)
        totalFramesReceived += 1
    }

    /// Get synchronized frames from all sources
    /// Returns nil if not all sources have frames available yet
    /// - Returns: Dictionary of aligned frames (sourceId -> frame), or nil if alignment not possible
    public func getAlignedFrames() -> [String: SourcedFrame]? {
        // Check that all sources have at least one frame
        guard buffers.values.allSatisfy({ !$0.isEmpty }) else {
            return nil
        }

        // Find earliest timestamp across all sources
        let timestamps = buffers.values.compactMap { $0.first?.timestamp }
        guard let baseTime = timestamps.min() else {
            return nil
        }

        // Collect frames within tolerance
        var aligned: [String: SourcedFrame] = [:]
        var framesToRemove: [String: Int] = [:] // sourceId -> sequenceNumber to remove up to

        let toleranceSeconds = Double(toleranceMs) / 1000.0

        for (sourceId, frames) in buffers {
            // Find first frame within tolerance of baseTime
            if let matchingFrame = frames.first(where: {
                abs($0.timestamp.seconds - baseTime.seconds) < toleranceSeconds
            }) {
                aligned[sourceId] = matchingFrame
                framesToRemove[sourceId] = matchingFrame.sequenceNumber
            } else {
                // Check if we need to drop old frames that are too far behind
                let tooOldFrames = frames.filter { $0.timestamp < baseTime }
                if !tooOldFrames.isEmpty {
                    totalFramesDropped += tooOldFrames.count
                    print("⚠️  [FrameSynchronizer] Dropping \(tooOldFrames.count) old frames from \(sourceId)")
                    // Keep only frames at or after baseTime
                    buffers[sourceId] = frames.filter { $0.timestamp >= baseTime }
                }
            }
        }

        // Only return if we have frames from all sources
        guard aligned.count == sourceIds.count else {
            return nil
        }

        // Remove consumed frames from buffers
        for (sourceId, maxSequence) in framesToRemove {
            buffers[sourceId] = buffers[sourceId]?.filter { $0.sequenceNumber > maxSequence } ?? []
        }

        totalFramesSynchronized += 1

        return aligned
    }

    /// Clear all buffered frames
    public func clear() {
        for sourceId in sourceIds {
            buffers[sourceId] = []
        }
        print("🗑️  [FrameSynchronizer] Cleared all buffers")
    }

    /// Add a new source to the synchronizer (for hot-swapping)
    /// - Parameter sourceId: ID of the new source to add
    public func addSource(_ sourceId: String) {
        guard !sourceIds.contains(sourceId) else {
            print("⚠️  [FrameSynchronizer] Source already exists: \(sourceId)")
            return
        }

        sourceIds.insert(sourceId)
        buffers[sourceId] = []
        print("✅ [FrameSynchronizer] Added new source: \(sourceId)")
    }

    /// Remove a source from the synchronizer (for hot-swapping)
    /// - Parameter sourceId: ID of the source to remove
    public func removeSource(_ sourceId: String) {
        guard sourceIds.contains(sourceId) else {
            print("⚠️  [FrameSynchronizer] Source not found: \(sourceId)")
            return
        }

        sourceIds.remove(sourceId)
        buffers.removeValue(forKey: sourceId)
        print("✅ [FrameSynchronizer] Removed source: \(sourceId)")
    }

    /// Get buffer statistics
    public func getStats() -> SynchronizerStats {
        let bufferCounts = buffers.mapValues { $0.count }
        return SynchronizerStats(
            totalFramesReceived: totalFramesReceived,
            totalFramesSynchronized: totalFramesSynchronized,
            totalFramesDropped: totalFramesDropped,
            currentBufferSizes: bufferCounts
        )
    }

    /// Update tolerance
    public func setTolerance(_ toleranceMs: Int) {
        self.toleranceMs = toleranceMs
        print("⚙️  [FrameSynchronizer] Updated tolerance to \(toleranceMs)ms")
    }
}

// MARK: - Statistics

public struct SynchronizerStats {
    public let totalFramesReceived: Int
    public let totalFramesSynchronized: Int
    public let totalFramesDropped: Int
    public let currentBufferSizes: [String: Int]

    public var description: String {
        let bufferDesc = currentBufferSizes.map { "\($0.key): \($0.value)" }.joined(separator: ", ")
        return "Received: \(totalFramesReceived), Synchronized: \(totalFramesSynchronized), Dropped: \(totalFramesDropped), Buffers: [\(bufferDesc)]"
    }
}
