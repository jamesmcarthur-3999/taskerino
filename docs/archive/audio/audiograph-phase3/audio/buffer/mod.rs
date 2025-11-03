/**
 * Buffer Management System for Real-Time Audio
 *
 * High-performance buffer management for zero-contention audio streaming.
 *
 * ## Components
 *
 * - **ring_buffer**: Lock-free SPSC ring buffer using crossbeam
 * - **buffer_pool**: Pre-allocated buffer pool for zero-allocation processing
 * - **backpressure**: Hysteresis-based backpressure detection
 * - **health**: Health monitoring with latency/throughput metrics
 *
 * ## Example Usage
 *
 * ```rust
 * use audio::buffer::{AudioRingBuffer, BufferPool, BackpressureDetector, BufferHealthMonitor};
 *
 * // Create ring buffer (100 chunks, 90% backpressure threshold)
 * let ring_buffer = AudioRingBuffer::new(100, 0.9);
 *
 * // Create buffer pool (1024 samples per buffer, 10 initial, 100 max)
 * let pool = BufferPool::new(1024, 10, 100);
 *
 * // Create backpressure detector (trigger at 90%, clear at 70%)
 * let mut backpressure = BackpressureDetector::new(0.9, 0.7);
 *
 * // Create health monitor (keep 100 latency samples)
 * let health = BufferHealthMonitor::new(100);
 *
 * // Producer: Push audio chunks
 * let buffer = pool.acquire();
 * // ... fill buffer with audio data ...
 * let chunk = AudioChunk::new(buffer, 16000, 1, 0);
 * if let Err(chunk) = ring_buffer.push(chunk) {
 *     health.record_drop();
 *     pool.release(chunk.data);
 * }
 *
 * // Check backpressure
 * if let Some(event) = backpressure.update(ring_buffer.usage()) {
 *     // Handle backpressure event
 * }
 *
 * // Consumer: Pop and process
 * if let Some(chunk) = ring_buffer.pop() {
 *     let start = std::time::Instant::now();
 *     // ... process chunk ...
 *     health.record_chunk(start.elapsed());
 *     pool.release(chunk.data);
 * }
 * ```
 */

pub mod backpressure;
pub mod buffer_pool;
pub mod health;
pub mod ring_buffer;

// Re-export main types for convenience
pub use backpressure::{BackpressureDetector, BackpressureEvent, BackpressureStats};
pub use buffer_pool::{BufferPool, PoolStats};
pub use health::{BufferHealthMonitor, BufferHealthSnapshot};
pub use ring_buffer::{AudioChunk, AudioRingBuffer, BufferStats};
