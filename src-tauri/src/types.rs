use serde::{Deserialize, Serialize};

/// Audio device type (input or output)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AudioDeviceType {
    Input,
    Output,
}

/// Audio device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    /// Unique device identifier
    pub id: String,

    /// Human-readable device name
    pub name: String,

    /// Device type (input for microphones, output for system audio loopback)
    #[serde(rename = "deviceType")]
    pub device_type: AudioDeviceType,

    /// Whether this is the system default device
    #[serde(rename = "isDefault")]
    pub is_default: bool,

    /// Native sample rate in Hz
    #[serde(rename = "sampleRate")]
    pub sample_rate: u32,

    /// Number of audio channels
    pub channels: u16,
}

/// Display information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayInfo {
    #[serde(rename = "displayId")]
    pub display_id: String,

    #[serde(rename = "displayName")]
    pub display_name: String,

    pub width: u32,
    pub height: u32,

    #[serde(rename = "isPrimary")]
    pub is_primary: bool,

    pub thumbnail: Option<String>,

    #[serde(rename = "thumbnailDataUri")]
    pub thumbnail_data_uri: Option<String>,
}

/// Window information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    #[serde(rename = "windowId")]
    pub window_id: String,

    pub title: String,

    #[serde(rename = "owningApp")]
    pub owning_app: String,

    #[serde(rename = "bundleId")]
    pub bundle_id: String,

    pub bounds: WindowBounds,
    pub layer: i32,

    #[serde(rename = "thumbnailDataUri")]
    pub thumbnail_data_uri: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Webcam device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebcamInfo {
    #[serde(rename = "deviceId")]
    pub device_id: String,

    #[serde(rename = "deviceName")]
    pub device_name: String,

    pub position: String,
    pub manufacturer: String,
}

/// Video source type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum VideoSourceType {
    Display,
    Window,
    Webcam,
    DisplayWithWebcam,
}

/// PiP position
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PiPPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

/// PiP size
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PiPSize {
    Small,
    Medium,
    Large,
}

/// PiP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiPConfig {
    pub enabled: bool,
    pub position: PiPPosition,
    pub size: PiPSize,

    #[serde(rename = "borderRadius")]
    pub border_radius: Option<u32>,
}

/// Video quality preset
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VideoQuality {
    Low,
    Medium,
    High,
    Ultra,
}

/// Video recording configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoRecordingConfig {
    #[serde(rename = "sourceType")]
    pub source_type: VideoSourceType,

    #[serde(rename = "displayIds")]
    pub display_ids: Option<Vec<String>>,

    #[serde(rename = "windowIds")]
    pub window_ids: Option<Vec<String>>,

    #[serde(rename = "webcamDeviceId")]
    pub webcam_device_id: Option<String>,

    #[serde(rename = "pipConfig")]
    pub pip_config: Option<PiPConfig>,

    pub quality: VideoQuality,
    pub fps: u32,

    pub resolution: Option<VideoResolution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoResolution {
    pub width: u32,
    pub height: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_video_source_type_serialization() {
        // Verify VideoSourceType serializes with kebab-case
        let display = VideoSourceType::Display;
        let json = serde_json::to_string(&display).unwrap();
        assert_eq!(json, r#""display""#);

        let window = VideoSourceType::Window;
        let json = serde_json::to_string(&window).unwrap();
        assert_eq!(json, r#""window""#);

        let webcam = VideoSourceType::Webcam;
        let json = serde_json::to_string(&webcam).unwrap();
        assert_eq!(json, r#""webcam""#);

        let display_with_webcam = VideoSourceType::DisplayWithWebcam;
        let json = serde_json::to_string(&display_with_webcam).unwrap();
        assert_eq!(json, r#""display-with-webcam""#);
    }

    #[test]
    fn test_pip_position_serialization() {
        // Verify PiPPosition serializes with kebab-case
        let top_left = PiPPosition::TopLeft;
        let json = serde_json::to_string(&top_left).unwrap();
        assert_eq!(json, r#""top-left""#);

        let bottom_right = PiPPosition::BottomRight;
        let json = serde_json::to_string(&bottom_right).unwrap();
        assert_eq!(json, r#""bottom-right""#);
    }

    #[test]
    fn test_pip_size_serialization() {
        // Verify PiPSize serializes with lowercase
        let small = PiPSize::Small;
        let json = serde_json::to_string(&small).unwrap();
        assert_eq!(json, r#""small""#);

        let medium = PiPSize::Medium;
        let json = serde_json::to_string(&medium).unwrap();
        assert_eq!(json, r#""medium""#);

        let large = PiPSize::Large;
        let json = serde_json::to_string(&large).unwrap();
        assert_eq!(json, r#""large""#);
    }

    #[test]
    fn test_video_quality_serialization() {
        // Verify VideoQuality serializes with lowercase
        let low = VideoQuality::Low;
        let json = serde_json::to_string(&low).unwrap();
        assert_eq!(json, r#""low""#);

        let ultra = VideoQuality::Ultra;
        let json = serde_json::to_string(&ultra).unwrap();
        assert_eq!(json, r#""ultra""#);
    }

    #[test]
    fn test_video_recording_config_serialization() {
        // Verify VideoRecordingConfig serializes with camelCase
        let config = VideoRecordingConfig {
            source_type: VideoSourceType::DisplayWithWebcam,
            display_ids: Some(vec!["display-1".to_string()]),
            window_ids: None,
            webcam_device_id: Some("cam-456".to_string()),
            pip_config: Some(PiPConfig {
                enabled: true,
                position: PiPPosition::BottomRight,
                size: PiPSize::Small,
                border_radius: Some(10),
            }),
            quality: VideoQuality::High,
            fps: 30,
            resolution: Some(VideoResolution {
                width: 1920,
                height: 1080,
            }),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains(r#""sourceType":"display-with-webcam""#));
        assert!(json.contains(r#""displayIds":["display-1"]"#));
        assert!(json.contains(r#""webcamDeviceId":"cam-456""#));
        assert!(json.contains(r#""pipConfig""#));
        assert!(json.contains(r#""borderRadius":10"#));
        assert!(json.contains(r#""quality":"high""#));
        assert!(json.contains(r#""fps":30"#));
    }

    #[test]
    fn test_video_recording_config_deserialization() {
        // Verify VideoRecordingConfig deserializes from TypeScript JSON
        let json = r#"{
            "sourceType": "display-with-webcam",
            "displayIds": ["display-1", "display-2"],
            "webcamDeviceId": "cam-456",
            "pipConfig": {
                "enabled": true,
                "position": "bottom-right",
                "size": "small",
                "borderRadius": 10
            },
            "quality": "ultra",
            "fps": 60,
            "resolution": {
                "width": 1920,
                "height": 1080
            }
        }"#;

        let config: VideoRecordingConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.source_type, VideoSourceType::DisplayWithWebcam);
        assert_eq!(
            config.display_ids,
            Some(vec!["display-1".to_string(), "display-2".to_string()])
        );
        assert_eq!(config.webcam_device_id, Some("cam-456".to_string()));
        assert!(config.pip_config.is_some());
        assert_eq!(config.quality, VideoQuality::Ultra);
        assert_eq!(config.fps, 60);
    }

    #[test]
    fn test_display_info_serialization() {
        // Verify DisplayInfo serializes with camelCase
        let display = DisplayInfo {
            display_id: "display-1".to_string(),
            display_name: "Built-in Retina Display".to_string(),
            width: 2880,
            height: 1800,
            is_primary: true,
            thumbnail: None,
            thumbnail_data_uri: None,
        };

        let json = serde_json::to_string(&display).unwrap();
        assert!(json.contains(r#""displayId":"display-1""#));
        assert!(json.contains(r#""displayName":"Built-in Retina Display""#));
        assert!(json.contains(r#""isPrimary":true"#));
    }

    #[test]
    fn test_audio_device_serialization() {
        // Verify AudioDevice serializes with camelCase
        let device = AudioDevice {
            id: "mic-123".to_string(),
            name: "Built-in Microphone".to_string(),
            device_type: AudioDeviceType::Input,
            is_default: true,
            sample_rate: 44100,
            channels: 1,
        };

        let json = serde_json::to_string(&device).unwrap();
        assert!(json.contains(r#""deviceType":"Input""#));
        assert!(json.contains(r#""isDefault":true"#));
        assert!(json.contains(r#""sampleRate":44100"#));
    }
}
