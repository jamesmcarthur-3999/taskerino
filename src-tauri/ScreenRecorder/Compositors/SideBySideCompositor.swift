/**
 * SideBySideCompositor - Horizontal Window Layout Compositor
 *
 * GPU-accelerated composition of multiple video sources placed horizontally side-by-side.
 * Uses Core Image with Metal backend for 60fps real-time processing.
 *
 * Features:
 * - Horizontal layout (left to right)
 * - Aspect ratio preservation for each source
 * - Metal-accelerated composition
 * - Support for 2-4 sources
 * - Handle unequal source counts gracefully
 * - Memory-efficient pixel buffer pools
 *
 * Performance: 60fps on M1 at 1080p output with 4x 720p sources
 * Memory usage: <100MB during active composition
 */

import Foundation
import CoreImage
import CoreVideo
import Metal
import AVFoundation

// MARK: - Configuration

/// Configuration for side-by-side layout
public struct SideBySideConfiguration {
    /// Output frame width
    public let outputWidth: Int

    /// Output frame height
    public let outputHeight: Int

    /// Spacing between sources in pixels
    public let spacing: CGFloat

    /// Background color for letterboxing/pillarboxing
    public let backgroundColor: CIColor

    public init(
        outputWidth: Int,
        outputHeight: Int,
        spacing: CGFloat = 4.0,
        backgroundColor: CIColor = CIColor(red: 0, green: 0, blue: 0, alpha: 1)
    ) {
        self.outputWidth = outputWidth
        self.outputHeight = outputHeight
        self.spacing = spacing
        self.backgroundColor = backgroundColor
    }
}

// MARK: - Layout Calculator

/// Calculate horizontal layout dimensions and positions
private struct HorizontalLayout {
    let sourceCount: Int
    let slotWidth: CGFloat
    let slotHeight: CGFloat
    let totalWidth: CGFloat
    let totalHeight: CGFloat
    let spacing: CGFloat

    /// Calculate horizontal layout for given number of sources
    static func calculate(
        sourceCount: Int,
        outputWidth: Int,
        outputHeight: Int,
        spacing: CGFloat
    ) -> HorizontalLayout {
        guard sourceCount > 0 else {
            return HorizontalLayout(
                sourceCount: 0,
                slotWidth: 0,
                slotHeight: 0,
                totalWidth: 0,
                totalHeight: 0,
                spacing: 0
            )
        }

        // Calculate total spacing
        let totalSpacing = CGFloat(sourceCount - 1) * spacing

        // Calculate width per source
        let slotWidth = (CGFloat(outputWidth) - totalSpacing) / CGFloat(sourceCount)
        let slotHeight = CGFloat(outputHeight)

        return HorizontalLayout(
            sourceCount: sourceCount,
            slotWidth: slotWidth,
            slotHeight: slotHeight,
            totalWidth: CGFloat(outputWidth),
            totalHeight: CGFloat(outputHeight),
            spacing: spacing
        )
    }

    /// Get X position for slot at given index
    func slotPosition(at index: Int) -> CGFloat {
        return CGFloat(index) * (slotWidth + spacing)
    }
}

// MARK: - SideBySideCompositor Class

/// GPU-accelerated side-by-side compositor for multiple video sources
@available(macOS 12.3, *)
public class SideBySideCompositor: FrameCompositor {
    // Core Image context with Metal backend
    private let ciContext: CIContext

    // Metal device for GPU acceleration
    private let metalDevice: MTLDevice

    // Configuration
    private let config: SideBySideConfiguration

    // Pixel buffer pool for output
    private var outputBufferPool: CVPixelBufferPool?

    // Performance metrics
    private var frameCount: UInt64 = 0
    private var lastLogTime: Date = Date()
    private var compositionTimes: [TimeInterval] = []

    /// Initialize compositor with output dimensions
    public init(outputWidth: Int, outputHeight: Int) throws {
        // Get default Metal device
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw SideBySideCompositorError.metalNotAvailable
        }
        self.metalDevice = device

        // Create Metal-backed Core Image context
        let context = CIContext(mtlDevice: device, options: [
            .workingColorSpace: NSNull(),
            .cacheIntermediates: true,
            .useSoftwareRenderer: false
        ])
        self.ciContext = context

        // Store configuration
        self.config = SideBySideConfiguration(
            outputWidth: outputWidth,
            outputHeight: outputHeight
        )

        print("✅ [SIDE-BY-SIDE] Compositor initialized: \(outputWidth)x\(outputHeight)")
    }

    /// Composite frames from multiple sources into a horizontal layout
    /// - Parameter frames: Dictionary of frames by source ID
    /// - Returns: Composited pixel buffer
    /// - Throws: CompositorError if composition fails
    public func composite(_ frames: [String: SourcedFrame]) throws -> CVPixelBuffer {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Validate source count
        guard !frames.isEmpty else {
            throw CompositorError.invalidFrameCount(expected: 1, got: 0)
        }

        guard frames.count >= 2 && frames.count <= 4 else {
            throw SideBySideCompositorError.invalidSourceCount(count: frames.count)
        }

        // Ensure output buffer pool exists
        if outputBufferPool == nil {
            outputBufferPool = try createPixelBufferPool(
                width: config.outputWidth,
                height: config.outputHeight
            )
        }

        // Calculate horizontal layout
        let layout = HorizontalLayout.calculate(
            sourceCount: frames.count,
            outputWidth: config.outputWidth,
            outputHeight: config.outputHeight,
            spacing: config.spacing
        )

        // Create background image
        var compositedImage = createBackgroundImage(
            width: config.outputWidth,
            height: config.outputHeight,
            color: config.backgroundColor
        )

        // Sort frames by sourceId for consistent ordering
        let sortedFrames = frames.sorted { $0.key < $1.key }

        // Composite each frame horizontally
        for (index, (_, sourcedFrame)) in sortedFrames.enumerated() {
            let slotImage = try createSlotImage(
                from: sourcedFrame.buffer,
                targetWidth: layout.slotWidth,
                targetHeight: layout.slotHeight
            )

            // Calculate X position
            let xPosition = layout.slotPosition(at: index)

            // Translate slot to position and composite over background
            let translatedSlot = slotImage.transformed(by: CGAffineTransform(
                translationX: xPosition,
                y: 0
            ))

            compositedImage = translatedSlot.composited(over: compositedImage)
        }

        // Render to output buffer
        guard let outputPool = outputBufferPool else {
            throw CompositorError.bufferAllocationFailed
        }

        var outputBuffer: CVPixelBuffer?
        let status = CVPixelBufferPoolCreatePixelBuffer(nil, outputPool, &outputBuffer)
        guard status == kCVReturnSuccess, let output = outputBuffer else {
            throw CompositorError.bufferAllocationFailed
        }

        // Render composited image to output buffer
        ciContext.render(compositedImage, to: output)

        // Track performance
        let compositionTime = CFAbsoluteTimeGetCurrent() - startTime
        trackPerformance(compositionTime: compositionTime)

        frameCount += 1
        logPerformanceMetrics()

        return output
    }

    /// Create a background image with solid color
    private func createBackgroundImage(width: Int, height: Int, color: CIColor) -> CIImage {
        let rect = CGRect(x: 0, y: 0, width: width, height: height)

        let colorGenerator = CIFilter(name: "CIConstantColorGenerator")!
        colorGenerator.setValue(color, forKey: kCIInputColorKey)

        guard let colorImage = colorGenerator.outputImage?.cropped(to: rect) else {
            return CIImage.empty()
        }

        return colorImage
    }

    /// Create a slot image from a source buffer, scaled to fit the slot dimensions while preserving aspect ratio
    private func createSlotImage(
        from buffer: CVPixelBuffer,
        targetWidth: CGFloat,
        targetHeight: CGFloat
    ) throws -> CIImage {
        let sourceImage = CIImage(cvPixelBuffer: buffer)
        let sourceSize = sourceImage.extent.size

        // Calculate scale to fit target size while maintaining aspect ratio
        let scaleX = targetWidth / sourceSize.width
        let scaleY = targetHeight / sourceSize.height
        let scale = min(scaleX, scaleY)

        // Scale transform
        let transform = CGAffineTransform(scaleX: scale, y: scale)
        let scaledImage = sourceImage.transformed(by: transform)

        // Calculate centering offset
        let scaledSize = scaledImage.extent.size
        let xOffset = (targetWidth - scaledSize.width) / 2.0
        let yOffset = (targetHeight - scaledSize.height) / 2.0

        // Create a background for this slot
        let slotBackground = createBackgroundImage(
            width: Int(targetWidth),
            height: Int(targetHeight),
            color: config.backgroundColor
        )

        // Center the scaled image over the slot background
        let centeredImage = scaledImage.transformed(by: CGAffineTransform(
            translationX: xOffset,
            y: yOffset
        ))

        return centeredImage.composited(over: slotBackground)
    }

    /// Create pixel buffer pool for efficient memory management
    private func createPixelBufferPool(width: Int, height: Int) throws -> CVPixelBufferPool {
        let poolAttributes: [CFString: Any] = [
            kCVPixelBufferPoolMinimumBufferCountKey: 3
        ]

        let pixelBufferAttributes: [CFString: Any] = [
            kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey: width,
            kCVPixelBufferHeightKey: height,
            kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary
        ]

        var pool: CVPixelBufferPool?
        let status = CVPixelBufferPoolCreate(
            kCFAllocatorDefault,
            poolAttributes as CFDictionary,
            pixelBufferAttributes as CFDictionary,
            &pool
        )

        guard status == kCVReturnSuccess, let bufferPool = pool else {
            throw SideBySideCompositorError.bufferPoolCreationFailed
        }

        return bufferPool
    }

    /// Track performance metrics
    private func trackPerformance(compositionTime: TimeInterval) {
        compositionTimes.append(compositionTime)

        // Keep last 100 samples
        if compositionTimes.count > 100 {
            compositionTimes.removeFirst()
        }
    }

    /// Get average composition time
    public func getAverageCompositionTime() -> TimeInterval {
        guard !compositionTimes.isEmpty else { return 0 }
        return compositionTimes.reduce(0, +) / Double(compositionTimes.count)
    }

    /// Log performance metrics periodically
    private func logPerformanceMetrics() {
        let now = Date()
        let elapsed = now.timeIntervalSince(lastLogTime)

        if elapsed >= 5.0 {
            let fps = Double(frameCount) / elapsed
            let avgTime = getAverageCompositionTime()
            let avgTimeMs = avgTime * 1000.0

            print("📊 [SIDE-BY-SIDE] Performance: \(String(format: "%.1f", fps)) fps, avg composition: \(String(format: "%.2f", avgTimeMs))ms")

            frameCount = 0
            lastLogTime = now
        }
    }
}

// MARK: - Errors

/// Side-by-side compositor errors
public enum SideBySideCompositorError: Error {
    case metalNotAvailable
    case bufferPoolCreationFailed
    case bufferAllocationFailed
    case invalidSourceCount(count: Int)
    case scalingFailed

    public var description: String {
        switch self {
        case .metalNotAvailable:
            return "Metal device not available"
        case .bufferPoolCreationFailed:
            return "Failed to create pixel buffer pool"
        case .bufferAllocationFailed:
            return "Failed to allocate pixel buffer"
        case .invalidSourceCount(let count):
            return "Invalid source count: \(count) (must be 2-4 for side-by-side layout)"
        case .scalingFailed:
            return "Failed to scale source image"
        }
    }
}
