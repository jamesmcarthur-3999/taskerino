//! In-memory buffer sink for testing and preview
//!
//! Accumulates audio buffers in memory up to a specified limit. Useful for
//! testing audio pipelines, generating previews, or temporary storage before
//! encoding to a final format.

use crate::audio::graph::traits::{AudioBuffer, AudioError, AudioFormat, AudioSink, SinkStats};
use std::sync::{Arc, Mutex};

/// Buffer sink that accumulates audio buffers in memory
///
/// Stores buffers up to a maximum count to prevent out-of-memory errors.
/// Useful for testing, preview generation, and temporary audio storage.
///
/// # Thread Safety
///
/// The internal buffer is protected by a Mutex, making this sink safe to
/// share across threads.
///
/// # Example
///
/// ```rust,no_run
/// use audio::sinks::BufferSink;
/// use audio::graph::traits::AudioSink;
///
/// let mut sink = BufferSink::new(100); // Store up to 100 buffers
///
/// // Write buffers
/// for buffer in buffers {
///     sink.write(buffer)?;
/// }
///
/// // Retrieve accumulated buffers
/// let all_buffers = sink.get_buffers();
/// println!("Accumulated {} buffers", all_buffers.len());
/// ```
pub struct BufferSink {
    /// Accumulated buffers (protected by Mutex for thread safety)
    buffers: Arc<Mutex<Vec<AudioBuffer>>>,
    /// Maximum number of buffers to store
    max_buffers: usize,
    /// Audio format (set on first write)
    format: Option<AudioFormat>,
    /// Sink statistics
    stats: SinkStats,
}

impl BufferSink {
    /// Creates a new buffer sink with specified capacity.
    ///
    /// # Arguments
    ///
    /// * `max_buffers` - Maximum number of buffers to store (prevents OOM)
    ///
    /// # Example
    ///
    /// ```rust
    /// let sink = BufferSink::new(100); // Store up to 100 buffers
    /// ```
    pub fn new(max_buffers: usize) -> Self {
        Self {
            buffers: Arc::new(Mutex::new(Vec::with_capacity(max_buffers.min(1000)))),
            max_buffers,
            format: None,
            stats: SinkStats::default(),
        }
    }

    /// Returns all accumulated buffers.
    ///
    /// This clones all buffers (Arc clones, not sample data), so it's
    /// relatively cheap but not free.
    pub fn get_buffers(&self) -> Vec<AudioBuffer> {
        self.buffers
            .lock()
            .expect("Buffer lock poisoned")
            .clone()
    }

    /// Returns the number of buffers currently stored.
    pub fn buffer_count(&self) -> usize {
        self.buffers
            .lock()
            .expect("Buffer lock poisoned")
            .len()
    }

    /// Clears all accumulated buffers.
    ///
    /// This resets the sink to an empty state, freeing memory.
    pub fn clear(&mut self) {
        self.buffers
            .lock()
            .expect("Buffer lock poisoned")
            .clear();
    }

    /// Returns the audio format of stored buffers (if any).
    pub fn format(&self) -> Option<AudioFormat> {
        self.format
    }

    /// Checks if the sink is full (at max capacity).
    pub fn is_full(&self) -> bool {
        self.buffer_count() >= self.max_buffers
    }

    /// Returns the maximum capacity of this sink.
    pub fn capacity(&self) -> usize {
        self.max_buffers
    }

    /// Returns a clone of the internal buffer Arc for shared access.
    ///
    /// This allows multiple consumers to access the buffered audio data
    /// without transferring ownership. Useful for monitoring or preview
    /// while the sink continues to accumulate data.
    pub fn get_buffer_arc(&self) -> Arc<Mutex<Vec<AudioBuffer>>> {
        Arc::clone(&self.buffers)
    }
}

impl AudioSink for BufferSink {
    fn write(&mut self, buffer: AudioBuffer) -> Result<(), AudioError> {
        // Store format on first write
        if self.format.is_none() {
            self.format = Some(buffer.format);
        } else {
            // Verify format consistency
            if let Some(expected_format) = self.format {
                if buffer.format != expected_format {
                    return Err(AudioError::FormatError(format!(
                        "Buffer format {:?} does not match sink format {:?}",
                        buffer.format, expected_format
                    )));
                }
            }
        }

        let mut buffers = self.buffers.lock().expect("Buffer lock poisoned");

        if buffers.len() >= self.max_buffers {
            return Err(AudioError::BufferError(format!(
                "Buffer sink full (max: {})",
                self.max_buffers
            )));
        }

        buffers.push(buffer);
        self.stats.buffers_written += 1;
        self.stats.samples_written += buffers.last().unwrap().samples.len() as u64;
        self.stats.bytes_written = self.stats.samples_written * 4; // f32 = 4 bytes

        Ok(())
    }

    fn flush(&mut self) -> Result<(), AudioError> {
        // No-op for in-memory sink
        Ok(())
    }

    fn close(&mut self) -> Result<(), AudioError> {
        // No-op for in-memory sink (could optionally clear buffers)
        Ok(())
    }

    fn name(&self) -> &str {
        "BufferSink"
    }

    fn stats(&self) -> SinkStats {
        self.stats.clone()
    }
}

impl Default for BufferSink {
    fn default() -> Self {
        Self::new(20000) // Default capacity: 20,000 buffers (massive headroom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn create_test_buffer(format: AudioFormat, num_samples: usize) -> AudioBuffer {
        let samples: Vec<f32> = vec![0.5; num_samples];
        AudioBuffer::new(format, samples, Instant::now())
    }

    #[test]
    fn test_buffer_sink_creation() {
        let sink = BufferSink::new(100);
        assert_eq!(sink.capacity(), 100);
        assert_eq!(sink.buffer_count(), 0);
        assert!(!sink.is_full());
    }

    #[test]
    fn test_write_and_retrieve() {
        let mut sink = BufferSink::new(100);
        let format = AudioFormat::speech();

        for _ in 0..10 {
            let buffer = create_test_buffer(format, 160);
            sink.write(buffer).unwrap();
        }

        assert_eq!(sink.buffer_count(), 10);
        let buffers = sink.get_buffers();
        assert_eq!(buffers.len(), 10);
        assert_eq!(buffers[0].samples.len(), 160);
    }

    #[test]
    fn test_buffer_overflow() {
        let mut sink = BufferSink::new(10); // Small capacity

        // Fill to capacity
        for _ in 0..10 {
            let buffer = create_test_buffer(AudioFormat::speech(), 160);
            assert!(sink.write(buffer).is_ok());
        }

        assert!(sink.is_full());

        // 11th write should error
        let buffer = create_test_buffer(AudioFormat::speech(), 160);
        let result = sink.write(buffer);
        assert!(result.is_err());
        if let Err(AudioError::BufferError(msg)) = result {
            assert!(msg.contains("full"));
        } else {
            panic!("Expected BufferError");
        }
    }

    #[test]
    fn test_clear() {
        let mut sink = BufferSink::new(100);

        for _ in 0..50 {
            let buffer = create_test_buffer(AudioFormat::speech(), 160);
            sink.write(buffer).unwrap();
        }

        assert_eq!(sink.buffer_count(), 50);

        sink.clear();
        assert_eq!(sink.buffer_count(), 0);
    }

    #[test]
    fn test_format_tracking() {
        let mut sink = BufferSink::new(100);
        assert!(sink.format().is_none());

        let buffer = create_test_buffer(AudioFormat::speech(), 160);
        sink.write(buffer).unwrap();

        assert!(sink.format().is_some());
        assert_eq!(sink.format().unwrap(), AudioFormat::speech());
    }

    #[test]
    fn test_format_mismatch() {
        let mut sink = BufferSink::new(100);

        // Write first buffer with speech format
        let buffer1 = create_test_buffer(AudioFormat::speech(), 160);
        sink.write(buffer1).unwrap();

        // Try to write with different format
        let wrong_format = AudioFormat::new(48000, 2, crate::audio::graph::traits::SampleFormat::F32);
        let buffer2 = create_test_buffer(wrong_format, 160);
        let result = sink.write(buffer2);

        assert!(result.is_err());
        if let Err(AudioError::FormatError(msg)) = result {
            assert!(msg.contains("does not match"));
        } else {
            panic!("Expected FormatError");
        }
    }

    #[test]
    fn test_stats_tracking() {
        let mut sink = BufferSink::new(100);

        for _ in 0..5 {
            let buffer = create_test_buffer(AudioFormat::speech(), 160);
            sink.write(buffer).unwrap();
        }

        let stats = sink.stats();
        assert_eq!(stats.buffers_written, 5);
        assert_eq!(stats.samples_written, 800); // 5 * 160
    }

    #[test]
    fn test_flush_close_no_op() {
        let mut sink = BufferSink::new(100);
        let buffer = create_test_buffer(AudioFormat::speech(), 160);
        sink.write(buffer).unwrap();

        assert!(sink.flush().is_ok());
        assert!(sink.close().is_ok());

        // Buffers should still be accessible after close
        assert_eq!(sink.buffer_count(), 1);
    }

    #[test]
    fn test_default_capacity() {
        let sink = BufferSink::default();
        assert_eq!(sink.capacity(), 1000);
    }

    #[test]
    fn test_thread_safety() {
        use std::thread;

        let sink = Arc::new(Mutex::new(BufferSink::new(1000)));
        let mut handles = vec![];

        // Spawn 10 threads, each writing 10 buffers
        for _ in 0..10 {
            let sink_clone = Arc::clone(&sink);
            let handle = thread::spawn(move || {
                for _ in 0..10 {
                    let buffer = create_test_buffer(AudioFormat::speech(), 160);
                    let mut sink_guard = sink_clone.lock().unwrap();
                    sink_guard.write(buffer).unwrap();
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        let sink_guard = sink.lock().unwrap();
        assert_eq!(sink_guard.buffer_count(), 100); // 10 threads * 10 buffers
    }

    #[test]
    fn test_name() {
        let sink = BufferSink::new(100);
        assert_eq!(sink.name(), "BufferSink");
    }
}
