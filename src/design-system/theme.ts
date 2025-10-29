/**
 * Taskerino Design System - Theme Configuration
 *
 * Centralized theme system with customizable color schemes and glass morphism
 */

// ============================================================================
// COLOR SCHEMES
// ============================================================================

export type ColorScheme = 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome';

export interface ThemeColors {
  name: string;
  primary: {
    from: string;
    to: string;
  };
  accent: {
    from: string;
    to: string;
  };
  // For focus rings, active states, etc.
  focus: string;
  focusRing: string;
}

export const COLOR_SCHEMES: Record<ColorScheme, ThemeColors> = {
  ocean: {
    name: 'Ocean',
    primary: {
      from: 'cyan-600',
      to: 'blue-600',
    },
    accent: {
      from: 'cyan-500',
      to: 'blue-500',
    },
    focus: 'cyan-400',
    focusRing: 'cyan-400',
  },
  sunset: {
    name: 'Sunset',
    primary: {
      from: 'orange-600',
      to: 'pink-600',
    },
    accent: {
      from: 'orange-500',
      to: 'pink-500',
    },
    focus: 'orange-400',
    focusRing: 'orange-400',
  },
  forest: {
    name: 'Forest',
    primary: {
      from: 'emerald-600',
      to: 'teal-600',
    },
    accent: {
      from: 'emerald-500',
      to: 'teal-500',
    },
    focus: 'emerald-400',
    focusRing: 'emerald-400',
  },
  lavender: {
    name: 'Lavender',
    primary: {
      from: 'purple-600',
      to: 'pink-600',
    },
    accent: {
      from: 'purple-500',
      to: 'pink-500',
    },
    focus: 'purple-400',
    focusRing: 'purple-400',
  },
  monochrome: {
    name: 'Monochrome',
    primary: {
      from: 'gray-700',
      to: 'gray-900',
    },
    accent: {
      from: 'gray-600',
      to: 'gray-800',
    },
    focus: 'gray-500',
    focusRing: 'gray-500',
  },
};

// ============================================================================
// GLASS MORPHISM LEVELS
// ============================================================================

export type GlassStrength = 'subtle' | 'medium' | 'strong' | 'extra-strong';

export interface GlassPattern {
  background: string;        // e.g., 'bg-white/30'
  backdropBlur: string;      // e.g., 'backdrop-blur-xl'
  border: string;            // e.g., 'border-2'
  borderColor: string;       // e.g., 'border-white/50'
  shadow: string;            // e.g., 'shadow-xl'
}

export const GLASS_PATTERNS: Record<GlassStrength, GlassPattern> = {
  subtle: {
    background: 'bg-white/30',
    backdropBlur: 'backdrop-blur-sm',
    border: 'border',
    borderColor: 'border-white/40',
    shadow: 'shadow-sm',
  },
  medium: {
    background: 'bg-white/50',
    backdropBlur: 'backdrop-blur-xl',
    border: 'border',
    borderColor: 'border-white/60',
    shadow: 'shadow-lg',
  },
  strong: {
    background: 'bg-white/40',
    backdropBlur: 'backdrop-blur-2xl',
    border: 'border-2',
    borderColor: 'border-white/50',
    shadow: 'shadow-xl',
  },
  'extra-strong': {
    background: 'bg-white/60',
    backdropBlur: 'backdrop-blur-2xl',
    border: 'border-2',
    borderColor: 'border-white/60',
    shadow: 'shadow-2xl',
  },
};

// ============================================================================
// BORDER RADIUS STANDARDS
// ============================================================================

export const RADIUS = {
  modal: 24,      // Large modals, overlays (reduced from 32 for professional feel)
  card: 16,       // Cards, sections, containers (reduced from 24)
  field: 12,      // Inputs, buttons, select boxes (reduced from 20)
  element: 12,    // Small interactive elements (reduced from 16)
  pill: 9999,     // Pills, badges, circular elements (rounded-full equivalent)
} as const;

// ============================================================================
// SHADOW HIERARCHY
// ============================================================================

export const SHADOWS = {
  modal: 'shadow-2xl',          // Major overlays
  elevated: 'shadow-xl',        // Elevated cards, popovers
  card: 'shadow-lg',            // Default cards
  button: 'shadow-md',          // Buttons (can use colored shadow variants)
  input: 'shadow-sm',           // Input fields
  none: 'shadow-none',          // Flat elements
} as const;

// Colored shadow variants (for buttons with gradients)
export const COLORED_SHADOWS: Record<ColorScheme, string> = {
  ocean: 'shadow-cyan-200/50',
  sunset: 'shadow-orange-200/50',
  forest: 'shadow-emerald-200/50',
  lavender: 'shadow-purple-200/50',
  monochrome: 'shadow-gray-200/50',
};

// ============================================================================
// INTERACTION SCALE VALUES
// ============================================================================

export const SCALE = {
  buttonHover: 'hover:scale-105',
  buttonActive: 'active:scale-95',
  iconButtonHover: 'hover:scale-110',
  iconButtonActive: 'active:scale-90',
  cardHover: 'hover:scale-[1.02]',
  cardActive: 'active:scale-[0.99]',
  subtleHover: 'hover:scale-[1.01]',
  subtleActive: 'active:scale-[0.99]',
} as const;

// ============================================================================
// TRANSITION PATTERNS
// ============================================================================

export const TRANSITIONS = {
  // Faster transitions for immediate feedback
  fast: 'transition-all duration-200',

  // Standard transitions for most interactions
  standard: 'transition-all duration-300',

  // Slower for dramatic effects
  slow: 'transition-all duration-500',

  // Specific property transitions (better performance)
  transform: 'transition-transform duration-300',
  colors: 'transition-colors duration-200',
  opacity: 'transition-opacity duration-300',

  // Custom easing (bouncy feel)
  bouncy: 'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
} as const;

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

/**
 * Easing curves for natural motion
 * Note: Using array format for Framer Motion compatibility
 */
export const EASING = {
  // Standard easing functions
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0.0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],

  // Smooth, natural motion (recommended for most UI)
  smooth: [0.4, 0.0, 0.2, 1],

  // Snappy, responsive feel
  snappy: [0.4, 0.0, 0.6, 1],

  // Elastic, bouncy effect
  elastic: [0.34, 1.56, 0.64, 1],

  // Anticipation (slightly overshoots)
  anticipate: [0.68, -0.55, 0.265, 1.55],
} as const;

/**
 * Animation durations in milliseconds
 */
export const DURATION = {
  instant: 100,
  fast: 150,
  normal: 250,
  moderate: 300,
  slow: 400,
  slower: 500,
  glacial: 700,
} as const;

/**
 * Sidebar-specific animation configuration
 */
export const SIDEBAR_ANIMATION = {
  // Main slide animation
  slide: {
    duration: DURATION.moderate,
    easing: EASING.smooth,
  },

  // Content fade (faster than slide for smooth coordination)
  contentFade: {
    duration: DURATION.fast,
    easing: EASING.easeOut,
  },

  // Peek strip hover effects
  peekHover: {
    duration: DURATION.fast,
    easing: EASING.snappy,
  },

  // Backdrop overlay
  backdrop: {
    duration: DURATION.normal,
    easing: EASING.easeInOut,
  },

  // Micro-interactions (button press, icon rotate)
  microInteraction: {
    duration: DURATION.instant,
    easing: EASING.snappy,
  },
} as const;

/**
 * Stagger delays for coordinated animations (in ms)
 */
export const STAGGER_DELAY = {
  tiny: 25,
  small: 50,
  medium: 100,
  large: 150,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the class string for a glass pattern
 */
export function getGlassClasses(strength: GlassStrength = 'strong'): string {
  const pattern = GLASS_PATTERNS[strength];
  return `${pattern.background} ${pattern.backdropBlur} ${pattern.border} ${pattern.borderColor} ${pattern.shadow}`;
}

/**
 * Get border radius class for a specific element type
 */
export function getRadiusClass(type: 'modal' | 'card' | 'field' | 'element' | 'pill'): string {
  const radiusValue = RADIUS[type];
  if (radiusValue === 9999) {
    return 'rounded-full';
  }
  return `rounded-[${radiusValue}px]`;
}

/**
 * Alias for getGlassClasses - more semantic name for glassmorphism effects
 */
export function getGlassmorphism(strength: GlassStrength = 'strong'): string {
  return getGlassClasses(strength);
}

/**
 * Get gradient classes for the current theme
 */
export function getGradientClasses(
  scheme: ColorScheme = 'ocean',
  variant: 'primary' | 'accent' = 'primary'
): string {
  const colors = COLOR_SCHEMES[scheme][variant];
  return `bg-gradient-to-r from-${colors.from} to-${colors.to}`;
}

/**
 * Get focus ring classes for the current theme
 */
export function getFocusRingClasses(scheme: ColorScheme = 'ocean'): string {
  const { focus, focusRing } = COLOR_SCHEMES[scheme];
  return `focus:ring-2 focus:ring-${focusRing} focus:border-${focus}`;
}

/**
 * Get colored shadow for buttons
 */
export function getColoredShadow(scheme: ColorScheme = 'ocean'): string {
  return COLORED_SHADOWS[scheme];
}

// ============================================================================
// PRESET COMPONENT STYLES
// ============================================================================

/**
 * Get complete button classes
 */
export function getButtonClasses(
  variant: 'primary' | 'secondary' | 'tertiary' | 'ghost' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md',
  scheme: ColorScheme = 'ocean'
): string {
  const baseClasses = `${TRANSITIONS.standard} ${SCALE.buttonHover} ${SCALE.buttonActive}`;

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-2 text-base',
    lg: 'px-8 py-3 text-lg',
  };

  const variantClasses = {
    primary: `${getGradientClasses(scheme, 'primary')} text-white rounded-[${RADIUS.field}px] ${SHADOWS.button} ${getColoredShadow(scheme)}`,
    secondary: `${getGlassClasses('medium')} rounded-[${RADIUS.field}px] hover:${getGlassClasses('strong')}`,
    tertiary: `${getGlassClasses('subtle')} rounded-[${RADIUS.field}px] hover:${getGlassClasses('medium')}`,
    ghost: 'bg-transparent hover:bg-white/20',
  };

  return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]}`;
}

/**
 * Get complete modal classes
 */
export function getModalClasses(
  scheme: ColorScheme = 'ocean',
  glassStrength: GlassStrength = 'strong'
): {
  overlay: string;
  container: string;
  content: string;
} {
  return {
    overlay: 'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4',
    container: 'max-w-3xl w-full flex flex-col',
    content: `${getGlassClasses(glassStrength)} rounded-[${RADIUS.modal}px] ${SHADOWS.modal}`,
  };
}

/**
 * Get complete card classes
 */
export function getCardClasses(
  variant: 'default' | 'elevated' | 'interactive' = 'default',
  scheme: ColorScheme = 'ocean'
): string {
  const baseClasses = `rounded-[${RADIUS.card}px]`;

  const variantClasses = {
    default: getGlassClasses('medium'),
    elevated: getGlassClasses('strong'),
    interactive: `${getGlassClasses('medium')} ${SCALE.cardHover} ${TRANSITIONS.standard}`,
  };

  return `${baseClasses} ${variantClasses[variant]}`;
}

/**
 * Get complete input classes
 */
export function getInputClasses(scheme: ColorScheme = 'ocean'): string {
  return `${getGlassClasses('strong')} rounded-[${RADIUS.field}px] ${SHADOWS.input} ${getFocusRingClasses(scheme)} ${TRANSITIONS.fast}`;
}

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

// Legacy typography removed - see comprehensive TYPOGRAPHY system at end of file

// ============================================================================
// SPACING SCALE
// ============================================================================

export type SpacingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const SPACING = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
} as const;

export const GAP = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
} as const;

/**
 * Get spacing value for the specified size
 */
export function getSpacing(size: SpacingSize): string {
  return SPACING[size];
}

/**
 * Get gap value for the specified size
 */
export function getGap(size: SpacingSize): string {
  return GAP[size];
}

// ============================================================================
// ICON SIZES
// ============================================================================

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// ============================================================================
// SEMANTIC GRADIENTS
// ============================================================================

export type GradientIntensity = 'light' | 'medium' | 'strong';

interface SemanticGradientClasses {
  container: string;  // Combined background, backdrop-blur, border, shadow
  iconBg: string;     // Icon background color
  iconColor: string;  // Icon color
  textPrimary: string;
  textSecondary: string;
}

/**
 * Get success gradient (green) with specified intensity
 */
export function getSuccessGradient(intensity: GradientIntensity = 'medium'): SemanticGradientClasses {
  const gradients: Record<GradientIntensity, SemanticGradientClasses> = {
    light: {
      container: 'bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-green-400/10 backdrop-blur-xl border border-green-300/40 shadow-sm',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      textPrimary: 'text-green-900',
      textSecondary: 'text-green-700',
    },
    medium: {
      container: 'bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-green-400/20 backdrop-blur-xl border-2 border-green-300/50 shadow-lg',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      textPrimary: 'text-green-900',
      textSecondary: 'text-green-700',
    },
    strong: {
      container: 'bg-gradient-to-r from-green-500/30 via-emerald-500/15 to-green-400/30 backdrop-blur-xl border-2 border-green-300/60 shadow-xl',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      textPrimary: 'text-green-900',
      textSecondary: 'text-green-700',
    },
  };
  return gradients[intensity];
}

/**
 * Get danger gradient (red) with specified intensity
 */
export function getDangerGradient(intensity: GradientIntensity = 'medium'): SemanticGradientClasses {
  const gradients: Record<GradientIntensity, SemanticGradientClasses> = {
    light: {
      container: 'bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-400/10 backdrop-blur-xl border border-red-300/40 shadow-sm',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      textPrimary: 'text-red-900',
      textSecondary: 'text-red-700',
    },
    medium: {
      container: 'bg-gradient-to-r from-red-500/20 via-rose-500/10 to-red-400/20 backdrop-blur-xl border-2 border-red-300/50 shadow-lg',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      textPrimary: 'text-red-900',
      textSecondary: 'text-red-700',
    },
    strong: {
      container: 'bg-gradient-to-r from-red-500/30 via-rose-500/15 to-red-400/30 backdrop-blur-xl border-2 border-red-300/60 shadow-xl',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      textPrimary: 'text-red-900',
      textSecondary: 'text-red-700',
    },
  };
  return gradients[intensity];
}

/**
 * Get warning gradient (amber/orange) with specified intensity
 */
export function getWarningGradient(intensity: GradientIntensity = 'medium'): SemanticGradientClasses {
  const gradients: Record<GradientIntensity, SemanticGradientClasses> = {
    light: {
      container: 'bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-400/10 backdrop-blur-xl border border-amber-300/40 shadow-sm',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      textPrimary: 'text-amber-900',
      textSecondary: 'text-amber-700',
    },
    medium: {
      container: 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-400/20 backdrop-blur-xl border-2 border-amber-300/50 shadow-lg',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      textPrimary: 'text-amber-900',
      textSecondary: 'text-amber-700',
    },
    strong: {
      container: 'bg-gradient-to-r from-amber-500/30 via-orange-500/15 to-amber-400/30 backdrop-blur-xl border-2 border-amber-300/60 shadow-xl',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      textPrimary: 'text-amber-900',
      textSecondary: 'text-amber-700',
    },
  };
  return gradients[intensity];
}

/**
 * Get info gradient (blue/cyan) with specified intensity
 */
export function getInfoGradient(intensity: GradientIntensity = 'medium'): SemanticGradientClasses {
  const gradients: Record<GradientIntensity, SemanticGradientClasses> = {
    light: {
      container: 'bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-cyan-400/10 backdrop-blur-xl border border-cyan-300/40 shadow-sm',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      textPrimary: 'text-cyan-900',
      textSecondary: 'text-cyan-700',
    },
    medium: {
      container: 'bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-cyan-400/20 backdrop-blur-xl border-2 border-cyan-300/50 shadow-lg',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      textPrimary: 'text-cyan-900',
      textSecondary: 'text-cyan-700',
    },
    strong: {
      container: 'bg-gradient-to-r from-cyan-500/30 via-blue-500/15 to-cyan-400/30 backdrop-blur-xl border-2 border-cyan-300/60 shadow-xl',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      textPrimary: 'text-cyan-900',
      textSecondary: 'text-cyan-700',
    },
  };
  return gradients[intensity];
}

// ============================================================================
// AUDIO & MEDIA GRADIENTS (for timeline cards)
// ============================================================================

export interface AudioGradients {
  primary: string;
  background: string;
  iconBg: string;
  shadow: string;
  shadowHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}

/**
 * Audio gradient palette for audio segments in timeline
 */
export const AUDIO_GRADIENTS: AudioGradients = {
  // Primary gradient for audio cards
  primary: 'from-purple-500 to-pink-500',
  // Background gradient (lighter)
  background: 'from-purple-500/20 via-pink-500/10 to-purple-400/20',
  // Icon background
  iconBg: 'from-purple-50 to-pink-50',
  // Shadow colors
  shadow: 'shadow-purple-100/30',
  shadowHover: 'shadow-purple-200/40',
  // Border
  border: 'border-purple-400',
  // Text colors
  textPrimary: 'text-purple-900',
  textSecondary: 'text-purple-800',
} as const;

export interface NoteGradients {
  border: string;
  background: string;
  iconBg: string;
  shadow: string;
  shadowHover: string;
  textPrimary: string;
  textSecondary: string;
}

/**
 * Note gradient palette for user notes in timeline
 */
export const NOTE_GRADIENTS: NoteGradients = {
  // Animated border gradient
  border: 'from-amber-400 via-amber-500 to-amber-600',
  // Background gradient
  background: 'from-amber-500/10 via-yellow-500/5 to-amber-400/10',
  // Icon background
  iconBg: 'from-amber-50 to-yellow-100',
  // Shadow colors
  shadow: 'shadow-amber-100/30',
  shadowHover: 'shadow-amber-200/40',
  // Text colors
  textPrimary: 'text-amber-900',
  textSecondary: 'text-amber-800',
} as const;

export interface ActivityColor {
  primary: string;
  accent: string;
  bg: string;
  text: string;
}

export type ActivityType = 'code' | 'design' | 'email' | 'browser' | 'meeting' | 'document' | 'terminal' | 'writing' | 'unknown';

/**
 * Activity type colors and icons for screenshot/activity cards
 */
export const ACTIVITY_COLORS: Record<ActivityType, ActivityColor> = {
  code: {
    primary: 'blue-500',
    accent: 'cyan-400',
    bg: 'blue-50',
    text: 'blue-900',
  },
  design: {
    primary: 'purple-500',
    accent: 'pink-400',
    bg: 'purple-50',
    text: 'purple-900',
  },
  email: {
    primary: 'green-500',
    accent: 'emerald-400',
    bg: 'green-50',
    text: 'green-900',
  },
  browser: {
    primary: 'orange-500',
    accent: 'amber-400',
    bg: 'orange-50',
    text: 'orange-900',
  },
  meeting: {
    primary: 'red-500',
    accent: 'rose-400',
    bg: 'red-50',
    text: 'red-900',
  },
  document: {
    primary: 'indigo-500',
    accent: 'violet-400',
    bg: 'indigo-50',
    text: 'indigo-900',
  },
  terminal: {
    primary: 'gray-700',
    accent: 'gray-500',
    bg: 'gray-50',
    text: 'gray-900',
  },
  writing: {
    primary: 'amber-500',
    accent: 'yellow-400',
    bg: 'amber-50',
    text: 'amber-900',
  },
  unknown: {
    primary: 'slate-500',
    accent: 'slate-400',
    bg: 'slate-50',
    text: 'slate-900',
  },
} as const;

export interface PriorityColor {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export type PriorityLevel = 'critical' | 'important' | 'normal' | 'low' | 'info';

/**
 * Priority level colors for notes
 */
export const PRIORITY_COLORS: Record<PriorityLevel, PriorityColor> = {
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  important: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  normal: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
  low: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    dot: 'bg-gray-300',
  },
  info: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
} as const;

/**
 * Waveform visualization constants
 */
export const WAVEFORM = {
  barCount: 30,
  barWidth: 3,
  barGap: 2,
  minHeight: 4,
  maxHeight: 24,
  color: 'violet-500',
  activeColor: 'pink-500',
  backgroundColor: 'purple-100',
} as const;

// ============================================================================
// CONTROL SIZING STANDARDS
// ============================================================================

/**
 * Standardized control sizes for consistent UI across all zones
 */
export const CONTROL_SIZES = {
  // Menu bar controls (buttons, selects, inputs)
  menuBar: {
    button: {
      primary: 'px-4 py-2',      // Primary action buttons: ~40px height
      secondary: 'px-3 py-1.5',  // Secondary/view switchers: ~32px height
      icon: 'p-2',               // Icon-only buttons: ~36px height
    },
    select: {
      default: 'pl-3 pr-8 py-2 h-[38px]', // Forced height for consistency
    },
    input: {
      default: 'px-4 py-2 h-[38px]',
    },
  },

  // Filter controls
  filter: {
    pill: 'px-2.5 py-1.5',       // Filter pills: consistent across all zones
    button: 'px-4 py-2.5',       // Filter category buttons
  },

  // Form controls (settings pages)
  form: {
    input: 'px-4 py-3',
    select: 'px-4 py-3 h-[46px]',
    button: 'px-6 py-3',
  },
} as const;

/**
 * Standardized border styles for different control types
 */
export const BORDER_STYLES = {
  menuBar: 'border-2 border-white/50',
  dropdown: 'border-2 border-cyan-400/80',
  filterActive: 'border-2 border-transparent',
  filterInactive: 'border-2 border-white/60',
  control: 'border-2 border-white/60',
} as const;

/**
 * Glass morphism styles for different contexts
 */
export const GLASS_STYLES = {
  menuBar: 'bg-white/40 backdrop-blur-xl',
  dropdown: 'bg-white backdrop-blur-xl',
  control: 'bg-white/50 backdrop-blur-sm',
  panel: 'bg-white/40 backdrop-blur-xl',
} as const;

/**
 * Z-index hierarchy for layering
 */
export const Z_INDEX = {
  base: 'z-0',
  dropdown: 'z-[9999]',
  modal: 'z-50',
  tooltip: 'z-[10000]',
  notification: 'z-[10001]',
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get activity colors by activity type with fallback to 'unknown'
 */
export function getActivityColors(type: ActivityType | string): ActivityColor {
  if (type in ACTIVITY_COLORS) {
    return ACTIVITY_COLORS[type as ActivityType];
  }
  return ACTIVITY_COLORS.unknown;
}

/**
 * Get priority colors by priority level with fallback to 'normal'
 */
export function getPriorityColors(level: PriorityLevel | string): PriorityColor {
  if (level in PRIORITY_COLORS) {
    return PRIORITY_COLORS[level as PriorityLevel];
  }
  return PRIORITY_COLORS.normal;
}

/**
 * Get audio gradient classes
 */
export function getAudioGradientClasses(): AudioGradients {
  return AUDIO_GRADIENTS;
}

/**
 * Get note gradient classes
 */
export function getNoteGradientClasses(): NoteGradients {
  return NOTE_GRADIENTS;
}

/**
 * Build a complete activity card gradient based on activity type
 */
export function getActivityGradient(type: ActivityType | string): {
  background: string;
  border: string;
  text: string;
} {
  const colors = getActivityColors(type);
  return {
    background: `bg-gradient-to-r from-${colors.primary}/20 via-${colors.accent}/10 to-${colors.primary}/20`,
    border: `border-${colors.primary}/40`,
    text: `text-${colors.text}`,
  };
}

/**
 * Build complete priority badge classes
 */
export function getPriorityBadgeClasses(level: PriorityLevel | string): string {
  const colors = getPriorityColors(level);
  return `${colors.bg} ${colors.text} ${colors.border}`;
}

// ============================================================================
// NAVIGATION CONSTANTS
// ============================================================================

/**
 * Navigation-specific constants for TopNavigation component
 */
export const NAVIGATION = {
  // Logo container styles
  logo: {
    container: 'flex items-center gap-2.5 px-5 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 backdrop-blur-xl rounded-full shadow-xl shadow-cyan-200/50 border-2 border-white/60 ring-1 ring-cyan-400/30 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-300/60 hover:scale-105 hover:brightness-110 active:scale-95',
    iconBg: 'w-6 h-6 bg-white/95 rounded-lg flex items-center justify-center shadow-md',
    iconText: 'font-bold text-xs bg-gradient-to-br from-cyan-600 to-blue-600 bg-clip-text text-transparent',
    text: 'font-semibold text-base text-white tracking-wide drop-shadow-sm',
  },

  // Island container styles
  island: {
    container: 'bg-white/40 backdrop-blur-2xl rounded-[40px] shadow-2xl border-2 border-white/50 ring-1 ring-black/5',
    maxWidth: '32rem',
  },

  // Tab styles
  tab: {
    base: 'relative flex items-center gap-2 px-4 h-10 rounded-full font-medium text-sm transition-all duration-200',
    active: 'bg-white/95 backdrop-blur-lg shadow-lg text-cyan-600 border-2 border-cyan-400/60 ring-2 ring-cyan-300/40 shadow-cyan-500/30',
    inactive: 'bg-white/50 backdrop-blur-md text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-md border border-transparent hover:border-white/40',
  },

  // Badge styles
  badge: {
    count: 'ml-1 px-1.5 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-full min-w-[20px] text-center',
    countClickable: 'ml-1 px-1.5 py-0.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 text-xs font-bold rounded-full min-w-[20px] text-center transition-all duration-200 hover:shadow-md cursor-pointer',
    processing: 'ml-1 px-1.5 py-0.5 bg-gradient-to-r from-violet-100 to-purple-100 hover:from-violet-200 hover:to-purple-200 text-violet-700 text-xs font-bold rounded-full min-w-[20px] text-center flex items-center gap-1 transition-all duration-200 hover:shadow-md cursor-pointer',
    statusActive: 'ml-1.5 w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-400/50 transition-all duration-200 hover:scale-150 cursor-pointer',
    statusPaused: 'ml-1.5 w-2 h-2 rounded-full bg-yellow-500 shadow-lg shadow-yellow-400/50 transition-all duration-200 hover:scale-150 cursor-pointer',
  },

  // Quick action button styles
  quickAction: {
    base: 'p-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full hover:shadow-lg transition-all duration-200',
  },
} as const;

/**
 * Responsive navigation patterns for compact and full modes
 */
export const RESPONSIVE_NAVIGATION = {
  compact: {
    button: {
      size: 'min-w-14 h-10',  // 56px wide × 40px tall (pill-shaped)
      padding: 'px-2',
      gap: 'gap-2',
    },
    island: {
      maxWidth: '24rem',  // 384px (reduced from 448px)
      gap: 'gap-2',
    },
    logo: {
      width: 'w-10',  // Just the T icon
    },
    tooltip: {
      delay: 300,  // 300ms delay as specified
    }
  },
  full: {
    button: {
      size: 'h-10',  // Current height
      padding: 'px-4',
      gap: 'gap-2',
    },
    island: {
      maxWidth: '80rem',  // 1280px (max-w-7xl) - wide enough to prevent button cutoff
      gap: 'gap-2',
    },
  }
} as const;

/**
 * Menu Morphing Pill Constants
 * Used by MenuMorphPill component for scroll-driven morphing
 */
export const MENU_PILL = {
  width: {
    expanded: 400,  // Full width (natural inline state)
    compact: 140,   // Compact width (scrolled state)
  },
  borderRadius: {
    expanded: 24 as number,   // Rounded rectangle (inline)
    compact: 9999 as number,  // Fully rounded pill (scrolled)
  },
  scrollThresholds: {
    start: 100,     // When morphing begins
    end: 250,       // When fully compact
    hysteresis: 10, // Anti-flicker buffer zone
  },
  stagger: {
    offset: 10,     // Scroll offset per item
    range: 150,     // Total animation range (end - start)
  },
} as const;

/**
 * Navigation button style variants
 */
export type NavButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';

export const NAV_BUTTON_STYLES: Record<NavButtonVariant, string> = {
  default: 'px-7 py-4 rounded-full bg-white/60 text-gray-600 hover:bg-white/80 hover:shadow-2xl shadow-xl border-2 border-white/50 backdrop-blur-xl ring-1 ring-black/5 hover:scale-105 transition-all duration-300',
  primary: 'px-4 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-200/40 shadow-xl border-2 border-white/50 backdrop-blur-xl ring-1 ring-black/5 hover:scale-105 transition-all duration-300',
  danger: 'px-4 py-4 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200/40 shadow-xl border-2 border-white/50 backdrop-blur-xl ring-1 ring-black/5 hover:scale-105 transition-all duration-300',
  ghost: 'px-7 py-4 rounded-full bg-white/40 text-gray-600 hover:bg-white/60 hover:shadow-lg shadow-xl border-2 border-white/50 backdrop-blur-xl ring-1 ring-black/5 hover:scale-105 transition-all duration-300',
} as const;

/**
 * Get navigation button classes for the specified variant
 */
export function getNavButtonClasses(variant: NavButtonVariant = 'default', isActive: boolean = false): string {
  const baseClasses = NAV_BUTTON_STYLES[variant];
  const activeClasses = isActive ? 'bg-white/90 text-cyan-600 shadow-cyan-200/40' : '';
  return `${baseClasses} ${activeClasses}`.trim();
}

/**
 * Navigation badge style variants
 */
export type NavBadgeVariant = 'count' | 'processing' | 'status';

export const NAV_BADGE_STYLES: Record<NavBadgeVariant, string> = {
  count: NAVIGATION.badge.count,
  processing: NAVIGATION.badge.processing,
  status: NAVIGATION.badge.statusActive,
} as const;

// ============================================================================
// BACKGROUND GRADIENTS
// ============================================================================

/**
 * Background gradient patterns for zone backgrounds
 */
export const BACKGROUND_GRADIENT = {
  primary: 'bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20',
  secondary: 'bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse',
} as const;

// ============================================================================
// SETTINGS UI PATTERNS
// ============================================================================

/**
 * Settings-specific UI patterns
 */
export const SETTINGS = {
  tab: {
    base: 'flex items-center gap-2 px-4 py-3 rounded-t-[20px] font-medium transition-all',
    active: 'bg-white/80 backdrop-blur-sm text-cyan-700 shadow-sm',
    inactive: 'text-gray-600 hover:text-gray-900 hover:bg-white/50',
  },
  radioCard: {
    base: 'flex items-start gap-4 p-5 rounded-[20px] cursor-pointer transition-all border-2',
    selected: 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-400',
    unselected: 'bg-white/20 backdrop-blur-sm border-white/40 hover:bg-white/30',
  },
  statCard: 'p-4 bg-white/20 backdrop-blur-sm rounded-[20px] border border-white/40',
} as const;

/**
 * Get tab classes based on active state
 */
export function getTabClasses(isActive: boolean): string {
  return `${SETTINGS.tab.base} ${isActive ? SETTINGS.tab.active : SETTINGS.tab.inactive}`;
}

/**
 * Get radio card classes based on selected state
 */
export function getRadioCardClasses(isSelected: boolean): string {
  return `${SETTINGS.radioCard.base} ${isSelected ? SETTINGS.radioCard.selected : SETTINGS.radioCard.unselected}`;
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

/**
 * Get toast notification classes by variant
 */
export function getToastClasses(variant: ToastVariant = 'info'): string {
  const baseClasses = 'bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border-2';

  const variantClasses: Record<ToastVariant, string> = {
    info: 'border-cyan-400/60',
    success: 'border-green-400/60',
    warning: 'border-amber-400/60',
    error: 'border-red-400/60',
  };

  return `${baseClasses} ${variantClasses[variant]}`;
}

// ============================================================================
// NOTE CARD PATTERNS
// ============================================================================

/**
 * Get note card classes with selected state
 */
export function getNoteCardClasses(isSelected: boolean): string {
  return `group relative bg-white/30 backdrop-blur-xl rounded-[24px] p-3 cursor-pointer border-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] will-change-transform ${
    isSelected
      ? 'border-cyan-400 bg-cyan-100/20 shadow-lg shadow-cyan-100/30'
      : 'border-white/60 hover:border-cyan-200/60 hover:shadow-md'
  }`;
}

/**
 * Panel footer pattern for list panels
 */
export const PANEL_FOOTER = 'px-4 py-3 border-t-2 border-white/50 bg-white/30 backdrop-blur-sm';

// ============================================================================
// STATUS COLORS (for tasks, sessions, etc.)
// ============================================================================

export interface StatusColor {
  bg: string;
  text: string;
  border: string;
}

export type StatusType = 'done' | 'in-progress' | 'blocked' | 'todo' | 'active' | 'paused' | 'completed' | 'interrupted';

/**
 * Status colors for tasks, sessions, and other items
 */
export const STATUS_COLORS: Record<StatusType, StatusColor> = {
  done: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  'in-progress': {
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
  blocked: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  todo: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
  active: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  paused: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  completed: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
  interrupted: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
  },
} as const;

/**
 * Get status badge classes for the specified status
 */
export function getStatusBadgeClasses(status: StatusType): string {
  const colors = STATUS_COLORS[status];
  return `${colors.bg} ${colors.text} border ${colors.border}`;
}

// ============================================================================
// ENTITY RELATIONSHIP PILLS
// ============================================================================

export type EntityType = 'company' | 'contact' | 'topic';

export const ENTITY_GRADIENTS: Record<EntityType, {
  from: string;
  to: string;
  border: string;
  text: string;
}> = {
  company: {
    from: 'from-blue-100/80',
    to: 'to-cyan-100/80',
    border: 'border-blue-300/60',
    text: 'text-blue-800',
  },
  contact: {
    from: 'from-emerald-100/80',
    to: 'to-green-100/80',
    border: 'border-emerald-300/60',
    text: 'text-emerald-800',
  },
  topic: {
    from: 'from-amber-100/80',
    to: 'to-yellow-100/80',
    border: 'border-amber-300/60',
    text: 'text-amber-800',
  },
};

/**
 * Get entity pill classes for the specified entity type
 */
export function getEntityPillClasses(entityType: EntityType): string {
  const gradient = ENTITY_GRADIENTS[entityType];
  return `bg-gradient-to-r ${gradient.from} ${gradient.to} border ${gradient.border} ${gradient.text}`;
}

// ============================================================================
// STATS CARD GRADIENTS
// ============================================================================

export const STATS_CARD_GRADIENTS = {
  duration: {
    bg: 'from-blue-500/30 via-cyan-500/20 to-blue-400/30',
    border: 'border-blue-300/50',
    icon: 'text-blue-600',
    text: 'text-blue-900',
  },
  screenshots: {
    bg: 'from-purple-500/30 via-pink-500/20 to-purple-400/30',
    border: 'border-purple-300/50',
    icon: 'text-purple-600',
    text: 'text-purple-900',
  },
  activities: {
    bg: 'from-teal-500/30 via-emerald-500/20 to-teal-400/30',
    border: 'border-teal-300/50',
    icon: 'text-teal-600',
    text: 'text-teal-900',
  },
} as const;

// ============================================================================
// MODAL OVERLAY
// ============================================================================

/**
 * Standard modal overlay for backdrops
 */
export const MODAL_OVERLAY = 'fixed inset-0 bg-black/20 backdrop-blur-sm';

// ============================================================================
// MODAL SECTIONS
// ============================================================================

/**
 * Modal section styles - standardized header, content, footer
 */
export const MODAL_SECTIONS = {
  header: 'p-6 border-b-2 border-white/30 backdrop-blur-sm rounded-t-2xl',
  content: 'flex-1 overflow-y-auto p-6',
  footer: 'p-6 border-t-2 border-white/30 bg-white/40 backdrop-blur-xl rounded-b-2xl',
} as const;

/**
 * Input container pattern - reusable for modal inputs
 */
export function getInputContainerClasses(variant: 'default' | 'highlighted' = 'default'): string {
  if (variant === 'highlighted') {
    return `${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4 border-2 border-cyan-200/60 shadow-sm`;
  }
  return `${getGlassClasses('subtle')} ${getRadiusClass('field')} p-4 border border-white/60 shadow-sm`;
}

/**
 * Modal header with gradient - theme-aware
 */
export function getModalHeaderClasses(scheme: ColorScheme = 'ocean'): string {
  const schemeColors = {
    ocean: 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10',
    sunset: 'bg-gradient-to-r from-orange-500/10 to-pink-500/10',
    forest: 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10',
    lavender: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
    monochrome: 'bg-gradient-to-r from-gray-500/10 to-gray-700/10',
  };
  return `${MODAL_SECTIONS.header} ${schemeColors[scheme]}`;
}

// ============================================================================
// RICH TEXT EDITOR STYLES
// ============================================================================

/**
 * Rich Text Editor patterns for TipTap integration
 */
export const EDITOR_STYLES = {
  toolbar: {
    container: 'flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-xl',
    button: 'p-2 rounded hover:bg-gray-200 transition-colors',
    buttonActive: (scheme: ColorScheme) => `bg-gray-200 text-${scheme === 'ocean' ? 'cyan' : scheme === 'sunset' ? 'orange' : scheme === 'forest' ? 'emerald' : scheme === 'lavender' ? 'purple' : 'gray'}-600`,
    divider: 'w-px h-6 bg-gray-300 mx-1',
  },
  prose: {
    bulletList: 'list-disc pl-6 space-y-1',
    orderedList: 'list-decimal pl-6 space-y-1',
    code: 'bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono',
    codeBlock: 'bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-sm my-4',
    blockquote: (scheme: ColorScheme) => `border-l-4 border-${scheme === 'ocean' ? 'cyan' : scheme === 'sunset' ? 'orange' : scheme === 'forest' ? 'emerald' : scheme === 'lavender' ? 'violet' : 'gray'}-500 pl-4 italic text-gray-700 my-4`,
  },
} as const;

// ============================================================================
// CHAT/AI PATTERNS
// ============================================================================

/**
 * Chat and AI assistant interface patterns
 */
export const CHAT_STYLES = {
  container: 'flex-1 bg-white/30 backdrop-blur-xl border-2 border-white/60 shadow-xl rounded-[32px]',
  banner: {
    warning: 'flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-yellow-50/80 to-amber-50/80 backdrop-blur-xl border-2 border-yellow-200/60 rounded-[20px] shadow-xl',
    info: 'flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-cyan-50/80 via-blue-50/60 to-purple-50/60 backdrop-blur-xl border-2 border-white/70 rounded-[20px] shadow-xl',
  },
  inputBar: 'bg-white/50 backdrop-blur-xl border-2 border-white/60 shadow-2xl shadow-cyan-200/30 px-4 py-3 rounded-full',
} as const;

// ============================================================================
// DROPDOWN MENU PATTERNS
// ============================================================================

/**
 * Dropdown and popover menu patterns
 */
export const DROPDOWN_STYLES = {
  backdrop: 'fixed inset-0',
  menu: (radius: keyof typeof RADIUS = 'field') => `absolute bg-white backdrop-blur-xl ${getRadiusClass(radius)} shadow-xl border-2 border-white/60`,
  item: 'px-4 py-2 hover:bg-white/80 transition-colors cursor-pointer',
  divider: 'border-t border-gray-200/50 my-1',
} as const;

// ============================================================================
// KANBAN BOARD PATTERNS
// ============================================================================

/**
 * Kanban board component patterns for TasksZone
 */
export const KANBAN = {
  column: {
    default: 'bg-white/60 backdrop-blur-xl rounded-[24px] border border-gray-200/60 shadow-md hover:shadow-lg transition-all duration-300',
    dragOver: 'border-cyan-400 bg-cyan-50/40 shadow-2xl scale-[1.02]',
  },
  header: 'px-4 py-3 border-b border-gray-200/50 bg-white/70 backdrop-blur-sm',
  card: {
    base: 'group relative bg-white/95 backdrop-blur-lg rounded-[16px] shadow-sm cursor-grab active:cursor-grabbing border-l-4 border-t border-r border-b transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-98 will-change-transform overflow-hidden',
  },
} as const;

/**
 * Get complete task card classes with priority and state styling
 */
export function getTaskCardClasses(
  priority: 'urgent' | 'high' | 'medium' | 'low',
  state: 'overdue' | 'dueToday' | 'default'
): string {
  // Map task priority to PriorityLevel type
  const priorityMap: Record<'urgent' | 'high' | 'medium' | 'low', PriorityLevel> = {
    urgent: 'critical',
    high: 'important',
    medium: 'normal',
    low: 'low',
  };

  const priorityColors = PRIORITY_COLORS[priorityMap[priority]];
  const priorityBorder = priorityColors.border;
  const stateClasses = {
    overdue: 'border-t-red-300 border-r-red-300 border-b-red-300 hover:shadow-red-100/50 bg-red-50/40',
    dueToday: 'border-t-cyan-300 border-r-cyan-300 border-b-cyan-300 hover:shadow-cyan-100/50 bg-cyan-50/30',
    default: 'border-t-gray-200 border-r-gray-200 border-b-gray-200 hover:shadow-gray-100/50',
  }[state];

  return `${KANBAN.card.base} ${priorityBorder} ${stateClasses}`;
}

// ============================================================================
// CANVAS COMPONENT SYSTEM
// ============================================================================

/**
 * Design tokens for AI-composable Canvas components
 * Used by the flexible Canvas system to render session summaries
 */
export const CANVAS_COMPONENTS = {
  spacing: {
    tight: '0.5rem',      // 8px - Minimal spacing for compact layouts
    normal: '0.75rem',    // 12px - Standard spacing between elements (reduced from 16px)
    relaxed: '1rem',      // 16px - More breathing room (reduced from 24px)
    loose: '1.5rem',      // 24px - Maximum spacing for section separation (reduced from 32px)
  },

  elevation: {
    flat: 'shadow-none',
    lifted: 'shadow-md',
    floating: 'shadow-lg',
    elevated: 'shadow-xl',
  },

  emphasis: {
    subtle: 'opacity-60',           // De-emphasized text
    normal: 'opacity-100',          // Standard text
    strong: 'font-semibold',        // Bold text
    hero: 'text-2xl font-bold',     // Large hero text
  },

  themes: {
    default: {
      bg: 'bg-white/50',
      border: 'border-gray-200',
      text: 'text-gray-900',
      textSecondary: 'text-gray-600',
    },
    success: {
      bg: 'bg-green-50/50',
      border: 'border-green-200',
      text: 'text-green-900',
      textSecondary: 'text-green-700',
    },
    warning: {
      bg: 'bg-amber-50/50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      textSecondary: 'text-amber-700',
    },
    danger: {
      bg: 'bg-red-50/50',
      border: 'border-red-200',
      text: 'text-red-900',
      textSecondary: 'text-red-700',
    },
    info: {
      bg: 'bg-cyan-50/50',
      border: 'border-cyan-200',
      text: 'text-cyan-900',
      textSecondary: 'text-cyan-700',
    },
    purple: {
      bg: 'bg-purple-50/50',
      border: 'border-purple-200',
      text: 'text-purple-900',
      textSecondary: 'text-purple-700',
    },
  },

  grid: {
    columns: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    },
    gaps: {
      tight: 'gap-2',    // 8px
      normal: 'gap-3',   // 12px (reduced from 16px)
      relaxed: 'gap-4',  // 16px (reduced from 24px)
      loose: 'gap-6',    // 24px (reduced from 32px)
    },
  },

  buttons: {
    primary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all',
    secondary: 'bg-white/90 hover:bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 shadow-md hover:shadow-lg transition-all',
    ghost: 'bg-transparent hover:bg-white/50 text-gray-700 transition-all',
    danger: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg hover:shadow-xl transition-all',
  },

  badges: {
    default: 'bg-gray-100 text-gray-700 border-gray-300',
    success: 'bg-green-100 text-green-700 border-green-300',
    warning: 'bg-amber-100 text-amber-700 border-amber-300',
    danger: 'bg-red-100 text-red-700 border-red-300',
    info: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300',
  },
} as const;

/**
 * Typography Design System
 *
 * Comprehensive typography scale based on:
 * - Minor Third ratio (1.2) for balanced hierarchy
 * - 4 font weights for clear distinction
 * - Formalized line heights for readability
 * - Tabular numbers for data displays
 *
 * Usage: Import specific typography classes instead of ad-hoc text sizes
 */
export const TYPOGRAPHY = {
  /**
   * Display sizes - For hero stats, large KPIs, and headline numbers
   */
  display: {
    large: 'text-5xl font-black leading-tight tracking-tight',      // 48px - Hero metrics
    medium: 'text-4xl font-bold leading-tight tracking-tight',      // 36px - Large KPIs
    small: 'text-3xl font-bold leading-tight tracking-tight',       // 30px - Secondary stats
  },

  /**
   * Heading sizes - For section titles and card headers
   */
  heading: {
    h1: 'text-3xl font-bold leading-tight',                         // 30px - Main sections
    h2: 'text-2xl font-semibold leading-tight',                     // 24px - Card headers
    h3: 'text-xl font-semibold leading-normal',                     // 20px - Subsections
    h4: 'text-lg font-semibold leading-normal',                     // 18px - Minor headings
    h5: 'text-base font-semibold leading-normal',                   // 16px - Smallest headings
    h6: 'text-sm font-semibold uppercase tracking-wide leading-normal', // 14px - Overlines
  },

  /**
   * Body text sizes - For paragraphs and content
   */
  body: {
    large: 'text-base font-normal leading-relaxed',                 // 16px - Primary text
    default: 'text-sm font-normal leading-relaxed',                 // 14px - Secondary text
    small: 'text-xs font-normal leading-normal',                    // 12px - Tertiary text
  },

  /**
   * Label sizes - For form labels and metadata
   */
  label: {
    default: 'text-sm font-medium leading-normal',                  // 14px - Standard labels
    small: 'text-xs font-medium leading-normal',                    // 12px - Compact labels
  },

  /**
   * Special use cases
   */
  badge: 'text-xs font-semibold leading-normal uppercase',          // 12px - All badges
  caption: 'text-xs font-normal leading-normal',                    // 12px - Captions, timestamps
  overline: 'text-xs font-semibold uppercase tracking-wide leading-normal', // 12px - Section labels

  /**
   * Interactive elements
   */
  button: {
    large: 'text-base font-medium leading-normal',                  // 16px
    default: 'text-sm font-medium leading-normal',                  // 14px
    small: 'text-xs font-medium leading-normal',                    // 12px
  },
} as const;

/**
 * Text color hierarchy for consistent contrast
 */
export const TEXT_COLORS = {
  primary: 'text-gray-900',           // Primary text - highest emphasis
  secondary: 'text-gray-600',         // Secondary text - medium emphasis
  tertiary: 'text-gray-500',          // Tertiary text - lower emphasis
  disabled: 'text-gray-400',          // Disabled/muted text
  inverse: 'text-white',              // Text on dark backgrounds
} as const;

/**
 * Type guard for theme variants
 */
export type CanvasThemeVariant = keyof typeof CANVAS_COMPONENTS.themes;

/**
 * Get theme classes for Canvas components
 */
export function getCanvasThemeClasses(theme: CanvasThemeVariant = 'default') {
  return CANVAS_COMPONENTS.themes[theme];
}

// ============================================================================
// GLASSMORPHIC DROPDOWN DESIGN PATTERN
// ============================================================================

/**
 * **Glassmorphic Dropdown Design Pattern**
 *
 * A unified design system for all dropdown menus in Taskerino.
 * Based on the Filter Sessions dropdown aesthetic.
 *
 * ## Core Principles
 * 1. **Clean frosted glass effect** - Translucent with strong blur
 * 2. **Subtle hover states** - Light, semi-transparent backgrounds
 * 3. **Minimal visual noise** - No unnecessary borders or decoration
 * 4. **Consistent spacing** - Predictable, breathable layouts
 *
 * ## Container Structure
 * ```tsx
 * <div className={`
 *   absolute top-full left-0 mt-2
 *   w-80                                    // Or custom width
 *   bg-white/80 backdrop-blur-2xl          // Frosted glass base
 *   ${getRadiusClass('modal')}             // Consistent border radius
 *   border-2 border-cyan-400/80            // Prominent cyan border
 *   ${SHADOWS.modal}                       // Strong shadow for elevation
 *   z-[9999]                               // Above everything
 * `}>
 * ```
 *
 * ## Header Pattern
 * ```tsx
 * <div className="flex items-center justify-between p-5 border-b-2 border-gray-200/50">
 *   <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
 *     <Icon size={20} className="text-cyan-600" />
 *     Title
 *   </h3>
 *   <button
 *     onClick={onClose}
 *     className={`p-1.5 ${getRadiusClass('element')} hover:bg-white/60 transition-colors`}
 *   >
 *     <X size={18} className="text-gray-600" />
 *   </button>
 * </div>
 * ```
 *
 * ## Search Input Pattern
 * ```tsx
 * <input
 *   className={`
 *     w-full pl-10 pr-3 py-2
 *     text-sm
 *     bg-white/50 backdrop-blur-md        // Semi-transparent glass
 *     border border-white/50              // Subtle border
 *     ${getRadiusClass('field')}
 *     focus:outline-none
 *     focus:ring-2 focus:ring-cyan-400
 *     transition-all
 *   `}
 * />
 * ```
 *
 * ## Interactive Item Pattern (Buttons/Labels)
 * ```tsx
 * <button className={`
 *   w-full text-left px-3 py-2
 *   ${getRadiusClass('element')}
 *   text-sm font-medium
 *   transition-all
 *   ${selected
 *     ? 'bg-cyan-100 text-cyan-900'      // Selected: SOLID cyan
 *     : 'text-gray-800 hover:bg-cyan-50' // Hover: SOLID light cyan
 *   }
 * `}>
 * ```
 *
 * ## Section Headers
 * ```tsx
 * <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
 *   Section Title
 * </h4>
 * ```
 *
 * ## Footer Pattern
 * ```tsx
 * <div className="px-5 pb-5 pt-4 border-t-2 border-white/30">
 *   <button className={`
 *     w-full flex items-center justify-center gap-2
 *     px-4 py-2.5
 *     ${getRadiusClass('field')}
 *     bg-white/60 backdrop-blur-lg         // Glass button
 *     hover:bg-white/70                    // Slightly more opaque on hover
 *     border-2 border-white/50
 *     hover:border-cyan-400/60             // Cyan border on hover
 *     text-cyan-700 font-semibold text-sm
 *     transition-all
 *   `}>
 *     <Icon size={16} />
 *     Action Text
 *   </button>
 * </div>
 * ```
 *
 * ## Warning/Alert Boxes
 * ```tsx
 * <div className="p-3 bg-yellow-50/60 backdrop-blur-lg rounded-xl border-2 border-yellow-300/60">
 *   <p className="text-xs text-yellow-900 font-semibold">⚠️ Warning Title</p>
 *   <p className="text-xs text-yellow-800">Warning message...</p>
 *   <button className={`
 *     w-full px-3 py-1.5
 *     bg-yellow-500/90 hover:bg-yellow-600
 *     text-white text-xs font-semibold
 *     ${getRadiusClass('element')}
 *     transition-colors
 *   `}>
 *     Action
 *   </button>
 * </div>
 * ```
 *
 * ## Spacing Guidelines
 * - **Container padding**: `p-5` (20px) for main content areas
 * - **Section spacing**: `space-y-5` (20px) between major sections
 * - **Item spacing**: `space-y-2` (8px) within sections
 * - **Footer padding**: `px-5 pb-5 pt-4` (asymmetric for visual balance)
 *
 * ## Color Guidelines
 * - **Primary accent**: Cyan (`cyan-400`, `cyan-600`, etc.)
 * - **Borders**: `border-gray-200/50` for internal dividers
 * - **Borders (external)**: `border-cyan-400/80` for dropdown edge
 * - **Text primary**: `text-gray-900`
 * - **Text secondary**: `text-gray-800` (slightly lighter)
 * - **Text tertiary**: `text-gray-600` or `text-gray-700`
 *
 * ## Opacity Stack Rules
 * **IMPORTANT**: Avoid stacking multiple opaque layers
 * - Main container: `bg-white/80` (80% opaque frosted glass)
 * - Internal inputs: `bg-white/50` (50% opaque) - DO NOT go higher
 * - Hover states: `bg-cyan-50` (SOLID - provides clear feedback)
 * - Selected states: `bg-cyan-100` (SOLID - clear selection)
 * - Warning boxes: `bg-yellow-50/60` (60% opaque yellow with blur)
 *
 * Never use:
 * - Solid white backgrounds on SECTIONS (no `bg-white` wrappers around groups)
 * - Multiple nested glass layers (causes opacity stacking)
 * - Gradient backgrounds on section containers (visual clutter)
 * - Semi-transparent hover states (too subtle - users need clear feedback)
 *
 * ## Animation Pattern
 * ```tsx
 * <motion.div
 *   initial={{ opacity: 0, y: -10, scale: 0.95 }}
 *   animate={{ opacity: 1, y: 0, scale: 1 }}
 *   exit={{ opacity: 0, y: -5, scale: 0.98 }}
 *   transition={{
 *     type: 'spring',
 *     damping: 25,
 *     stiffness: 300,
 *   }}
 * >
 * ```
 *
 * ## Examples in Codebase
 * - ✅ **Reference**: `SessionsFilterMenu.tsx` (gold standard)
 * - ✅ **Reference**: `SessionsSortMenu.tsx`
 * - ✅ **Reference**: `AudioQuickSettings.tsx`
 * - ✅ **Reference**: `CaptureQuickSettings.tsx`
 */
export const DROPDOWN_PATTERN = {
  container: {
    background: 'bg-white/80 backdrop-blur-2xl',
    border: 'border-2 border-cyan-400/80',
    shadow: SHADOWS.modal,
    radius: getRadiusClass('modal'),
    padding: 'p-5',
  },
  header: {
    padding: 'p-5 pb-4',
    border: 'border-b-2 border-gray-200/50',
    title: 'text-lg font-bold text-gray-900',
    closeButton: `p-1.5 ${getRadiusClass('element')} hover:bg-white/60 transition-colors`,
  },
  search: {
    background: 'bg-white/50 backdrop-blur-md',
    border: 'border border-white/50',
    focus: 'focus:ring-2 focus:ring-cyan-400',
  },
  item: {
    base: `px-3 py-2 ${getRadiusClass('element')} text-sm font-medium transition-all`,
    selected: 'bg-cyan-100 text-cyan-900',
    hover: 'text-gray-800 hover:bg-cyan-50',
  },
  section: {
    header: 'text-xs font-bold text-gray-700 uppercase tracking-wider mb-3',
    spacing: 'space-y-5',
  },
  footer: {
    padding: 'px-5 pb-5 pt-4',
    border: 'border-t-2 border-white/30',
    button: {
      background: 'bg-white/60 backdrop-blur-lg hover:bg-white/70',
      border: 'border-2 border-white/50 hover:border-cyan-400/60',
      text: 'text-cyan-700 font-semibold text-sm',
    },
  },
} as const;
