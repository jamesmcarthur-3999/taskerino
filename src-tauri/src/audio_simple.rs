/**
 * Simple Audio Recording System
 *
 * A straightforward implementation for Taskerino's audio recording needs:
 * - Capture microphone audio (cpal)
 * - Capture system audio (Swift bridge on macOS)
 * - Mix with configurable balance
 * - Chunk every 10 seconds
 * - Emit audio-chunk events for transcription
 *
 * Replaces the overengineered AudioGraph system with a direct, simple approach.
 */

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::sync::{Arc, Mutex, Condvar};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
use crate::macos_audio::{SystemAudioCapture, is_system_audio_available};

use crate::permissions::{RecordingError, DeviceType};

// ============================================================================
// Constants
// ============================================================================

/// Standard sample rate for all audio (16kHz - optimal for Whisper)
const STANDARD_SAMPLE_RATE: u32 = 16000;

/// Chunk duration in seconds
const CHUNK_DURATION_SECS: f64 = 10.0;

/// Processing thread poll interval (100ms)
const PROCESSING_INTERVAL_MS: u64 = 100;

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

/// Audio device configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceConfig {
    pub enable_microphone: bool,
    pub enable_system_audio: bool,
    pub balance: u8,  // 0-100 (0 = all mic, 100 = all system)
    pub microphone_device_name: Option<String>,
    pub system_audio_device_name: Option<String>,
    pub vad_enabled: Option<bool>,
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
            vad_enabled: Some(false),
            vad_threshold: Some(-45.0),
        }
    }
}

/// Audio device info for enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub is_default: bool,
    pub sample_rate: u32,
    pub channels: u16,
}

/// Audio health status for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioHealthStatus {
    pub mic_buffer_usage_percent: u64,
    pub system_buffer_usage_percent: u64,
    pub dropped_chunks: u64,
    pub overrun_count: u64,
    pub last_activity_ms: u64,
    pub state: String,
}

// ============================================================================
// Simple Audio Recorder
// ============================================================================

/// SAFETY: SimpleAudioRecorder uses Arc<Mutex<>> for all mutable state,
/// making it safe to share across threads. The cpal::Stream and JoinHandle
/// are only accessed from the main thread during start/stop operations.
#[derive(Clone)]
pub struct SimpleAudioRecorder {
    // Mic capture - wrapped in Arc for thread safety
    // SAFETY: Stream is only accessed from Tauri command thread, never shared
    mic_stream: Arc<Mutex<Option<cpal::Stream>>>,
    mic_buffer: Arc<Mutex<Vec<f32>>>,
    mic_sample_rate: Arc<Mutex<u32>>,

    // System audio capture (macOS) - Arc for thread safety
    #[cfg(target_os = "macos")]
    system_audio: Arc<Mutex<Option<SystemAudioCapture>>>,

    // Config and state
    config: Arc<Mutex<AudioDeviceConfig>>,
    state: Arc<Mutex<RecordingState>>,
    session_id: Arc<Mutex<Option<String>>>,

    // Processing thread - Arc for thread safety
    processing_thread: Arc<Mutex<Option<JoinHandle<()>>>>,
    should_stop: Arc<Mutex<bool>>,
    stop_condvar: Arc<Condvar>,  // Wakes processing thread immediately on stop

    // App handle for events - Arc for thread safety
    app_handle: Arc<Mutex<Option<AppHandle>>>,

    // Chunk counter
    chunk_counter: Arc<Mutex<u32>>,
}

impl SimpleAudioRecorder {
    /// Create a new audio recorder
    pub fn new() -> Self {
        Self {
            mic_stream: Arc::new(Mutex::new(None)),
            mic_buffer: Arc::new(Mutex::new(Vec::new())),
            mic_sample_rate: Arc::new(Mutex::new(44100)),  // Default, updated when stream starts

            #[cfg(target_os = "macos")]
            system_audio: Arc::new(Mutex::new(None)),

            config: Arc::new(Mutex::new(AudioDeviceConfig::default())),
            state: Arc::new(Mutex::new(RecordingState::Stopped)),
            session_id: Arc::new(Mutex::new(None)),

            processing_thread: Arc::new(Mutex::new(None)),
            should_stop: Arc::new(Mutex::new(false)),
            stop_condvar: Arc::new(Condvar::new()),

            app_handle: Arc::new(Mutex::new(None)),
            chunk_counter: Arc::new(Mutex::new(0)),
        }
    }

    /// Start recording with configuration
    pub fn start_recording(
        &self,
        session_id: String,
        config: AudioDeviceConfig,
        app_handle: AppHandle,
    ) -> Result<(), RecordingError> {
        println!("🎤 [AUDIO SIMPLE] Starting recording for session: {}", session_id);

        // Update state
        *self.state.lock().unwrap() = RecordingState::Recording;
        *self.session_id.lock().unwrap() = Some(session_id.clone());
        *self.config.lock().unwrap() = config.clone();
        *self.app_handle.lock().unwrap() = Some(app_handle.clone());
        *self.should_stop.lock().unwrap() = false;
        *self.chunk_counter.lock().unwrap() = 0;

        // Start microphone if enabled
        if config.enable_microphone {
            self.start_microphone(&config)?;
        }

        // Start system audio if enabled (macOS only)
        #[cfg(target_os = "macos")]
        if config.enable_system_audio {
            self.start_system_audio()?;
        }

        // Start processing thread
        self.start_processing_thread();

        println!("✅ [AUDIO SIMPLE] Recording started successfully");
        Ok(())
    }

    /// Stop recording
    pub fn stop_recording(&self) -> Result<(), RecordingError> {
        println!("🛑 [AUDIO SIMPLE] Stopping recording");

        // Signal processing thread to stop
        *self.should_stop.lock().unwrap() = true;
        // Wake processing thread immediately via condvar
        self.stop_condvar.notify_all();

        // Wait for processing thread to finish
        if let Some(thread) = self.processing_thread.lock().unwrap().take() {
            let _ = thread.join();
            // Small delay to let event queue drain any final audio-chunk events
            // that were emitted before the thread stopped
            thread::sleep(Duration::from_millis(50));
        }

        // Stop microphone
        if let Ok(mut stream) = self.mic_stream.lock() {
            if let Some(s) = stream.take() {
                // CRITICAL: Pause stream before dropping to release audio device
                if let Err(e) = s.pause() {
                    eprintln!("⚠️ [AUDIO SIMPLE] Failed to pause mic stream: {}", e);
                }
                drop(s);
                println!("✅ [AUDIO SIMPLE] Microphone stream released");
            }
        }

        // Stop system audio
        #[cfg(target_os = "macos")]
        if let Ok(mut sys_audio) = self.system_audio.lock() {
            if let Some(capture) = sys_audio.as_ref() {
                let _ = capture.stop();
            }
            *sys_audio = None;
        }

        // Update state
        *self.state.lock().unwrap() = RecordingState::Stopped;
        *self.session_id.lock().unwrap() = None;

        println!("✅ [AUDIO SIMPLE] Recording stopped");
        Ok(())
    }

    /// Pause recording
    pub fn pause_recording(&self) -> Result<(), RecordingError> {
        println!("⏸️  [AUDIO SIMPLE] Pausing recording");
        *self.state.lock().unwrap() = RecordingState::Paused;
        Ok(())
    }

    /// Update audio balance
    pub fn update_balance(&self, balance: u8) -> Result<(), RecordingError> {
        println!("🎛️ [AUDIO SIMPLE] Updating balance to: {}", balance);
        if let Ok(mut config) = self.config.lock() {
            config.balance = balance.min(100);
        }
        Ok(())
    }

    /// Get current recording state
    pub fn is_recording(&self) -> bool {
        *self.state.lock().unwrap() == RecordingState::Recording
    }

    /// Get audio health status
    pub fn get_health_status(&self) -> Result<AudioHealthStatus, RecordingError> {
        let state = self.state.lock().unwrap().clone();
        let state_str = match state {
            RecordingState::Stopped => "stopped",
            RecordingState::Recording => "recording",
            RecordingState::Paused => "paused",
        }.to_string();

        // Simple implementation - buffers are always healthy
        // We don't have complex ring buffers, so usage is always low
        let mic_buffer_len = self.mic_buffer.lock().unwrap().len();
        let mic_usage = ((mic_buffer_len as f64 / 16000.0) * 100.0).min(100.0) as u64; // ~1s buffer = 100%

        Ok(AudioHealthStatus {
            mic_buffer_usage_percent: mic_usage,
            system_buffer_usage_percent: 0, // System audio managed by Swift
            dropped_chunks: 0, // Simple implementation doesn't drop chunks
            overrun_count: 0,
            last_activity_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            state: state_str,
        })
    }

    /// Switch audio input device (microphone)
    pub fn switch_audio_input_device(&self, device_name: Option<String>) -> Result<(), RecordingError> {
        println!("🔄 [AUDIO SIMPLE] Switching input device to: {:?}", device_name);

        // Update config
        if let Ok(mut config) = self.config.lock() {
            config.microphone_device_name = device_name.clone();
        }

        // If currently recording, restart microphone with new device
        if self.is_recording() {
            let config = self.config.lock().unwrap().clone();

            // Stop current stream
            if let Ok(mut stream) = self.mic_stream.lock() {
                if let Some(s) = stream.take() {
                    drop(s);
                }
            }

            // Start with new device
            if config.enable_microphone {
                self.start_microphone(&config)?;
            }
        }

        Ok(())
    }

    /// Switch audio output device (system audio capture)
    pub fn switch_audio_output_device(&self, device_name: Option<String>) -> Result<(), RecordingError> {
        println!("🔄 [AUDIO SIMPLE] Switching output device to: {:?}", device_name);

        // Update config
        if let Ok(mut config) = self.config.lock() {
            config.system_audio_device_name = device_name.clone();
        }

        // System audio device switching not implemented (Swift bridge limitation)
        // Would require restarting the entire system audio capture
        println!("⚠️  [AUDIO SIMPLE] System audio device switching not yet implemented");

        Ok(())
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /// Start microphone capture
    fn start_microphone(&self, config: &AudioDeviceConfig) -> Result<(), RecordingError> {
        println!("🎤 [AUDIO SIMPLE] Starting microphone capture");

        let host = cpal::default_host();

        // Get device
        let device = if let Some(ref name) = config.microphone_device_name {
            // Find device by name
            host.input_devices()
                .map_err(|e| RecordingError::DeviceNotFound {
                    device_type: DeviceType::Microphone,
                    device_id: None,
                    details: Some(e.to_string()),
                })?
                .find(|d| d.name().ok() == Some(name.clone()))
                .ok_or_else(|| RecordingError::DeviceNotFound {
                    device_type: DeviceType::Microphone,
                    device_id: Some(name.clone()),
                    details: None,
                })?
        } else {
            // Use default device
            host.default_input_device()
                .ok_or_else(|| RecordingError::DeviceNotFound {
                    device_type: DeviceType::Microphone,
                    device_id: None,
                    details: Some("No default input device found".to_string()),
                })?
        };

        // Get device config
        let device_config = device
            .default_input_config()
            .map_err(|e| RecordingError::InvalidConfiguration {
                field: "microphone_config".to_string(),
                reason: e.to_string(),
            })?;

        let sample_rate = device_config.sample_rate().0;
        let channels = device_config.channels();
        *self.mic_sample_rate.lock().unwrap() = sample_rate;

        println!("🎤 [AUDIO SIMPLE] Microphone: {} Hz, {} channels", sample_rate, channels);

        // Build stream config
        let config = cpal::StreamConfig {
            channels,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        // Create buffer reference for callback
        let buffer = Arc::clone(&self.mic_buffer);

        // Build stream
        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Accumulate samples in buffer
                    if let Ok(mut buf) = buffer.lock() {
                        buf.extend_from_slice(data);
                    }
                },
                |err| {
                    eprintln!("❌ [AUDIO SIMPLE] Stream error: {}", err);
                },
                None,
            )
            .map_err(|e| RecordingError::SystemError {
                source: crate::permissions::ErrorSource::Cpal,
                message: format!("Failed to build audio stream: {}", e),
                is_recoverable: false,
            })?;

        // Start stream
        stream.play().map_err(|e| RecordingError::SystemError {
            source: crate::permissions::ErrorSource::Cpal,
            message: format!("Failed to start audio stream: {}", e),
            is_recoverable: false,
        })?;

        *self.mic_stream.lock().unwrap() = Some(stream);

        println!("✅ [AUDIO SIMPLE] Microphone capture started");
        Ok(())
    }

    /// Start system audio capture (macOS only)
    #[cfg(target_os = "macos")]
    fn start_system_audio(&self) -> Result<(), RecordingError> {
        println!("🔊 [AUDIO SIMPLE] Starting system audio capture");

        if !is_system_audio_available() {
            println!("⚠️  [AUDIO SIMPLE] System audio not available on this macOS version");
            return Ok(());  // Graceful degradation
        }

        let capture = SystemAudioCapture::new()?;
        capture.start()?;

        *self.system_audio.lock().unwrap() = Some(capture);

        println!("✅ [AUDIO SIMPLE] System audio capture started (16kHz, mono)");
        Ok(())
    }

    /// Start processing thread
    fn start_processing_thread(&self) {
        let mic_buffer = Arc::clone(&self.mic_buffer);

        // Clone system audio Arc for thread
        #[cfg(target_os = "macos")]
        let system_audio = Arc::clone(&self.system_audio);

        let config = Arc::clone(&self.config);
        let state = Arc::clone(&self.state);
        let session_id = Arc::clone(&self.session_id);
        let should_stop = Arc::clone(&self.should_stop);
        let stop_condvar = Arc::clone(&self.stop_condvar);
        let app_handle = self.app_handle.lock().unwrap().clone().expect("App handle not set");
        let chunk_counter = Arc::clone(&self.chunk_counter);
        let mic_sample_rate_arc = Arc::clone(&self.mic_sample_rate);

        let thread = thread::spawn(move || {
            let mut output_buffer: Vec<f32> = Vec::new();
            let mut last_chunk_time = Instant::now();

            loop {
                // Check if should stop (with condvar for immediate wake-up)
                let stop_guard = should_stop.lock().unwrap();
                if *stop_guard {
                    println!("🛑 [AUDIO SIMPLE] Processing thread stopping");
                    break;
                }

                // Check if paused
                if *state.lock().unwrap() == RecordingState::Paused {
                    // Use condvar wait_timeout instead of sleep for immediate wake on stop
                    let (_guard, _result) = stop_condvar.wait_timeout(stop_guard, Duration::from_millis(PROCESSING_INTERVAL_MS)).unwrap();
                    continue;
                }
                drop(stop_guard);  // Release lock before processing

                // Process audio
                #[cfg(target_os = "macos")]
                {
                    if let Err(e) = process_audio_chunk(
                        &mic_buffer,
                        &system_audio,
                        &config,
                        &mut output_buffer,
                        &mut last_chunk_time,
                        &app_handle,
                        &session_id,
                        &chunk_counter,
                        *mic_sample_rate_arc.lock().unwrap(),
                    ) {
                        eprintln!("❌ [AUDIO SIMPLE] Processing error: {:?}", e);
                    }
                }

                #[cfg(not(target_os = "macos"))]
                {
                    if let Err(e) = process_audio_chunk_no_system(
                        &mic_buffer,
                        &config,
                        &mut output_buffer,
                        &mut last_chunk_time,
                        &app_handle,
                        &session_id,
                        &chunk_counter,
                        *mic_sample_rate_arc.lock().unwrap(),
                    ) {
                        eprintln!("❌ [AUDIO SIMPLE] Processing error: {:?}", e);
                    }
                }

                // Wait before next iteration (using condvar for immediate wake on stop)
                let stop_guard = should_stop.lock().unwrap();
                let (_guard, _result) = stop_condvar.wait_timeout(stop_guard, Duration::from_millis(PROCESSING_INTERVAL_MS)).unwrap();
                // Guard is dropped automatically at end of iteration
            }

            println!("✅ [AUDIO SIMPLE] Processing thread stopped");
        });

        *self.processing_thread.lock().unwrap() = Some(thread);
    }
}

// SAFETY: SimpleAudioRecorder is safe to Send/Sync because:
// 1. All mutable state is wrapped in Arc<Mutex<>>
// 2. The cpal::Stream is only accessed from Tauri command threads (never shared across threads)
// 3. JoinHandle is only accessed during start/stop (main thread operations)
unsafe impl Send for SimpleAudioRecorder {}
unsafe impl Sync for SimpleAudioRecorder {}

// ============================================================================
// Audio Processing
// ============================================================================

/// Process audio chunk (macOS with system audio)
#[cfg(target_os = "macos")]
fn process_audio_chunk(
    mic_buffer: &Arc<Mutex<Vec<f32>>>,
    system_audio: &Arc<Mutex<Option<SystemAudioCapture>>>,
    config: &Arc<Mutex<AudioDeviceConfig>>,
    output_buffer: &mut Vec<f32>,
    last_chunk_time: &mut Instant,
    app_handle: &AppHandle,
    session_id: &Arc<Mutex<Option<String>>>,
    chunk_counter: &Arc<Mutex<u32>>,
    mic_sample_rate: u32,
) -> Result<(), String> {
    // Get mic samples
    let mic_samples = {
        let mut buf = mic_buffer.lock().unwrap();
        let samples = buf.clone();
        buf.clear();
        samples
    };

    // Resample mic to 16kHz if needed
    let mic_resampled = if mic_sample_rate != STANDARD_SAMPLE_RATE {
        resample_linear(&mic_samples, mic_sample_rate, STANDARD_SAMPLE_RATE)
    } else {
        mic_samples
    };

    // Get system audio samples
    let system_samples = if let Ok(sys_audio) = system_audio.lock() {
        if let Some(capture) = sys_audio.as_ref() {
            capture.take_samples().unwrap_or_else(|_| vec![])
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    // Mix audio
    let cfg = config.lock().unwrap().clone();
    let mixed = mix_audio(&mic_resampled, &system_samples, cfg.balance);

    // Accumulate in output buffer
    output_buffer.extend_from_slice(&mixed);

    // Check if we have 10 seconds worth of samples
    let samples_needed = (STANDARD_SAMPLE_RATE as f64 * CHUNK_DURATION_SECS) as usize;

    if output_buffer.len() >= samples_needed {
        // Extract chunk
        let chunk: Vec<f32> = output_buffer.drain(..samples_needed).collect();

        // Encode to WAV
        let wav_data = encode_wav(&chunk, STANDARD_SAMPLE_RATE)?;

        // Encode to base64
        let base64_data = BASE64_STANDARD.encode(&wav_data);

        // Check for silence (simple RMS check)
        let is_silent = if cfg.vad_enabled.unwrap_or(false) {
            check_silence(&chunk, cfg.vad_threshold.unwrap_or(-45.0))
        } else {
            false
        };

        // Get session ID
        let session_id_val = session_id.lock().unwrap().clone();

        if let Some(sid) = session_id_val {
            // Increment chunk counter
            let counter = {
                let mut c = chunk_counter.lock().unwrap();
                *c += 1;
                *c
            };

            println!("🎵 [AUDIO SIMPLE] Emitting audio chunk #{} ({} samples, silent: {})",
                     counter, chunk.len(), is_silent);

            // Emit audio-chunk event
            let _ = app_handle.emit("audio-chunk", serde_json::json!({
                "sessionId": sid,
                "audioBase64": base64_data,
                "duration": CHUNK_DURATION_SECS,
                "isSilent": is_silent,
            }));
        }

        *last_chunk_time = Instant::now();
    }

    Ok(())
}

/// Process audio chunk (non-macOS, microphone only)
#[cfg(not(target_os = "macos"))]
fn process_audio_chunk_no_system(
    mic_buffer: &Arc<Mutex<Vec<f32>>>,
    config: &Arc<Mutex<AudioDeviceConfig>>,
    output_buffer: &mut Vec<f32>,
    last_chunk_time: &mut Instant,
    app_handle: &AppHandle,
    session_id: &Arc<Mutex<Option<String>>>,
    chunk_counter: &Arc<Mutex<u32>>,
    mic_sample_rate: u32,
) -> Result<(), String> {
    // Get mic samples
    let mic_samples = {
        let mut buf = mic_buffer.lock().unwrap();
        let samples = buf.clone();
        buf.clear();
        samples
    };

    // Resample mic to 16kHz if needed
    let mixed = if mic_sample_rate != STANDARD_SAMPLE_RATE {
        resample_linear(&mic_samples, mic_sample_rate, STANDARD_SAMPLE_RATE)
    } else {
        mic_samples
    };

    // Accumulate in output buffer
    output_buffer.extend_from_slice(&mixed);

    // Check if we have 10 seconds worth of samples
    let samples_needed = (STANDARD_SAMPLE_RATE as f64 * CHUNK_DURATION_SECS) as usize;

    if output_buffer.len() >= samples_needed {
        // Extract chunk
        let chunk: Vec<f32> = output_buffer.drain(..samples_needed).collect();

        // Encode to WAV
        let wav_data = encode_wav(&chunk, STANDARD_SAMPLE_RATE)?;

        // Encode to base64
        let base64_data = BASE64_STANDARD.encode(&wav_data);

        // Check for silence (simple RMS check)
        let cfg = config.lock().unwrap().clone();
        let is_silent = if cfg.vad_enabled.unwrap_or(false) {
            check_silence(&chunk, cfg.vad_threshold.unwrap_or(-45.0))
        } else {
            false
        };

        // Get session ID
        let session_id_val = session_id.lock().unwrap().clone();

        if let Some(sid) = session_id_val {
            // Increment chunk counter
            let counter = {
                let mut c = chunk_counter.lock().unwrap();
                *c += 1;
                *c
            };

            println!("🎵 [AUDIO SIMPLE] Emitting audio chunk #{} ({} samples, silent: {})",
                     counter, chunk.len(), is_silent);

            // Emit audio-chunk event
            let _ = app_handle.emit("audio-chunk", serde_json::json!({
                "sessionId": sid,
                "audioBase64": base64_data,
                "duration": CHUNK_DURATION_SECS,
                "isSilent": is_silent,
            }));
        }

        *last_chunk_time = Instant::now();
    }

    Ok(())
}

/// Simple linear interpolation resampler
fn resample_linear(input: &[f32], input_rate: u32, output_rate: u32) -> Vec<f32> {
    if input.is_empty() {
        return vec![];
    }

    let ratio = input_rate as f64 / output_rate as f64;
    let output_len = (input.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let pos = i as f64 * ratio;
        let idx = pos.floor() as usize;
        let frac = pos - pos.floor();

        if idx + 1 < input.len() {
            // Linear interpolation
            let sample = input[idx] * (1.0 - frac as f32) + input[idx + 1] * frac as f32;
            output.push(sample);
        } else if idx < input.len() {
            output.push(input[idx]);
        }
    }

    output
}

/// Mix two audio buffers with configurable balance
fn mix_audio(mic: &[f32], system: &[f32], balance: u8) -> Vec<f32> {
    let balance_f = (balance as f32) / 100.0;  // 0.0 to 1.0
    let mic_gain = 1.0 - balance_f;
    let system_gain = balance_f;

    let max_len = mic.len().max(system.len());
    let mut output = Vec::with_capacity(max_len);

    for i in 0..max_len {
        let mic_sample = mic.get(i).copied().unwrap_or(0.0);
        let system_sample = system.get(i).copied().unwrap_or(0.0);

        let mixed = mic_sample * mic_gain + system_sample * system_gain;
        output.push(mixed);
    }

    output
}

/// Check if audio is silent (simple RMS check)
fn check_silence(samples: &[f32], threshold_db: f32) -> bool {
    if samples.is_empty() {
        return true;
    }

    // Calculate RMS
    let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_squares / samples.len() as f32).sqrt();

    // Convert to dB
    let db = 20.0 * rms.log10();

    // Check against threshold
    db < threshold_db
}

/// Encode samples to WAV format
fn encode_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    let mut cursor = Cursor::new(Vec::new());

    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = WavWriter::new(&mut cursor, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

    // Convert f32 to i16 and write
    for &sample in samples {
        let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
        writer.write_sample(sample_i16)
            .map_err(|e| format!("Failed to write sample: {}", e))?;
    }

    writer.finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

    Ok(cursor.into_inner())
}

// ============================================================================
// Device Enumeration
// ============================================================================

/// Enumerate available audio devices
pub fn enumerate_audio_devices() -> Result<Vec<AudioDeviceInfo>, RecordingError> {
    let mut devices = Vec::new();

    let host = cpal::default_host();

    // Get default device
    let default_device_name = host.default_input_device()
        .and_then(|d| d.name().ok());

    // Enumerate input devices
    let input_devices = host.input_devices()
        .map_err(|e| RecordingError::DeviceNotFound {
            device_type: DeviceType::Microphone,
            device_id: None,
            details: Some(e.to_string()),
        })?;

    for device in input_devices {
        if let Ok(name) = device.name() {
            if let Ok(config) = device.default_input_config() {
                devices.push(AudioDeviceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    device_type: "Input".to_string(),
                    is_default: Some(name.clone()) == default_device_name,
                    sample_rate: config.sample_rate().0,
                    channels: config.channels(),
                });
            }
        }
    }

    println!("🎤 [AUDIO SIMPLE] Enumerated {} audio devices", devices.len());

    Ok(devices)
}
