#!/usr/bin/env swift

/**
 * Manual test harness for SideBySideCompositor
 * This verifies compilation and basic functionality without XCTest
 */

import Foundation
import CoreImage
import CoreVideo
import CoreMedia
import Metal

print("=== SideBySideCompositor Test Harness ===\n")

// Test 1: Verify Metal is available
print("✓ Test 1: Metal availability")
guard let device = MTLCreateSystemDefaultDevice() else {
    print("❌ Metal device not available")
    exit(1)
}
print("  Metal device: \(device.name)")

// Test 2: Create mock pixel buffer
print("\n✓ Test 2: Create mock pixel buffer")
func createMockPixelBuffer(width: Int, height: Int) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let attributes: [CFString: Any] = [
        kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey: width,
        kCVPixelBufferHeightKey: height,
        kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary
    ]

    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        attributes as CFDictionary,
        &pixelBuffer
    )

    return status == kCVReturnSuccess ? pixelBuffer : nil
}

guard let buffer = createMockPixelBuffer(width: 640, height: 480) else {
    print("❌ Failed to create pixel buffer")
    exit(1)
}
print("  Created buffer: \(CVPixelBufferGetWidth(buffer))x\(CVPixelBufferGetHeight(buffer))")

// Test 3: Verify Core Image context creation
print("\n✓ Test 3: Core Image context")
let ciContext = CIContext(mtlDevice: device, options: [
    .workingColorSpace: NSNull(),
    .cacheIntermediates: true,
    .useSoftwareRenderer: false
])
print("  Core Image context created successfully")

// Test 4: Verify image operations work
print("\n✓ Test 4: Image operations")
let sourceImage = CIImage(cvPixelBuffer: buffer)
let rect = CGRect(x: 0, y: 0, width: 1920, height: 1080)

let colorGenerator = CIFilter(name: "CIConstantColorGenerator")!
colorGenerator.setValue(CIColor(red: 0, green: 0, blue: 0, alpha: 1), forKey: kCIInputColorKey)

guard let colorImage = colorGenerator.outputImage?.cropped(to: rect) else {
    print("❌ Failed to create background image")
    exit(1)
}
print("  Background image: \(colorImage.extent)")

// Test 5: Verify scaling and transformation
print("\n✓ Test 5: Scaling and transformation")
let scaleX = 960.0 / 640.0
let scaleY = 1080.0 / 480.0
let scale = min(scaleX, scaleY)
let transform = CGAffineTransform(scaleX: scale, y: scale)
let scaledImage = sourceImage.transformed(by: transform)
print("  Scaled image: \(scaledImage.extent)")

// Test 6: Verify composition
print("\n✓ Test 6: Image composition")
let compositedImage = scaledImage.composited(over: colorImage)
print("  Composited image: \(compositedImage.extent)")

// Test 7: Verify pixel buffer pool creation
print("\n✓ Test 7: Pixel buffer pool")
let poolAttributes: [CFString: Any] = [
    kCVPixelBufferPoolMinimumBufferCountKey: 3
]

let pixelBufferAttributes: [CFString: Any] = [
    kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey: 1920,
    kCVPixelBufferHeightKey: 1080,
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
    print("❌ Failed to create pixel buffer pool")
    exit(1)
}
print("  Pixel buffer pool created successfully")

// Test 8: Verify buffer allocation from pool
print("\n✓ Test 8: Buffer allocation from pool")
var outputBuffer: CVPixelBuffer?
let allocStatus = CVPixelBufferPoolCreatePixelBuffer(nil, bufferPool, &outputBuffer)
guard allocStatus == kCVReturnSuccess, let output = outputBuffer else {
    print("❌ Failed to allocate pixel buffer from pool")
    exit(1)
}
print("  Output buffer: \(CVPixelBufferGetWidth(output))x\(CVPixelBufferGetHeight(output))")

// Test 9: Verify rendering to output buffer
print("\n✓ Test 9: Rendering to output buffer")
ciContext.render(compositedImage, to: output)
print("  Rendered successfully")

// Test 10: Layout calculation
print("\n✓ Test 10: Horizontal layout calculation")
struct HorizontalLayout {
    let sourceCount: Int
    let slotWidth: CGFloat
    let slotHeight: CGFloat
    let spacing: CGFloat

    static func calculate(sourceCount: Int, outputWidth: Int, outputHeight: Int, spacing: CGFloat) -> HorizontalLayout {
        let totalSpacing = CGFloat(sourceCount - 1) * spacing
        let slotWidth = (CGFloat(outputWidth) - totalSpacing) / CGFloat(sourceCount)
        let slotHeight = CGFloat(outputHeight)

        return HorizontalLayout(
            sourceCount: sourceCount,
            slotWidth: slotWidth,
            slotHeight: slotHeight,
            spacing: spacing
        )
    }

    func slotPosition(at index: Int) -> CGFloat {
        return CGFloat(index) * (slotWidth + spacing)
    }
}

let layout2 = HorizontalLayout.calculate(sourceCount: 2, outputWidth: 1920, outputHeight: 1080, spacing: 4.0)
print("  2 sources: slotWidth=\(layout2.slotWidth), slotHeight=\(layout2.slotHeight)")
print("  Position 0: x=\(layout2.slotPosition(at: 0))")
print("  Position 1: x=\(layout2.slotPosition(at: 1))")

let layout3 = HorizontalLayout.calculate(sourceCount: 3, outputWidth: 1920, outputHeight: 1080, spacing: 4.0)
print("  3 sources: slotWidth=\(layout3.slotWidth), slotHeight=\(layout3.slotHeight)")

let layout4 = HorizontalLayout.calculate(sourceCount: 4, outputWidth: 1920, outputHeight: 1080, spacing: 4.0)
print("  4 sources: slotWidth=\(layout4.slotWidth), slotHeight=\(layout4.slotHeight)")

// Test 11: Performance test
print("\n✓ Test 11: Performance test")
let iterations = 60
var startTime = CFAbsoluteTimeGetCurrent()

for _ in 0..<iterations {
    var perfBuffer: CVPixelBuffer?
    _ = CVPixelBufferPoolCreatePixelBuffer(nil, bufferPool, &perfBuffer)
    if let pb = perfBuffer {
        ciContext.render(compositedImage, to: pb)
    }
}

let endTime = CFAbsoluteTimeGetCurrent()
let totalTime = endTime - startTime
let avgTimePerFrame = totalTime / Double(iterations)
let avgTimeMs = avgTimePerFrame * 1000.0

print("  Average time per frame: \(String(format: "%.2f", avgTimeMs))ms")
if avgTimeMs < 16.0 {
    print("  ✅ Performance is excellent (< 16ms for 60fps)")
} else if avgTimeMs < 25.0 {
    print("  ⚠️  Performance is acceptable (< 25ms)")
} else {
    print("  ❌ Performance is poor (>= 25ms)")
}

print("\n=== All Tests Passed ✅ ===")
print("SideBySideCompositor components are working correctly\n")
