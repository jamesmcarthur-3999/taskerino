/**
 * Audio Capture Module
 *
 * **Phase 3 Implementation**: This module now uses AudioGraph internally while
 * maintaining 100% backward compatibility with the existing API.
 *
 * Implements real-time audio recording with:
 * - Dual-source audio capture (microphone + system audio)
 * - Real-time mixing with configurable balance
 * - Sample rate alignment and resampling
 * - Configurable chunk buffering (matches screenshot interval)
 * - WAV encoding with hound
 * - Base64 transmission to frontend
 * - State management (recording/paused/stopped)
 * - Hot-swap device switching during recording
 *
 * # Architecture
 *
 * The implementation uses AudioGraph for composable audio processing:
 * ```
 * MicrophoneSource ──┐
 *                     ├─→ Mixer → BufferSink
 * SystemAudioSource ─┘
 * ```
 *
 * # Migration Note
 *
 * For new Rust code, consider using `AudioGraph` directly for more flexibility.
 * See `docs/sessions-rewrite/AUDIO_MIGRATION_GUIDE.md` for details.
 */

use cpal::traits::{DeviceTrait, HostTrait};
use hound::{WavSpec, WavWriter};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use std::collections::HashMap;
use chrono::Utc;

#[cfg(target_os = "macos")]
use crate::macos_audio::is_system_audio_available;

// Import RecordingError and related types from Phase 1
use crate::permissions::{RecordingError, DeviceType};

// Import audio graph components
use crate::audio::graph::{AudioGraph, NodeId};
use crate::audio::graph::traits::AudioSource;  // For format() method
use crate::audio::sources::{MicrophoneSource, SystemAudioSource};
use crate::audio::processors::{Mixer, MixMode, SilenceDetector, Resampler};
use crate::audio::sinks::BufferSink as GraphBufferSink;

// ============================================================================
// Audio Configuration Constants
// ============================================================================

/// Standard sample rate for all audio processing (Hz)
///
/// Set to 16kHz which is optimal for Whisper transcription.
/// All audio sources are resampled to this rate to ensure consistency.
///
/// Future: Can be made configurable via settings if higher quality is needed.
const STANDARD_SAMPLE_RATE: u32 = 16000;

// ============================================================================
// Types
// ============================================================================

/// Audio recording state
#[derive(Debug, Clone, PartialEq)]
pub enum RecordingState {
    Stopped,
    Recording,
    Paused,
}

/// Audio device configuration for dual-source recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceConfig {
    /// Enable microphone capture
    pub enable_microphone: bool,
    /// Enable system audio capture
    pub enable_system_audio: bool,
    /// Mix balance: 0 = 100% mic, 100 = 100% system, 50 = equal mix
    pub balance: u8,
    /// Optional specific microphone device name
    pub microphone_device_name: Option<String>,
    /// Optional specific system audio device name
    pub system_audio_device_name: Option<String>,
    /// Enable Voice Activity Detection
    /// When true, silent segments are detected and skipped for transcription
    /// When false, all audio is transcribed (useful for testing)
    /// Default: false
    pub vad_enabled: Option<bool>,
    /// Voice Activity Detection threshold in decibels (-50 to -20)
    /// Lower values are more sensitive, higher values filter more aggressively
    /// Default: -45
    pub vad_threshold: Option<f32>,
}

impl Default for AudioDeviceConfig {
    fn default() -> Self {
        Self {
            enable_microphone: true,
            enable_system_audio: false,
            balance: 50,
            microphone_device_name: None,
            system_audio_device_name: None,
            vad_enabled: Some(false), // Default to disabled for testing
            vad_threshold: Some(-45.0), // Default to -45dB (less aggressive, catches quieter speech)
        }
    }
}

/// Real-time audio level data for UI visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioLevelData {
    /// Device type: "microphone" or "system-audio"
    pub device_type: String,
    /// Device ID (for future multi-device support)
    pub device_id: Option<String>,
    /// RMS (Root Mean Square) level: 0.0-1.0
    pub rms: f32,
    /// Peak level: 0.0-1.0
    pub peak: f32,
    /// Level as percentage: 0-100
    pub level_percent: u8,
}

/// Audio health status tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioHealthStatus {
    /// Microphone buffer usage percentage (0-100)
    pub mic_buffer_usage_percent: u64,
    /// System audio buffer usage percentage (0-100)
    pub system_buffer_usage_percent: u64,
    /// Number of audio chunks dropped due to overflow
    pub dropped_chunks: u64,
    /// Number of buffer overrun events
    pub overrun_count: u64,
    /// Last activity timestamp (milliseconds since epoch)
    pub last_activity_ms: u64,
    /// Current recording state
    pub state: String,
}

impl AudioHealthStatus {
    fn new() -> Self {
        Self {
            mic_buffer_usage_percent: 0,
            system_buffer_usage_percent: 0,
            dropped_chunks: 0,
            overrun_count: 0,
            last_activity_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            state: "stopped".to_string(),
        }
    }
}

/// Audio mixing buffer for dual-source recording (kept for API compatibility)
pub struct AudioMixBuffer {
    /// Mix balance: 0-100 (0 = all mic, 100 = all system)
    balance: Arc<Mutex<u8>>,
}

impl AudioMixBuffer {
    /// Create new mixing buffer with specified balance
    pub fn new(balance: u8) -> Self {
        Self {
            balance: Arc::new(Mutex::new(balance.min(100))),
        }
    }

    /// Update mix balance (0-100)
    pub fn set_balance(&self, balance: u8) -> Result<(), String> {
        *self
            .balance
            .lock()
            .map_err(|e| format!("[AUDIO] Failed to lock balance: {}", e))? = balance.min(100);
        println!("[AUDIO] Updated mix balance to {}", balance);
        Ok(())
    }

    /// Get current balance
    pub fn get_balance(&self) -> u8 {
        self.balance.lock().map(|b| *b).unwrap_or(50)
    }
}

/// Global audio recorder state with dual-source support
///
/// **Phase 3 Implementation**: This struct now uses AudioGraph internally while
/// maintaining 100% backward compatibility with the existing API. All public
/// methods work exactly as before, but the implementation uses the new graph-based
/// architecture.
///
/// # Migration Note
///
/// For new Rust code, consider using `AudioGraph` directly for more flexibility.
/// See `docs/sessions-rewrite/AUDIO_MIGRATION_GUIDE.md` for details.
pub struct AudioRecorder {
    /// Current recording state
    state: Arc<Mutex<RecordingState>>,
    /// Audio graph (new backend)
    graph: Arc<Mutex<Option<AudioGraph>>>,
    /// Node IDs for graph manipulation
    source_ids: Arc<Mutex<HashMap<String, NodeId>>>,
    processor_ids: Arc<Mutex<HashMap<String, NodeId>>>,
    sink_ids: Arc<Mutex<HashMap<String, NodeId>>>,
    /// Buffer data reference (Arc from BufferSink internals for shared access)
    buffer_data: Arc<Mutex<Option<Arc<Mutex<Vec<crate::audio::graph::traits::AudioBuffer>>>>>>,
    /// Device configuration
    device_config: Arc<Mutex<AudioDeviceConfig>>,
    /// Session ID
    session_id: Arc<Mutex<Option<String>>>,
    /// App handle for event emission
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    /// Last time we emitted mic level event (throttling)
    last_mic_level_time: Arc<Mutex<Instant>>,
    /// Last time we emitted system audio level event (throttling)
    last_system_level_time: Arc<Mutex<Instant>>,
    /// Dropped chunks counter
    dropped_chunks: Arc<Mutex<u64>>,
    /// Last time we emitted health status
    last_health_emit_time: Arc<Mutex<Instant>>,
    /// Processing thread handle
    processor_thread: Arc<Mutex<Option<std::thread::JoinHandle<()>>>>,
    /// Signal to stop processing thread
    stop_signal: Arc<Mutex<bool>>,
    /// Audio chunk duration in seconds (configurable per session)
    chunk_duration_secs: Arc<Mutex<u64>>,
}

// SAFETY: AudioRecorder uses Mutex for all internal state synchronization,
// making it safe to share across threads
unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    /// Create a new AudioRecorder instance
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RecordingState::Stopped)),
            graph: Arc::new(Mutex::new(None)),
            source_ids: Arc::new(Mutex::new(HashMap::new())),
            processor_ids: Arc::new(Mutex::new(HashMap::new())),
            sink_ids: Arc::new(Mutex::new(HashMap::new())),
            buffer_data: Arc::new(Mutex::new(None)),
            device_config: Arc::new(Mutex::new(AudioDeviceConfig::default())),
            session_id: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            last_mic_level_time: Arc::new(Mutex::new(Instant::now())),
            last_system_level_time: Arc::new(Mutex::new(Instant::now())),
            dropped_chunks: Arc::new(Mutex::new(0)),
            last_health_emit_time: Arc::new(Mutex::new(Instant::now())),
            processor_thread: Arc::new(Mutex::new(None)),
            stop_signal: Arc::new(Mutex::new(false)),
            chunk_duration_secs: Arc::new(Mutex::new(10)), // Default 10 seconds
        }
    }

    /// Initialize the audio recorder with app handle
    pub fn init(&self, app_handle: AppHandle) -> Result<(), String> {
        *self
            .app_handle
            .lock()
            .map_err(|e| format!("Failed to lock app_handle: {}", e))? = Some(app_handle);
        Ok(())
    }

    /// Build audio graph based on configuration
    ///
    /// Creates a graph with the appropriate sources, mixer, and sink based on
    /// the device configuration.
    fn build_graph(&self, config: &AudioDeviceConfig) -> Result<AudioGraph, RecordingError> {
        let mut graph = AudioGraph::new();
        let mut source_ids = HashMap::new();
        let mut processor_ids = HashMap::new();
        let mut sink_ids = HashMap::new();

        println!(
            "[AUDIO] Building graph - mic: {}, system: {}, balance: {}, standard_rate: {} Hz",
            config.enable_microphone, config.enable_system_audio, config.balance, STANDARD_SAMPLE_RATE
        );

        // Validate configuration
        if !config.enable_microphone && !config.enable_system_audio {
            return Err(RecordingError::InvalidConfiguration {
                field: "audio_sources".to_string(),
                reason: "At least one audio source must be enabled".to_string(),
            });
        }

        // Track detected sample rate for resampler configuration
        let mut detected_rate: Option<u32> = None;

        // Add microphone source if enabled
        if config.enable_microphone {
            let mic_source = MicrophoneSource::new(config.microphone_device_name.clone())
                .map_err(|e| RecordingError::DeviceNotFound {
                    device_type: DeviceType::Microphone,
                    device_id: config.microphone_device_name.clone(),
                    details: Some(e.to_string()),  // Include actual error for debugging
                })?;

            // Get actual device sample rate
            let mic_rate = mic_source.format().sample_rate;

            // Validate rate (rubato supports 16kHz - 192kHz)
            if mic_rate < 16000 || mic_rate > 192000 {
                return Err(RecordingError::InvalidConfiguration {
                    field: "microphone_sample_rate".to_string(),
                    reason: format!("Unsupported device sample rate: {} Hz (must be 16-192 kHz)", mic_rate),
                });
            }

            detected_rate = Some(mic_rate);
            println!("[AUDIO] Microphone sample rate detected: {} Hz", mic_rate);

            let mic_id = graph.add_source(Box::new(mic_source));
            source_ids.insert("microphone".to_string(), mic_id);
            println!("[AUDIO] Added microphone source");
        }

        // Add system audio source if enabled (macOS only)
        #[cfg(target_os = "macos")]
        if config.enable_system_audio {
            if !is_system_audio_available() {
                println!("[AUDIO] System audio not available, gracefully degrading");
            } else {
                match SystemAudioSource::new() {
                    Ok(sys_source) => {
                        let sys_id = graph.add_source(Box::new(sys_source));
                        source_ids.insert("system-audio".to_string(), sys_id);
                        println!("[AUDIO] Added system audio source (always 16kHz from Swift bridge)");
                    }
                    Err(e) => {
                        println!("[AUDIO] Failed to create system audio source: {}", e);
                    }
                }
            }
        }

        // Handle mixed-rate sources (microphone + system audio with different rates)
        // Track final node IDs after any pre-mixer resampling
        let mut mic_final_id = source_ids.get("microphone").copied();
        let sys_final_id = source_ids.get("system-audio").copied();

        if let (Some(mic_id), Some(_sys_id)) = (mic_final_id, sys_final_id) {
            // Both sources enabled - check if rates match
            let mic_rate = detected_rate.unwrap(); // We know mic rate from above
            let sys_rate = 16000; // System audio is always 16kHz from Swift

            if mic_rate != sys_rate {
                // Different rates - add resampler for microphone BEFORE mixer
                println!("[AUDIO] Mixed-rate sources detected: mic={}Hz, system=16kHz", mic_rate);
                println!("[AUDIO] Adding pre-mixer resampler for microphone: {}Hz → 16kHz", mic_rate);

                let mic_resampler = Resampler::new(mic_rate, 16000, 1, 256)
                    .map_err(|e| RecordingError::InvalidConfiguration {
                        field: "mic_pre_resampler".to_string(),
                        reason: format!("Failed to create mic pre-resampler: {}", e),
                    })?;

                let mic_resample_id = graph.add_processor(Box::new(mic_resampler));
                processor_ids.insert("mic_pre_resampler".to_string(), mic_resample_id);

                // Connect mic → resampler
                graph.connect(mic_id, mic_resample_id)
                    .map_err(|e| RecordingError::SystemError {
                        source: crate::permissions::ErrorSource::Cpal,
                        message: format!("[AUDIO] Failed to connect mic to pre-resampler: {}", e),
                        is_recoverable: false,
                    })?;

                // Update mic_final_id to point to resampler output
                mic_final_id = Some(mic_resample_id);

                // Update detected_rate to 16kHz for final resampler (both sources now 16kHz)
                detected_rate = Some(16000);

                println!("[AUDIO] Pre-mixer resampling configured successfully");
            }
        }

        // If we have multiple sources, add a mixer
        let final_node_id = if source_ids.len() > 1 {
            // Create mixer for dual-source
            let mut mixer = Mixer::new(source_ids.len(), MixMode::Weighted)
                .map_err(|e| RecordingError::InvalidConfiguration {
                    field: "audio_mixer".to_string(),
                    reason: format!("Failed to create mixer: {}", e),
                })?;

            // Convert 0-100 balance to per-input weights
            // balance: 0 = 100% mic, 100 = 100% system, 50 = equal
            let mic_weight = (100 - config.balance) as f32 / 100.0;
            let sys_weight = config.balance as f32 / 100.0;

            // Set balance BEFORE adding to graph
            // Microphone is input 0, system audio is input 1
            mixer
                .set_balance(0, mic_weight)
                .map_err(|e| RecordingError::InvalidConfiguration {
                    field: "mic_balance".to_string(),
                    reason: format!("Failed to set mic balance: {}", e),
                })?;

            if source_ids.contains_key("system-audio") {
                mixer
                    .set_balance(1, sys_weight)
                    .map_err(|e| RecordingError::InvalidConfiguration {
                        field: "sys_balance".to_string(),
                        reason: format!("Failed to set sys balance: {}", e),
                    })?;
            }

            println!("[AUDIO] Created mixer with weights - mic: {}, sys: {}", mic_weight, sys_weight);

            // Add mixer to graph
            let mixer_id = graph.add_processor(Box::new(mixer));
            processor_ids.insert("mixer".to_string(), mixer_id);

            // Connect sources to mixer (using final IDs which may be post-resampler)
            if let Some(mic_id) = mic_final_id {
                graph
                    .connect(mic_id, mixer_id)
                    .map_err(|e| RecordingError::SystemError {
                        source: crate::permissions::ErrorSource::Cpal,
                        message: format!("[AUDIO] Failed to connect mic to mixer: {}", e),
                        is_recoverable: false,
                    })?;
            }

            if let Some(sys_id) = sys_final_id {
                graph
                    .connect(sys_id, mixer_id)
                    .map_err(|e| RecordingError::SystemError {
                        source: crate::permissions::ErrorSource::Cpal,
                        message: format!("[AUDIO] Failed to connect sys to mixer: {}", e),
                        is_recoverable: false,
                    })?;
            }

            mixer_id
        } else {
            // Single source - use mic_final_id or sys_final_id
            mic_final_id.or(sys_final_id)
                .ok_or_else(|| RecordingError::Internal {
                    message: "[AUDIO] No sources available".to_string(),
                })?
        };

        // Add resampler to normalize all audio to standard sample rate (16kHz)
        // This ensures consistent audio for Whisper transcription regardless of source sample rates

        // Determine input rate for final resampler
        let input_rate = detected_rate.unwrap_or(16000); // System audio only = 16kHz

        // Only create resampler if input rate != output rate
        let final_processor_id = if input_rate != STANDARD_SAMPLE_RATE {
            println!("[AUDIO] Adding resampler: {}Hz → {}Hz", input_rate, STANDARD_SAMPLE_RATE);

            let resampler = Resampler::new(
                input_rate,               // Use ACTUAL detected rate (not hardcoded 48kHz)
                STANDARD_SAMPLE_RATE,     // Output: 16kHz standard
                1,                        // Mono
                256                       // Chunk size
            ).map_err(|e| RecordingError::InvalidConfiguration {
                field: "resampler".to_string(),
                reason: format!("Failed to create resampler ({}Hz → 16kHz): {}", input_rate, e),
            })?;

            let resampler_id = graph.add_processor(Box::new(resampler));
            processor_ids.insert("resampler".to_string(), resampler_id);

            // Connect source/mixer → resampler
            graph
                .connect(final_node_id, resampler_id)
                .map_err(|e| RecordingError::SystemError {
                    source: crate::permissions::ErrorSource::Cpal,
                    message: format!("[AUDIO] Failed to connect to resampler: {}", e),
                    is_recoverable: false,
                })?;

            println!("[AUDIO] Resampler added and connected");
            resampler_id
        } else {
            // No resampling needed - input is already 16kHz (system audio only)
            println!("[AUDIO] No resampling needed - input is already {}Hz", input_rate);
            final_node_id
        };

        // VAD (Voice Activity Detection) - Conditional based on config
        // When enabled: Uses configurable threshold with 500ms minimum silence duration
        // When disabled: All audio is transcribed (no silence detection)
        // Audio is always saved regardless of VAD state - only transcription is affected
        let vad_processor_id = if config.vad_enabled.unwrap_or(false) {
            // VAD ENABLED - Add silence detector
            let vad_threshold = config.vad_threshold.unwrap_or(-45.0); // Default to -45dB if not specified
            let vad = SilenceDetector::new(vad_threshold, 500.0, 16000);
            let vad_id = graph.add_processor(Box::new(vad));
            processor_ids.insert("vad".to_string(), vad_id);
            println!("[AUDIO] VAD ENABLED - Added SilenceDetector (threshold: {}dB, min_silence: 500ms)", vad_threshold);

            // Connect final_processor (resampler or source) → VAD
            graph
                .connect(final_processor_id, vad_id)
                .map_err(|e| RecordingError::SystemError {
                    source: crate::permissions::ErrorSource::Cpal,
                    message: format!("[AUDIO] Failed to connect to VAD: {}", e),
                    is_recoverable: false,
                })?;

            vad_id
        } else {
            // VAD DISABLED - Skip silence detection
            println!("[AUDIO] VAD DISABLED - All audio will be transcribed");
            final_processor_id
        };

        // Create buffer sink and get shared buffer Arc
        // Massive capacity to eliminate any hard-coded limit issues
        let buffer_sink = GraphBufferSink::new(20000);
        let buffer_arc = buffer_sink.get_buffer_arc(); // Get shared access before moving
        let sink_id = graph.add_sink(Box::new(buffer_sink));
        sink_ids.insert("buffer".to_string(), sink_id);

        // Connect final processor → sink
        // If VAD enabled: resampler → VAD → sink (silence marked)
        // If VAD disabled: resampler → sink (all audio transcribed)
        graph
            .connect(vad_processor_id, sink_id)
            .map_err(|e| RecordingError::SystemError {
                source: crate::permissions::ErrorSource::Cpal,
                message: format!("[AUDIO] Failed to connect to sink: {}", e),
                is_recoverable: false,
            })?;

        println!("[AUDIO] Graph constructed successfully");

        // Store node IDs and buffer reference
        *self
            .source_ids
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock source_ids: {}", e),
            })? = source_ids;
        *self
            .processor_ids
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock processor_ids: {}", e),
            })? = processor_ids;
        *self
            .sink_ids
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock sink_ids: {}", e),
            })? = sink_ids;
        *self
            .buffer_data
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock buffer_data: {}", e),
            })? = Some(buffer_arc);

        Ok(graph)
    }

    /// Start recording audio with default configuration
    /// Audio is chunked at configurable intervals (default: 10 seconds)
    pub fn start_recording(
        &self,
        session_id: String,
        chunk_duration_secs: u64,
    ) -> Result<(), RecordingError> {
        self.start_recording_with_config(
            session_id,
            AudioDeviceConfig::default(),
            chunk_duration_secs,
        )
    }

    /// Start recording audio with device configuration
    /// Audio chunking interval is configurable (default: 10s for consistent transcription delivery)
    pub fn start_recording_with_config(
        &self,
        session_id: String,
        config: AudioDeviceConfig,
        chunk_duration_secs: u64,
    ) -> Result<(), RecordingError> {
        println!(
            "[AUDIO] Starting recording for session: {} (chunk: {}s, mic: {}, system: {}, balance: {})",
            session_id, chunk_duration_secs, config.enable_microphone, config.enable_system_audio, config.balance
        );

        // Validate configuration
        if !config.enable_microphone && !config.enable_system_audio {
            return Err(RecordingError::InvalidConfiguration {
                field: "audio_sources".to_string(),
                reason: "At least one audio source must be enabled".to_string(),
            });
        }

        // Check if already recording
        let current_state = self
            .state
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock state: {}", e),
            })?
            .clone();

        if current_state == RecordingState::Recording {
            println!("[AUDIO] Already recording, switching configuration");
            return self.switch_recording_config(config);
        }

        // Store configuration
        *self
            .session_id
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock session_id: {}", e),
            })? = Some(session_id.clone());
        *self
            .device_config
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock device_config: {}", e),
            })? = config.clone();
        *self
            .chunk_duration_secs
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock chunk_duration_secs: {}", e),
            })? = chunk_duration_secs;

        println!("[AUDIO DEBUG] ✅ Configured chunk_duration_secs = {} seconds", chunk_duration_secs);

        // Build and start graph
        let mut graph = self.build_graph(&config)?;
        let start_result = graph
            .start()
            .map_err(|e| RecordingError::SystemError {
                source: crate::permissions::ErrorSource::Cpal,
                message: format!("[AUDIO] Failed to start graph: {}", e),
                is_recoverable: true,
            });

        // If graph start failed, emit error event before returning
        if let Err(ref error) = start_result {
            if let Ok(app_lock) = self.app_handle.lock() {
                if let Some(ref app) = *app_lock {
                    let error_payload = serde_json::json!({
                        "sessionId": session_id,
                        "errorType": "audio",
                        "errorCode": "AUDIO_START_FAILED",
                        "message": format!("{}", error),
                        "canRetry": true,
                        "timestamp": chrono::Utc::now().timestamp_millis(),
                    });

                    let _ = app.emit("recording-error", error_payload);
                }
            }
        }

        start_result?;

        // Store graph
        *self
            .graph
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock graph: {}", e),
            })? = Some(graph);

        // Update state
        *self
            .state
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock state: {}", e),
            })? = RecordingState::Recording;

        // Start processing thread
        self.start_processing_thread()?;

        println!("[AUDIO] Recording started successfully");
        Ok(())
    }

    /// Switch recording configuration during active recording (hot-swap)
    fn switch_recording_config(&self, new_config: AudioDeviceConfig) -> Result<(), RecordingError> {
        println!("[AUDIO] Hot-swapping recording configuration");

        // Stop current graph
        if let Ok(mut graph_lock) = self.graph.lock() {
            if let Some(ref mut graph) = *graph_lock {
                graph
                    .stop()
                    .map_err(|e| RecordingError::SystemError {
                        source: crate::permissions::ErrorSource::Cpal,
                        message: format!("[AUDIO] Failed to stop graph: {}", e),
                        is_recoverable: true,
                    })?;
            }
        }

        // Update configuration
        *self
            .device_config
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock device_config: {}", e),
            })? = new_config.clone();

        // Build and start new graph
        let mut new_graph = self.build_graph(&new_config)?;
        new_graph
            .start()
            .map_err(|e| RecordingError::SystemError {
                source: crate::permissions::ErrorSource::Cpal,
                message: format!("[AUDIO] Failed to start new graph: {}", e),
                is_recoverable: true,
            })?;

        // Replace graph
        *self
            .graph
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock graph: {}", e),
            })? = Some(new_graph);

        println!("[AUDIO] Configuration switched successfully");
        Ok(())
    }

    /// Start background processing thread
    ///
    /// This thread:
    /// - Processes audio through the graph
    /// - Emits audio chunks as WAV/base64
    /// - Monitors levels (100ms throttling)
    /// - Emits health status (10s intervals)
    fn start_processing_thread(&self) -> Result<(), RecordingError> {
        // Reset stop signal
        *self
            .stop_signal
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock stop_signal: {}", e),
            })? = false;

        let state = self.state.clone();
        let graph = self.graph.clone();
        let buffer_data = self.buffer_data.clone();
        let app_handle = self.app_handle.clone();
        let session_id = self.session_id.clone();
        let device_config = self.device_config.clone();
        let last_mic_level = self.last_mic_level_time.clone();
        let last_sys_level = self.last_system_level_time.clone(); // Now used for system audio level monitoring
        let last_health = self.last_health_emit_time.clone();
        let dropped_chunks = self.dropped_chunks.clone();
        let stop_signal = self.stop_signal.clone();
        let chunk_duration = self.chunk_duration_secs.clone();

        let handle = std::thread::spawn(move || {
            println!("[AUDIO] Processing thread started");
            let mut last_chunk_time = Instant::now();
            let mut last_debug_log = Instant::now();  // Throttle debug logging to once per second

            loop {
                // Check stop signal
                if let Ok(should_stop) = stop_signal.lock() {
                    if *should_stop {
                        println!("[AUDIO] Processing thread stopping");
                        break;
                    }
                }

                // Check state
                let current_state = match state.lock() {
                    Ok(s) => s.clone(),
                    Err(_) => break,
                };

                if current_state == RecordingState::Stopped {
                    break;
                }

                if current_state == RecordingState::Paused {
                    std::thread::sleep(Duration::from_millis(100));
                    continue;
                }

                // Process graph continuously (no sleep for maximum throughput)
                if let Ok(mut graph_lock) = graph.lock() {
                    if let Some(ref mut graph) = *graph_lock {
                        match graph.process_once() {
                            Ok(_processed) => {
                                // Continue processing without delay to keep up with 100Hz input rate
                            }
                            Err(e) => {
                                eprintln!("[AUDIO] Graph processing error: {}", e);

                                // Emit error event to TypeScript
                                if let Ok(app_lock) = app_handle.lock() {
                                    if let Some(ref app) = *app_lock {
                                        if let Ok(sid_lock) = session_id.lock() {
                                            if let Some(ref sid) = *sid_lock {
                                                let error_payload = serde_json::json!({
                                                    "sessionId": sid,
                                                    "errorType": "audio",
                                                    "errorCode": "AUDIO_PROCESSING_FAILED",
                                                    "message": format!("Audio processing error: {}", e),
                                                    "canRetry": false,
                                                    "timestamp": Utc::now().timestamp_millis(),
                                                });

                                                let _ = app.emit("recording-error", error_payload);
                                            }
                                        }
                                    }
                                }

                                std::thread::sleep(Duration::from_millis(100));
                            }
                        }
                    }
                }

                // Check if we have enough audio accumulated (sample-based, not time-based)
                let chunk_duration_secs = *chunk_duration.lock().unwrap_or_else(|e| {
                    eprintln!("[AUDIO] Failed to lock chunk_duration: {}", e);
                    e.into_inner()
                });

                // Check accumulated samples instead of wall-clock time
                if let Ok(data_lock) = buffer_data.lock() {
                    if let Some(ref buffer_arc) = *data_lock {
                        if let Ok(mut buffers_guard) = buffer_arc.lock() {
                            if !buffers_guard.is_empty() {
                                // Calculate actual audio duration from accumulated samples
                                let total_samples: usize = buffers_guard.iter()
                                    .map(|b| b.samples.len())
                                    .sum();
                                let audio_duration_secs = total_samples as f64 / STANDARD_SAMPLE_RATE as f64;

                                // Throttled debug logging (once per second to avoid performance impact)
                                if last_debug_log.elapsed() >= Duration::from_secs(1) {
                                    println!("[AUDIO DEBUG] 📊 Buffered: {} samples = {:.2}s (target: {}s)",
                                             total_samples, audio_duration_secs, chunk_duration_secs);
                                    last_debug_log = Instant::now();
                                }

                                // Emit chunk when we have enough AUDIO (not just elapsed time)
                                if audio_duration_secs >= chunk_duration_secs as f64 {
                                    println!("[AUDIO DEBUG] 🎵 Emitting chunk with {} buffers", buffers_guard.len());

                                    // Clone buffers for processing
                                    let buffers = buffers_guard.clone();

                                    // Clear buffers
                                    buffers_guard.clear();
                                    drop(buffers_guard); // Release lock

                                    // Combine all buffers into one
                                    let mut all_samples = Vec::new();
                                    for buffer in &buffers {
                                        all_samples.extend_from_slice(&buffer.samples);
                                    }

                                    if !all_samples.is_empty() {
                                        // Check if chunk is silent using VAD algorithm
                                        let is_silent = Self::is_chunk_silent(&all_samples);

                                        // Convert to WAV and emit (using standard sample rate)
                                        match Self::samples_to_wav_base64(&all_samples, STANDARD_SAMPLE_RATE, 1) {
                                            Ok(base64_data) => {
                                                if let Ok(app_lock) = app_handle.lock() {
                                                    if let Some(ref app) = *app_lock {
                                                        if let Ok(sid_lock) = session_id.lock() {
                                                            if let Some(ref sid) = *sid_lock {
                                                                let duration =
                                                                    all_samples.len() as f64 / STANDARD_SAMPLE_RATE as f64;

                                                                println!("[AUDIO DEBUG] 📊 Accumulated: {} samples = {:.2}s of audio",
                                                                         all_samples.len(), duration);

                                                                let payload = serde_json::json!({
                                                                    "sessionId": sid,
                                                                    "audioBase64": base64_data,
                                                                    "duration": duration,
                                                                    "isSilent": is_silent,
                                                                });

                                                                match app.emit("audio-chunk", payload) {
                                                                    Ok(_) => {
                                                                        println!(
                                                                            "[AUDIO] Emitted chunk ({:.1}s, silent={})",
                                                                            duration, is_silent
                                                                        );
                                                                    }
                                                                    Err(e) => {
                                                                        eprintln!(
                                                                            "[AUDIO] Failed to emit chunk: {}",
                                                                            e
                                                                        );
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                eprintln!("[AUDIO] Failed to encode audio: {}", e);

                                                // Emit error event to TypeScript
                                                if let Ok(app_lock) = app_handle.lock() {
                                                    if let Some(ref app) = *app_lock {
                                                        if let Ok(sid_lock) = session_id.lock() {
                                                            if let Some(ref sid) = *sid_lock {
                                                                let error_payload = serde_json::json!({
                                                                    "sessionId": sid,
                                                                    "errorType": "audio",
                                                                    "errorCode": "AUDIO_ENCODING_FAILED",
                                                                    "message": format!("Failed to encode audio: {}", e),
                                                                    "canRetry": false,
                                                                    "timestamp": Utc::now().timestamp_millis(),
                                                                });

                                                                let _ = app.emit("recording-error", error_payload);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    last_chunk_time = Instant::now();
                                }
                            }
                        }
                    }
                }

                // Emit audio levels (throttled to 100ms) - runs continuously, not just on chunks
                if let Ok(data_lock) = buffer_data.lock() {
                    if let Some(ref buffer_arc) = *data_lock {
                        if let Ok(buffers_guard) = buffer_arc.lock() {
                            if !buffers_guard.is_empty() {
                                let last_buffer = &buffers_guard[buffers_guard.len() - 1];
                                let rms = last_buffer.rms();
                                let peak = last_buffer.peak();

                                // Get current config to check what's enabled
                                if let Ok(config) = device_config.lock() {
                                    // Emit mic level (if microphone is enabled)
                                    if config.enable_microphone {
                                        if let Ok(mut last_time) = last_mic_level.lock() {
                                            if last_time.elapsed() >= Duration::from_millis(100) {
                                                if let Ok(app_lock) = app_handle.lock() {
                                                    if let Some(ref app) = *app_lock {
                                                        let level_data = AudioLevelData {
                                                            device_type: "microphone".to_string(),
                                                            device_id: None,
                                                            rms,
                                                            peak,
                                                            level_percent: (rms * 100.0).min(100.0) as u8,
                                                        };

                                                        let _ = app.emit("audio-level", level_data);
                                                    }
                                                }
                                                *last_time = Instant::now();
                                            }
                                        }
                                    }

                                    // Emit system audio level (if system audio is enabled)
                                    // NOTE: In mixed mode, both meters show the same mixed levels
                                    // This is acceptable for basic "is audio coming in?" validation
                                    if config.enable_system_audio {
                                        if let Ok(mut last_time) = last_sys_level.lock() {
                                            if last_time.elapsed() >= Duration::from_millis(100) {
                                                if let Ok(app_lock) = app_handle.lock() {
                                                    if let Some(ref app) = *app_lock {
                                                        let level_data = AudioLevelData {
                                                            device_type: "system-audio".to_string(),
                                                            device_id: None,
                                                            rms,
                                                            peak,
                                                            level_percent: (rms * 100.0).min(100.0) as u8,
                                                        };

                                                        let _ = app.emit("audio-level", level_data);
                                                    }
                                                }
                                                *last_time = Instant::now();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Emit health status (every 10 seconds)
                if let Ok(mut last_health_time) = last_health.lock() {
                    if last_health_time.elapsed() >= Duration::from_secs(10) {
                        if let Ok(app_lock) = app_handle.lock() {
                            if let Some(ref app) = *app_lock {
                                let dropped = dropped_chunks.lock().map(|d| *d).unwrap_or(0);

                                let status = AudioHealthStatus {
                                    mic_buffer_usage_percent: 0, // Graph manages buffers
                                    system_buffer_usage_percent: 0,
                                    dropped_chunks: dropped,
                                    overrun_count: 0,
                                    last_activity_ms: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_millis() as u64,
                                    state: "recording".to_string(),
                                };

                                let _ = app.emit("audio-health-status", status);
                            }
                        }
                        *last_health_time = Instant::now();
                    }
                }

                // Sleep removed - process at maximum throughput to keep up with audio input
                // Pull-based graph processing naturally waits when no data is available
            }

            println!("[AUDIO] Processing thread exiting");
        });

        *self
            .processor_thread
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock processor_thread: {}", e),
            })? = Some(handle);

        Ok(())
    }

    /// Check if audio samples are silent based on RMS energy threshold
    /// Uses the same algorithm as SilenceDetector: -40 dB threshold
    fn is_chunk_silent(samples: &[f32]) -> bool {
        if samples.is_empty() {
            return true;
        }

        // Calculate RMS (Root Mean Square)
        let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_squares / samples.len() as f32).sqrt();

        // Convert to dB (20 * log10(rms))
        let rms_db = if rms <= 0.0 {
            f32::NEG_INFINITY
        } else {
            20.0 * rms.log10()
        };

        // Threshold: -40 dB (same as VAD processor)
        const SILENCE_THRESHOLD_DB: f32 = -40.0;
        rms_db < SILENCE_THRESHOLD_DB
    }

    /// Convert audio samples to WAV format and encode as base64
    fn samples_to_wav_base64(
        samples: &[f32],
        sample_rate: u32,
        channels: u16,
    ) -> Result<String, String> {
        let mut wav_buffer = Vec::new();

        {
            let spec = WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };

            let mut writer = WavWriter::new(std::io::Cursor::new(&mut wav_buffer), spec)
                .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

            // Convert f32 samples to i16 and write
            for &sample in samples {
                let amplitude = i16::MAX as f32;
                let sample_i16 = (sample * amplitude) as i16;
                writer
                    .write_sample(sample_i16)
                    .map_err(|e| format!("Failed to write sample: {}", e))?;
            }

            writer
                .finalize()
                .map_err(|e| format!("Failed to finalize WAV: {}", e))?;
        }

        // Encode to base64
        let base64_data =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &wav_buffer);
        Ok(format!("data:audio/wav;base64,{}", base64_data))
    }

    /// Pause recording
    pub fn pause_recording(&self) -> Result<(), RecordingError> {
        println!("⏸️  [AUDIO] Pausing recording");
        *self
            .state
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("Failed to lock state: {}", e),
            })? = RecordingState::Paused;
        Ok(())
    }

    /// Resume recording
    pub fn resume_recording(&self) -> Result<(), RecordingError> {
        println!("▶️  [AUDIO] Resuming recording");
        let current_state = self
            .state
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("Failed to lock state: {}", e),
            })?
            .clone();

        if current_state == RecordingState::Stopped {
            return Err(RecordingError::SystemError {
                source: crate::permissions::ErrorSource::Cpal,
                message: "Cannot resume - recording is stopped".to_string(),
                is_recoverable: false,
            });
        }

        *self
            .state
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("Failed to lock state: {}", e),
            })? = RecordingState::Recording;
        Ok(())
    }

    /// Stop recording
    pub fn stop_recording(&self) -> Result<(), RecordingError> {
        println!("[AUDIO] Stopping recording");

        // Signal processing thread to stop
        *self
            .stop_signal
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock stop_signal: {}", e),
            })? = true;

        // Update state first
        *self
            .state
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock state: {}", e),
            })? = RecordingState::Stopped;

        // Wait for processing thread to finish
        if let Ok(mut thread_lock) = self.processor_thread.lock() {
            if let Some(handle) = thread_lock.take() {
                match handle.join() {
                    Ok(_) => println!("[AUDIO] Processing thread stopped"),
                    Err(e) => eprintln!("[AUDIO] Processing thread panicked: {:?}", e),
                }
            }
        }

        // Stop graph
        if let Ok(mut graph_lock) = self.graph.lock() {
            if let Some(ref mut graph) = *graph_lock {
                graph
                    .stop()
                    .map_err(|e| RecordingError::SystemError {
                        source: crate::permissions::ErrorSource::Cpal,
                        message: format!("[AUDIO] Failed to stop graph: {}", e),
                        is_recoverable: false,
                    })?;
            }
            *graph_lock = None;
        }

        // Clear state
        *self
            .buffer_data
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock buffer_data: {}", e),
            })? = None;

        self.source_ids
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock source_ids: {}", e),
            })?
            .clear();

        self.processor_ids
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock processor_ids: {}", e),
            })?
            .clear();

        self.sink_ids
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock sink_ids: {}", e),
            })?
            .clear();
        *self
            .session_id
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock session_id: {}", e),
            })? = None;

        println!("[AUDIO] Recording stopped successfully");
        Ok(())
    }

    /// Get current recording state
    pub fn get_state(&self) -> RecordingState {
        self.state
            .lock()
            .map(|s| s.clone())
            .unwrap_or(RecordingState::Stopped)
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        self.state
            .lock()
            .map(|s| *s == RecordingState::Recording)
            .unwrap_or(false)
    }

    /// Update audio mix balance during recording (0-100)
    /// 0 = 100% microphone, 100 = 100% system audio, 50 = equal mix
    pub fn update_audio_balance(&self, balance: u8) -> Result<(), RecordingError> {
        println!("[AUDIO] Updating balance to {}", balance);

        let balance = balance.min(100);

        // Update in device config
        if let Ok(mut config) = self.device_config.lock() {
            config.balance = balance;
        }

        // Update mixer if exists
        if let Ok(processor_ids) = self.processor_ids.lock() {
            if processor_ids.contains_key("mixer") {
                // Mixer exists - rebuild graph with new balance
                // Note: AudioGraph API doesn't provide mutable node access,
                // so we rebuild the entire graph to update mixer weights
                if let Ok(config) = self.device_config.lock() {
                    return self.switch_recording_config(config.clone());
                }
            }
        }

        println!("[AUDIO] Balance updated successfully");
        Ok(())
    }

    /// Switch audio input device during recording (hot-swap)
    pub fn switch_audio_input_device(&self, device_name: Option<String>) -> Result<(), RecordingError> {
        println!("[AUDIO] Switching audio input device");

        let mut config = self
            .device_config
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock device_config: {}", e),
            })?
            .clone();

        config.microphone_device_name = device_name;
        self.switch_recording_config(config)
    }

    /// Switch audio output device for system audio during recording (hot-swap)
    pub fn switch_audio_output_device(&self, device_name: Option<String>) -> Result<(), RecordingError> {
        println!("[AUDIO] Switching audio output device");

        let mut config = self
            .device_config
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock device_config: {}", e),
            })?
            .clone();

        config.system_audio_device_name = device_name;
        self.switch_recording_config(config)
    }

    /// Get current audio health status
    pub fn get_health_status(&self) -> Result<AudioHealthStatus, RecordingError> {
        let dropped = *self
            .dropped_chunks
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("[AUDIO] Failed to lock dropped_chunks: {}", e),
            })?;

        let state_str = match self
            .state
            .lock()
            .map(|s| s.clone())
            .unwrap_or(RecordingState::Stopped)
        {
            RecordingState::Recording => "recording",
            RecordingState::Paused => "paused",
            RecordingState::Stopped => "stopped",
        }
        .to_string();

        Ok(AudioHealthStatus {
            mic_buffer_usage_percent: 0, // Graph manages buffers internally
            system_buffer_usage_percent: 0,
            dropped_chunks: dropped,
            overrun_count: 0,
            last_activity_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            state: state_str,
        })
    }
}

impl Default for AudioRecorder {
    fn default() -> Self {
        Self::new()
    }
}

/// Get list of available audio devices
/// Returns both input (microphone) and output (system audio) devices
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    /// Unique device identifier
    pub id: String,
    /// Human-readable device name
    pub name: String,
    /// Device type: "Input" or "Output"
    pub device_type: String,
    /// Whether this is the system default device
    pub is_default: bool,
    /// Native sample rate in Hz
    pub sample_rate: u32,
    /// Number of audio channels
    pub channels: u16,
}

/// Enumerate all available audio devices
pub fn get_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    // Get default input and output devices for comparison
    let default_input = host.default_input_device();
    let default_output = host.default_output_device();

    // Enumerate input devices
    let input_devices = host
        .input_devices()
        .map_err(|e| format!("[AUDIO] Failed to enumerate input devices: {}", e))?;

    for device in input_devices {
        let name = device
            .name()
            .unwrap_or_else(|_| "Unknown Device".to_string());

        // Check if this is the default input device
        let is_default = default_input
            .as_ref()
            .and_then(|d| d.name().ok())
            .map(|n| n == name)
            .unwrap_or(false);

        // Get device config to extract sample rate and channels
        match device.default_input_config() {
            Ok(config) => {
                devices.push(AudioDeviceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    device_type: "Input".to_string(),
                    is_default,
                    sample_rate: config.sample_rate().0,
                    channels: config.channels(),
                });
            }
            Err(e) => {
                eprintln!(
                    "[AUDIO] Failed to get config for input device '{}': {}",
                    name, e
                );
                // Add device with default values
                devices.push(AudioDeviceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    device_type: "Input".to_string(),
                    is_default,
                    sample_rate: 44100,
                    channels: 2,
                });
            }
        }
    }

    // Enumerate output devices
    let output_devices = host
        .output_devices()
        .map_err(|e| format!("[AUDIO] Failed to enumerate output devices: {}", e))?;

    for device in output_devices {
        let name = device
            .name()
            .unwrap_or_else(|_| "Unknown Device".to_string());

        // Check if this is the default output device
        let is_default = default_output
            .as_ref()
            .and_then(|d| d.name().ok())
            .map(|n| n == name)
            .unwrap_or(false);

        // Get device config to extract sample rate and channels
        match device.default_output_config() {
            Ok(config) => {
                devices.push(AudioDeviceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    device_type: "Output".to_string(),
                    is_default,
                    sample_rate: config.sample_rate().0,
                    channels: config.channels(),
                });
            }
            Err(e) => {
                eprintln!(
                    "[AUDIO] Failed to get config for output device '{}': {}",
                    name, e
                );
                // Add device with default values
                devices.push(AudioDeviceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    device_type: "Output".to_string(),
                    is_default,
                    sample_rate: 44100,
                    channels: 2,
                });
            }
        }
    }

    println!(
        "[AUDIO] Enumerated {} devices ({} inputs, {} outputs)",
        devices.len(),
        devices.iter().filter(|d| d.device_type == "Input").count(),
        devices.iter().filter(|d| d.device_type == "Output").count()
    );

    Ok(devices)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_health_status_creation() {
        let status = AudioHealthStatus::new();

        assert_eq!(status.mic_buffer_usage_percent, 0);
        assert_eq!(status.system_buffer_usage_percent, 0);
        assert_eq!(status.dropped_chunks, 0);
        assert_eq!(status.overrun_count, 0);
        assert_eq!(status.state, "stopped");
        assert!(status.last_activity_ms > 0);
    }

    #[test]
    fn test_audio_mix_buffer_creation() {
        let mix_buffer = AudioMixBuffer::new(50);
        assert_eq!(mix_buffer.get_balance(), 50);
    }

    #[test]
    fn test_audio_mix_buffer_set_balance() {
        let mix_buffer = AudioMixBuffer::new(50);

        mix_buffer.set_balance(75).unwrap();
        assert_eq!(mix_buffer.get_balance(), 75);

        // Balance should be clamped to 100
        mix_buffer.set_balance(150).unwrap();
        assert_eq!(mix_buffer.get_balance(), 100);
    }

    #[test]
    fn test_audio_device_config_default() {
        let config = AudioDeviceConfig::default();

        assert_eq!(config.enable_microphone, true);
        assert_eq!(config.enable_system_audio, false);
        assert_eq!(config.balance, 50);
        assert!(config.microphone_device_name.is_none());
        assert!(config.system_audio_device_name.is_none());
    }

    #[test]
    fn test_audio_recorder_creation() {
        let recorder = AudioRecorder::new();
        assert_eq!(recorder.get_state(), RecordingState::Stopped);
        assert!(!recorder.is_recording());
    }

    #[test]
    fn test_audio_recorder_state_transitions() {
        let recorder = AudioRecorder::new();

        // Initially stopped
        assert_eq!(recorder.get_state(), RecordingState::Stopped);

        // Can't resume when stopped
        assert!(recorder.resume_recording().is_err());

        // Pause works (sets state but doesn't validate)
        assert!(recorder.pause_recording().is_ok());
        assert_eq!(recorder.get_state(), RecordingState::Paused);

        // Resume works
        assert!(recorder.resume_recording().is_ok());
        assert_eq!(recorder.get_state(), RecordingState::Recording);

        // Stop works
        assert!(recorder.stop_recording().is_ok());
        assert_eq!(recorder.get_state(), RecordingState::Stopped);
    }
}
