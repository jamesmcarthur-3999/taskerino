use rayon::prelude::*;
use std::path::PathBuf;
use std::time::Instant;
/**
 * Attachment Loader Module (Task 3A)
 *
 * Parallel attachment loading using Rust + Rayon
 * Batch loads attachment metadata for faster initial renders
 */
use tauri::{AppHandle, Manager};

use crate::session_models::AttachmentMeta;

/**
 * Load attachment metadata in parallel (no base64 data)
 * Fast for building UI lists without loading full attachments
 */
#[tauri::command]
pub async fn load_attachments_metadata_parallel(
    attachment_ids: Vec<String>,
    app_handle: AppHandle,
) -> Result<Vec<AttachmentMeta>, String> {
    println!(
        "🦀 [RUST] Loading {} attachment metadata in parallel...",
        attachment_ids.len()
    );
    let start = Instant::now();

    // Get attachments directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let attachments_dir = data_dir.join("attachments");

    if !attachments_dir.exists() {
        println!("⚠️  [RUST] Attachments directory not found");
        return Ok(vec![]);
    }

    // Load metadata in PARALLEL using rayon
    let metadata: Vec<AttachmentMeta> = attachment_ids
        .into_par_iter()
        .filter_map(|id| {
            // Construct path to metadata file
            let meta_path = attachments_dir.join(format!("{}.meta.json", id));

            // Read metadata file
            match std::fs::read_to_string(&meta_path) {
                Ok(content) => {
                    // Parse JSON
                    match serde_json::from_str::<AttachmentMeta>(&content) {
                        Ok(meta) => Some(meta),
                        Err(e) => {
                            eprintln!("Failed to parse metadata for {}: {}", id, e);
                            None
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read metadata file for {}: {}", id, e);
                    None
                }
            }
        })
        .collect();

    let elapsed = start.elapsed();
    println!(
        "✅ [RUST] Loaded {} metadata files in {:?} (parallel)",
        metadata.len(),
        elapsed
    );
    println!(
        "⚡ [PERFORMANCE] CPU cores utilized: {}",
        rayon::current_num_threads()
    );

    Ok(metadata)
}

/**
 * Check if attachments exist (fast batch check)
 * Returns list of IDs that exist on disk
 */
#[tauri::command]
pub async fn check_attachments_exist(
    attachment_ids: Vec<String>,
    app_handle: AppHandle,
) -> Result<Vec<String>, String> {
    println!(
        "🦀 [RUST] Checking existence of {} attachments...",
        attachment_ids.len()
    );
    let start = Instant::now();

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let attachments_dir = data_dir.join("attachments");

    if !attachments_dir.exists() {
        return Ok(vec![]);
    }

    let total_count = attachment_ids.len();

    // Check existence in PARALLEL
    let existing: Vec<String> = attachment_ids
        .into_par_iter()
        .filter(|id| {
            let meta_path = attachments_dir.join(format!("{}.meta.json", id));
            let data_path = attachments_dir.join(format!("{}.dat", id));
            meta_path.exists() || data_path.exists()
        })
        .collect();

    let elapsed = start.elapsed();
    println!(
        "✅ [RUST] Checked {} attachments in {:?}, found {}",
        total_count,
        elapsed,
        existing.len()
    );

    Ok(existing)
}

/**
 * Get total size of attachments (for storage analytics)
 */
#[tauri::command]
pub async fn get_attachments_total_size(app_handle: AppHandle) -> Result<u64, String> {
    println!("🦀 [RUST] Calculating total attachment size...");
    let start = Instant::now();

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let attachments_dir = data_dir.join("attachments");

    if !attachments_dir.exists() {
        return Ok(0);
    }

    // Read directory
    let entries = std::fs::read_dir(&attachments_dir)
        .map_err(|e| format!("Failed to read attachments directory: {}", e))?;

    // Calculate total size in PARALLEL
    let total_size: u64 = entries
        .par_bridge() // Convert iterator to parallel iterator
        .filter_map(|entry| entry.ok().and_then(|e| e.metadata().ok().map(|m| m.len())))
        .sum();

    let elapsed = start.elapsed();
    println!(
        "✅ [RUST] Total size: {} bytes ({} MB) calculated in {:?}",
        total_size,
        total_size / 1024 / 1024,
        elapsed
    );

    Ok(total_size)
}

/**
 * Count attachments by type (analytics)
 */
#[derive(serde::Serialize)]
pub struct AttachmentCounts {
    pub total: usize,
    pub images: usize,
    pub audio: usize,
    pub video: usize,
    pub other: usize,
}

#[tauri::command]
pub async fn count_attachments_by_type(app_handle: AppHandle) -> Result<AttachmentCounts, String> {
    println!("🦀 [RUST] Counting attachments by type...");
    let start = Instant::now();

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let attachments_dir = data_dir.join("attachments");

    if !attachments_dir.exists() {
        return Ok(AttachmentCounts {
            total: 0,
            images: 0,
            audio: 0,
            video: 0,
            other: 0,
        });
    }

    // Read all metadata files
    let entries = std::fs::read_dir(&attachments_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let meta_files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
        .collect();

    // Count in PARALLEL
    let counts = meta_files
        .into_par_iter()
        .filter_map(|path| {
            std::fs::read_to_string(&path)
                .ok()
                .and_then(|content| serde_json::from_str::<AttachmentMeta>(&content).ok())
        })
        .fold(
            || (0usize, 0usize, 0usize, 0usize),
            |(mut images, mut audio, mut video, mut other), meta| {
                if meta.mime_type.starts_with("image/") {
                    images += 1;
                } else if meta.mime_type.starts_with("audio/") {
                    audio += 1;
                } else if meta.mime_type.starts_with("video/") {
                    video += 1;
                } else {
                    other += 1;
                }
                (images, audio, video, other)
            },
        )
        .reduce(
            || (0, 0, 0, 0),
            |a, b| (a.0 + b.0, a.1 + b.1, a.2 + b.2, a.3 + b.3),
        );

    let total = counts.0 + counts.1 + counts.2 + counts.3;

    let elapsed = start.elapsed();
    println!("✅ [RUST] Counted {} attachments in {:?}", total, elapsed);

    Ok(AttachmentCounts {
        total,
        images: counts.0,
        audio: counts.1,
        video: counts.2,
        other: counts.3,
    })
}
