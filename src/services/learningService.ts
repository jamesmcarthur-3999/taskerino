import type {
  Learning,
  LearningEvidence,
  LearningCategory,
  UserLearnings,
  Task,
  AppState,
} from '../types';
import { generateId } from '../utils/helpers';

/**
 * LearningService: Manages AI learning from user corrections
 *
 * Reinforcement Schedule (configurable):
 * - Default: 5+ confirmations → Pattern, 10+ confirmations → Rule
 * - Contradictions heavily penalize strength
 * - All parameters adjustable via learningSettings
 */
export class LearningService {
  private learnings: UserLearnings;
  private settings: AppState['learningSettings'];

  constructor(userLearnings: UserLearnings, settings: AppState['learningSettings']) {
    this.learnings = { ...userLearnings };
    this.settings = settings;
  }

  /**
   * Create or update a learning from user evidence
   */
  recordEvidence(
    category: LearningCategory,
    pattern: string,
    action: string,
    userAction: 'confirm' | 'modify' | 'reject',
    context: string,
    details?: { before?: any; after?: any }
  ): Learning | null {
    const evidence: LearningEvidence = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      context,
      userAction,
      details,
    };

    // Find existing learning or create new one
    let learning = this.learnings.learnings.find(
      l => l.category === category && l.pattern.toLowerCase() === pattern.toLowerCase()
    );

    if (learning) {
      // Update existing learning
      learning.evidence.push(evidence);
      learning.lastReinforced = new Date().toISOString();

      if (userAction === 'confirm') {
        learning.timesConfirmed++;
      } else if (userAction === 'reject' || userAction === 'modify') {
        learning.timesRejected++;
      }

      learning.strength = this.calculateStrength(learning);
      learning.status = this.determineStatus(learning);
    } else {
      // Create new learning (observation)
      learning = {
        id: generateId(),
        category,
        pattern,
        action,
        strength: userAction === 'confirm' ? 10 : 0,
        evidence: [evidence],
        createdAt: new Date().toISOString(),
        lastReinforced: new Date().toISOString(),
        timesApplied: 0,
        timesConfirmed: userAction === 'confirm' ? 1 : 0,
        timesRejected: userAction === 'reject' || userAction === 'modify' ? 1 : 0,
        status: 'experimental',
        isFlag: false,
      };

      this.learnings.learnings.push(learning);
    }

    // Update stats
    this.updateStats();

    return learning;
  }

  /**
   * Calculate learning strength based on confirmations, rejections, and time
   *
   * Uses configurable parameters from learningSettings:
   * - confirmationPoints: Points per confirmation
   * - rejectionPenalty: Points removed per rejection
   * - applicationBonus: Points per application
   * - flagMultiplier: Multiplier for flagged learnings
   * - timeDecayDays: Days before decay starts
   * - timeDecayRate: Decay rate per day
   */
  private calculateStrength(learning: Learning): number {
    let baseStrength = (
      (learning.timesConfirmed * this.settings.confirmationPoints) -
      (learning.timesRejected * this.settings.rejectionPenalty) +
      (learning.timesApplied * this.settings.applicationBonus)
    );

    // Flag multiplier for faster promotion
    if (learning.isFlag) {
      baseStrength *= this.settings.flagMultiplier;
    }

    // Apply time decay if not reinforced recently
    const daysSinceReinforced = this.daysBetween(
      new Date(learning.lastReinforced),
      new Date()
    );

    if (daysSinceReinforced > this.settings.timeDecayDays) {
      const decay = (daysSinceReinforced - this.settings.timeDecayDays) * this.settings.timeDecayRate;
      baseStrength -= decay;
    }

    return Math.max(0, Math.min(100, baseStrength));
  }

  /**
   * Determine learning status based on strength
   *
   * Uses configurable thresholds from learningSettings:
   * - Below deprecated threshold → Deprecated
   * - Below active threshold → Experimental
   * - Above active threshold → Active
   */
  private determineStatus(learning: Learning): Learning['status'] {
    if (learning.strength < this.settings.thresholds.deprecated) {
      return 'deprecated';
    } else if (learning.strength >= this.settings.thresholds.active) {
      return 'active';
    } else {
      return 'experimental';
    }
  }

  /**
   * Record that AI applied a learning (for tracking)
   */
  recordApplication(learningId: string, wasCorrect: boolean): void {
    const learning = this.learnings.learnings.find(l => l.id === learningId);
    if (!learning) return;

    learning.timesApplied++;

    // If user confirmed AI's use of this learning, reinforce it
    if (wasCorrect) {
      learning.timesConfirmed++;
      learning.lastReinforced = new Date().toISOString();
    } else {
      learning.timesRejected++;
    }

    learning.strength = this.calculateStrength(learning);
    learning.status = this.determineStatus(learning);
    this.updateStats();
  }

  /**
   * Get applicable learnings for AI prompt (sorted by strength)
   */
  getApplicableLearnings(category?: LearningCategory): Learning[] {
    return this.learnings.learnings
      .filter(l => l.status === 'active' || l.status === 'experimental')
      .filter(l => !category || l.category === category)
      .sort((a, b) => b.strength - a.strength);
  }

  /**
   * Format learnings for AI prompt
   */
  formatForPrompt(learnings: Learning[]): string {
    if (learnings.length === 0) return 'No custom learnings yet.';

    return learnings.map(l => {
      const label = l.strength >= this.settings.thresholds.rule ? '✅ RULE' :
                   l.strength >= this.settings.thresholds.active ? '📊 PATTERN' :
                   '🔬 OBSERVATION';

      const flagLabel = l.isFlag ? ' [USER-FLAGGED]' : '';

      return `${label}${flagLabel} (${l.strength}%): ${l.pattern} → ${l.action}`;
    }).join('\n');
  }

  /**
   * Analyze task edit and create learnings
   */
  analyzeTaskEdit(originalTask: any, editedTask: Task): void {
    // Due date learning
    if (originalTask.dueDate !== editedTask.dueDate) {
      if (editedTask.dueDate) {
        const userAction = originalTask.dueDate === editedTask.dueDate ? 'confirm' : 'modify';
        const pattern = this.extractDueDatePattern(originalTask.dueDateReasoning || '');

        if (pattern) {
          this.recordEvidence(
            'task-timing',
            pattern,
            `Set due to ${this.formatDate(editedTask.dueDate)}`,
            userAction,
            `Task: "${editedTask.title}"`,
            { before: originalTask.dueDate, after: editedTask.dueDate }
          );
        }
      }
    } else if (originalTask.dueDate && editedTask.dueDate === originalTask.dueDate) {
      // User kept AI's due date - confirm the pattern
      const pattern = this.extractDueDatePattern(originalTask.dueDateReasoning || '');
      if (pattern) {
        this.recordEvidence(
          'task-timing',
          pattern,
          `Set due to ${this.formatDate(editedTask.dueDate!)}`,
          'confirm',
          `Task: "${editedTask.title}"`,
          { before: originalTask.dueDate, after: editedTask.dueDate }
        );
      }
    }

    // Priority learning
    if (originalTask.priority !== editedTask.priority) {
      const keyPhrase = this.extractKeyPhrase(editedTask.title);
      if (keyPhrase) {
        this.recordEvidence(
          'task-priority',
          keyPhrase,
          `Set priority to ${editedTask.priority}`,
          'modify',
          `Task: "${editedTask.title}"`,
          { before: originalTask.priority, after: editedTask.priority }
        );
      }
    } else {
      // User kept AI's priority - confirm
      const keyPhrase = this.extractKeyPhrase(editedTask.title);
      if (keyPhrase) {
        this.recordEvidence(
          'task-priority',
          keyPhrase,
          `Set priority to ${editedTask.priority}`,
          'confirm',
          `Task: "${editedTask.title}"`,
          { before: originalTask.priority, after: editedTask.priority }
        );
      }
    }

    // Description learning
    if (!originalTask.description && editedTask.description) {
      this.recordEvidence(
        'task-creation',
        'add task description',
        'Include description from note context',
        'modify',
        `Task: "${editedTask.title}"`,
        { before: originalTask.description, after: editedTask.description }
      );
    } else if (originalTask.description && editedTask.description === originalTask.description) {
      this.recordEvidence(
        'task-creation',
        'task with description',
        'Include description from note context',
        'confirm',
        `Task: "${editedTask.title}"`
      );
    }

    // Tags learning
    if (editedTask.tags && editedTask.tags.length > 0) {
      const addedTags = editedTask.tags.filter(t => !originalTask.tags?.includes(t));
      const keptTags = editedTask.tags.filter(t => originalTask.tags?.includes(t));

      addedTags.forEach(tag => {
        this.recordEvidence(
          'tagging',
          `#${tag} for task type`,
          `Add #${tag} tag to similar tasks`,
          'modify',
          `Task: "${editedTask.title}"`,
          { before: originalTask.tags, after: editedTask.tags }
        );
      });

      keptTags.forEach(tag => {
        this.recordEvidence(
          'tagging',
          `#${tag} for task type`,
          `Add #${tag} tag to similar tasks`,
          'confirm',
          `Task: "${editedTask.title}"`
        );
      });
    }
  }

  /**
   * Extract due date pattern from AI reasoning
   */
  private extractDueDatePattern(reasoning: string): string | null {
    const patterns = [
      { match: /end of week|eow/i, pattern: 'end of week' },
      { match: /next week/i, pattern: 'next week' },
      { match: /this week/i, pattern: 'this week' },
      { match: /tomorrow/i, pattern: 'tomorrow' },
      { match: /urgent|asap|today/i, pattern: 'urgent' },
      { match: /end of month/i, pattern: 'end of month' },
      { match: /in (\d+) (day|week|month)/i, pattern: 'relative timeframe' },
    ];

    for (const { match, pattern } of patterns) {
      if (match.test(reasoning)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Extract key phrase from task title for pattern matching
   */
  private extractKeyPhrase(title: string): string | null {
    const patterns = [
      { match: /follow[- ]?up/i, phrase: 'follow up' },
      { match: /review/i, phrase: 'review' },
      { match: /send/i, phrase: 'send' },
      { match: /schedule/i, phrase: 'schedule' },
      { match: /call/i, phrase: 'call' },
      { match: /meeting/i, phrase: 'meeting' },
      { match: /urgent/i, phrase: 'urgent' },
      { match: /asap/i, phrase: 'asap' },
    ];

    for (const { match, phrase } of patterns) {
      if (match.test(title)) {
        return phrase;
      }
    }

    return null;
  }

  /**
   * Format date for learning patterns
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  /**
   * Flag a learning for faster promotion
   */
  flagLearning(learningId: string): void {
    const learning = this.learnings.learnings.find(l => l.id === learningId);
    if (learning) {
      learning.isFlag = true;
      learning.strength = this.calculateStrength(learning);
      this.updateStats();
    }
  }

  /**
   * Unflag a learning
   */
  unflagLearning(learningId: string): void {
    const learning = this.learnings.learnings.find(l => l.id === learningId);
    if (learning) {
      learning.isFlag = false;
      learning.strength = this.calculateStrength(learning);
      this.updateStats();
    }
  }

  /**
   * Manually disable a learning
   */
  disableLearning(learningId: string): void {
    const learning = this.learnings.learnings.find(l => l.id === learningId);
    if (learning) {
      learning.status = 'deprecated';
      learning.strength = 0;
      this.updateStats();
    }
  }

  /**
   * Manually enable a learning
   */
  enableLearning(learningId: string): void {
    const learning = this.learnings.learnings.find(l => l.id === learningId);
    if (learning) {
      learning.status = 'experimental';
      learning.strength = Math.max(10, learning.strength);
      this.updateStats();
    }
  }

  /**
   * Export learnings as JSON profile
   */
  exportProfile(): string {
    return JSON.stringify(this.learnings, null, 2);
  }

  /**
   * Import learnings from JSON profile
   */
  importProfile(json: string): UserLearnings {
    try {
      const imported = JSON.parse(json) as UserLearnings;
      this.learnings = imported;
      this.updateStats();
      return this.learnings;
    } catch (error) {
      throw new Error('Invalid profile format');
    }
  }

  /**
   * Get current learnings
   */
  getLearnings(): UserLearnings {
    return this.learnings;
  }

  /**
   * Get single learning by ID
   */
  getLearning(id: string): Learning | undefined {
    return this.learnings.learnings.find(l => l.id === id);
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const active = this.learnings.learnings.filter(l => l.status === 'active');
    const experimental = this.learnings.learnings.filter(l => l.status === 'experimental');
    const observations = this.learnings.learnings.filter(l => l.strength < this.settings.thresholds.active / 2);

    // Rules are active learnings with strength >= rule threshold
    const rules = active.filter(l => l.strength >= this.settings.thresholds.rule);

    this.learnings.stats = {
      totalLearnings: this.learnings.learnings.length,
      activeRules: rules.length,
      experimentalPatterns: experimental.length,
      observations: observations.length,
    };
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
  }

  /**
   * Analyze learning effectiveness and generate metrics for AI optimization
   */
  analyzeLearningEffectiveness(): {
    totalLearnings: number;
    accuracy: number;
    avgConfirmations: number;
    avgRejections: number;
    avgApplications: number;
    promotionRate: number;
    degradationRate: number;
    flaggedCount: number;
    categoryBreakdown: Record<string, { count: number; avgStrength: number }>;
  } {
    const learnings = this.learnings.learnings;

    if (learnings.length === 0) {
      return {
        totalLearnings: 0,
        accuracy: 0,
        avgConfirmations: 0,
        avgRejections: 0,
        avgApplications: 0,
        promotionRate: 0,
        degradationRate: 0,
        flaggedCount: 0,
        categoryBreakdown: {},
      };
    }

    const totalConfirmations = learnings.reduce((sum, l) => sum + l.timesConfirmed, 0);
    const totalRejections = learnings.reduce((sum, l) => sum + l.timesRejected, 0);
    const totalApplications = learnings.reduce((sum, l) => sum + l.timesApplied, 0);
    const totalInteractions = totalConfirmations + totalRejections;

    const accuracy = totalInteractions > 0 ? totalConfirmations / totalInteractions : 0;
    const promotionRate = learnings.filter(l => l.status === 'active').length / learnings.length;
    const degradationRate = learnings.filter(l => l.status === 'deprecated').length / learnings.length;
    const flaggedCount = learnings.filter(l => l.isFlag).length;

    // Category breakdown
    const categoryBreakdown: Record<string, { count: number; avgStrength: number }> = {};
    learnings.forEach(l => {
      if (!categoryBreakdown[l.category]) {
        categoryBreakdown[l.category] = { count: 0, avgStrength: 0 };
      }
      categoryBreakdown[l.category].count++;
      categoryBreakdown[l.category].avgStrength += l.strength;
    });

    Object.keys(categoryBreakdown).forEach(cat => {
      categoryBreakdown[cat].avgStrength /= categoryBreakdown[cat].count;
    });

    return {
      totalLearnings: learnings.length,
      accuracy,
      avgConfirmations: totalConfirmations / learnings.length,
      avgRejections: totalRejections / learnings.length,
      avgApplications: totalApplications / learnings.length,
      promotionRate,
      degradationRate,
      flaggedCount,
      categoryBreakdown,
    };
  }

  /**
   * Get parameter optimization suggestions based on learning effectiveness
   * This method provides data for AI to analyze and suggest adjustments
   */
  getOptimizationContext(): string {
    const metrics = this.analyzeLearningEffectiveness();
    const currentSettings = this.settings;

    return `
**Current Learning System Performance:**

Total Learnings: ${metrics.totalLearnings}
Accuracy Rate: ${(metrics.accuracy * 100).toFixed(1)}% (confirmations vs rejections)
Average Confirmations per Learning: ${metrics.avgConfirmations.toFixed(1)}
Average Rejections per Learning: ${metrics.avgRejections.toFixed(1)}
Average Applications: ${metrics.avgApplications.toFixed(1)}
Promotion Rate to Active: ${(metrics.promotionRate * 100).toFixed(1)}%
Degradation Rate: ${(metrics.degradationRate * 100).toFixed(1)}%
User-Flagged Learnings: ${metrics.flaggedCount}

**Current Parameter Settings:**
- Confirmation Points: ${currentSettings.confirmationPoints}
- Rejection Penalty: ${currentSettings.rejectionPenalty}
- Application Bonus: ${currentSettings.applicationBonus}
- Flag Multiplier: ${currentSettings.flagMultiplier}x
- Time Decay: Starts after ${currentSettings.timeDecayDays} days at ${currentSettings.timeDecayRate} points/day
- Thresholds: Deprecated <${currentSettings.thresholds.deprecated}, Active >=${currentSettings.thresholds.active}, Rule >=${currentSettings.thresholds.rule}

**Category Performance:**
${Object.entries(metrics.categoryBreakdown)
  .map(([cat, data]) => `- ${cat}: ${data.count} learnings, avg strength ${data.avgStrength.toFixed(1)}%`)
  .join('\n')}

**Optimization Goal:**
The system should promote valuable patterns to "Active" status quickly (5-6 confirmations) and "Rule" status for permanent preferences (10+ confirmations). Contradictions should significantly reduce strength. Current accuracy of ${(metrics.accuracy * 100).toFixed(1)}% suggests ${
  metrics.accuracy > 0.8 ? 'system is working well' :
  metrics.accuracy > 0.6 ? 'moderate effectiveness, may need tuning' :
  'low effectiveness, parameters may need adjustment'
}.
`;
  }
}

