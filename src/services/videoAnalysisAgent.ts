/**
 * VideoAnalysisAgent
 *
 * Separate Claude agent that analyzes video frames for Ned.
 * Ned invokes this agent when users ask about specific moments.
 */

// TODO: Install @anthropic-ai/sdk if not already installed
// import Anthropic from '@anthropic-ai/sdk';
import type { Session, VideoFrame } from '../types';
import { videoFrameExtractor } from './videoFrameExtractor';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { getStorage } from './storage';

export interface VideoAnalysisRequest {
  sessionId: string;
  timeRange: {
    start: number; // Seconds from session start
    end: number; // Seconds from session start
  };
  question: string; // What the user wants to know
  samplingStrategy?: 'dense' | 'sparse' | 'smart'; // How many frames to extract
}

export interface VideoAnalysisResult {
  answer: string; // Text description answering the question
  analyzedFrames: VideoFrame[]; // Frames that were analyzed (for UI display)
  confidence: number; // 0-1, how confident the agent is
  timeRange: { start: number; end: number }; // Actual time range analyzed
}

class VideoAnalysisAgent {
  // TODO: Uncomment when @anthropic-ai/sdk is installed
  // private anthropic: Anthropic;

  constructor() {
    // TODO: Get API key from environment/settings
    // TODO: Uncomment when @anthropic-ai/sdk is installed
    // this.anthropic = new Anthropic({
    //   apiKey: process.env.ANTHROPIC_API_KEY || ''
    // });
  }

  /**
   * Analyze a specific moment in a session video
   *
   * This is the main entry point for Ned. Ned calls this when:
   * - User asks "What was I working on at 2:35?"
   * - User asks "Show me when I debugged the login issue"
   * - User asks "What happened between 1:00 and 3:00?"
   */
  async analyzeVideoMoment(
    request: VideoAnalysisRequest
  ): Promise<VideoAnalysisResult> {
    console.log(`🎬 [VIDEO AGENT] Analyzing ${request.timeRange.start}s - ${request.timeRange.end}s`);

    // 1. Get session data
    const session = await this.getSession(request.sessionId);
    if (!session.video?.fullVideoAttachmentId) {
      throw new Error('Session has no video recording');
    }

    // 2. Get video path (Phase 4: Use hash if available)
    const caStorage = await getCAStorage();
    const identifier = session.video.hash || session.video.fullVideoAttachmentId;
    const videoAttachment = await caStorage.loadAttachment(identifier);
    if (!videoAttachment?.path) {
      throw new Error('Video file not found');
    }

    // 3. Determine sampling strategy
    const timestamps = this.generateTimestamps(
      request.timeRange,
      request.samplingStrategy || 'smart',
      session
    );

    console.log(`🎬 [VIDEO AGENT] Extracting ${timestamps.length} frames`);

    // 4. Extract frames
    const frames = await videoFrameExtractor.extractFrames(
      videoAttachment.path,
      timestamps
    );

    // 5. Get timeline context
    const context = this.buildTimelineContext(session, request.timeRange);

    // 6. Build prompt for Claude
    const prompt = this.buildAnalysisPrompt(
      request.question,
      context,
      request.timeRange
    );

    // 7. Call Claude with frames
    const answer = await this.callClaude(prompt, frames);

    console.log(`✅ [VIDEO AGENT] Analysis complete`);

    return {
      answer,
      analyzedFrames: frames,
      confidence: 0.8, // TODO: Extract from Claude response
      timeRange: request.timeRange
    };
  }

  /**
   * Generate timestamps based on sampling strategy
   */
  private generateTimestamps(
    timeRange: { start: number; end: number },
    strategy: 'dense' | 'sparse' | 'smart',
    session: Session
  ): number[] {
    const duration = timeRange.end - timeRange.start;
    const timestamps: number[] = [];

    switch (strategy) {
      case 'dense':
        // Every 2 seconds (good for detailed analysis)
        for (let t = timeRange.start; t <= timeRange.end; t += 2) {
          timestamps.push(t);
        }
        break;

      case 'sparse':
        // Every 10 seconds (good for broad overview)
        for (let t = timeRange.start; t <= timeRange.end; t += 10) {
          timestamps.push(t);
        }
        break;

      case 'smart':
        // Sample at screenshot timestamps + audio timestamps + regular intervals
        const sessionStart = new Date(session.startTime).getTime();

        // Add screenshot timestamps
        session.screenshots?.forEach(screenshot => {
          const offset = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
          if (offset >= timeRange.start && offset <= timeRange.end) {
            timestamps.push(offset);
          }
        });

        // Add audio segment timestamps
        session.audioSegments?.forEach(segment => {
          const offset = (new Date(segment.timestamp).getTime() - sessionStart) / 1000;
          if (offset >= timeRange.start && offset <= timeRange.end) {
            timestamps.push(offset);
          }
        });

        // Fill gaps with regular intervals (every 5 seconds)
        for (let t = timeRange.start; t <= timeRange.end; t += 5) {
          if (!timestamps.find(ts => Math.abs(ts - t) < 2)) {
            timestamps.push(t);
          }
        }

        // Sort and deduplicate
        timestamps.sort((a, b) => a - b);
        break;
    }

    // Always include start and end
    if (!timestamps.includes(timeRange.start)) {
      timestamps.unshift(timeRange.start);
    }
    if (!timestamps.includes(timeRange.end)) {
      timestamps.push(timeRange.end);
    }

    return timestamps;
  }

  /**
   * Build timeline context (screenshots, audio, notes)
   */
  private buildTimelineContext(
    session: Session,
    timeRange: { start: number; end: number }
  ): string {
    const sessionStart = new Date(session.startTime).getTime();
    let context = '';

    // Screenshots
    const screenshots = session.screenshots?.filter(s => {
      const offset = (new Date(s.timestamp).getTime() - sessionStart) / 1000;
      return offset >= timeRange.start && offset <= timeRange.end;
    }) || [];

    if (screenshots.length > 0) {
      context += 'Screenshots:\n';
      screenshots.forEach(s => {
        const offset = (new Date(s.timestamp).getTime() - sessionStart) / 1000;
        context += `[${this.formatTime(offset)}] ${s.aiAnalysis?.detectedActivity || 'Activity'}\n`;
        if (s.aiAnalysis?.summary) {
          context += `  ${s.aiAnalysis.summary}\n`;
        }
      });
      context += '\n';
    }

    // Audio
    const audio = session.audioSegments?.filter(a => {
      const offset = (new Date(a.timestamp).getTime() - sessionStart) / 1000;
      return offset >= timeRange.start && offset <= timeRange.end;
    }) || [];

    if (audio.length > 0) {
      context += 'Audio Transcripts:\n';
      audio.forEach(a => {
        const offset = (new Date(a.timestamp).getTime() - sessionStart) / 1000;
        context += `[${this.formatTime(offset)}] "${a.transcription}"\n`;
      });
      context += '\n';
    }

    // User notes
    const notes = session.contextItems?.filter(n => {
      const offset = (new Date(n.timestamp).getTime() - sessionStart) / 1000;
      return offset >= timeRange.start && offset <= timeRange.end;
    }) || [];

    if (notes.length > 0) {
      context += 'User Notes:\n';
      notes.forEach(n => {
        const offset = (new Date(n.timestamp).getTime() - sessionStart) / 1000;
        context += `[${this.formatTime(offset)}] "${n.content}"\n`;
      });
      context += '\n';
    }

    return context;
  }

  /**
   * Build Claude prompt
   */
  private buildAnalysisPrompt(
    question: string,
    context: string,
    timeRange: { start: number; end: number }
  ): string {
    return `You are analyzing a work session video recording to answer the user's question.

User's Question: "${question}"

Time Range: ${this.formatTime(timeRange.start)} - ${this.formatTime(timeRange.end)}

Timeline Context:
${context}

I've attached video frames from this time range. Please analyze them to answer the user's question.

Focus on:
- What the user was working on (code, documentation, design, etc.)
- What applications/tools were visible
- What specific actions or changes occurred
- Any problems or successes visible in the UI

Provide a clear, concise answer (2-4 sentences) that directly addresses the question.`;
  }

  /**
   * Call Claude API with frames
   *
   * TODO: Implement real Claude API call when @anthropic-ai/sdk is installed
   * For now, returns mock response
   */
  private async callClaude(prompt: string, frames: VideoFrame[]): Promise<string> {
    console.log(`🤖 [VIDEO AGENT] Calling Claude with ${frames.length} frames`);

    // TODO: Implement real Claude API call
    // Here's how it should look when @anthropic-ai/sdk is installed:
    /*
    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...frames.map(frame => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/png' as const,
                data: frame.dataUri.split(',')[1] // Remove data:image/png;base64, prefix
              }
            }))
          ]
        }]
      });

      const textContent = message.content.find(c => c.type === 'text');
      return textContent && 'text' in textContent ? textContent.text : 'No response';
    } catch (error) {
      console.error('❌ [VIDEO AGENT] Claude API error:', error);
      throw error;
    }
    */

    // Mock response for now
    return `Mock analysis: Analyzed ${frames.length} frames from this time range. The user appears to be working on development tasks. (TODO: Replace with real Claude API call)`;
  }

  // Helper methods

  /**
   * Format seconds as MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get session from storage
   */
  private async getSession(sessionId: string): Promise<Session> {
    const storage = await getStorage();
    const sessions = await storage.load<Session[]>('sessions');
    const session = sessions?.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return session;
  }
}

export const videoAnalysisAgent = new VideoAnalysisAgent();
