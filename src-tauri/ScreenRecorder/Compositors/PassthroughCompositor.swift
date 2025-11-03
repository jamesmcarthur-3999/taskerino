/**
 * PassthroughCompositor - Single-source compositor (no actual compositing)
 *
 * Implements FrameCompositor protocol for single-source recording scenarios.
 * Simply passes through the single source's frame without modification.
 *
 * Use case: When recording from a single source (one display or one window).
 *
 * This is a minimal implementation for Task 2.8. Full implementation in Task 2.3.
 *
 * Requirements: macOS 12.3+
 */

import Foundation
import CoreVideo
import CoreMedia

/// Passthrough compositor for single-source recording
@available(macOS 12.3, *)
public class PassthroughCompositor: FrameCompositor {
    public init() {
        print("✅ [PassthroughCompositor] Initialized")
    }

    public func composite(_ frames: [String: SourcedFrame]) throws -> CVPixelBuffer {
        guard let frame = frames.values.first else {
            throw CompositorError.invalidFrameCount(expected: 1, got: 0)
        }

        // Simply return the single frame's buffer
        return frame.buffer
    }
}
