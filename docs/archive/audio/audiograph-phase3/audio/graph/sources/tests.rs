//! Additional tests for sources
//!
//! Note: Individual sources have their own test modules.
//! This file is for cross-source integration tests.

use super::*;
use crate::audio::graph::traits::AudioSource;
use crate::audio::platform::mock::MockAudioDevice;

#[test]
fn test_multiple_microphone_sources() {
        // Create two different sources
        let device1 = MockAudioDevice::new_sine_wave(440.0, 1);
        let device2 = MockAudioDevice::new_sine_wave(880.0, 1);

        let mut source1 = MicrophoneSource::new(Box::new(device1)).unwrap();
        let mut source2 = MicrophoneSource::new(Box::new(device2)).unwrap();

        // Both should start independently
        assert!(source1.start().is_ok());
        assert!(source2.start().is_ok());

        // Both should produce data
        assert!(source1.read().unwrap().is_some());
        assert!(source2.read().unwrap().is_some());

        // Both should stop independently
        assert!(source1.stop().is_ok());
        assert!(source2.stop().is_ok());
    }
