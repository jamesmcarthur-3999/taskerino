/**
 * Lock-Free Ring Buffer for Audio Samples
 *
 * High-performance, lock-free SPSC (Single Producer, Single Consumer) ring buffer
 * designed for real-time audio streaming with backpressure detection.
 *
 * Features:
 * - Lock-free using crossbeam's ArrayQueue
 * - Zero-contention audio streaming
 * - Backpressure detection at configurable threshold
 * - Thread-safe metrics tracking
 * - Zero-copy where possible
 */

use crossbeam::queue::ArrayQueue;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Audio chunk containing a batch of samples
/// Fixed-size buffers for predictable memory usage
#[derive(Clone, Debug)]
pub struct AudioChunk {
    /// Audio sample data (f32 samples)
    pub data: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: u16,
    /// Timestamp when chunk was created
    pub timestamp: Instant,
    /// Sequence number for ordering
    pub sequence: u64,
}

impl AudioChunk {
    /// Create a new audio chunk
    pub fn new(data: Vec<f32>, sample_rate: u32, channels: u16, sequence: u64) -> Self {
        Self {
            data,
            sample_rate,
            channels,
            timestamp: Instant::now(),
            sequence,
        }
    }

    /// Get duration of this chunk in seconds
    pub fn duration_secs(&self) -> f64 {
        self.data.len() as f64 / (self.sample_rate as f64 * self.channels as f64)
    }
}

/// Lock-free ring buffer for audio samples
/// Single-producer, single-consumer (SPSC) design
pub struct AudioRingBuffer {
    /// Lock-free queue (crossbeam ArrayQueue)
    queue: Arc<ArrayQueue<AudioChunk>>,

    /// Buffer capacity (number of chunks)
    capacity: usize,

    /// Backpressure threshold (0.0-1.0)
    backpressure_threshold: f32,

    /// Metrics - total chunks pushed
    total_pushed: Arc<AtomicU64>,

    /// Metrics - total chunks popped
    total_popped: Arc<AtomicU64>,

    /// Metrics - total chunks dropped (backpressure)
    total_dropped: Arc<AtomicU64>,

    /// Current size (approximate, for metrics)
    current_size: Arc<AtomicUsize>,
}

impl AudioRingBuffer {
    /// Create new ring buffer with specified capacity
    ///
    /// # Arguments
    /// * `capacity` - Maximum number of chunks the buffer can hold
    /// * `backpressure_threshold` - Usage percentage (0.0-1.0) to trigger backpressure
    ///
    /// # Example
    /// ```
    /// let buffer = AudioRingBuffer::new(100, 0.9); // 100 chunks, 90% threshold
    /// ```
    pub fn new(capacity: usize, backpressure_threshold: f32) -> Self {
        Self {
            queue: Arc::new(ArrayQueue::new(capacity)),
            capacity,
            backpressure_threshold: backpressure_threshold.clamp(0.0, 1.0),
            total_pushed: Arc::new(AtomicU64::new(0)),
            total_popped: Arc::new(AtomicU64::new(0)),
            total_dropped: Arc::new(AtomicU64::new(0)),
            current_size: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Push audio chunk into buffer (producer side)
    ///
    /// Returns Ok(()) if successful, Err(chunk) if buffer is full (backpressure)
    pub fn push(&self, chunk: AudioChunk) -> Result<(), AudioChunk> {
        match self.queue.push(chunk) {
            Ok(()) => {
                // Track successful push
                self.total_pushed.fetch_add(1, Ordering::Relaxed);
                self.current_size.fetch_add(1, Ordering::Relaxed);
                Ok(())
            }
            Err(chunk) => {
                // Buffer full - backpressure!
                self.total_dropped.fetch_add(1, Ordering::Relaxed);
                Err(chunk)
            }
        }
    }

    /// Pop audio chunk from buffer (consumer side)
    ///
    /// Returns Some(chunk) if available, None if buffer is empty
    pub fn pop(&self) -> Option<AudioChunk> {
        match self.queue.pop() {
            Some(chunk) => {
                self.total_popped.fetch_add(1, Ordering::Relaxed);
                self.current_size.fetch_sub(1, Ordering::Relaxed);
                Some(chunk)
            }
            None => None,
        }
    }

    /// Get current buffer usage (0.0-1.0)
    pub fn usage(&self) -> f32 {
        let size = self.current_size.load(Ordering::Relaxed);
        size as f32 / self.capacity as f32
    }

    /// Check if buffer is experiencing backpressure
    pub fn is_backpressure(&self) -> bool {
        self.usage() >= self.backpressure_threshold
    }

    /// Get buffer capacity
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Get current buffer size (approximate)
    pub fn len(&self) -> usize {
        self.current_size.load(Ordering::Relaxed)
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get total chunks pushed since creation
    pub fn total_pushed(&self) -> u64 {
        self.total_pushed.load(Ordering::Relaxed)
    }

    /// Get total chunks popped since creation
    pub fn total_popped(&self) -> u64 {
        self.total_popped.load(Ordering::Relaxed)
    }

    /// Get total chunks dropped due to backpressure
    pub fn total_dropped(&self) -> u64 {
        self.total_dropped.load(Ordering::Relaxed)
    }

    /// Get buffer statistics snapshot
    pub fn stats(&self) -> BufferStats {
        BufferStats {
            capacity: self.capacity,
            current_size: self.len(),
            usage: self.usage(),
            is_backpressure: self.is_backpressure(),
            total_pushed: self.total_pushed(),
            total_popped: self.total_popped(),
            total_dropped: self.total_dropped(),
        }
    }

    /// Clear all chunks from buffer
    pub fn clear(&self) {
        while self.pop().is_some() {}
    }
}

/// Buffer statistics snapshot
#[derive(Debug, Clone)]
pub struct BufferStats {
    pub capacity: usize,
    pub current_size: usize,
    pub usage: f32,
    pub is_backpressure: bool,
    pub total_pushed: u64,
    pub total_popped: u64,
    pub total_dropped: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_buffer() {
        let buffer = AudioRingBuffer::new(100, 0.9);
        assert_eq!(buffer.capacity(), 100);
        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
        assert_eq!(buffer.usage(), 0.0);
        assert!(!buffer.is_backpressure());
    }

    #[test]
    fn test_push_pop_operations() {
        let buffer = AudioRingBuffer::new(10, 0.9);

        // Push a chunk
        let chunk = AudioChunk::new(vec![0.1, 0.2, 0.3], 16000, 1, 0);
        assert!(buffer.push(chunk).is_ok());
        assert_eq!(buffer.len(), 1);
        assert_eq!(buffer.total_pushed(), 1);

        // Pop the chunk
        let popped = buffer.pop();
        assert!(popped.is_some());
        assert_eq!(buffer.len(), 0);
        assert_eq!(buffer.total_popped(), 1);

        let chunk = popped.unwrap();
        assert_eq!(chunk.data.len(), 3);
        assert_eq!(chunk.sample_rate, 16000);
    }

    #[test]
    fn test_backpressure_detection() {
        let buffer = AudioRingBuffer::new(10, 0.9);

        // Fill buffer to 90% (9 chunks)
        for i in 0..9 {
            let chunk = AudioChunk::new(vec![0.0], 16000, 1, i);
            assert!(buffer.push(chunk).is_ok());
        }

        assert_eq!(buffer.len(), 9);
        assert_eq!(buffer.usage(), 0.9);
        assert!(buffer.is_backpressure()); // Should trigger at 90%
    }

    #[test]
    fn test_buffer_full_returns_error() {
        let buffer = AudioRingBuffer::new(3, 0.9);

        // Fill buffer completely
        for i in 0..3 {
            let chunk = AudioChunk::new(vec![0.0], 16000, 1, i);
            assert!(buffer.push(chunk).is_ok());
        }

        // Next push should fail
        let chunk = AudioChunk::new(vec![0.0], 16000, 1, 3);
        let result = buffer.push(chunk);
        assert!(result.is_err());
        assert_eq!(buffer.total_dropped(), 1);
    }

    #[test]
    fn test_clear_buffer() {
        let buffer = AudioRingBuffer::new(10, 0.9);

        // Push some chunks
        for i in 0..5 {
            let chunk = AudioChunk::new(vec![0.0], 16000, 1, i);
            buffer.push(chunk).unwrap();
        }

        assert_eq!(buffer.len(), 5);

        buffer.clear();
        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_stats_snapshot() {
        let buffer = AudioRingBuffer::new(10, 0.9);

        // Push some chunks
        for i in 0..5 {
            let chunk = AudioChunk::new(vec![0.0], 16000, 1, i);
            buffer.push(chunk).unwrap();
        }

        let stats = buffer.stats();
        assert_eq!(stats.capacity, 10);
        assert_eq!(stats.current_size, 5);
        assert_eq!(stats.usage, 0.5);
        assert!(!stats.is_backpressure);
        assert_eq!(stats.total_pushed, 5);
        assert_eq!(stats.total_popped, 0);
        assert_eq!(stats.total_dropped, 0);
    }

    #[test]
    fn test_audio_chunk_duration() {
        // 16000 samples/sec, mono, 8000 samples = 0.5 seconds
        let chunk = AudioChunk::new(vec![0.0; 8000], 16000, 1, 0);
        assert!((chunk.duration_secs() - 0.5).abs() < 0.001);

        // 48000 samples/sec, stereo, 48000 samples = 0.5 seconds
        let chunk = AudioChunk::new(vec![0.0; 48000], 48000, 2, 0);
        assert!((chunk.duration_secs() - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_concurrent_push_pop() {
        use std::thread;

        let buffer = Arc::new(AudioRingBuffer::new(100, 0.9));
        let buffer_producer = Arc::clone(&buffer);
        let buffer_consumer = Arc::clone(&buffer);

        // Producer thread
        let producer = thread::spawn(move || {
            for i in 0..50 {
                let chunk = AudioChunk::new(vec![i as f32], 16000, 1, i);
                while buffer_producer.push(chunk.clone()).is_err() {
                    thread::yield_now(); // Wait if full
                }
            }
        });

        // Consumer thread
        let consumer = thread::spawn(move || {
            let mut consumed = 0;
            while consumed < 50 {
                if buffer_consumer.pop().is_some() {
                    consumed += 1;
                } else {
                    thread::yield_now();
                }
            }
            consumed
        });

        producer.join().unwrap();
        let consumed = consumer.join().unwrap();

        assert_eq!(consumed, 50);
        assert_eq!(buffer.total_pushed(), 50);
        assert_eq!(buffer.total_popped(), 50);
    }
}
