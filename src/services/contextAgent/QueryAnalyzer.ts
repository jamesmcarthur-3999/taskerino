/**
 * QueryAnalyzer - Analyzes user queries to optimize search strategy
 *
 * Extracts entities, patterns, and filters from natural language queries
 * to enable graph-first search optimization.
 *
 * @module services/contextAgent/QueryAnalyzer
 * @since 2.1.0
 */

import type { Company, Contact, Topic } from '../../types';
import type { EntityType } from '../../types/relationships';

/**
 * Query pattern types (determines search strategy)
 */
export const QueryPattern = {
  /** Entity-focused: "notes about NVIDIA", "tasks for Acme Corp" */
  ENTITY_SEARCH: 'entity_search',
  
  /** Date/time focused: "notes from this week", "tasks due tomorrow" */
  DATE_FILTER: 'date_filter',
  
  /** Status/priority focused: "high priority tasks", "blocked tasks" */
  STATUS_FILTER: 'status_filter',
  
  /** Complex semantic: "what was I working on with John last month?" */
  COMPLEX_SEMANTIC: 'complex_semantic',
  
  /** Simple keyword: "meeting notes", "bug fixes" */
  KEYWORD_SEARCH: 'keyword_search',
} as const;

export type QueryPattern = typeof QueryPattern[keyof typeof QueryPattern];

/**
 * Date filter types
 */
export interface DateFilter {
  type: 'absolute' | 'relative';
  startDate?: string; // ISO format
  endDate?: string;   // ISO format
  value?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year';
}

/**
 * Extracted entity reference
 */
export interface ExtractedEntity {
  type: EntityType;
  id: string;
  name: string;
  confidence: number; // 0-1 (how confident we are this entity was mentioned)
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  /** Detected query pattern */
  pattern: QueryPattern;
  
  /** Extracted entities (companies, contacts, topics) */
  entities: ExtractedEntity[];
  
  /** Date/time filter (if detected) */
  dateFilter?: DateFilter;
  
  /** Status filter (if detected) */
  statusFilter?: Array<'todo' | 'in-progress' | 'done' | 'blocked'>;
  
  /** Priority filter (if detected) */
  priorityFilter?: Array<'low' | 'medium' | 'high'>;
  
  /** Extracted tags/keywords */
  tags: string[];
  
  /** Require tasks in results? */
  requireTasks: boolean;
  
  /** Require notes in results? */
  requireNotes: boolean;
  
  /** Original query */
  originalQuery: string;
}

/**
 * QueryAnalyzer - Analyzes natural language queries
 *
 * @example
 * ```typescript
 * const analyzer = new QueryAnalyzer();
 * const analysis = analyzer.analyzeQuery(
 *   "show me high priority tasks for NVIDIA from this week",
 *   companies,
 *   contacts,
 *   topics
 * );
 * console.log(analysis.pattern); // QueryPattern.ENTITY_SEARCH
 * console.log(analysis.entities); // [{ type: 'company', id: '...', name: 'NVIDIA' }]
 * console.log(analysis.priorityFilter); // ['high']
 * console.log(analysis.dateFilter); // { type: 'relative', value: 'this_week' }
 * ```
 */
export class QueryAnalyzer {
  /**
   * Analyze a user query
   */
  analyzeQuery(
    query: string,
    companies: Company[],
    contacts: Contact[],
    topics: Topic[]
  ): QueryAnalysis {
    const queryLower = query.toLowerCase();

    // Extract entities first (highest signal)
    const entities = this.extractEntities(query, companies, contacts, topics);

    // Detect pattern
    const pattern = this.detectPattern(queryLower, entities);

    // Extract filters
    const dateFilter = this.extractDateFilter(queryLower);
    const statusFilter = this.extractStatusFilter(queryLower);
    const priorityFilter = this.extractPriorityFilter(queryLower);
    const tags = this.extractTags(queryLower);

    // Detect result type requirements
    const requireTasks = this.detectRequiresTasks(queryLower);
    const requireNotes = this.detectRequiresNotes(queryLower);

    return {
      pattern,
      entities,
      dateFilter,
      statusFilter,
      priorityFilter,
      tags,
      requireTasks,
      requireNotes,
      originalQuery: query,
    };
  }

  /**
   * Detect query pattern
   */
  private detectPattern(queryLower: string, entities: ExtractedEntity[]): QueryPattern {
    // Entity search - has entity mentions
    if (entities.length > 0) {
      return QueryPattern.ENTITY_SEARCH;
    }

    // Date filter - has date/time keywords
    if (this.hasDateKeywords(queryLower)) {
      return QueryPattern.DATE_FILTER;
    }

    // Status filter - has status/priority keywords
    if (this.hasStatusKeywords(queryLower) || this.hasPriorityKeywords(queryLower)) {
      return QueryPattern.STATUS_FILTER;
    }

    // Complex semantic - has question words or complex phrases
    if (this.isComplexSemantic(queryLower)) {
      return QueryPattern.COMPLEX_SEMANTIC;
    }

    // Default: keyword search
    return QueryPattern.KEYWORD_SEARCH;
  }

  /**
   * Extract entities mentioned in query
   */
  private extractEntities(
    query: string,
    companies: Company[],
    contacts: Contact[],
    topics: Topic[]
  ): ExtractedEntity[] {
    const queryLower = query.toLowerCase();
    const entities: ExtractedEntity[] = [];

    // Match companies (case-insensitive, whole word or phrase)
    companies.forEach(company => {
      const nameLower = company.name.toLowerCase();
      
      // Exact match or word boundary match
      const regex = new RegExp(`\\b${this.escapeRegex(nameLower)}\\b`, 'i');
      if (regex.test(query)) {
        entities.push({
          type: 'company',
          id: company.id,
          name: company.name,
          confidence: 1.0, // Exact match = high confidence
        });
      }
    });

    // Match contacts (case-insensitive)
    contacts.forEach(contact => {
      const nameLower = contact.name.toLowerCase();
      const regex = new RegExp(`\\b${this.escapeRegex(nameLower)}\\b`, 'i');
      
      if (regex.test(query)) {
        entities.push({
          type: 'contact',
          id: contact.id,
          name: contact.name,
          confidence: 1.0,
        });
      }
    });

    // Match topics (case-insensitive)
    topics.forEach(topic => {
      const nameLower = topic.name.toLowerCase();
      const regex = new RegExp(`\\b${this.escapeRegex(nameLower)}\\b`, 'i');
      
      if (regex.test(query)) {
        entities.push({
          type: 'topic',
          id: topic.id,
          name: topic.name,
          confidence: 1.0,
        });
      }
    });

    return entities;
  }

  /**
   * Extract date/time filter
   */
  private extractDateFilter(queryLower: string): DateFilter | undefined {
    const now = new Date();
    
    // Today
    if (/\btoday\b/.test(queryLower)) {
      const today = now.toISOString().split('T')[0];
      return {
        type: 'relative',
        value: 'today',
        startDate: today,
        endDate: today,
      };
    }

    // Yesterday
    if (/\byesterday\b/.test(queryLower)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      return {
        type: 'relative',
        value: 'yesterday',
        startDate: dateStr,
        endDate: dateStr,
      };
    }

    // This week
    if (/\bthis week\b/.test(queryLower)) {
      const startOfWeek = this.getStartOfWeek(now);
      const endOfWeek = this.getEndOfWeek(now);
      return {
        type: 'relative',
        value: 'this_week',
        startDate: startOfWeek,
        endDate: endOfWeek,
      };
    }

    // Last week
    if (/\blast week\b/.test(queryLower)) {
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const startOfWeek = this.getStartOfWeek(lastWeekStart);
      const endOfWeek = this.getEndOfWeek(lastWeekStart);
      return {
        type: 'relative',
        value: 'last_week',
        startDate: startOfWeek,
        endDate: endOfWeek,
      };
    }

    // This month
    if (/\bthis month\b/.test(queryLower)) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return {
        type: 'relative',
        value: 'this_month',
        startDate: startOfMonth,
        endDate: endOfMonth,
      };
    }

    // Last month
    if (/\blast month\b/.test(queryLower)) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return {
        type: 'relative',
        value: 'last_month',
        startDate: startOfMonth,
        endDate: endOfMonth,
      };
    }

    // This year
    if (/\bthis year\b/.test(queryLower)) {
      const startOfYear = `${now.getFullYear()}-01-01`;
      const endOfYear = `${now.getFullYear()}-12-31`;
      return {
        type: 'relative',
        value: 'this_year',
        startDate: startOfYear,
        endDate: endOfYear,
      };
    }

    return undefined;
  }

  /**
   * Extract status filter
   */
  private extractStatusFilter(queryLower: string): Array<'todo' | 'in-progress' | 'done' | 'blocked'> | undefined {
    const statuses: Array<'todo' | 'in-progress' | 'done' | 'blocked'> = [];

    if (/\btodo\b|\bnot started\b|\bpending\b/.test(queryLower)) {
      statuses.push('todo');
    }
    if (/\bin progress\b|\bworking on\b|\bactive\b/.test(queryLower)) {
      statuses.push('in-progress');
    }
    if (/\bdone\b|\bcompleted\b|\bfinished\b/.test(queryLower)) {
      statuses.push('done');
    }
    if (/\bblocked\b|\bstuck\b/.test(queryLower)) {
      statuses.push('blocked');
    }

    return statuses.length > 0 ? statuses : undefined;
  }

  /**
   * Extract priority filter
   */
  private extractPriorityFilter(queryLower: string): Array<'low' | 'medium' | 'high'> | undefined {
    const priorities: Array<'low' | 'medium' | 'high'> = [];

    if (/\bhigh priority\b|\burgent\b|\bcritical\b|\bimportant\b/.test(queryLower)) {
      priorities.push('high');
    }
    if (/\bmedium priority\b|\bmoderate\b/.test(queryLower)) {
      priorities.push('medium');
    }
    if (/\blow priority\b|\bnice to have\b/.test(queryLower)) {
      priorities.push('low');
    }

    return priorities.length > 0 ? priorities : undefined;
  }

  /**
   * Extract tags/keywords
   */
  private extractTags(queryLower: string): string[] {
    const tags: string[] = [];

    // Common hashtag pattern
    const hashtagMatch = queryLower.match(/#(\w+)/g);
    if (hashtagMatch) {
      tags.push(...hashtagMatch.map(tag => tag.substring(1)));
    }

    return tags;
  }

  /**
   * Detect if query requires tasks in results
   */
  private detectRequiresTasks(queryLower: string): boolean {
    return /\btask(s)?\b|\btodo(s)?\b/.test(queryLower);
  }

  /**
   * Detect if query requires notes in results
   */
  private detectRequiresNotes(queryLower: string): boolean {
    return /\bnote(s)?\b|\bmeeting(s)?\b|\bdocument(s)?\b/.test(queryLower);
  }

  /**
   * Check if query has date keywords
   */
  private hasDateKeywords(queryLower: string): boolean {
    return /\b(today|yesterday|tomorrow|this week|last week|next week|this month|last month|this year)\b/.test(queryLower);
  }

  /**
   * Check if query has status keywords
   */
  private hasStatusKeywords(queryLower: string): boolean {
    return /\b(todo|in progress|done|completed|blocked|pending|active)\b/.test(queryLower);
  }

  /**
   * Check if query has priority keywords
   */
  private hasPriorityKeywords(queryLower: string): boolean {
    return /\b(high|low|medium) priority\b|\burgent\b|\bcritical\b/.test(queryLower);
  }

  /**
   * Check if query is complex semantic
   */
  private isComplexSemantic(queryLower: string): boolean {
    // Question words
    if (/\b(what|when|where|who|why|how)\b/.test(queryLower)) {
      return true;
    }

    // Complex phrases
    if (/\bworking on\b|\bdiscussed with\b|\brelated to\b/.test(queryLower)) {
      return true;
    }

    return false;
  }

  /**
   * Get start of week (Monday)
   */
  private getStartOfWeek(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  /**
   * Get end of week (Sunday)
   */
  private getEndOfWeek(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}


