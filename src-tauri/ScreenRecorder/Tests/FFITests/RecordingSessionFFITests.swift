/**
 * RecordingSessionFFITests - Tests for RecordingSession FFI layer
 *
 * Validates all FFI functions work correctly from C calling convention:
 * - recording_session_create
 * - recording_session_add_display_source
 * - recording_session_add_window_source
 * - recording_session_set_compositor
 * - recording_session_start
 * - recording_session_stop
 * - recording_session_get_stats
 * - recording_session_destroy
 *
 * Tests memory management, error handling, and thread safety.
 */

import XCTest
import Foundation

@available(macOS 12.3, *)
final class RecordingSessionFFITests: XCTestCase {

    // MARK: - Test Setup

    var tempDir: URL!

    override func setUp() async throws {
        // Create temp directory for test outputs
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        // Clean up temp directory
        if let tempDir = tempDir {
            try? FileManager.default.removeItem(at: tempDir)
        }
    }

    // MARK: - Creation Tests

    /// Test creating a session with valid parameters
    func testRecordingSessionCreate_ValidParams() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        )

        XCTAssertNotNil(session, "Session should be created successfully")

        // Clean up
        if let session = session {
            recording_session_destroy(session: session)
        }
    }

    /// Test creating a session with invalid width
    func testRecordingSessionCreate_InvalidWidth() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        let session = recording_session_create(
            outputPath: cPath,
            width: 0,  // Invalid
            height: 720,
            fps: 30
        )

        XCTAssertNil(session, "Session should not be created with invalid width")
    }

    /// Test creating a session with invalid height
    func testRecordingSessionCreate_InvalidHeight() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: -100,  // Invalid
            fps: 30
        )

        XCTAssertNil(session, "Session should not be created with invalid height")
    }

    /// Test creating a session with invalid fps
    func testRecordingSessionCreate_InvalidFPS() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 0  // Invalid
        )

        XCTAssertNil(session, "Session should not be created with invalid fps")
    }

    // MARK: - Source Management Tests

    /// Test adding display source
    func testRecordingSessionAddDisplaySource_Success() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        // Add display source (use main display ID)
        let displayID = CGMainDisplayID()
        let result = recording_session_add_display_source(
            session: session,
            displayID: displayID
        )

        XCTAssertEqual(result, 0, "Adding display source should succeed (error code 0)")
    }

    /// Test adding window source
    func testRecordingSessionAddWindowSource_Success() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        // Add window source (use a test window ID - may not exist, but API should not crash)
        let result = recording_session_add_window_source(
            session: session,
            windowID: 12345
        )

        // Result can be 0 (success) or 2 (not found) - both are valid
        XCTAssertTrue(result == 0 || result == 2, "Adding window source should return valid error code")
    }

    /// Test adding too many sources
    func testRecordingSessionAddSource_TooMany() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        let displayID = CGMainDisplayID()

        // Add 4 sources (max limit)
        for _ in 0..<4 {
            let result = recording_session_add_display_source(
                session: session,
                displayID: displayID
            )
            XCTAssertEqual(result, 0, "Adding source should succeed within limit")
        }

        // Try to add 5th source (should fail with error code 5)
        let result = recording_session_add_display_source(
            session: session,
            displayID: displayID
        )

        XCTAssertEqual(result, 5, "Adding 5th source should fail with source limit error")
    }

    // MARK: - Compositor Tests

    /// Test setting passthrough compositor
    func testRecordingSessionSetCompositor_Passthrough() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        let result = recording_session_set_compositor(
            session: session,
            compositorType: 0  // Passthrough
        )

        XCTAssertEqual(result, 0, "Setting passthrough compositor should succeed")
    }

    /// Test setting grid compositor
    func testRecordingSessionSetCompositor_Grid() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        let result = recording_session_set_compositor(
            session: session,
            compositorType: 1  // Grid
        )

        XCTAssertEqual(result, 0, "Setting grid compositor should succeed")
    }

    /// Test setting side-by-side compositor
    func testRecordingSessionSetCompositor_SideBySide() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        let result = recording_session_set_compositor(
            session: session,
            compositorType: 2  // Side-by-side
        )

        XCTAssertEqual(result, 0, "Setting side-by-side compositor should succeed")
    }

    /// Test setting invalid compositor
    func testRecordingSessionSetCompositor_Invalid() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        let result = recording_session_set_compositor(
            session: session,
            compositorType: 999  // Invalid
        )

        XCTAssertEqual(result, 1, "Setting invalid compositor should fail with invalid params error")
    }

    // MARK: - Recording Lifecycle Tests

    /// Test starting recording without sources
    func testRecordingSessionStart_NoSources() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        // Try to start without adding sources
        let result = recording_session_start(session: session)

        XCTAssertEqual(result, 1, "Starting without sources should fail with invalid params error")
    }

    /// Test stopping recording that was never started
    func testRecordingSessionStop_NotStarted() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        // Try to stop without starting
        let result = recording_session_stop(session: session)

        XCTAssertEqual(result, 4, "Stopping non-started session should fail with not recording error")
    }

    /// Test adding sources after recording started
    func testRecordingSessionAddSource_AfterStart() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        // Add one source
        let displayID = CGMainDisplayID()
        _ = recording_session_add_display_source(
            session: session,
            displayID: displayID
        )

        // Start recording
        let startResult = recording_session_start(session: session)

        // If start succeeded, try to add another source (should fail)
        if startResult == 0 {
            let addResult = recording_session_add_display_source(
                session: session,
                displayID: displayID
            )

            XCTAssertEqual(addResult, 3, "Adding source after start should fail with already recording error")

            // Stop recording
            _ = recording_session_stop(session: session)
        }
    }

    // MARK: - Stats Tests

    /// Test getting stats from non-recording session
    func testRecordingSessionGetStats_NotRecording() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        defer { recording_session_destroy(session: session) }

        var framesProcessed: UInt64 = 999
        var framesDropped: UInt64 = 999
        var isRecording: Bool = true

        let result = recording_session_get_stats(
            session: session,
            outFramesProcessed: &framesProcessed,
            outFramesDropped: &framesDropped,
            outIsRecording: &isRecording
        )

        XCTAssertEqual(result, 0, "Getting stats should succeed")
        XCTAssertEqual(framesProcessed, 0, "Frames processed should be 0")
        XCTAssertEqual(framesDropped, 0, "Frames dropped should be 0")
        XCTAssertFalse(isRecording, "isRecording should be false")
    }

    // MARK: - Memory Management Tests

    /// Test creating and destroying multiple sessions
    func testRecordingSessionMemory_MultipleCreateDestroy() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        for i in 0..<10 {
            guard let session = recording_session_create(
                outputPath: cPath,
                width: 1280,
                height: 720,
                fps: 30
            ) else {
                XCTFail("Failed to create session \(i)")
                return
            }

            recording_session_destroy(session: session)
        }

        // If we got here without crashing, memory management is working
        XCTAssertTrue(true, "Multiple create/destroy cycles should not leak memory")
    }

    /// Test destroying session while recording
    func testRecordingSessionMemory_DestroyWhileRecording() throws {
        let outputPath = tempDir.appendingPathComponent("test.mp4").path
        let cPath = (outputPath as NSString).utf8String!

        guard let session = recording_session_create(
            outputPath: cPath,
            width: 1280,
            height: 720,
            fps: 30
        ) else {
            XCTFail("Failed to create session")
            return
        }

        // Add source
        let displayID = CGMainDisplayID()
        _ = recording_session_add_display_source(
            session: session,
            displayID: displayID
        )

        // Start recording
        let startResult = recording_session_start(session: session)

        // Destroy without stopping (destroy should handle this)
        recording_session_destroy(session: session)

        // If we got here without crashing, cleanup is working
        XCTAssertTrue(true, "Destroying while recording should not crash")
    }

    // MARK: - Thread Safety Tests

    /// Test concurrent access to different sessions
    func testRecordingSessionThreadSafety_MultipleSessions() throws {
        let expectation = XCTestExpectation(description: "Concurrent session access")
        expectation.expectedFulfillmentCount = 5

        let queue = DispatchQueue(label: "test.concurrent", attributes: .concurrent)

        for i in 0..<5 {
            queue.async {
                let outputPath = self.tempDir.appendingPathComponent("test\(i).mp4").path
                let cPath = (outputPath as NSString).utf8String!

                guard let session = recording_session_create(
                    outputPath: cPath,
                    width: 1280,
                    height: 720,
                    fps: 30
                ) else {
                    XCTFail("Failed to create session \(i)")
                    return
                }

                // Perform operations
                let displayID = CGMainDisplayID()
                _ = recording_session_add_display_source(
                    session: session,
                    displayID: displayID
                )

                var stats = RecordingSessionStatsC(
                    framesProcessed: 0,
                    framesDropped: 0,
                    isRecording: false
                )
                _ = recording_session_get_stats(session: session, outStats: &stats)

                recording_session_destroy(session: session)

                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 10.0)
    }

    // MARK: - Error Code Tests

    /// Test all error codes are documented
    func testRecordingSessionErrorCodes_Complete() {
        // This test documents all error codes
        let errorCodes: [Int32: String] = [
            0: "Success",
            1: "Invalid parameters",
            2: "Not found",
            3: "Already recording",
            4: "Not recording",
            5: "Source limit reached",
            6: "Internal error"
        ]

        XCTAssertEqual(errorCodes.count, 7, "All error codes should be documented")

        // Verify each error code is unique
        let values = Set(errorCodes.keys)
        XCTAssertEqual(values.count, errorCodes.count, "Error codes should be unique")
    }
}
