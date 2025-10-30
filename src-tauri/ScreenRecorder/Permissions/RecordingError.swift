import Foundation

/// Error codes for FFI communication with Rust
/// These codes allow Rust to distinguish between different failure modes
public enum RecordingErrorCode: Int32 {
    case success = 0
    case permissionDenied = 1000
    case deviceNotFound = 1001
    case deviceInUse = 1002
    case configurationInvalid = 1003
    case alreadyStarted = 1004
    case notStarted = 1005
    case timeout = 1006
    case unknown = 9999
}

/// Error context passed to Rust via FFI
/// Contains error code, human-readable message, and retry capability
public struct FFIErrorContext {
    public let code: Int32
    public let message: String
    public let canRetry: Bool

    public init(code: RecordingErrorCode, message: String, canRetry: Bool = false) {
        self.code = code.rawValue
        self.message = message
        self.canRetry = canRetry
    }
}

// MARK: - Thread-Safe Error Storage

/// Global error storage with thread-safe access
/// Multiple threads can call FFI functions, so we need locking
private var lastFFIError: FFIErrorContext?
private let errorLock = NSLock()

/// Store the last error that occurred in any FFI call
/// Thread-safe: Multiple threads can call FFI functions concurrently
public func setLastFFIError(_ error: FFIErrorContext) {
    errorLock.lock()
    defer { errorLock.unlock() }
    lastFFIError = error
}

/// Retrieve the last error that occurred
/// Thread-safe: Returns nil if no error has occurred
public func getLastFFIError() -> FFIErrorContext? {
    errorLock.lock()
    defer { errorLock.unlock() }
    return lastFFIError
}

/// Clear the stored error
/// Call this at the start of each FFI function to reset error state
public func clearLastFFIError() {
    errorLock.lock()
    defer { errorLock.unlock() }
    lastFFIError = nil
}

// MARK: - FFI Accessors (called from Rust)

/// Get the error code from the last FFI operation
/// Returns 0 (success) if no error has occurred
@_cdecl("screen_recorder_get_last_error_code")
public func screen_recorder_get_last_error_code() -> Int32 {
    return getLastFFIError()?.code ?? 0
}

/// Get the error message from the last FFI operation
/// Returns NULL if no error has occurred
/// IMPORTANT: Rust must free the returned string with screen_recorder_free_string()
@_cdecl("screen_recorder_get_last_error_message")
public func screen_recorder_get_last_error_message() -> UnsafePointer<CChar>? {
    guard let message = getLastFFIError()?.message else { return nil }
    // strdup allocates memory that Rust must free
    // Cast UnsafeMutablePointer to UnsafePointer
    return UnsafePointer(strdup(message))
}

/// Check if the last error is retryable
/// Returns false if no error has occurred
@_cdecl("screen_recorder_get_last_error_can_retry")
public func screen_recorder_get_last_error_can_retry() -> Bool {
    return getLastFFIError()?.canRetry ?? false
}

/// Clear the last error state
/// Should be called after Rust has processed the error
@_cdecl("screen_recorder_clear_last_error")
public func screen_recorder_clear_last_error() {
    clearLastFFIError()
}

/// Free a string returned by screen_recorder_get_last_error_message()
/// IMPORTANT: Rust must call this to avoid memory leaks
@_cdecl("screen_recorder_free_string")
public func screen_recorder_free_string(_ ptr: UnsafeMutablePointer<CChar>?) {
    if let ptr = ptr {
        free(ptr)
    }
}

// MARK: - Error Mapping Helpers

/// Map RecordingSourceError to FFI error context
public func mapRecordingSourceError(_ error: RecordingSourceError) -> FFIErrorContext {
    switch error {
    case .permissionDenied:
        return FFIErrorContext(
            code: .permissionDenied,
            message: "Screen Recording permission denied. Enable in System Settings > Privacy & Security > Screen Recording",
            canRetry: true
        )
    case .alreadyCapturing:
        return FFIErrorContext(
            code: .alreadyStarted,
            message: "Recording already in progress",
            canRetry: false
        )
    case .notCapturing:
        return FFIErrorContext(
            code: .notStarted,
            message: "No recording in progress",
            canRetry: false
        )
    case .notConfigured:
        return FFIErrorContext(
            code: .configurationInvalid,
            message: "Recording source not configured",
            canRetry: false
        )
    case .configurationFailed(let reason):
        return FFIErrorContext(
            code: .configurationInvalid,
            message: "Configuration failed: \(reason)",
            canRetry: true
        )
    case .captureFailed(let innerError):
        return FFIErrorContext(
            code: .deviceNotFound,
            message: "Capture failed: \(innerError.localizedDescription)",
            canRetry: true
        )
    }
}

/// Map AudioCaptureError to FFI error context
public func mapAudioCaptureError(_ error: AudioCaptureError) -> FFIErrorContext {
    switch error {
    case .displayNotFound:
        return FFIErrorContext(
            code: .deviceNotFound,
            message: "No display found for system audio capture",
            canRetry: true
        )
    case .alreadyCapturing:
        return FFIErrorContext(
            code: .alreadyStarted,
            message: "System audio already capturing",
            canRetry: false
        )
    case .notCapturing:
        return FFIErrorContext(
            code: .notStarted,
            message: "System audio not capturing",
            canRetry: false
        )
    case .conversionFailed:
        return FFIErrorContext(
            code: .unknown,
            message: "Audio format conversion failed",
            canRetry: true
        )
    }
}

/// Map generic NSError to FFI error context
/// Handles special cases like ScreenCaptureKit permission errors
public func mapNSError(_ error: NSError) -> FFIErrorContext {
    // Check for ScreenCaptureKit permission denial (-3801)
    if error.domain == "com.apple.screencapturekit" && error.code == -3801 {
        return FFIErrorContext(
            code: .permissionDenied,
            message: "Screen Recording permission required. Enable in System Settings > Privacy & Security > Screen Recording",
            canRetry: true
        )
    }

    // Generic error
    return FFIErrorContext(
        code: .unknown,
        message: error.localizedDescription,
        canRetry: false
    )
}
