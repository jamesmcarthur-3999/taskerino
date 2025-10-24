/**
 * Session Models for Rust Backend
 *
 * Defines lightweight data structures for parallel session processing
 * Used by session_storage and attachment_loader modules
 */
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: Option<String>,
    pub duration: Option<i64>,
    pub category: Option<String>,
    pub screenshots: Option<Vec<Screenshot>>,
    #[serde(rename = "audioSegments")]
    pub audio_segments: Option<Vec<AudioSegment>>,
    pub video: Option<Video>,
    pub notes: Option<String>,
    pub transcript: Option<String>,
}

/// Lightweight session summary (no full data arrays)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: Option<String>,
    pub duration: Option<i64>,
    pub category: Option<String>,
    #[serde(rename = "screenshotCount")]
    pub screenshot_count: usize,
    #[serde(rename = "audioSegmentCount")]
    pub audio_segment_count: usize,
    #[serde(rename = "hasVideo")]
    pub has_video: bool,
    #[serde(rename = "hasNotes")]
    pub has_notes: bool,
    #[serde(rename = "hasTranscript")]
    pub has_transcript: bool,
}

impl From<Session> for SessionSummary {
    fn from(session: Session) -> Self {
        SessionSummary {
            id: session.id,
            name: session.name,
            start_time: session.start_time,
            end_time: session.end_time,
            duration: session.duration,
            category: session.category,
            screenshot_count: session.screenshots.as_ref().map(|s| s.len()).unwrap_or(0),
            audio_segment_count: session
                .audio_segments
                .as_ref()
                .map(|a| a.len())
                .unwrap_or(0),
            has_video: session.video.is_some(),
            has_notes: session.notes.is_some() && !session.notes.as_ref().unwrap().is_empty(),
            has_transcript: session.transcript.is_some()
                && !session.transcript.as_ref().unwrap().is_empty(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: String,
    #[serde(rename = "attachmentId")]
    pub attachment_id: String,
    pub timestamp: String,
    #[serde(rename = "relativeTime")]
    pub relative_time: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSegment {
    pub id: String,
    #[serde(rename = "attachmentId")]
    pub attachment_id: String,
    pub timestamp: String,
    pub duration: f64,
    #[serde(rename = "startTime")]
    pub start_time: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    #[serde(rename = "fullVideoAttachmentId")]
    pub full_video_attachment_id: String,
    pub duration: Option<f64>,
}

/// Attachment metadata (for parallel loading)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentMeta {
    pub id: String,
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub name: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub size: usize,
}
