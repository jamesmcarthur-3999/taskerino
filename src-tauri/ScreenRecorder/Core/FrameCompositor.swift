/**
 * FrameCompositor - Protocol for frame composition
 *
 * Defines the interface for compositing multiple frames together.
 * Main implementation is PiPCompositor (Picture-in-Picture).
 *
 * This protocol allows for:
 * - Swappable compositor implementations
 * - Testing with mock compositors
 * - Future alternative composition strategies
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import CoreVideo

/// Protocol for compositing multiple frames into a single output frame
@available(macOS 12.3, *)
public protocol FrameCompositor {
    /// Composite frames from multiple sources into a single output frame
    /// - Parameter frames: Dictionary of frames by source ID
    /// - Returns: Composited pixel buffer
    /// - Throws: CompositorError if composition fails
    func composite(_ frames: [String: SourcedFrame]) throws -> CVPixelBuffer
}

// MARK: - Errors

/// Errors that can occur during frame composition
public enum CompositorError: Error {
    case invalidFrameCount(expected: Int, got: Int)
    case missingSource(String)
    case compositionFailed(Error)
    case bufferAllocationFailed
}

// MARK: - Helper Extension for PiP

/// Extension to support legacy PiP compositor interface
@available(macOS 12.3, *)
extension FrameCompositor {
    /// Composite screen and webcam buffers for PiP mode
    /// - Parameters:
    ///   - screenBuffer: The main screen buffer
    ///   - webcamBuffer: The webcam buffer to overlay
    /// - Returns: Composited buffer with webcam overlay
    /// - Throws: CompositorError if composition fails
    public func compositePiP(screenBuffer: CVPixelBuffer, webcamBuffer: CVPixelBuffer) throws -> CVPixelBuffer {
        // Create frames dictionary with standard PiP source IDs
        let frames: [String: SourcedFrame] = [
            "screen": SourcedFrame(buffer: screenBuffer, sourceId: "screen", timestamp: .zero, sequenceNumber: 0),
            "webcam": SourcedFrame(buffer: webcamBuffer, sourceId: "webcam", timestamp: .zero, sequenceNumber: 0)
        ]
        
        return try composite(frames)
    }
}
