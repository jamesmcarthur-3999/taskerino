/**
 * RecordingSession - Main multi-source recording orchestrator
 *
 * Coordinates multiple recording sources (display, window, webcam) with:
 * - Frame synchronization across sources
 * - Frame composition using configurable compositors
 * - Video encoding to file
 * - Statistics tracking
 * - Proper error handling and cleanup
 *
 * Architecture:
 * - Actor-based for thread safety (no locks/semaphores)
 * - Async/await throughout
 * - Manages source lifecycle
 * - Coordinates synchronizer, compositor, and encoder
 *
 * Based on ARCHITECTURE.md lines 623-660
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import CoreMedia
import CoreVideo

/// Main orchestrator for multi-source recording
@available(macOS 12.3, *)
public actor RecordingSession {
    // MARK: - Properties

    /// Recording sources (display, window, webcam)
    /// Note: Changed from 'let' to 'var' to support hot-swapping sources during recording
    private var sources: [RecordingSource]

    /// Frame synchronization coordinator
    private let synchronizer: FrameSynchronizer

    /// Frame compositor (combines multiple frames)
    private let compositor: FrameCompositor

    /// Video encoder
    private let encoder: VideoEncoder

    /// Timestamp tolerance in milliseconds
    private let toleranceMs: Int

    /// Is the session currently recording?
    private var isRecording = false

    /// Is the session currently paused?
    private var isPaused = false

    /// Timestamp when recording was paused (for time tracking)
    private var pauseStartTime: CMTime?

    /// Total pause duration (accumulated across multiple pauses)
    private var totalPauseDuration: CMTime = CMTime.zero

    /// Processing task (frame loop)
    private var processingTask: Task<Void, Never>?

    /// Statistics
    private var stats = RecordingStats()

    /// Start time of the session
    private var sessionStartTime: CMTime?

    // MARK: - Initialization

    /// Create a recording session
    /// - Parameters:
    ///   - sources: Array of recording sources to coordinate
    ///   - compositor: Frame compositor for combining frames
    ///   - encoder: Video encoder for output
    ///   - toleranceMs: Timestamp tolerance for frame synchronization (default: 16ms = 60fps)
    public init(
        sources: [RecordingSource],
        compositor: FrameCompositor,
        encoder: VideoEncoder,
        toleranceMs: Int = 16
    ) {
        self.sources = sources
        self.compositor = compositor
        self.encoder = encoder
        self.toleranceMs = toleranceMs

        // Create synchronizer with source IDs
        let sourceIds = Set(sources.map { $0.sourceId })
        self.synchronizer = FrameSynchronizer(sourceIds: sourceIds, toleranceMs: toleranceMs)

        print("✅ [RecordingSession] Initialized with \(sources.count) sources: \(sourceIds.joined(separator: ", "))")
    }

    // MARK: - Recording Control

    /// Start the recording session
    /// - Starts all sources in parallel
    /// - Begins frame processing loop
    /// - Throws if already recording or if any source fails to start
    public func start() async throws {
        guard !isRecording else {
            throw RecordingSessionError.alreadyRecording
        }

        print("🎬 [RecordingSession] Starting recording with \(sources.count) sources...")

        // Configure encoder
        try encoder.configure()
        try encoder.start()

        // Start all sources in parallel
        try await withThrowingTaskGroup(of: Void.self) { group in
            for source in sources {
                group.addTask {
                    try await source.start()
                }
            }

            // Wait for all sources to start
            try await group.waitForAll()
        }

        print("✅ [RecordingSession] All sources started successfully")

        // Mark session as recording
        isRecording = true
        sessionStartTime = nil  // Will be set to first frame's timestamp

        // Start frame processing loop
        startFrameProcessing()

        print("✅ [RecordingSession] Recording session started")
    }

    /// Stop the recording session
    /// - Stops frame processing
    /// - Stops all sources
    /// - Finishes encoding
    /// - Performs cleanup
    public func stop() async throws {
        guard isRecording else {
            print("⚠️  [RecordingSession] Not recording")
            return
        }

        print("🛑 [RecordingSession] Stopping recording...")

        // Mark as not recording (stops frame processing loop)
        isRecording = false

        // Cancel processing task
        processingTask?.cancel()
        processingTask = nil

        // Stop all sources in parallel
        await withTaskGroup(of: Void.self) { group in
            for source in sources {
                group.addTask {
                    do {
                        try await source.stop()
                    } catch {
                        print("⚠️  [RecordingSession] Error stopping source \(source.sourceId): \(error)")
                    }
                }
            }

            await group.waitForAll()
        }

        print("✅ [RecordingSession] All sources stopped")

        // Finish encoding
        try await encoder.finish()

        // Reset session start time for next recording
        sessionStartTime = nil

        print("✅ [RecordingSession] Recording session stopped")
        print("📊 [RecordingSession] Final stats: \(stats)")
    }

    /// Pause the recording session
    /// - Pauses frame processing without stopping sources
    /// - Can be resumed later
    /// - Throws if not currently recording or already paused
    public func pause() async throws {
        guard isRecording else {
            throw RecordingSessionError.notRecording
        }

        guard !isPaused else {
            print("⚠️  [RecordingSession] Already paused")
            return
        }

        print("⏸️  [RecordingSession] Pausing recording...")

        // Mark as paused
        isPaused = true
        pauseStartTime = await getCurrentTimestamp()

        // Note: We DON'T stop sources or cancel processing task
        // Frame processing continues but frames are dropped while paused

        print("✅ [RecordingSession] Recording paused")
    }

    /// Resume the recording session after pause
    /// - Resumes frame processing
    /// - Adjusts timestamps to account for pause duration
    /// - Throws if not currently paused
    public func resume() async throws {
        guard isRecording else {
            throw RecordingSessionError.notRecording
        }

        guard isPaused else {
            print("⚠️  [RecordingSession] Not paused")
            return
        }

        print("▶️  [RecordingSession] Resuming recording...")

        // Calculate pause duration
        if let pauseStart = pauseStartTime {
            let now = await getCurrentTimestamp()
            let duration = CMTimeSubtract(now, pauseStart)
            totalPauseDuration = CMTimeAdd(totalPauseDuration, duration)

            print("📊 [RecordingSession] Pause duration: \(duration.seconds)s, Total: \(totalPauseDuration.seconds)s")
        }

        // Clear pause state
        isPaused = false
        pauseStartTime = nil

        print("✅ [RecordingSession] Recording resumed")
    }

    /// Switch a recording source during active recording
    /// - Replaces an existing source with a new one
    /// - Preserves synchronization and frame timing
    /// - Parameters:
    ///   - oldSourceId: ID of source to replace
    ///   - newSource: New source to add
    /// - Throws if not recording or source IDs don't match
    public func switchSource(oldSourceId: String, newSource: RecordingSource) async throws {
        guard isRecording else {
            throw RecordingSessionError.notRecording
        }

        print("🔄 [RecordingSession] Switching source: \(oldSourceId) → \(newSource.sourceId)")

        // Find the old source
        guard let oldIndex = sources.firstIndex(where: { $0.sourceId == oldSourceId }) else {
            throw RecordingSessionError.sourceNotFound(oldSourceId)
        }

        let oldSource = sources[oldIndex]

        // Stop old source
        try await oldSource.stop()
        print("🛑 [RecordingSession] Stopped old source: \(oldSourceId)")

        // Update synchronizer (remove old, add new)
        await synchronizer.removeSource(oldSourceId)
        await synchronizer.addSource(newSource.sourceId)

        // Replace source in array
        sources[oldIndex] = newSource

        // Start new source
        try await newSource.start()
        print("✅ [RecordingSession] Started new source: \(newSource.sourceId)")

        print("✅ [RecordingSession] Source switch complete")
    }

    // MARK: - Frame Processing

    /// Start the frame processing loop
    /// Continuously processes frames from all sources
    private func startFrameProcessing() {
        processingTask = Task { [weak self] in
            guard let self = self else { return }

            print("🔄 [RecordingSession] Frame processing loop started")

            // Merge frame streams from all sources
            await processMergedFrameStreams()

            print("🔄 [RecordingSession] Frame processing loop ended")
        }
    }

    /// Process merged frame streams from all sources
    /// Uses async/await pattern to merge multiple AsyncStreams
    private func processMergedFrameStreams() async {
        // Create tasks for each source's frame stream
        await withTaskGroup(of: Void.self) { group in
            for source in sources {
                group.addTask { [weak self] in
                    guard let self = self else { return }

                    // Process frames from this source
                    for await frame in source.frameStream {
                        // Check if still recording
                        guard await self.isRecording else {
                            break
                        }

                        // Add frame to synchronizer
                        await self.synchronizer.addFrame(frame)
                        await self.incrementFramesReceived()

                        // Try to get aligned frames
                        if let alignedFrames = await self.synchronizer.getAlignedFrames() {
                            await self.processAlignedFrames(alignedFrames)
                        }
                    }
                }
            }

            // Wait for all source streams to complete
            await group.waitForAll()
        }
    }

    /// Process a set of aligned frames
    /// - Composites frames together
    /// - Encodes to video
    /// - Updates statistics
    private func processAlignedFrames(_ alignedFrames: [String: SourcedFrame]) async {
        // Skip frame processing if paused
        guard !isPaused else {
            return  // Drop frames while paused
        }

        do {
            // Composite frames
            let compositedBuffer = try compositor.composite(alignedFrames)

            // Get timestamp from first frame (all should be aligned)
            guard let firstFrame = alignedFrames.values.first else {
                print("⚠️  [RecordingSession] No frames in aligned set")
                return
            }

            // Capture session start time from first frame
            if sessionStartTime == nil {
                sessionStartTime = firstFrame.timestamp
                print("⏱️  [RecordingSession] Session start time captured: \(firstFrame.timestamp.seconds)s (absolute)")
            }

            // Rebase timestamp to session-relative time (start from zero)
            guard let startTime = sessionStartTime else {
                print("❌ [RecordingSession] Session start time not set")
                return
            }
            let relativeTimestamp = CMTimeSubtract(firstFrame.timestamp, startTime)

            // Write to encoder with session-relative timestamp
            try encoder.writeFrame(compositedBuffer, at: relativeTimestamp)

            // Update stats
            stats.framesProcessed += 1

            // Log progress every 30 frames
            if stats.framesProcessed % 30 == 0 {
                print("✅ [RecordingSession] Processed \(stats.framesProcessed) frames")
            }

        } catch {
            print("❌ [RecordingSession] Error processing aligned frames: \(error)")
            stats.framesDropped += 1
        }
    }

    /// Increment frames received counter
    private func incrementFramesReceived() {
        stats.framesReceived += 1
    }

    // MARK: - Statistics

    /// Get current recording statistics
    /// - Returns: Recording statistics including frames processed, dropped, etc.
    public func getStats() -> RecordingStats {
        return stats
    }

    /// Get detailed statistics including synchronizer stats
    public func getDetailedStats() async -> DetailedRecordingStats {
        let syncStats = await synchronizer.getStats()

        return DetailedRecordingStats(
            framesReceived: stats.framesReceived,
            framesProcessed: stats.framesProcessed,
            framesDropped: stats.framesDropped,
            synchronizerStats: syncStats,
            encoderFrameCount: encoder.currentFrameCount,
            isRecording: isRecording,
            sourceCount: sources.count
        )
    }

    // MARK: - Helper Methods

    /// Get current timestamp adjusted for pause duration
    private func getCurrentTimestamp() async -> CMTime {
        let now = CMClockGetTime(CMClockGetHostTimeClock())

        // Subtract total pause duration to get effective recording time
        return CMTimeSubtract(now, totalPauseDuration)
    }

    /// Check if currently paused (public accessor)
    public func getIsPaused() -> Bool {
        return isPaused
    }
}

// MARK: - Statistics Structures

/// Basic recording statistics
public struct RecordingStats: CustomStringConvertible {
    /// Total frames received from all sources
    public var framesReceived: Int = 0

    /// Total frames successfully processed (composited + encoded)
    public var framesProcessed: Int = 0

    /// Total frames dropped due to errors
    public var framesDropped: Int = 0

    public var description: String {
        return "Received: \(framesReceived), Processed: \(framesProcessed), Dropped: \(framesDropped)"
    }
}

/// Detailed recording statistics including synchronizer info
public struct DetailedRecordingStats {
    public let framesReceived: Int
    public let framesProcessed: Int
    public let framesDropped: Int
    public let synchronizerStats: SynchronizerStats
    public let encoderFrameCount: Int64
    public let isRecording: Bool
    public let sourceCount: Int

    public var description: String {
        return """
        Recording Status: \(isRecording ? "ACTIVE" : "STOPPED")
        Sources: \(sourceCount)
        Frames Received: \(framesReceived)
        Frames Processed: \(framesProcessed)
        Frames Dropped: \(framesDropped)
        Encoder Frames: \(encoderFrameCount)
        Synchronizer: \(synchronizerStats.description)
        """
    }
}

// MARK: - Errors

/// Recording session errors
public enum RecordingSessionError: Error {
    case alreadyRecording
    case notRecording
    case alreadyPaused
    case notPaused
    case sourceNotFound(String)
    case sourceStartFailed(String, Error)
    case compositingFailed(Error)
    case encodingFailed(Error)
}
