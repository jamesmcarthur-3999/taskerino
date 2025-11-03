import { claudeService } from './claudeService';
import type { ProcessingJob, Topic, Note, AISettings, UserLearnings, LearningSettings, Task, Attachment } from '../types';

type ProcessingCallback = (job: ProcessingJob) => void;

class BackgroundProcessor {
  private processing: boolean = false;
  private queue: ProcessingJob[] = [];
  private onProgressCallback?: ProcessingCallback;
  private onCompleteCallback?: ProcessingCallback;
  private onErrorCallback?: ProcessingCallback;

  constructor() {
    // Start processing loop
    this.startProcessing();
  }

  /**
   * Add a job to the processing queue
   */
  addJob(
    input: string,
    topics: Topic[],
    notes: Note[],
    aiSettings: AISettings,
    learnings: UserLearnings,
    learningSettings: LearningSettings,
    tasks: Task[],
    attachments?: Attachment[],
    extractTasks: boolean = true
  ): ProcessingJob {
    const job: ProcessingJob = {
      id: this.generateId(),
      type: 'note',
      input,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      processingSteps: [],
    };

    // Store additional data needed for processing
    (job as any)._processingData = {
      topics,
      notes,
      aiSettings,
      learnings,
      learningSettings,
      tasks,
      attachments,
      extractTasks,
    };

    this.queue.push(job);

    // Trigger processing if not already running
    if (!this.processing) {
      this.processNext();
    }

    return job;
  }

  /**
   * Set callback for progress updates
   */
  onProgress(callback: ProcessingCallback) {
    this.onProgressCallback = callback;
  }

  /**
   * Set callback for completion
   */
  onComplete(callback: ProcessingCallback) {
    this.onCompleteCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: ProcessingCallback) {
    this.onErrorCallback = callback;
  }

  /**
   * Start the processing loop
   */
  private async startProcessing() {
    // Check queue every 500ms
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processNext();
      }
    }, 500);
  }

  /**
   * Process next job in queue
   */
  private async processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const job = this.queue[0];

    try {
      // Update status to processing
      job.status = 'processing';
      job.progress = 0;
      this.notifyProgress(job);

      // Get processing data
      const data = (job as any)._processingData;

      // Simulate progress for preparation
      job.currentStep = '🚀 Connecting to Claude AI...';
      job.progress = 10;
      this.notifyProgress(job);

      await this.delay(800);

      job.currentStep = '📤 Sending your input securely...';
      job.progress = 20;
      this.notifyProgress(job);

      await this.delay(800);

      job.currentStep = '🤖 AI is analyzing your note...';
      job.progress = 30;
      this.notifyProgress(job);

      // Call Claude API
      const result = await claudeService.processInput(
        job.input,
        data.topics,
        data.notes,
        data.aiSettings,
        data.learnings,
        data.learningSettings,
        data.tasks,
        data.attachments,
        data.extractTasks
      );

      // Update with processing steps (with defensive check)
      job.processingSteps = result.processingSteps || [];

      // Simulate showing each step with progress
      if (job.processingSteps.length > 0) {
        const stepIncrement = 50 / job.processingSteps.length;
        for (let i = 0; i < job.processingSteps.length; i++) {
          job.currentStep = job.processingSteps[i];
          job.progress = 30 + (i + 1) * stepIncrement;
          this.notifyProgress(job);
          await this.delay(400);
        }
      } else {
        // No processing steps - skip to completion
        job.progress = 80;
      }

      // Complete
      job.status = 'complete';
      job.progress = 100;
      job.result = result;
      job.completedAt = new Date().toISOString();
      job.currentStep = '✅ Processing complete!';

      this.notifyComplete(job);

      // Remove from queue
      this.queue.shift();
    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Processing failed';
      job.currentStep = '❌ Processing failed';

      this.notifyError(job);

      // Remove from queue
      this.queue.shift();
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      processing: this.queue.filter(j => j.status === 'processing').length,
      queued: this.queue.filter(j => j.status === 'queued').length,
      total: this.queue.length,
    };
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ProcessingJob[] {
    return this.queue;
  }

  /**
   * Remove a job from queue
   */
  removeJob(jobId: string) {
    this.queue = this.queue.filter(j => j.id !== jobId);
  }

  // Helper methods
  private notifyProgress(job: ProcessingJob) {
    if (this.onProgressCallback) {
      this.onProgressCallback(job);
    }
  }

  private notifyComplete(job: ProcessingJob) {
    if (this.onCompleteCallback) {
      this.onCompleteCallback(job);
    }
  }

  private notifyError(job: ProcessingJob) {
    if (this.onErrorCallback) {
      this.onErrorCallback(job);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const backgroundProcessor = new BackgroundProcessor();
