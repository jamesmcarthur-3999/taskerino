/**
 * VideoChapteringService
 *
 * Analyzes session timeline data to detect chapter boundaries.
 * Uses AI to understand topic transitions and segment the session.
 */

import type { Session, VideoChapter, SessionScreenshot, SessionAudioSegment, SessionContextItem, VideoFrame } from '../types';
import { videoFrameExtractor } from './videoFrameExtractor';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { getStorage } from './storage';
import { invoke } from '@tauri-apps/api/core';
import type {
  ClaudeChatResponse,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeImageSource,
} from '../types/tauri-ai-commands';

export interface ChapterProposal {
  startTime: number;
  endTime: number;
  title: string;
  summary: string;
  keyTopics: string[];
  confidence: number;
  reasoning: string; // Why this is a chapter boundary
}

class VideoChapteringService {
  /**
   * Analyze session and propose chapter boundaries
   *
   * Strategy:
   * 1. Collect timeline data (screenshots with AI analysis, audio transcripts)
   * 2. Sample video frames at intervals
   * 3. Send to Claude for chapter boundary detection
   * 4. Return proposed chapters
   */
  async proposeChapters(session: Session): Promise<ChapterProposal[]> {
    console.log(`📖 [CHAPTERING] Analyzing session ${session.id} for chapters`);

    // Check if we have video OR screenshots
    const hasVideo = !!(session.video?.path || session.video?.optimizedPath);
    const hasScreenshots = session.screenshots && session.screenshots.length > 0;

    if (!hasVideo && !hasScreenshots) {
      throw new Error('Session has no video recording or screenshots for chaptering');
    }

    // 1. Collect timeline data
    const timelineData = this.buildTimelineData(session);

    // 2. Get frames from video OR screenshots
    let frames: VideoFrame[];

    if (hasVideo) {
      // Use video frames (existing logic with adaptive sampling)
      const videoPath = session.video!.path;
      if (!videoPath) {
        throw new Error('Video file path not found in session.video');
      }

      const duration = session.video!.duration || 0;
      const interval = this.getAdaptiveFrameInterval(duration);
      console.log(`📊 [CHAPTERING] Using adaptive video sampling: ${interval}s interval for ${duration}s video (${Math.ceil(duration / interval)} frames)`);

      frames = await videoFrameExtractor.extractFramesAtInterval(
        videoPath,
        duration,
        interval
      );
    } else {
      // Fallback: Use screenshots (already have timestamps and images)
      console.log(`📸 [CHAPTERING] No video found, using ${session.screenshots!.length} screenshots for chaptering`);

      // Convert screenshots to VideoFrame format
      frames = await this.convertScreenshotsToFrames(session);

      // Apply adaptive sampling to screenshots too (if too many)
      if (frames.length > 20) {
        const samplingRate = Math.ceil(frames.length / 20);
        frames = frames.filter((_, index) => index % samplingRate === 0);
        console.log(`📊 [CHAPTERING] Sampled ${frames.length} screenshots (every ${samplingRate}th screenshot)`);
      }
    }

    // 3. Build Claude prompt
    const prompt = this.buildChapterAnalysisPrompt(session, timelineData, frames);

    // 4. Call Claude API with frames
    const chapters = await this.callClaudeForChapters(prompt, frames);

    console.log(`✅ [CHAPTERING] Proposed ${chapters.length} chapters`);
    return chapters;
  }

  /**
   * Calculate adaptive frame sampling interval
   * Targets 15-20 frames total regardless of session length
   *
   * Strategy:
   * - Short sessions (< 5 min): Sample frequently for detail
   * - Medium sessions (5-60 min): Aim for ~20 frames
   * - Long sessions (60+ min): Aim for ~15 frames (high-level overview)
   *
   * @param durationSeconds - Video duration in seconds
   * @returns Sampling interval in seconds
   */
  private getAdaptiveFrameInterval(durationSeconds: number): number {
    // Short sessions: sample frequently for detail
    if (durationSeconds < 300) return 15;

    // Medium-long sessions: aim for ~20 frames
    if (durationSeconds < 3600) return Math.ceil(durationSeconds / 20);

    // Very long sessions: aim for ~15 frames (high-level overview)
    return Math.ceil(durationSeconds / 15);
  }

  /**
   * Build timeline data summary for Claude
   */
  private buildTimelineData(session: Session): string {
    const sessionStart = new Date(session.startTime).getTime();

    let timeline = `Session: ${session.name}\n`;
    timeline += `Duration: ${this.formatDuration((session.endTime ? new Date(session.endTime).getTime() : Date.now()) - sessionStart)}\n\n`;
    timeline += `Timeline Items:\n\n`;

    // Add screenshots with AI analysis
    const screenshots = (session.screenshots || []).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    screenshots.forEach(screenshot => {
      const offsetSeconds = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
      timeline += `[${this.formatTime(offsetSeconds)}] Screenshot\n`;

      if (screenshot.aiAnalysis?.detectedActivity) {
        timeline += `  Activity: ${screenshot.aiAnalysis.detectedActivity}\n`;
      }
      if (screenshot.aiAnalysis?.summary) {
        timeline += `  Summary: ${screenshot.aiAnalysis.summary}\n`;
      }
      timeline += `\n`;
    });

    // Add audio segments with transcripts
    const audioSegments = (session.audioSegments || []).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    audioSegments.forEach(segment => {
      const offsetSeconds = (new Date(segment.timestamp).getTime() - sessionStart) / 1000;
      timeline += `[${this.formatTime(offsetSeconds)}] Audio\n`;

      if (segment.transcription) {
        timeline += `  Transcript: "${segment.transcription}"\n`;
      }
      timeline += `\n`;
    });

    // Add context items (user notes)
    const contextItems = (session.contextItems || []).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    contextItems.forEach(item => {
      const offsetSeconds = (new Date(item.timestamp).getTime() - sessionStart) / 1000;
      timeline += `[${this.formatTime(offsetSeconds)}] User Note\n`;
      timeline += `  Content: "${item.content}"\n\n`;
    });

    return timeline;
  }

  /**
   * Build Claude prompt for chapter analysis
   */
  private buildChapterAnalysisPrompt(
    session: Session,
    timelineData: string,
    frames: VideoFrame[]
  ): string {
    const frameTimestamps = frames.map(f => this.formatTime(f.timestamp)).join(', ');

    return `You are analyzing a work session recording to detect natural chapter boundaries.

I've attached ${frames.length} video frames (sampled every 30 seconds at: ${frameTimestamps}) along with timeline data from the session.

${timelineData}

Please analyze the video frames and timeline data to propose chapter markers. A chapter should represent a distinct phase or topic in the work session.

Look for:
- Major topic transitions visible in the frames (e.g., switching from coding to documentation, different applications)
- Activity changes (e.g., debugging → implementation → testing)
- User notes in the timeline that signal new sections
- Visual changes in the screen (different apps, different files, different UI states)
- Correlations between audio transcripts and visual changes

Return your analysis as a JSON array of chapters:

[
  {
    "startTime": 0,
    "endTime": 120,
    "title": "Setting Up Development Environment",
    "summary": "Installing dependencies and configuring VS Code",
    "keyTopics": ["npm install", "VS Code", "git"],
    "confidence": 0.9,
    "reasoning": "Clear transition from terminal commands to VS Code editor visible in frames at 2:00"
  },
  ...
]

Guidelines:
- Minimum chapter length: 60 seconds (1 minute)
- Maximum chapters: 10 (keep it manageable)
- Use clear, descriptive titles (5-7 words)
- Confidence: 0-1 (how sure you are this is a real boundary based on visual and timeline evidence)
- Only create chapters where there's a meaningful transition
- Base your analysis on BOTH the visual frames AND the timeline data

Return ONLY the JSON array, no other text.`;
  }

  /**
   * Call Claude API for chapter analysis using Vision API
   */
  private async callClaudeForChapters(prompt: string, frames: VideoFrame[]): Promise<ChapterProposal[]> {
    console.log('📝 [CHAPTERING] Sending to Claude for analysis...');
    console.log('Prompt length:', prompt.length);
    console.log('Frame count:', frames.length);

    try {
      // Convert frames to Claude image blocks
      const frameBlocks: ClaudeContentBlock[] = frames.map(frame => {
        // Extract base64 from data URI
        const base64Data = frame.dataUri.split(',')[1];

        // Detect actual format from data URI prefix (screenshots are JPEG, video frames are PNG)
        const mediaType = frame.dataUri.startsWith('data:image/jpeg')
          ? 'image/jpeg'
          : 'image/png';

        const imageSource: ClaudeImageSource = {
          type: 'base64',
          mediaType,
          data: base64Data
        };

        return {
          type: 'image',
          source: imageSource
        };
      });

      // Build content blocks (text prompt + all frames)
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: prompt
        },
        ...frameBlocks
      ];

      console.log(`✅ Total content blocks: ${contentBlocks.length} (1 text + ${frames.length} images)`);

      // Build messages
      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: contentBlocks
        }
      ];

      // Call Claude Vision API via Tauri
      const response = await invoke<ClaudeChatResponse>('claude_chat_completion_vision', {
        model: 'claude-haiku-4-5-20251001', // Official Haiku 4.5 model (October 2025) - 3x cheaper, 2x faster, supports vision
        maxTokens: 64000, // Claude Haiku 4.5 max output limit (2025)
        messages,
        system: undefined,
        temperature: undefined,
      });

      // Check for truncation in response
      if (response.stopReason === 'max_tokens') {
        console.error('❌ [CHAPTERING] Response truncated due to max_tokens limit!');
        console.error(`   Requested: 64000 tokens`);
        console.error(`   Used: ${response.usage?.outputTokens || 'unknown'} output tokens`);
        throw new Error('Claude response was truncated. This should not happen with 64K token limit. Contact support.');
      }

      // Extract response text
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      console.log(`📊 [CHAPTERING] Response length: ${responseText.length} characters, ${response.usage?.outputTokens || 'unknown'} tokens`);

      let jsonText = responseText;

      // Extract JSON from markdown code block if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      // Parse chapter proposals
      const chapters = JSON.parse(jsonText) as ChapterProposal[];

      console.log(`✅ [CHAPTERING] Received ${chapters.length} chapter proposals from Claude`);
      return chapters;

    } catch (error) {
      console.error('❌ [CHAPTERING] Claude API failed:', error);

      // Log full error details for truncation issues
      if (error instanceof Error && error.message.includes('truncated')) {
        console.error('   This is a truncation error - the AI response was cut off mid-generation');
        console.error('   Check token usage and consider implementing chunking strategy');
      }

      throw new Error(`Failed to analyze chapters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save approved chapters to session
   */
  async saveChapters(sessionId: string, chapters: ChapterProposal[]): Promise<VideoChapter[]> {
    const videoChapters: VideoChapter[] = chapters.map(proposal => ({
      id: `chapter-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sessionId,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      title: proposal.title,
      summary: proposal.summary,
      keyTopics: proposal.keyTopics,
      confidence: proposal.confidence,
      createdAt: new Date().toISOString()
    }));

    // Save using ChunkedStorage for efficient updates
    const { getChunkedStorage } = await import('./storage/ChunkedSessionStorage');
    const { getInvertedIndexManager } = await import('./storage/InvertedIndexManager');

    const chunkedStorage = await getChunkedStorage();

    // Load full session to update
    const session = await chunkedStorage.loadFullSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update the session's video chapters
    if (!session.video) {
      throw new Error(`Session ${sessionId} has no video data`);
    }

    // Update chapters while preserving other video data
    session.video.chapters = videoChapters;

    // Save updated session
    await chunkedStorage.saveFullSession(session);

    // Update search index (requires metadata, not full session)
    const indexManager = await getInvertedIndexManager();
    const metadata = await chunkedStorage.loadMetadata(session.id);
    if (metadata) {
      await indexManager.updateIndexes(metadata);
    }

    console.log(`✅ [CHAPTERING] Saved ${videoChapters.length} chapters to session ${sessionId}`);
    return videoChapters;
  }

  /**
   * Convert session screenshots to VideoFrame format for chaptering
   */
  private async convertScreenshotsToFrames(session: Session): Promise<VideoFrame[]> {
    const screenshots = session.screenshots || [];
    const sessionStart = new Date(session.startTime).getTime();

    const frames: VideoFrame[] = [];

    for (const screenshot of screenshots) {
      // Calculate relative timestamp from session start
      const timestamp = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;

      // Load screenshot data (Phase 4: Use hash if available)
      try {
        const caStorage = await getCAStorage();
        const identifier = screenshot.hash || screenshot.attachmentId;
        const attachment = await caStorage.loadAttachment(identifier);
        if (attachment?.thumbnail) {
          frames.push({
            timestamp,
            dataUri: attachment.thumbnail,
            width: 320,
            height: 180
          });
        }
      } catch (error) {
        console.warn(`⚠️ [CHAPTERING] Failed to load screenshot ${screenshot.id}:`, error);
      }
    }

    console.log(`✅ [CHAPTERING] Converted ${frames.length} screenshots to frames`);
    return frames;
  }

  // Helper methods
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return this.formatTime(seconds);
  }
}

export const videoChapteringService = new VideoChapteringService();
