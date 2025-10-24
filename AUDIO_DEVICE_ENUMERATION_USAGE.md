# Audio Device Enumeration - Usage Guide

## Quick Start

### TypeScript/Frontend Usage

```typescript
import { invoke } from '@tauri-apps/api/core';

// Type definitions (add to src/types.ts or similar)
interface AudioDevice {
  id: string;
  name: string;
  deviceType: 'Input' | 'Output';
  isDefault: boolean;
  sampleRate: number;
  channels: number;
}

// Get all audio devices
async function getAudioDevices(): Promise<AudioDevice[]> {
  try {
    const devices = await invoke<AudioDevice[]>('get_audio_devices');
    return devices;
  } catch (error) {
    console.error('Failed to get audio devices:', error);
    throw error;
  }
}

// Example: Filter devices by type
const devices = await getAudioDevices();
const microphones = devices.filter(d => d.deviceType === 'Input');
const outputDevices = devices.filter(d => d.deviceType === 'Output');

// Example: Get default microphone
const defaultMic = microphones.find(d => d.isDefault);
console.log('Default microphone:', defaultMic?.name);

// Example: List all microphones with their specs
microphones.forEach(mic => {
  console.log(`${mic.name}: ${mic.sampleRate}Hz, ${mic.channels} channel(s)`);
});
```

### React Component Example

```tsx
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AudioDevice {
  id: string;
  name: string;
  deviceType: 'Input' | 'Output';
  isDefault: boolean;
  sampleRate: number;
  channels: number;
}

export function AudioDeviceSelector() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDevices() {
      try {
        setLoading(true);
        const audioDevices = await invoke<AudioDevice[]>('get_audio_devices');
        setDevices(audioDevices);

        // Auto-select default device
        const defaultDevice = audioDevices.find(d => d.isDefault && d.deviceType === 'Input');
        if (defaultDevice) {
          setSelectedDevice(defaultDevice.id);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load devices');
      } finally {
        setLoading(false);
      }
    }

    loadDevices();
  }, []);

  if (loading) return <div>Loading audio devices...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  const microphones = devices.filter(d => d.deviceType === 'Input');

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        Select Microphone
      </label>
      <select
        value={selectedDevice}
        onChange={(e) => setSelectedDevice(e.target.value)}
        className="w-full px-3 py-2 border rounded-md"
      >
        {microphones.map(device => (
          <option key={device.id} value={device.id}>
            {device.name}
            {device.isDefault && ' (Default)'}
            {' - '}
            {device.sampleRate / 1000}kHz, {device.channels}ch
          </option>
        ))}
      </select>
    </div>
  );
}
```

## Rust/Backend Usage

### Direct Function Call

```rust
use crate::audio_capture::enumerate_audio_devices;
use crate::types::AudioDevice;

fn example_usage() -> Result<(), String> {
    // Get all devices
    let devices = enumerate_audio_devices()?;

    // Filter by type
    let microphones: Vec<&AudioDevice> = devices
        .iter()
        .filter(|d| matches!(d.device_type, AudioDeviceType::Input))
        .collect();

    // Find default microphone
    let default_mic = microphones
        .iter()
        .find(|d| d.is_default);

    if let Some(mic) = default_mic {
        println!("Default mic: {} ({}Hz, {} channels)",
                 mic.name, mic.sample_rate, mic.channels);
    }

    Ok(())
}
```

## Device Information

### AudioDevice Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | `string` | Unique device identifier | `"Built-in Microphone"` |
| `name` | `string` | Human-readable device name | `"Built-in Microphone"` |
| `deviceType` | `'Input' \| 'Output'` | Device type | `"Input"` |
| `isDefault` | `boolean` | Whether this is the system default | `true` |
| `sampleRate` | `number` | Native sample rate in Hz | `44100` |
| `channels` | `number` | Number of audio channels | `1` or `2` |

### Device Types

- **Input**: Microphones, line-in devices
- **Output**: Speakers, headphones, system audio loopback devices

### Sample Rates

Common values:
- `16000` - 16kHz (speech recognition optimal)
- `44100` - 44.1kHz (CD quality)
- `48000` - 48kHz (professional audio)

## Error Handling

### Possible Errors

1. **"No audio devices found"**
   - Cause: No input or output devices detected
   - Solution: Check system audio settings, ensure devices are connected

2. **"Failed to enumerate input devices: [error]"**
   - Cause: System error accessing input devices
   - Solution: Check permissions, restart audio service

3. **"Failed to enumerate output devices: [error]"**
   - Cause: System error accessing output devices
   - Solution: Check permissions, restart audio service

### Error Handling Example

```typescript
try {
  const devices = await invoke<AudioDevice[]>('get_audio_devices');
  if (devices.length === 0) {
    // Show "No devices found" UI
  }
} catch (error) {
  if (error === "No audio devices found") {
    // Show specific error message
  } else {
    // Show generic error
  }
}
```

## Integration with Media Controls

### Step 1: Add Service Method

In `src/services/audioRecordingService.ts`:

```typescript
class AudioRecordingService {
  async getAvailableDevices(): Promise<AudioDevice[]> {
    return await invoke('get_audio_devices');
  }

  async getDefaultMicrophone(): Promise<AudioDevice | null> {
    const devices = await this.getAvailableDevices();
    return devices.find(d => d.deviceType === 'Input' && d.isDefault) || null;
  }
}
```

### Step 2: Add to SessionsContext

```typescript
// In StartSessionModal component
const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);

useEffect(() => {
  async function loadDevices() {
    const devices = await audioRecordingService.getAvailableDevices();
    setAudioDevices(devices);
  }
  loadDevices();
}, []);
```

### Step 3: Store Selected Device in Session

```typescript
interface Session {
  // ... existing fields
  audioConfig?: {
    micDeviceId?: string;
    systemAudioDeviceId?: string;
    sourceType: 'microphone' | 'system-audio' | 'both';
    balance?: number;
  };
}
```

## Performance Considerations

- **Enumeration Time**: < 10ms on M1 Mac
- **Memory Usage**: ~1KB per device
- **Caching**: Consider caching devices and refreshing only when needed
- **Refresh Triggers**:
  - App startup
  - User clicks "Refresh devices" button
  - Device hot-plug events (future implementation)

## Testing

### Manual Testing

1. Run the app
2. Open browser console
3. Execute:
   ```javascript
   await window.__TAURI__.core.invoke('get_audio_devices')
   ```
4. Verify output contains your audio devices

### Expected Output

```json
[
  {
    "id": "Built-in Microphone",
    "name": "Built-in Microphone",
    "deviceType": "Input",
    "isDefault": true,
    "sampleRate": 44100,
    "channels": 1
  },
  {
    "id": "Built-in Output",
    "name": "Built-in Output",
    "deviceType": "Output",
    "isDefault": true,
    "sampleRate": 44100,
    "channels": 2
  }
]
```

## Next Steps

This implementation sets the foundation for:

1. **Stage 2.2**: System audio capture using ScreenCaptureKit
2. **Stage 2.3**: Audio mixing engine (mic + system audio)
3. **Stage 2.4**: Hot-swapping devices during recording
4. **Stage 5.1**: UI components for device selection

## Troubleshooting

### No Devices Appear

1. Check system permissions: System Settings > Privacy & Security > Microphone
2. Verify audio devices in System Settings > Sound
3. Check console for error messages
4. Restart the app

### Incorrect Default Device

The default device is determined by the operating system. To change:
1. Open System Settings > Sound
2. Select desired default input/output device

### Device Names Not Showing

- This indicates a system-level issue
- Check macOS audio configuration
- Try restarting Core Audio: `sudo killall coreaudiod`
