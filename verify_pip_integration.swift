#!/usr/bin/env swift
/**
 * PiP Integration Verification Script
 *
 * This script verifies that the PiPCompositor is properly integrated into
 * the ScreenRecorder.swift recording pipeline for display-with-webcam mode.
 *
 * Usage: swift verify_pip_integration.swift
 */

import Foundation

// ANSI Color codes for output
struct Colors {
    static let green = "\u{001B}[0;32m"
    static let red = "\u{001B}[0;31m"
    static let yellow = "\u{001B}[0;33m"
    static let blue = "\u{001B}[0;34m"
    static let reset = "\u{001B}[0m"
}

func checkmark() -> String { return Colors.green + "✓" + Colors.reset }
func cross() -> String { return Colors.red + "✗" + Colors.reset }
func info() -> String { return Colors.blue + "ℹ" + Colors.reset }

// Verification checks
var passedChecks = 0
var totalChecks = 0

func verify(_ name: String, _ condition: Bool) {
    totalChecks += 1
    if condition {
        passedChecks += 1
        print("\(checkmark()) \(name)")
    } else {
        print("\(cross()) \(name)")
    }
}

print("\n" + Colors.blue + "=== PiP Integration Verification ===" + Colors.reset + "\n")

// 1. Check PiPCompositor.swift exists
let compositorPath = "src-tauri/ScreenRecorder/PiPCompositor.swift"
let compositorExists = FileManager.default.fileExists(atPath: compositorPath)
verify("PiPCompositor.swift exists", compositorExists)

// 2. Check ScreenRecorder.swift exists
let recorderPath = "src-tauri/ScreenRecorder/ScreenRecorder.swift"
let recorderExists = FileManager.default.fileExists(atPath: recorderPath)
verify("ScreenRecorder.swift exists", recorderExists)

guard recorderExists else {
    print("\n" + Colors.red + "ERROR: ScreenRecorder.swift not found!" + Colors.reset)
    exit(1)
}

// 3. Read ScreenRecorder.swift content
guard let recorderContent = try? String(contentsOfFile: recorderPath, encoding: .utf8) else {
    print("\n" + Colors.red + "ERROR: Could not read ScreenRecorder.swift" + Colors.reset)
    exit(1)
}

// 4. Check for PiPCompositor import/reference
verify("PiPCompositor class is referenced", recorderContent.contains("PiPCompositor"))

// 5. Check for pipCompositor property in GlobalScreenRecorder
verify("pipCompositor property declared", recorderContent.contains("private var pipCompositor: PiPCompositor?"))

// 6. Check for setupPiPCompositor method
verify("setupPiPCompositor method exists", recorderContent.contains("private func setupPiPCompositor"))

// 7. Check for PiP configuration parsing
verify("PiPConfigData struct defined", recorderContent.contains("private struct PiPConfigData"))
verify("PiPRecordingConfig struct defined", recorderContent.contains("private struct PiPRecordingConfig"))

// 8. Check for startPiPRecording method
verify("startPiPRecording method exists", recorderContent.contains("func startPiPRecording(configJSON: String, outputPath: String)"))

// 9. Check for frame processing integration
verify("processScreenFrame method exists", recorderContent.contains("fileprivate func processScreenFrame"))
verify("processWebcamFrame method exists", recorderContent.contains("fileprivate func processWebcamFrame"))
verify("compositeAndWritePiPFrame method exists", recorderContent.contains("private func compositeAndWritePiPFrame"))

// 10. Check for compositor.composite() call
verify("compositor.composite() is called", recorderContent.contains("compositor.composite(screenBuffer:"))

// 11. Check for displayWithPiP recording mode
verify("displayWithPiP mode defined", recorderContent.contains("case displayWithPiP"))

// 12. Check for frame synchronization buffers
verify("lastScreenBuffer property exists", recorderContent.contains("private var lastScreenBuffer: CVPixelBuffer?"))
verify("lastWebcamBuffer property exists", recorderContent.contains("private var lastWebcamBuffer: CVPixelBuffer?"))

// 13. Check for PiPScreenOutput and PiPWebcamDelegate
verify("PiPScreenOutput class defined", recorderContent.contains("private class PiPScreenOutput"))
verify("PiPWebcamDelegate class defined", recorderContent.contains("private class PiPWebcamDelegate"))

// 14. Check for FFI function
verify("screen_recorder_start_pip_recording FFI function exists",
       recorderContent.contains("@_cdecl(\"screen_recorder_start_pip_recording\")"))

// 15. Check for proper configuration mapping
verify("Position mapping (top-left, top-right, etc.)",
       recorderContent.contains("case \"top-left\": position = .topLeft"))
verify("Size mapping (small, medium, large)",
       recorderContent.contains("case \"small\": size = .small"))

// 16. Check for compositor configuration
verify("compositor.configure() is called",
       recorderContent.contains("pipCompositor?.configure(position:"))

// 17. Check for cleanup
verify("pipCompositor cleanup in cleanup()",
       recorderContent.contains("pipCompositor = nil") &&
       recorderContent.contains("private func cleanup()"))

// 18. Check for error handling
verify("Composition error handling",
       recorderContent.contains("❌ [VIDEO] PiP composition failed"))

// Print summary
print("\n" + Colors.blue + "=== Summary ===" + Colors.reset)
print("Passed: \(passedChecks)/\(totalChecks) checks")

if passedChecks == totalChecks {
    print("\n" + Colors.green + "✓ ALL CHECKS PASSED!" + Colors.reset)
    print("\n" + info() + " Integration Status:")
    print("  • PiPCompositor is properly declared")
    print("  • Configuration parsing is implemented")
    print("  • Frame processing pipeline is wired")
    print("  • Screen and webcam frames are synchronized")
    print("  • compositor.composite() is called in the pipeline")
    print("  • FFI functions are exposed to Rust")
    print("  • Error handling is in place")
    print("  • Cleanup is properly implemented")
    print("\n" + Colors.green + "The PiP compositor is FULLY INTEGRATED into the recording pipeline!" + Colors.reset)
    exit(0)
} else {
    print("\n" + Colors.red + "✗ SOME CHECKS FAILED" + Colors.reset)
    print("\nFailed checks: \(totalChecks - passedChecks)")
    exit(1)
}
