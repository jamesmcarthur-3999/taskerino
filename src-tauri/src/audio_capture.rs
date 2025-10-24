/**
 * Audio Capture Module
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
 */
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use hound::{WavSpec, WavWriter};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[cfg(target_os = "macos")]
use crate::macos_audio::{SystemAudioCapture, is_system_audio_available};

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
}

impl Default for AudioDeviceConfig {
    fn default() -> Self {
        Self {
            enable_microphone: true,
            enable_system_audio: false,
            balance: 50,
            microphone_device_name: None,
            system_audio_device_name: None,
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

/// Audio mixing buffer for dual-source recording
pub struct AudioMixBuffer {
    /// Mix balance: 0-100 (0 = all mic, 100 = all system)
    balance: Arc<Mutex<u8>>,
    /// Target sample rate (16kHz for speech recognition)
    target_sample_rate: u32,
}

impl AudioMixBuffer {
    /// Create new mixing buffer with specified balance
    pub fn new(balance: u8) -> Self {
        Self {
            balance: Arc::new(Mutex::new(balance.min(100))),
            target_sample_rate: 16000,
        }
    }

    /// Update mix balance (0-100)
    pub fn set_balance(&self, balance: u8) -> Result<(), String> {
        *self.balance.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock balance: {}", e))? = balance.min(100);
        println!("[AUDIO] Updated mix balance to {}", balance);
        Ok(())
    }

    /// Get current balance
    pub fn get_balance(&self) -> u8 {
        self.balance.lock().map(|b| *b).unwrap_or(50)
    }

    /// Mix samples from two sources based on balance
    /// Returns mixed samples at target sample rate (16kHz)
    pub fn mix_samples(
        &self,
        mic_samples: &[f32],
        mic_sample_rate: u32,
        system_samples: &[f32],
        system_sample_rate: u32,
    ) -> Result<Vec<f32>, String> {
        let balance = self.get_balance();

        // Calculate mix weights
        let mic_weight = (100 - balance) as f32 / 100.0;
        let system_weight = balance as f32 / 100.0;

        // Resample both sources to target rate
        let mic_resampled = self.resample(mic_samples, mic_sample_rate)?;
        let system_resampled = self.resample(system_samples, system_sample_rate)?;

        // Determine output length (use longer one, pad shorter)
        let output_len = mic_resampled.len().max(system_resampled.len());
        let mut mixed = Vec::with_capacity(output_len);

        // Mix samples with weights
        for i in 0..output_len {
            let mic_sample = if i < mic_resampled.len() {
                mic_resampled[i] * mic_weight
            } else {
                0.0
            };

            let system_sample = if i < system_resampled.len() {
                system_resampled[i] * system_weight
            } else {
                0.0
            };

            // Mix and clamp to prevent clipping
            let mixed_sample = (mic_sample + system_sample).clamp(-1.0, 1.0);
            mixed.push(mixed_sample);
        }

        Ok(mixed)
    }

    /// Resample audio from source sample rate to target rate (16kHz) using linear interpolation
    pub fn resample(&self, samples: &[f32], source_rate: u32) -> Result<Vec<f32>, String> {
        if samples.is_empty() {
            return Ok(Vec::new());
        }

        if source_rate == self.target_sample_rate {
            return Ok(samples.to_vec());
        }

        let ratio = source_rate as f64 / self.target_sample_rate as f64;
        let output_length = (samples.len() as f64 / ratio).ceil() as usize;
        let mut resampled = Vec::with_capacity(output_length);

        for i in 0..output_length {
            let src_idx_f = i as f64 * ratio;
            let src_idx = src_idx_f as usize;

            if src_idx >= samples.len() {
                break;
            }

            // Linear interpolation between samples
            let frac = src_idx_f - src_idx as f64;
            let sample = if src_idx + 1 < samples.len() {
                let a = samples[src_idx];
                let b = samples[src_idx + 1];
                a + (b - a) * frac as f32
            } else {
                samples[src_idx]
            };

            resampled.push(sample);
        }

        Ok(resampled)
    }
}

/// Calculate audio level from samples
/// Returns (rms, peak) where both are in range 0.0-1.0
fn calculate_audio_level(samples: &[f32]) -> (f32, f32) {
    if samples.is_empty() {
        return (0.0, 0.0);
    }

    // Calculate RMS (Root Mean Square)
    let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
    let rms = (sum_squares / samples.len() as f32).sqrt();

    // Calculate peak
    let peak = samples.iter().map(|&s| s.abs()).fold(0.0f32, |a, b| a.max(b));

    (rms, peak)
}

/// Audio buffer for storing samples with backpressure monitoring
struct AudioBuffer {
    samples: Vec<f32>,
    start_time: Instant,
    chunk_duration: Duration,
    max_capacity: usize,
    overflow_count: u64,
}

impl AudioBuffer {
    fn new(chunk_duration_secs: u64) -> Self {
        // Calculate max capacity: 16kHz * chunk_duration * 2 (safety margin)
        let max_capacity = (16000 * chunk_duration_secs * 2) as usize;

        Self {
            samples: Vec::with_capacity(max_capacity),
            start_time: Instant::now(),
            chunk_duration: Duration::from_secs(chunk_duration_secs),
            max_capacity,
            overflow_count: 0,
        }
    }

    fn push_sample(&mut self, sample: f32) {
        // Check for overflow condition
        if self.samples.len() >= self.max_capacity {
            self.overflow_count += 1;
            // Drop oldest sample (ring buffer behavior)
            self.samples.remove(0);
        }
        self.samples.push(sample);
    }

    fn is_chunk_ready(&self) -> bool {
        self.start_time.elapsed() >= self.chunk_duration
    }

    fn take_samples(&mut self) -> Vec<f32> {
        let samples = std::mem::take(&mut self.samples);
        self.start_time = Instant::now();
        samples
    }

    fn clear(&mut self) {
        self.samples.clear();
        self.start_time = Instant::now();
        self.overflow_count = 0;
    }

    /// Get buffer usage as percentage (0-100)
    fn usage_percent(&self) -> u64 {
        if self.max_capacity == 0 {
            return 0;
        }
        ((self.samples.len() * 100) / self.max_capacity) as u64
    }

    /// Get overflow count
    fn get_overflow_count(&self) -> u64 {
        self.overflow_count
    }
}

/// Global audio recorder state with dual-source support
pub struct AudioRecorder {
    state: Arc<Mutex<RecordingState>>,
    /// Microphone buffer (cpal)
    mic_buffer: Arc<Mutex<AudioBuffer>>,
    /// System audio buffer (ScreenCaptureKit)
    system_buffer: Arc<Mutex<AudioBuffer>>,
    /// Microphone stream
    mic_stream: Arc<Mutex<Option<Stream>>>,
    /// System audio capture handle
    #[cfg(target_os = "macos")]
    system_capture: Arc<Mutex<Option<SystemAudioCapture>>>,
    /// Audio mixing buffer
    mix_buffer: Arc<Mutex<Option<AudioMixBuffer>>>,
    /// Device configuration
    device_config: Arc<Mutex<AudioDeviceConfig>>,
    session_id: Arc<Mutex<Option<String>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    /// Microphone sample rate
    mic_sample_rate: Arc<Mutex<u32>>,
    /// Last time we emitted mic level event (throttling)
    last_mic_level_time: Arc<Mutex<Instant>>,
    /// Last time we emitted system audio level event (throttling)
    last_system_level_time: Arc<Mutex<Instant>>,
    /// Health status tracking (for future direct access if needed)
    #[allow(dead_code)]
    health_status: Arc<Mutex<AudioHealthStatus>>,
    /// Dropped chunks counter
    dropped_chunks: Arc<Mutex<u64>>,
    /// Last time we emitted health status
    last_health_emit_time: Arc<Mutex<Instant>>,
}

// SAFETY: AudioRecorder uses Mutex for all internal state synchronization,
// making it safe to share across threads despite Stream not being Send/Sync on macOS
unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RecordingState::Stopped)),
            mic_buffer: Arc::new(Mutex::new(AudioBuffer::new(120))),
            system_buffer: Arc::new(Mutex::new(AudioBuffer::new(120))),
            mic_stream: Arc::new(Mutex::new(None)),
            #[cfg(target_os = "macos")]
            system_capture: Arc::new(Mutex::new(None)),
            mix_buffer: Arc::new(Mutex::new(None)),
            device_config: Arc::new(Mutex::new(AudioDeviceConfig::default())),
            session_id: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            mic_sample_rate: Arc::new(Mutex::new(44100)),
            last_mic_level_time: Arc::new(Mutex::new(Instant::now())),
            last_system_level_time: Arc::new(Mutex::new(Instant::now())),
            health_status: Arc::new(Mutex::new(AudioHealthStatus::new())),
            dropped_chunks: Arc::new(Mutex::new(0)),
            last_health_emit_time: Arc::new(Mutex::new(Instant::now())),
        }
    }

    /// Initialize the audio recorder with app handle
    pub fn init(&self, app_handle: AppHandle) -> Result<(), String> {
        *self.app_handle.lock()
            .map_err(|e| format!("Failed to lock app_handle: {}", e))? = Some(app_handle);
        Ok(())
    }

    /// Start recording audio with dual-source support
    pub fn start_recording(&self, session_id: String, chunk_duration_secs: u64) -> Result<(), String> {
        self.start_recording_with_config(session_id, chunk_duration_secs, AudioDeviceConfig::default())
    }

    /// Start recording audio with device configuration
    pub fn start_recording_with_config(
        &self,
        session_id: String,
        chunk_duration_secs: u64,
        config: AudioDeviceConfig,
    ) -> Result<(), String> {
        println!("[AUDIO] Starting recording for session: {} (chunk: {}s, mic: {}, system: {}, balance: {})",
            session_id, chunk_duration_secs, config.enable_microphone, config.enable_system_audio, config.balance);

        // Validate configuration
        if !config.enable_microphone && !config.enable_system_audio {
            return Err("[AUDIO] At least one audio source must be enabled".to_string());
        }

        // Check if already recording
        let current_state = self.state.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock state: {}", e))?.clone();
        if current_state == RecordingState::Recording {
            println!("[AUDIO] Already recording, switching configuration");
            return self.switch_recording_config(config);
        }

        // Store session ID and config
        *self.session_id.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock session_id: {}", e))? = Some(session_id.clone());
        *self.device_config.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock device_config: {}", e))? = config.clone();

        // Recreate buffers with the specified chunk duration
        *self.mic_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock mic_buffer: {}", e))? = AudioBuffer::new(chunk_duration_secs);
        *self.system_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock system_buffer: {}", e))? = AudioBuffer::new(chunk_duration_secs);

        // Create mix buffer
        *self.mix_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock mix_buffer: {}", e))? = Some(AudioMixBuffer::new(config.balance));

        let mut mic_sample_rate = 44100;

        // Start microphone capture if enabled
        if config.enable_microphone {
            let host = cpal::default_host();
            let device = if let Some(ref device_name) = config.microphone_device_name {
                host.input_devices()
                    .map_err(|e| format!("[AUDIO] Failed to enumerate input devices: {}", e))?
                    .find(|d| d.name().map(|n| n == *device_name).unwrap_or(false))
                    .ok_or_else(|| format!("[AUDIO] Microphone device '{}' not found", device_name))?
            } else {
                host.default_input_device()
                    .ok_or_else(|| "[AUDIO] No input device available".to_string())?
            };

            println!("[AUDIO] Using microphone: {}", device.name().unwrap_or_else(|_| "Unknown".to_string()));

            let device_config = device
                .default_input_config()
                .map_err(|e| format!("[AUDIO] Failed to get default input config: {}", e))?;

            println!("[AUDIO] Mic - Format: {:?}, Rate: {}, Channels: {}",
                device_config.sample_format(), device_config.sample_rate().0, device_config.channels());

            mic_sample_rate = device_config.sample_rate().0;
            *self.mic_sample_rate.lock()
                .map_err(|e| format!("[AUDIO] Failed to lock mic_sample_rate: {}", e))? = mic_sample_rate;

            let stream = match device_config.sample_format() {
                SampleFormat::F32 => self.build_mic_stream_f32(&device, device_config.into())?,
                SampleFormat::I16 => self.build_mic_stream_i16(&device, device_config.into())?,
                SampleFormat::U16 => self.build_mic_stream_u16(&device, device_config.into())?,
                _ => return Err(format!("[AUDIO] Unsupported sample format: {:?}", device_config.sample_format())),
            };

            stream.play()
                .map_err(|e| format!("[AUDIO] Failed to start microphone stream: {}", e))?;

            *self.mic_stream.lock()
                .map_err(|e| format!("[AUDIO] Failed to lock mic_stream: {}", e))? = Some(stream);

            println!("[AUDIO] Microphone capture started");
        }

        // Start system audio capture if enabled (macOS only)
        #[cfg(target_os = "macos")]
        if config.enable_system_audio {
            if !is_system_audio_available() {
                println!("[AUDIO] System audio capture not available on this macOS version, gracefully degrading");
            } else {
                match SystemAudioCapture::new() {
                    Ok(capture) => {
                        capture.start()
                            .map_err(|e| format!("[AUDIO] Failed to start system audio: {}", e))?;

                        *self.system_capture.lock()
                            .map_err(|e| format!("[AUDIO] Failed to lock system_capture: {}", e))? = Some(capture);

                        println!("[AUDIO] System audio capture started");
                    }
                    Err(e) => {
                        println!("[AUDIO] Failed to create system audio capture, gracefully degrading: {}", e);
                    }
                }
            }
        }

        // Update state
        *self.state.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock state: {}", e))? = RecordingState::Recording;

        // Clear buffers
        self.mic_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock mic_buffer: {}", e))?.clear();
        self.system_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock system_buffer: {}", e))?.clear();

        // Start background thread to check for completed chunks
        self.start_chunk_processor();

        println!("[AUDIO] Recording started successfully");
        Ok(())
    }

    /// Switch recording configuration during active recording (hot-swap)
    fn switch_recording_config(&self, new_config: AudioDeviceConfig) -> Result<(), String> {
        println!("[AUDIO] Hot-swapping recording configuration");

        let old_config = self.device_config.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock device_config: {}", e))?.clone();

        // Update mix balance if changed
        if new_config.balance != old_config.balance {
            if let Some(ref mix_buffer) = *self.mix_buffer.lock()
                .map_err(|e| format!("[AUDIO] Failed to lock mix_buffer: {}", e))? {
                mix_buffer.set_balance(new_config.balance)?;
            }
        }

        // Handle microphone device change
        if new_config.enable_microphone != old_config.enable_microphone ||
           new_config.microphone_device_name != old_config.microphone_device_name {

            // Stop old mic stream
            *self.mic_stream.lock()
                .map_err(|e| format!("[AUDIO] Failed to lock mic_stream: {}", e))? = None;

            // Start new mic stream if enabled
            if new_config.enable_microphone {
                let host = cpal::default_host();
                let device = if let Some(ref device_name) = new_config.microphone_device_name {
                    host.input_devices()
                        .map_err(|e| format!("[AUDIO] Failed to enumerate input devices: {}", e))?
                        .find(|d| d.name().map(|n| n == *device_name).unwrap_or(false))
                        .ok_or_else(|| format!("[AUDIO] Microphone device '{}' not found", device_name))?
                } else {
                    host.default_input_device()
                        .ok_or_else(|| "[AUDIO] No input device available".to_string())?
                };

                println!("[AUDIO] Switching to microphone: {}", device.name().unwrap_or_else(|_| "Unknown".to_string()));

                let device_config = device
                    .default_input_config()
                    .map_err(|e| format!("[AUDIO] Failed to get default input config: {}", e))?;

                let mic_sample_rate = device_config.sample_rate().0;
                *self.mic_sample_rate.lock()
                    .map_err(|e| format!("[AUDIO] Failed to lock mic_sample_rate: {}", e))? = mic_sample_rate;

                let stream = match device_config.sample_format() {
                    SampleFormat::F32 => self.build_mic_stream_f32(&device, device_config.into())?,
                    SampleFormat::I16 => self.build_mic_stream_i16(&device, device_config.into())?,
                    SampleFormat::U16 => self.build_mic_stream_u16(&device, device_config.into())?,
                    _ => return Err(format!("[AUDIO] Unsupported sample format: {:?}", device_config.sample_format())),
                };

                stream.play()
                    .map_err(|e| format!("[AUDIO] Failed to start microphone stream: {}", e))?;

                *self.mic_stream.lock()
                    .map_err(|e| format!("[AUDIO] Failed to lock mic_stream: {}", e))? = Some(stream);

                println!("[AUDIO] Microphone switched successfully");
            }
        }

        // Handle system audio change (macOS only)
        #[cfg(target_os = "macos")]
        if new_config.enable_system_audio != old_config.enable_system_audio {
            if new_config.enable_system_audio {
                if is_system_audio_available() {
                    match SystemAudioCapture::new() {
                        Ok(capture) => {
                            capture.start()
                                .map_err(|e| format!("[AUDIO] Failed to start system audio: {}", e))?;

                            *self.system_capture.lock()
                                .map_err(|e| format!("[AUDIO] Failed to lock system_capture: {}", e))? = Some(capture);

                            println!("[AUDIO] System audio enabled");
                        }
                        Err(e) => {
                            println!("[AUDIO] Failed to enable system audio: {}", e);
                        }
                    }
                }
            } else {
                *self.system_capture.lock()
                    .map_err(|e| format!("[AUDIO] Failed to lock system_capture: {}", e))? = None;
                println!("[AUDIO] System audio disabled");
            }
        }

        // Update config
        *self.device_config.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock device_config: {}", e))? = new_config;

        println!("[AUDIO] Configuration switched successfully");
        Ok(())
    }

    /// Build microphone audio stream for f32 samples
    fn build_mic_stream_f32(&self, device: &Device, config: StreamConfig) -> Result<Stream, String> {
        let buffer = self.mic_buffer.clone();
        let state = self.state.clone();
        let app_handle = self.app_handle.clone();
        let last_level_time = self.last_mic_level_time.clone();

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(current_state) = state.lock() {
                        if *current_state == RecordingState::Recording {
                            // Push samples to buffer
                            if let Ok(mut buf) = buffer.lock() {
                                for &sample in data {
                                    buf.push_sample(sample);
                                }
                            }

                            // Calculate and emit audio levels (throttled to 100ms)
                            if let Ok(mut last_time) = last_level_time.lock() {
                                if last_time.elapsed() >= Duration::from_millis(100) {
                                    let (rms, peak) = calculate_audio_level(data);
                                    let level_percent = (rms * 100.0).min(100.0) as u8;

                                    if let Ok(app) = app_handle.lock() {
                                        if let Some(app) = app.as_ref() {
                                            let level_data = AudioLevelData {
                                                device_type: "microphone".to_string(),
                                                device_id: None,
                                                rms,
                                                peak,
                                                level_percent,
                                            };

                                            if let Err(e) = app.emit("audio-level", level_data) {
                                                // Silently ignore emission errors to avoid log spam
                                                eprintln!("[AUDIO] Failed to emit mic level: {}", e);
                                            }
                                        }
                                    }

                                    *last_time = Instant::now();
                                }
                            }
                        }
                    }
                },
                |err| eprintln!("[AUDIO] Microphone stream error: {}", err),
                None,
            )
            .map_err(|e| format!("[AUDIO] Failed to build microphone stream: {}", e))?;

        Ok(stream)
    }

    /// Build microphone audio stream for i16 samples (convert to f32)
    fn build_mic_stream_i16(&self, device: &Device, config: StreamConfig) -> Result<Stream, String> {
        let buffer = self.mic_buffer.clone();
        let state = self.state.clone();
        let app_handle = self.app_handle.clone();
        let last_level_time = self.last_mic_level_time.clone();

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if let Ok(current_state) = state.lock() {
                        if *current_state == RecordingState::Recording {
                            // Convert i16 to f32 and push to buffer
                            let mut f32_samples = Vec::with_capacity(data.len());
                            if let Ok(mut buf) = buffer.lock() {
                                for &sample in data {
                                    let normalized = sample as f32 / i16::MAX as f32;
                                    buf.push_sample(normalized);
                                    f32_samples.push(normalized);
                                }
                            }

                            // Calculate and emit audio levels (throttled to 100ms)
                            if let Ok(mut last_time) = last_level_time.lock() {
                                if last_time.elapsed() >= Duration::from_millis(100) {
                                    let (rms, peak) = calculate_audio_level(&f32_samples);
                                    let level_percent = (rms * 100.0).min(100.0) as u8;

                                    if let Ok(app) = app_handle.lock() {
                                        if let Some(app) = app.as_ref() {
                                            let level_data = AudioLevelData {
                                                device_type: "microphone".to_string(),
                                                device_id: None,
                                                rms,
                                                peak,
                                                level_percent,
                                            };

                                            if let Err(e) = app.emit("audio-level", level_data) {
                                                eprintln!("[AUDIO] Failed to emit mic level: {}", e);
                                            }
                                        }
                                    }

                                    *last_time = Instant::now();
                                }
                            }
                        }
                    }
                },
                |err| eprintln!("[AUDIO] Microphone stream error: {}", err),
                None,
            )
            .map_err(|e| format!("[AUDIO] Failed to build microphone stream: {}", e))?;

        Ok(stream)
    }

    /// Build microphone audio stream for u16 samples (convert to f32)
    fn build_mic_stream_u16(&self, device: &Device, config: StreamConfig) -> Result<Stream, String> {
        let buffer = self.mic_buffer.clone();
        let state = self.state.clone();
        let app_handle = self.app_handle.clone();
        let last_level_time = self.last_mic_level_time.clone();

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    if let Ok(current_state) = state.lock() {
                        if *current_state == RecordingState::Recording {
                            // Convert u16 to f32 and push to buffer
                            let mut f32_samples = Vec::with_capacity(data.len());
                            if let Ok(mut buf) = buffer.lock() {
                                for &sample in data {
                                    let normalized = (sample as f32 / u16::MAX as f32) * 2.0 - 1.0;
                                    buf.push_sample(normalized);
                                    f32_samples.push(normalized);
                                }
                            }

                            // Calculate and emit audio levels (throttled to 100ms)
                            if let Ok(mut last_time) = last_level_time.lock() {
                                if last_time.elapsed() >= Duration::from_millis(100) {
                                    let (rms, peak) = calculate_audio_level(&f32_samples);
                                    let level_percent = (rms * 100.0).min(100.0) as u8;

                                    if let Ok(app) = app_handle.lock() {
                                        if let Some(app) = app.as_ref() {
                                            let level_data = AudioLevelData {
                                                device_type: "microphone".to_string(),
                                                device_id: None,
                                                rms,
                                                peak,
                                                level_percent,
                                            };

                                            if let Err(e) = app.emit("audio-level", level_data) {
                                                eprintln!("[AUDIO] Failed to emit mic level: {}", e);
                                            }
                                        }
                                    }

                                    *last_time = Instant::now();
                                }
                            }
                        }
                    }
                },
                |err| eprintln!("[AUDIO] Microphone stream error: {}", err),
                None,
            )
            .map_err(|e| format!("[AUDIO] Failed to build microphone stream: {}", e))?;

        Ok(stream)
    }

    /// Start background thread to process audio chunks with dual-source mixing
    fn start_chunk_processor(&self) {
        let mic_buffer = self.mic_buffer.clone();
        let system_buffer = self.system_buffer.clone();
        let state = self.state.clone();
        let app_handle = self.app_handle.clone();
        let session_id = self.session_id.clone();
        let mix_buffer = self.mix_buffer.clone();
        let device_config = self.device_config.clone();
        let mic_sample_rate = self.mic_sample_rate.clone();
        let dropped_chunks = self.dropped_chunks.clone();
        let last_health_emit = self.last_health_emit_time.clone();

        #[cfg(target_os = "macos")]
        let system_capture = self.system_capture.clone();

        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(1)); // Check every second

                let current_state = match state.lock() {
                    Ok(s) => s.clone(),
                    Err(_) => break,
                };

                if current_state == RecordingState::Stopped {
                    break;
                }

                if current_state != RecordingState::Recording {
                    continue;
                }

                // Check buffer usage and emit warnings if high (90% threshold)
                let mic_usage = mic_buffer.lock().map(|b| b.usage_percent()).unwrap_or(0);
                let system_usage = system_buffer.lock().map(|b| b.usage_percent()).unwrap_or(0);

                if mic_usage >= 90 {
                    println!("⚠️ [AUDIO] Microphone buffer near capacity: {}%", mic_usage);
                    if let Ok(app_lock) = app_handle.lock() {
                        if let Some(ref app) = *app_lock {
                            let warning = serde_json::json!({
                                "deviceType": "microphone",
                                "usagePercent": mic_usage,
                                "message": format!("Microphone buffer at {}% capacity", mic_usage)
                            });
                            let _ = app.emit("audio-health-warning", warning);
                        }
                    }
                }

                if system_usage >= 90 {
                    println!("⚠️ [AUDIO] System audio buffer near capacity: {}%", system_usage);
                    if let Ok(app_lock) = app_handle.lock() {
                        if let Some(ref app) = *app_lock {
                            let warning = serde_json::json!({
                                "deviceType": "system-audio",
                                "usagePercent": system_usage,
                                "message": format!("System audio buffer at {}% capacity", system_usage)
                            });
                            let _ = app.emit("audio-health-warning", warning);
                        }
                    }
                }

                // Emit health status every 10 seconds
                if let Ok(mut last_emit) = last_health_emit.lock() {
                    if last_emit.elapsed() >= Duration::from_secs(10) {
                        // Get overflow counts
                        let mic_overflow = mic_buffer.lock().map(|b| b.get_overflow_count()).unwrap_or(0);
                        let system_overflow = system_buffer.lock().map(|b| b.get_overflow_count()).unwrap_or(0);
                        let total_overrun = mic_overflow + system_overflow;

                        let dropped = dropped_chunks.lock().map(|d| *d).unwrap_or(0);

                        if let Ok(app_lock) = app_handle.lock() {
                            if let Some(ref app) = *app_lock {
                                let status = AudioHealthStatus {
                                    mic_buffer_usage_percent: mic_usage,
                                    system_buffer_usage_percent: system_usage,
                                    dropped_chunks: dropped,
                                    overrun_count: total_overrun,
                                    last_activity_ms: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_millis() as u64,
                                    state: "recording".to_string(),
                                };

                                let _ = app.emit("audio-health-status", status);
                            }
                        }

                        *last_emit = Instant::now();
                    }
                }

                // Check if chunk is ready (check mic buffer as reference)
                let is_ready = match mic_buffer.lock() {
                    Ok(b) => b.is_chunk_ready(),
                    Err(_) => continue,
                };
                if !is_ready {
                    continue;
                }

                // Get device configuration
                let config = match device_config.lock() {
                    Ok(c) => c.clone(),
                    Err(_) => continue,
                };

                // Take samples from microphone buffer
                let mic_samples = if config.enable_microphone {
                    match mic_buffer.lock() {
                        Ok(mut b) => b.take_samples(),
                        Err(_) => continue,
                    }
                } else {
                    Vec::new()
                };

                // Take samples from system audio buffer
                #[cfg(target_os = "macos")]
                let system_samples = if config.enable_system_audio {
                    match system_capture.lock() {
                        Ok(ref capture_opt) => {
                            if let Some(ref capture) = **capture_opt {
                                match capture.take_samples() {
                                    Ok(samples) => samples,
                                    Err(e) => {
                                        eprintln!("[AUDIO] Failed to take system audio samples: {}", e);
                                        Vec::new()
                                    }
                                }
                            } else {
                                Vec::new()
                            }
                        }
                        Err(_) => Vec::new(),
                    }
                } else {
                    Vec::new()
                };

                #[cfg(not(target_os = "macos"))]
                let system_samples: Vec<f32> = Vec::new();

                // Skip if no samples from any source
                if mic_samples.is_empty() && system_samples.is_empty() {
                    continue;
                }

                println!("[AUDIO] Processing chunk: {} mic samples, {} system samples",
                    mic_samples.len(), system_samples.len());

                // Get mic sample rate
                let mic_rate = match mic_sample_rate.lock() {
                    Ok(r) => *r,
                    Err(_) => 44100,
                };

                // Mix samples if both sources are present, otherwise use single source
                let mixed_samples = if !mic_samples.is_empty() && !system_samples.is_empty() {
                    // Dual-source mode: mix both sources
                    match mix_buffer.lock() {
                        Ok(ref mix_buf_opt) => {
                            if let Some(ref mix_buf) = **mix_buf_opt {
                                match mix_buf.mix_samples(
                                    &mic_samples,
                                    mic_rate,
                                    &system_samples,
                                    16000, // System audio is already at 16kHz from Swift
                                ) {
                                    Ok(mixed) => mixed,
                                    Err(e) => {
                                        eprintln!("[AUDIO] Failed to mix samples: {}", e);
                                        continue;
                                    }
                                }
                            } else {
                                eprintln!("[AUDIO] Mix buffer not initialized");
                                continue;
                            }
                        }
                        Err(_) => continue,
                    }
                } else if !mic_samples.is_empty() {
                    // Microphone only: resample to 16kHz
                    match mix_buffer.lock() {
                        Ok(ref mix_buf_opt) => {
                            if let Some(ref mix_buf) = **mix_buf_opt {
                                match mix_buf.resample(&mic_samples, mic_rate) {
                                    Ok(resampled) => resampled,
                                    Err(e) => {
                                        eprintln!("[AUDIO] Failed to resample mic: {}", e);
                                        continue;
                                    }
                                }
                            } else {
                                mic_samples
                            }
                        }
                        Err(_) => mic_samples,
                    }
                } else {
                    // System audio only (already at 16kHz)
                    system_samples
                };

                if mixed_samples.is_empty() {
                    continue;
                }

                // Convert to WAV and base64 (always 16kHz mono)
                match Self::samples_to_wav_base64(&mixed_samples, 16000, 1) {
                    Ok(base64_data) => {
                        let app = match app_handle.lock() {
                            Ok(h) => h.clone(),
                            Err(_) => continue,
                        };
                        let sess_id = match session_id.lock() {
                            Ok(s) => s.clone(),
                            Err(_) => continue,
                        };

                        if let (Some(app), Some(sid)) = (app, sess_id) {
                            let duration = mixed_samples.len() as f64 / 16000.0;

                            let payload = serde_json::json!({
                                "sessionId": sid,
                                "audioBase64": base64_data,
                                "duration": duration,
                            });

                            if let Err(e) = app.emit("audio-chunk", payload) {
                                eprintln!("[AUDIO] Failed to emit audio-chunk event: {}", e);
                            } else {
                                println!("[AUDIO] Emitted mixed audio chunk ({:.1}s)", duration);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[AUDIO] Failed to encode audio: {}", e);
                    }
                }
            }

            println!("[AUDIO] Chunk processor thread exiting");
        });
    }

    /// Resample audio from source sample rate to 16kHz using linear interpolation
    fn resample_to_16khz(samples: &[f32], source_rate: u32) -> Vec<f32> {
        if source_rate == 16000 {
            return samples.to_vec(); // Already 16kHz
        }

        let target_rate = 16000;
        let ratio = source_rate as f64 / target_rate as f64;
        let output_length = (samples.len() as f64 / ratio) as usize;
        let mut resampled = Vec::with_capacity(output_length);

        for i in 0..output_length {
            let src_idx = (i as f64 * ratio) as usize;
            if src_idx < samples.len() {
                resampled.push(samples[src_idx]);
            }
        }

        resampled
    }

    /// Convert audio samples to WAV format and encode as base64
    fn samples_to_wav_base64(samples: &[f32], sample_rate: u32, channels: u16) -> Result<String, String> {
        let mut wav_buffer = Vec::new();

        // Resample to 16kHz for optimal speech recognition
        let resampled = Self::resample_to_16khz(samples, sample_rate);
        let target_rate = 16000;

        {
            let spec = WavSpec {
                channels,
                sample_rate: target_rate, // Use 16kHz
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };

            let mut writer = WavWriter::new(std::io::Cursor::new(&mut wav_buffer), spec)
                .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

            // Convert f32 samples to i16 and write
            for &sample in &resampled { // Use resampled data
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
        let base64_data = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &wav_buffer);
        Ok(format!("data:audio/wav;base64,{}", base64_data))
    }

    /// Pause recording
    pub fn pause_recording(&self) -> Result<(), String> {
        println!("⏸️  [AUDIO CAPTURE] Pausing recording");
        *self.state.lock()
            .map_err(|e| format!("Failed to lock state: {}", e))? = RecordingState::Paused;
        Ok(())
    }

    /// Resume recording
    #[allow(dead_code)]
    pub fn resume_recording(&self) -> Result<(), String> {
        println!("▶️  [AUDIO CAPTURE] Resuming recording");
        let current_state = self.state.lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?.clone();

        if current_state == RecordingState::Stopped {
            return Err("Cannot resume - recording is stopped".to_string());
        }

        *self.state.lock()
            .map_err(|e| format!("Failed to lock state: {}", e))? = RecordingState::Recording;
        Ok(())
    }

    /// Stop recording
    pub fn stop_recording(&self) -> Result<(), String> {
        println!("[AUDIO] Stopping recording");

        // Update state first to signal threads to stop
        *self.state.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock state: {}", e))? = RecordingState::Stopped;

        // Stop microphone stream
        *self.mic_stream.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock mic_stream: {}", e))? = None;

        // Stop system audio capture
        #[cfg(target_os = "macos")]
        {
            if let Ok(mut capture_lock) = self.system_capture.lock() {
                if let Some(ref capture) = *capture_lock {
                    if let Err(e) = capture.stop() {
                        eprintln!("[AUDIO] Failed to stop system audio: {}", e);
                    }
                }
                *capture_lock = None;
            }
        }

        // Clear buffers
        self.mic_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock mic_buffer: {}", e))?.clear();
        self.system_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock system_buffer: {}", e))?.clear();

        // Clear mix buffer
        *self.mix_buffer.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock mix_buffer: {}", e))? = None;

        // Clear session ID
        *self.session_id.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock session_id: {}", e))? = None;

        println!("[AUDIO] Recording stopped successfully");
        Ok(())
    }

    /// Get current recording state
    #[allow(dead_code)]
    pub fn get_state(&self) -> RecordingState {
        self.state.lock()
            .map(|s| s.clone())
            .unwrap_or(RecordingState::Stopped)
    }

    /// Check if currently recording
    #[allow(dead_code)]
    pub fn is_recording(&self) -> bool {
        self.state.lock()
            .map(|s| *s == RecordingState::Recording)
            .unwrap_or(false)
    }

    /// Update audio mix balance during recording (0-100)
    /// 0 = 100% microphone, 100 = 100% system audio, 50 = equal mix
    pub fn update_audio_balance(&self, balance: u8) -> Result<(), String> {
        println!("[AUDIO] Updating balance to {}", balance);

        // Update in device config
        if let Ok(mut config) = self.device_config.lock() {
            config.balance = balance.min(100);
        }

        // Update in mix buffer
        if let Ok(ref mix_buf_opt) = self.mix_buffer.lock() {
            if let Some(ref mix_buf) = **mix_buf_opt {
                mix_buf.set_balance(balance)?;
            } else {
                return Err("[AUDIO] Mix buffer not initialized - not currently recording".to_string());
            }
        } else {
            return Err("[AUDIO] Failed to lock mix buffer".to_string());
        }

        println!("[AUDIO] Balance updated successfully");
        Ok(())
    }

    /// Switch audio input device during recording (hot-swap)
    pub fn switch_audio_input_device(&self, device_name: Option<String>) -> Result<(), String> {
        println!("[AUDIO] Switching audio input device");

        let mut config = self.device_config.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock device_config: {}", e))?.clone();

        config.microphone_device_name = device_name;
        self.switch_recording_config(config)
    }

    /// Switch audio output device for system audio during recording (hot-swap)
    pub fn switch_audio_output_device(&self, device_name: Option<String>) -> Result<(), String> {
        println!("[AUDIO] Switching audio output device");

        let mut config = self.device_config.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock device_config: {}", e))?.clone();

        config.system_audio_device_name = device_name;
        self.switch_recording_config(config)
    }

    /// Get current audio health status
    pub fn get_health_status(&self) -> Result<AudioHealthStatus, String> {
        // Get current buffer usage
        let mic_usage = self.mic_buffer.lock()
            .map(|b| b.usage_percent())
            .unwrap_or(0);

        let system_usage = self.system_buffer.lock()
            .map(|b| b.usage_percent())
            .unwrap_or(0);

        // Get overflow counts
        let mic_overflow = self.mic_buffer.lock()
            .map(|b| b.get_overflow_count())
            .unwrap_or(0);

        let system_overflow = self.system_buffer.lock()
            .map(|b| b.get_overflow_count())
            .unwrap_or(0);

        let total_overrun = mic_overflow + system_overflow;

        // Get dropped chunks
        let dropped = *self.dropped_chunks.lock()
            .map_err(|e| format!("[AUDIO] Failed to lock dropped_chunks: {}", e))?;

        // Get current state
        let state_str = match self.state.lock()
            .map(|s| s.clone())
            .unwrap_or(RecordingState::Stopped) {
            RecordingState::Recording => "recording",
            RecordingState::Paused => "paused",
            RecordingState::Stopped => "stopped",
        }.to_string();

        Ok(AudioHealthStatus {
            mic_buffer_usage_percent: mic_usage,
            system_buffer_usage_percent: system_usage,
            dropped_chunks: dropped,
            overrun_count: total_overrun,
            last_activity_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            state: state_str,
        })
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
    let input_devices = host.input_devices()
        .map_err(|e| format!("[AUDIO] Failed to enumerate input devices: {}", e))?;

    for device in input_devices {
        let name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());

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
                eprintln!("[AUDIO] Failed to get config for input device '{}': {}", name, e);
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
    let output_devices = host.output_devices()
        .map_err(|e| format!("[AUDIO] Failed to enumerate output devices: {}", e))?;

    for device in output_devices {
        let name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());

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
                eprintln!("[AUDIO] Failed to get config for output device '{}': {}", name, e);
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

    println!("[AUDIO] Enumerated {} devices ({} inputs, {} outputs)",
        devices.len(),
        devices.iter().filter(|d| d.device_type == "Input").count(),
        devices.iter().filter(|d| d.device_type == "Output").count()
    );

    Ok(devices)
}

// No global static - we'll use Tauri's managed state instead

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_buffer_capacity() {
        let buffer = AudioBuffer::new(10); // 10 seconds
        // Max capacity should be 16kHz * 10s * 2 (safety margin) = 320,000 samples
        assert_eq!(buffer.max_capacity, 320000);
    }

    #[test]
    fn test_audio_buffer_usage_percent() {
        let mut buffer = AudioBuffer::new(10);

        // Empty buffer should be 0%
        assert_eq!(buffer.usage_percent(), 0);

        // Add samples to 50% capacity
        let half_capacity = buffer.max_capacity / 2;
        for _ in 0..half_capacity {
            buffer.push_sample(0.5);
        }

        assert_eq!(buffer.usage_percent(), 50);
    }

    #[test]
    fn test_audio_buffer_overflow_detection() {
        let mut buffer = AudioBuffer::new(1); // 1 second = 32,000 capacity

        // Fill to capacity
        for _ in 0..buffer.max_capacity {
            buffer.push_sample(0.5);
        }

        assert_eq!(buffer.overflow_count, 0);

        // Add one more sample - should trigger overflow
        buffer.push_sample(0.5);
        assert_eq!(buffer.overflow_count, 1);

        // Buffer should still be at max capacity (ring buffer behavior)
        assert_eq!(buffer.samples.len(), buffer.max_capacity);
    }

    #[test]
    fn test_audio_buffer_overflow_multiple() {
        let mut buffer = AudioBuffer::new(1);

        // Overflow by 100 samples
        for _ in 0..(buffer.max_capacity + 100) {
            buffer.push_sample(0.5);
        }

        assert_eq!(buffer.overflow_count, 100);
    }

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
    fn test_audio_buffer_clear() {
        let mut buffer = AudioBuffer::new(10);

        // Add some samples
        for _ in 0..1000 {
            buffer.push_sample(0.5);
        }

        // Trigger some overflows
        for _ in 0..buffer.max_capacity + 10 {
            buffer.push_sample(0.5);
        }

        let overflow_count_before = buffer.overflow_count;
        assert!(overflow_count_before > 0);

        // Clear should reset everything
        buffer.clear();

        assert_eq!(buffer.samples.len(), 0);
        assert_eq!(buffer.overflow_count, 0);
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
    fn test_audio_mix_buffer_resample() {
        let mix_buffer = AudioMixBuffer::new(50);

        // Create test samples at 44.1kHz
        let samples: Vec<f32> = vec![0.5; 44100]; // 1 second of audio

        // Resample to 16kHz
        let resampled = mix_buffer.resample(&samples, 44100).unwrap();

        // Should have roughly 16000 samples (1 second at 16kHz)
        assert!((resampled.len() as i32 - 16000).abs() < 100);
    }

    #[test]
    fn test_audio_mix_buffer_same_rate() {
        let mix_buffer = AudioMixBuffer::new(50);

        let samples: Vec<f32> = vec![0.5; 16000];

        // Resampling at same rate should return identical samples
        let resampled = mix_buffer.resample(&samples, 16000).unwrap();
        assert_eq!(resampled.len(), samples.len());
    }

    #[test]
    fn test_calculate_audio_level() {
        // Test silence
        let silence: Vec<f32> = vec![0.0; 1000];
        let (rms, peak) = calculate_audio_level(&silence);
        assert_eq!(rms, 0.0);
        assert_eq!(peak, 0.0);

        // Test full amplitude
        let full: Vec<f32> = vec![1.0; 1000];
        let (rms, peak) = calculate_audio_level(&full);
        assert_eq!(rms, 1.0);
        assert_eq!(peak, 1.0);

        // Test mixed signal
        let mixed: Vec<f32> = vec![0.0, 0.5, 1.0, -0.5, -1.0];
        let (rms, peak) = calculate_audio_level(&mixed);
        assert!(rms > 0.0 && rms < 1.0);
        assert_eq!(peak, 1.0);
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
}
