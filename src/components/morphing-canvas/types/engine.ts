/**
 * Engine-specific types for layout selection and configuration generation
 *
 * These types extend the base types with additional metadata needed for
 * intelligent layout selection and module composition.
 */

import type { ModuleType, ModuleConfig, LayoutTemplate, SessionData } from './index';

// ============================================================================
// LAYOUT TYPE SYSTEM
// ============================================================================

/**
 * Named layout types for different session scenarios
 */
export type LayoutType =
  | 'deep_work_dev'         // Code-heavy development sessions
  | 'collaborative_meeting' // Discussion and decision-heavy meetings
  | 'learning_session'      // Educational content with media
  | 'creative_workshop'     // Design and visual content
  | 'research_review'       // Document and screenshot heavy
  | 'presentation'          // Linear content flow
  | 'default';              // General purpose fallback

/**
 * Extended layout template with intelligence metadata
 */
export interface IntelligentLayoutTemplate extends LayoutTemplate {
  layoutType: LayoutType;

  // Triggers for auto-selection
  triggers?: {
    hasCodeChanges?: boolean;
    hasVideoContent?: boolean;
    hasAudioContent?: boolean;
    hasScreenshots?: boolean;
    hasDecisions?: boolean;
    hasNotes?: boolean;
    hasTasks?: boolean;
    minDuration?: number;
    maxDuration?: number;
    participantCount?: number;
  };

  // Recommended modules for this layout
  recommendedModules?: string[]; // Changed to string[] for flexibility

  // Priority score for layout selection
  priority?: number;
}

// ============================================================================
// MODULE VARIANT SYSTEM
// ============================================================================

/**
 * Visual variants for modules
 */
export type ModuleVariant = 'compact' | 'standard' | 'expanded' | 'minimal' | 'detailed';

/**
 * Extended module definition with variant support
 */
export interface ExtendedModuleDefinition {
  type: string; // Changed to string for flexibility
  variants: ModuleVariant[];
  defaultVariant: ModuleVariant;
  category: ModuleCategory;

  // Content requirements for auto-inclusion
  requires?: {
    screenshots?: boolean;
    audio?: boolean;
    video?: boolean;
    code?: boolean;
    decisions?: boolean;
    notes?: boolean;
    tasks?: boolean;
  };

  // Metadata
  displayName: string;
  description?: string;
  icon?: string;
  tags?: string[];
}

/**
 * Module categories for organization
 */
export type ModuleCategory =
  | 'media'        // Video, audio, images
  | 'timeline'     // Time-based navigation
  | 'content'      // Text, code, documents
  | 'analytics'    // Charts, metrics, insights
  | 'navigation'   // Navigation and filtering
  | 'interaction'; // Interactive tools

// ============================================================================
// LAYOUT SELECTION
// ============================================================================

/**
 * Result from layout selection algorithm
 */
export interface LayoutSelectionResult {
  layoutType: LayoutType;
  confidence: number; // 0-1 score indicating confidence
  reasoning: string[]; // Human-readable reasons for selection

  // Alternative options
  alternatives?: Array<{
    layoutType: LayoutType;
    score: number;
    reasoning: string[];
  }>;

  // Metadata
  timestamp: Date;
}

/**
 * Session characteristics analyzed for layout selection
 */
export interface SessionCharacteristics {
  hasCodeChanges: boolean;
  codeChangeCount: number;

  hasVideoContent: boolean;
  videoChapterCount: number;

  hasAudioContent: boolean;
  audioSegmentCount: number;

  hasScreenshots: boolean;
  screenshotCount: number;

  hasDecisions: boolean;
  decisionCount: number;

  hasNotes: boolean;
  noteCount: number;

  hasTasks: boolean;
  taskCount: number;

  duration: number; // in minutes
  participantCount: number;

  // Derived characteristics
  primaryContentType?: 'code' | 'media' | 'discussion' | 'visual' | 'mixed';
  intensity?: 'light' | 'moderate' | 'heavy';
}

// ============================================================================
// MODULE COMPOSITION
// ============================================================================

/**
 * Result from module composition
 */
export interface ModuleCompositionResult {
  modules: ModuleConfig[];
  warnings?: string[];

  // Metadata
  totalModules: number;
  filledSlots: number;
  availableSlots: number;
}

/**
 * Options for module composition
 */
export interface CompositionOptions {
  maxModules?: number;
  preferredVariant?: ModuleVariant;
  excludedModules?: string[]; // Changed to string[] for flexibility
  requiredModules?: string[]; // Changed to string[] for flexibility
  fillEmptySlots?: boolean;
}

// ============================================================================
// CONFIG GENERATION
// ============================================================================

/**
 * Options for configuration generation
 */
export interface ConfigGenerationOptions {
  // Layout preferences
  layoutType?: LayoutType; // Override auto-detection

  // Module preferences
  preferredModules?: string[]; // Changed to string[] for flexibility
  excludedModules?: string[]; // Changed to string[] for flexibility
  maxModules?: number;
  defaultVariant?: ModuleVariant;

  // Behavior
  enableAnimations?: boolean;
  enableAutoLayout?: boolean;

  // Theme
  themeMode?: 'light' | 'dark' | 'auto';
}

/**
 * Result from configuration generation
 */
export interface ConfigGenerationResult {
  success: boolean;
  config?: any; // MorphingCanvasConfig from main types
  error?: string;

  // Metadata
  layoutSelection: LayoutSelectionResult;
  moduleComposition: ModuleCompositionResult;
  warnings?: string[];
}

// ============================================================================
// RESPONSIVE BEHAVIOR
// ============================================================================

/**
 * Responsive configuration adjustments
 */
export interface ResponsiveAdjustment {
  breakpoint: 'mobile' | 'tablet' | 'desktop' | 'wide';

  // Adjustments to apply
  hideModules?: string[]; // Module IDs to hide
  compactModules?: string[]; // Module IDs to switch to compact variant
  reorderModules?: Array<{
    moduleId: string;
    newSlotId: string;
  }>;

  // Grid adjustments
  gridColumns?: number;
  gridGap?: string;
}

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Module registry entry
 */
export interface RegistryEntry {
  definition: ExtendedModuleDefinition;
  component: any; // React.ComponentType
  defaultConfig: Record<string, any>;

  // Registration metadata
  registeredAt: Date;
  version?: string;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalModules: number;
  modulesByCategory: Record<ModuleCategory, number>;
  modulesByType: Record<string, number>; // Changed to string for flexibility
}

// ============================================================================
// HEURISTICS
// ============================================================================

/**
 * Scoring weights for layout selection
 */
export interface LayoutScoringWeights {
  codeChanges: number;
  videoContent: number;
  audioContent: number;
  screenshots: number;
  decisions: number;
  duration: number;
  participants: number;
}

/**
 * Heuristic rule for layout selection
 */
export interface LayoutHeuristic {
  name: string;
  description: string;
  condition: (characteristics: SessionCharacteristics) => boolean;
  suggestedLayout: LayoutType;
  confidence: number; // Base confidence if condition is met
  priority: number; // For rule ordering
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic result wrapper
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}
