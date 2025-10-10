/**
 * Ned Memory System
 *
 * Stores and retrieves memories for Ned to remember user preferences,
 * interaction outcomes, and context across conversations.
 *
 * Features:
 * - Three memory types: preferences, outcomes, context notes
 * - Relevance scoring with time decay
 * - Automatic pruning of old/irrelevant memories
 * - localStorage persistence
 */

import type { NedMemory } from './nedTools';

const MEMORY_STORAGE_KEY = 'ned-memories';
const MAX_MEMORIES = 1000;
const DECAY_DAYS = 30; // Start decay after this many days
const PRUNE_THRESHOLD = 0.1; // Prune memories below this score

export class NedMemoryService {
  private memories: NedMemory[] = [];

  constructor() {
    this.loadMemories();
  }

  /**
   * Add a new memory
   */
  addMemory(type: NedMemory['type'], content: string): NedMemory {
    const memory: NedMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      createdAt: new Date().toISOString(),
      relevanceScore: 1.0, // Start at max relevance
    };

    this.memories.push(memory);
    this.saveMemories();
    this.pruneIfNeeded();

    return memory;
  }

  /**
   * Get relevant memories for a given context
   */
  getRelevantMemories(context: string, limit: number = 5): NedMemory[] {
    // Update scores with time decay
    this.updateRelevanceScores();

    // Simple keyword matching (can be improved with embeddings later)
    const keywords = context.toLowerCase().split(/\s+/);

    const scored = this.memories.map(mem => {
      const memContent = mem.content.toLowerCase();
      const matchCount = keywords.filter(kw => memContent.includes(kw)).length;
      const keywordScore = matchCount / keywords.length;

      return {
        memory: mem,
        score: mem.relevanceScore * (1 + keywordScore), // Boost by keyword match
      };
    });

    // Sort by score and return top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.memory);
  }

  /**
   * Get all memories of a specific type
   */
  getMemoriesByType(type: NedMemory['type']): NedMemory[] {
    this.updateRelevanceScores();
    return this.memories
      .filter(m => m.type === type)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Update a memory's relevance (e.g., when it's used)
   */
  boostMemory(memoryId: string, boost: number = 0.2): void {
    const memory = this.memories.find(m => m.id === memoryId);
    if (memory) {
      memory.relevanceScore = Math.min(1.0, memory.relevanceScore + boost);
      this.saveMemories();
    }
  }

  /**
   * Delete a memory
   */
  deleteMemory(memoryId: string): void {
    this.memories = this.memories.filter(m => m.id !== memoryId);
    this.saveMemories();
  }

  /**
   * Clear all memories
   */
  clearAll(): void {
    this.memories = [];
    this.saveMemories();
  }

  /**
   * Get memory statistics
   */
  getStats() {
    this.updateRelevanceScores();

    return {
      total: this.memories.length,
      byType: {
        user_preference: this.memories.filter(m => m.type === 'user_preference').length,
        interaction_outcome: this.memories.filter(m => m.type === 'interaction_outcome').length,
        context_note: this.memories.filter(m => m.type === 'context_note').length,
      },
      avgScore: this.memories.reduce((sum, m) => sum + m.relevanceScore, 0) / this.memories.length || 0,
      oldestMemory: this.memories.length > 0
        ? Math.min(...this.memories.map(m => new Date(m.createdAt).getTime()))
        : null,
    };
  }

  /**
   * Format memories for Ned's context
   */
  formatForContext(memories: NedMemory[]): string {
    if (memories.length === 0) return '';

    const grouped = {
      user_preference: memories.filter(m => m.type === 'user_preference'),
      interaction_outcome: memories.filter(m => m.type === 'interaction_outcome'),
      context_note: memories.filter(m => m.type === 'context_note'),
    };

    let formatted = '**Relevant Memories:**\n\n';

    if (grouped.user_preference.length > 0) {
      formatted += '**User Preferences:**\n';
      grouped.user_preference.forEach(m => {
        formatted += `- ${m.content}\n`;
      });
      formatted += '\n';
    }

    if (grouped.context_note.length > 0) {
      formatted += '**Context:**\n';
      grouped.context_note.forEach(m => {
        formatted += `- ${m.content}\n`;
      });
      formatted += '\n';
    }

    if (grouped.interaction_outcome.length > 0) {
      formatted += '**Recent Interactions:**\n';
      grouped.interaction_outcome.forEach(m => {
        formatted += `- ${m.content}\n`;
      });
    }

    return formatted;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Update relevance scores based on time decay
   */
  private updateRelevanceScores(): void {
    const now = Date.now();

    this.memories.forEach(memory => {
      const ageInDays = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > DECAY_DAYS) {
        // Apply decay: score * (1 - decay_rate)^days_over_threshold
        const daysOverThreshold = ageInDays - DECAY_DAYS;
        const decayRate = 0.02; // 2% decay per day
        const decayFactor = Math.pow(1 - decayRate, daysOverThreshold);
        memory.relevanceScore *= decayFactor;
      }
    });
  }

  /**
   * Prune old/irrelevant memories
   */
  private pruneIfNeeded(): void {
    // Remove memories below threshold
    this.memories = this.memories.filter(m => m.relevanceScore >= PRUNE_THRESHOLD);

    // If still over limit, remove oldest
    if (this.memories.length > MAX_MEMORIES) {
      this.memories.sort((a, b) => b.relevanceScore - a.relevanceScore);
      this.memories = this.memories.slice(0, MAX_MEMORIES);
    }

    this.saveMemories();
  }

  /**
   * Load memories from localStorage
   */
  private loadMemories(): void {
    try {
      const stored = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (stored) {
        this.memories = JSON.parse(stored);
        console.log(`✅ Loaded ${this.memories.length} Ned memories`);
      }
    } catch (error) {
      console.error('Failed to load Ned memories:', error);
      this.memories = [];
    }
  }

  /**
   * Save memories to localStorage
   */
  private saveMemories(): void {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(this.memories));
    } catch (error) {
      console.error('Failed to save Ned memories:', error);
    }
  }
}

// Singleton instance
export const nedMemory = new NedMemoryService();
