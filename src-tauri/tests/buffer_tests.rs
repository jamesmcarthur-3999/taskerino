/**
 * Integration tests for buffer management system
 */

use app_lib::audio::buffer::{
    AudioChunk, AudioRingBuffer, BackpressureDetector, BufferHealthMonitor, BufferPool,
};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[test]
fn test_ring_buffer_push_pop() {
    let buffer = AudioRingBuffer::new(10, 0.9);

    // Push a chunk
    let chunk = AudioChunk::new(vec![0.1, 0.2, 0.3], 16000, 1, 0);
    assert!(buffer.push(chunk).is_ok());
    assert_eq!(buffer.len(), 1);

    // Pop the chunk
    let popped = buffer.pop();
    assert!(popped.is_some());
    assert_eq!(buffer.len(), 0);

    let chunk = popped.unwrap();
    assert_eq!(chunk.data.len(), 3);
    assert_eq!(chunk.sample_rate, 16000);
}

#[test]
fn test_ring_buffer_backpressure() {
    let buffer = AudioRingBuffer::new(10, 0.9);

    // Fill to 90%
    for i in 0..9 {
        let chunk = AudioChunk::new(vec![0.0], 16000, 1, i);
        buffer.push(chunk).unwrap();
    }

    assert!(buffer.is_backpressure());
    assert_eq!(buffer.usage(), 0.9);
}

#[test]
fn test_buffer_pool_acquire_release() {
    let pool = BufferPool::new(1024, 10, 100);

    let buffer = pool.acquire();
    assert_eq!(buffer.len(), 1024);
    assert_eq!(pool.len(), 9);

    pool.release(buffer);
    assert_eq!(pool.len(), 10);
}

#[test]
fn test_buffer_pool_stats() {
    let pool = BufferPool::new(1024, 5, 100);

    // Acquire some buffers
    for _ in 0..3 {
        pool.acquire();
    }

    let stats = pool.stats();
    assert_eq!(stats.pool_hits, 3);
    assert_eq!(stats.current_pool_size, 2);
}

#[test]
fn test_backpressure_detector() {
    let mut detector = BackpressureDetector::new(0.9, 0.7);

    // Trigger
    let event = detector.update(0.95);
    assert!(event.is_some());
    assert!(detector.is_triggered());

    // Clear
    let event = detector.update(0.6);
    assert!(event.is_some());
    assert!(!detector.is_triggered());
}

#[test]
fn test_health_monitor() {
    let monitor = BufferHealthMonitor::new(100);

    // Record some chunks
    monitor.record_chunk(Duration::from_millis(10));
    monitor.record_chunk(Duration::from_millis(20));
    monitor.record_drop();

    let snapshot = monitor.snapshot();
    assert_eq!(snapshot.total_chunks, 2);
    assert_eq!(snapshot.dropped_chunks, 1);
    assert_eq!(snapshot.avg_latency.as_millis(), 15);
}

#[test]
fn test_concurrent_ring_buffer_operations() {
    let buffer = Arc::new(AudioRingBuffer::new(100, 0.9));
    let buffer_producer: Arc<AudioRingBuffer> = Arc::clone(&buffer);
    let buffer_consumer: Arc<AudioRingBuffer> = Arc::clone(&buffer);

    // Producer thread
    let producer = thread::spawn(move || {
        for i in 0..50 {
            let chunk = AudioChunk::new(vec![i as f32], 16000, 1, i);
            while buffer_producer.push(chunk.clone()).is_err() {
                thread::yield_now();
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

#[test]
fn test_buffer_pool_concurrent_access() {
    let pool = Arc::new(BufferPool::new(1024, 10, 100));
    let mut handles = vec![];

    for _ in 0..4 {
        let pool_clone: Arc<BufferPool> = Arc::clone(&pool);
        let handle = thread::spawn(move || {
            for _ in 0..25 {
                let buffer = pool_clone.acquire();
                thread::yield_now();
                pool_clone.release(buffer);
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    let stats = pool.stats();
    assert_eq!(stats.pool_hits + stats.pool_misses, 100);
}

#[test]
fn test_backpressure_hysteresis() {
    let mut detector = BackpressureDetector::new(0.9, 0.7);

    // Trigger at 0.9
    detector.update(0.95);
    assert!(detector.is_triggered());

    // Fluctuate - should stay triggered
    assert!(detector.update(0.85).is_none());
    assert!(detector.is_triggered());

    // Only clears below 0.7
    let event = detector.update(0.65);
    assert!(event.is_some());
    assert!(!detector.is_triggered());
}

#[test]
fn test_health_monitor_percentiles() {
    let monitor = BufferHealthMonitor::new(100);

    // Add 100 samples
    for i in 1..=100 {
        monitor.record_chunk(Duration::from_millis(i));
    }

    let snapshot = monitor.snapshot();
    assert_eq!(snapshot.p50_latency.as_millis(), 50);
    assert_eq!(snapshot.p95_latency.as_millis(), 95);
    assert_eq!(snapshot.p99_latency.as_millis(), 99);
}
