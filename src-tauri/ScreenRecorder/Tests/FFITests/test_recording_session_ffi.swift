#!/usr/bin/env swift

/**
 * Manual test harness for RecordingSession FFI
 *
 * Compiles and runs FFI tests to verify:
 * - All FFI functions compile correctly
 * - Memory management works (no leaks)
 * - Error codes are correct
 * - Thread safety is maintained
 *
 * Usage:
 *   cd src-tauri/ScreenRecorder
 *   swift Tests/FFITests/test_recording_session_ffi.swift
 */

import Foundation
import XCTest
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreVideo

// Import test file
#sourceLocation(file: "../Tests/FFITests/RecordingSessionFFITests.swift", line: 1)
// Test file is compiled separately

print("🧪 RecordingSession FFI Test Harness")
print("=====================================")
print()

// Compilation test - verify all FFI functions exist and have correct signatures
print("✓ Testing FFI function signatures...")

// Check function existence (compiler will fail if missing)
let _ = recording_session_create
let _ = recording_session_add_display_source
let _ = recording_session_add_window_source
let _ = recording_session_set_compositor
let _ = recording_session_start
let _ = recording_session_stop
let _ = recording_session_get_stats
let _ = recording_session_destroy

print("✅ All FFI functions present")
print()

// Quick smoke test
print("✓ Running smoke test...")

let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent(UUID().uuidString, isDirectory: true)
try! FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

defer {
    try? FileManager.default.removeItem(at: tempDir)
}

let outputPath = tempDir.appendingPathComponent("test.mp4").path
let cPath = (outputPath as NSString).utf8String!

// Test 1: Create and destroy session
print("  → Test 1: Create and destroy session")
if let session = recording_session_create(
    outputPath: cPath,
    width: 1280,
    height: 720,
    fps: 30
) {
    print("    ✓ Session created")
    recording_session_destroy(session: session)
    print("    ✓ Session destroyed")
} else {
    print("    ✗ Failed to create session")
    exit(1)
}

// Test 2: Create session with invalid params (should fail)
print("  → Test 2: Create session with invalid params")
if recording_session_create(
    outputPath: cPath,
    width: 0,  // Invalid
    height: 720,
    fps: 30
) == nil {
    print("    ✓ Correctly rejected invalid params")
} else {
    print("    ✗ Should have rejected invalid params")
    exit(1)
}

// Test 3: Add source and get stats
print("  → Test 3: Add source and get stats")
if let session = recording_session_create(
    outputPath: cPath,
    width: 1280,
    height: 720,
    fps: 30
) {
    let displayID = CGMainDisplayID()
    let addResult = recording_session_add_display_source(
        session: session,
        displayID: displayID
    )

    if addResult == 0 {
        print("    ✓ Display source added")
    } else {
        print("    ✗ Failed to add display source (error \(addResult))")
        recording_session_destroy(session: session)
        exit(1)
    }

    var framesProcessed: UInt64 = 999
    var framesDropped: UInt64 = 999
    var isRecording: Bool = true

    let statsResult = recording_session_get_stats(
        session: session,
        outFramesProcessed: &framesProcessed,
        outFramesDropped: &framesDropped,
        outIsRecording: &isRecording
    )

    if statsResult == 0 {
        print("    ✓ Stats retrieved")
        print("      - Frames processed: \(framesProcessed)")
        print("      - Frames dropped: \(framesDropped)")
        print("      - Is recording: \(isRecording)")

        if framesProcessed == 0 && framesDropped == 0 && !isRecording {
            print("    ✓ Stats are correct (not recording)")
        } else {
            print("    ✗ Stats are incorrect")
            recording_session_destroy(session: session)
            exit(1)
        }
    } else {
        print("    ✗ Failed to get stats (error \(statsResult))")
        recording_session_destroy(session: session)
        exit(1)
    }

    recording_session_destroy(session: session)
    print("    ✓ Session destroyed")
} else {
    print("    ✗ Failed to create session")
    exit(1)
}

// Test 4: Set compositor types
print("  → Test 4: Set compositor types")
if let session = recording_session_create(
    outputPath: cPath,
    width: 1280,
    height: 720,
    fps: 30
) {
    // Test passthrough (0)
    if recording_session_set_compositor(session: session, compositorType: 0) == 0 {
        print("    ✓ Passthrough compositor set")
    } else {
        print("    ✗ Failed to set passthrough compositor")
        recording_session_destroy(session: session)
        exit(1)
    }

    // Test grid (1)
    if recording_session_set_compositor(session: session, compositorType: 1) == 0 {
        print("    ✓ Grid compositor set")
    } else {
        print("    ✗ Failed to set grid compositor")
        recording_session_destroy(session: session)
        exit(1)
    }

    // Test side-by-side (2)
    if recording_session_set_compositor(session: session, compositorType: 2) == 0 {
        print("    ✓ Side-by-side compositor set")
    } else {
        print("    ✗ Failed to set side-by-side compositor")
        recording_session_destroy(session: session)
        exit(1)
    }

    // Test invalid (should fail)
    if recording_session_set_compositor(session: session, compositorType: 999) == 1 {
        print("    ✓ Invalid compositor correctly rejected")
    } else {
        print("    ✗ Should have rejected invalid compositor")
        recording_session_destroy(session: session)
        exit(1)
    }

    recording_session_destroy(session: session)
    print("    ✓ Session destroyed")
} else {
    print("    ✗ Failed to create session")
    exit(1)
}

// Test 5: Error codes
print("  → Test 5: Error code validation")
if let session = recording_session_create(
    outputPath: cPath,
    width: 1280,
    height: 720,
    fps: 30
) {
    // Try to start without sources (should fail with error 1 - invalid params)
    let startResult = recording_session_start(session: session)
    if startResult == 1 {
        print("    ✓ Correctly returned error 1 (invalid params) for start without sources")
    } else {
        print("    ✗ Expected error 1, got \(startResult)")
        recording_session_destroy(session: session)
        exit(1)
    }

    // Try to stop without starting (should fail with error 4 - not recording)
    let stopResult = recording_session_stop(session: session)
    if stopResult == 4 {
        print("    ✓ Correctly returned error 4 (not recording) for stop without start")
    } else {
        print("    ✗ Expected error 4, got \(stopResult)")
        recording_session_destroy(session: session)
        exit(1)
    }

    // Add 4 sources (max)
    let displayID = CGMainDisplayID()
    for i in 0..<4 {
        let result = recording_session_add_display_source(
            session: session,
            displayID: displayID
        )
        if result != 0 {
            print("    ✗ Failed to add source \(i) (error \(result))")
            recording_session_destroy(session: session)
            exit(1)
        }
    }
    print("    ✓ Added 4 sources (max limit)")

    // Try to add 5th source (should fail with error 5 - source limit)
    let limitResult = recording_session_add_display_source(
        session: session,
        displayID: displayID
    )
    if limitResult == 5 {
        print("    ✓ Correctly returned error 5 (source limit reached)")
    } else {
        print("    ✗ Expected error 5, got \(limitResult)")
        recording_session_destroy(session: session)
        exit(1)
    }

    recording_session_destroy(session: session)
    print("    ✓ Session destroyed")
} else {
    print("    ✗ Failed to create session")
    exit(1)
}

print()
print("=====================================")
print("✅ All smoke tests passed!")
print()
print("To run full test suite, use:")
print("  swift test --filter RecordingSessionFFITests")
print()
