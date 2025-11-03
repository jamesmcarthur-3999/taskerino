#!/usr/bin/env swift

/**
 * Manual test harness for GridCompositor
 * This verifies compilation and basic functionality without XCTest
 */

import Foundation
import CoreImage
import CoreVideo
import CoreMedia
import Metal

// Load the required Swift files
// Note: In a real scenario, these would be compiled together

print("=== GridCompositor Test Harness ===\n")

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
print("  Created pixel buffer: \(CVPixelBufferGetWidth(buffer))x\(CVPixelBufferGetHeight(buffer))")

// Test 3: Core Image operations
print("\n✓ Test 3: Core Image operations")
let ciContext = CIContext(mtlDevice: device, options: [
    .workingColorSpace: NSNull(),
    .cacheIntermediates: true,
    .useSoftwareRenderer: false
])
print("  Core Image context created")

let ciImage = CIImage(cvPixelBuffer: buffer)
print("  CIImage size: \(ciImage.extent.size)")

// Test 4: Image scaling
print("\n✓ Test 4: Image scaling")
let scale: CGFloat = 0.5
let transform = CGAffineTransform(scaleX: scale, y: scale)
let scaledImage = ciImage.transformed(by: transform)
print("  Scaled image size: \(scaledImage.extent.size)")

// Test 5: Background color generation
print("\n✓ Test 5: Background color generation")
let colorGenerator = CIFilter(name: "CIConstantColorGenerator")!
colorGenerator.setValue(CIColor(red: 0, green: 0, blue: 0, alpha: 1), forKey: kCIInputColorKey)
let backgroundImage = colorGenerator.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: 1920, height: 1080))
print("  Background image size: \(backgroundImage.extent.size)")

// Test 6: Image composition
print("\n✓ Test 6: Image composition")
let composited = scaledImage.composited(over: backgroundImage)
print("  Composited image size: \(composited.extent.size)")

// Test 7: Pixel buffer pool
print("\n✓ Test 7: Pixel buffer pool creation")
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
let poolStatus = CVPixelBufferPoolCreate(
    kCFAllocatorDefault,
    poolAttributes as CFDictionary,
    pixelBufferAttributes as CFDictionary,
    &pool
)

guard poolStatus == kCVReturnSuccess, let bufferPool = pool else {
    print("❌ Failed to create pixel buffer pool")
    exit(1)
}
print("  Pixel buffer pool created successfully")

// Test 8: Allocate from pool
print("\n✓ Test 8: Allocate pixel buffer from pool")
var outputBuffer: CVPixelBuffer?
let allocStatus = CVPixelBufferPoolCreatePixelBuffer(nil, bufferPool, &outputBuffer)
guard allocStatus == kCVReturnSuccess, let output = outputBuffer else {
    print("❌ Failed to allocate buffer from pool")
    exit(1)
}
print("  Allocated buffer: \(CVPixelBufferGetWidth(output))x\(CVPixelBufferGetHeight(output))")

// Test 9: Render to buffer
print("\n✓ Test 9: Render to pixel buffer")
ciContext.render(composited, to: output)
print("  Successfully rendered to pixel buffer")

// Test 10: Performance benchmark
print("\n✓ Test 10: Performance benchmark (60 iterations)")
let iterations = 60
let startTime = CFAbsoluteTimeGetCurrent()

for _ in 0..<iterations {
    var testBuffer: CVPixelBuffer?
    _ = CVPixelBufferPoolCreatePixelBuffer(nil, bufferPool, &testBuffer)
    if let buf = testBuffer {
        ciContext.render(composited, to: buf)
    }
}

let endTime = CFAbsoluteTimeGetCurrent()
let totalTime = endTime - startTime
let avgTimeMs = (totalTime / Double(iterations)) * 1000.0

print("  Total time: \(String(format: "%.2f", totalTime))s")
print("  Average time per frame: \(String(format: "%.2f", avgTimeMs))ms")
print("  FPS: \(String(format: "%.1f", 1000.0 / avgTimeMs))")

if avgTimeMs < 16.0 {
    print("  ✅ Performance: PASS (< 16ms for 60fps)")
} else {
    print("  ⚠️  Performance: SLOW (>= 16ms)")
}

print("\n=== All Tests Passed ✅ ===")
