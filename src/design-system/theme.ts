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
  modal: 32,      // Large modals, overlays
  card: 24,       // Cards, sections, containers
  field: 20,      // Inputs, buttons, select boxes
  element: 16,    // Small interactive elements
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
 */
export const EASING = {
  // Standard easing functions
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',

  // Smooth, natural motion (recommended for most UI)
  smooth: 'cubic-bezier(0.4, 0.0, 0.2, 1)',

  // Snappy, responsive feel
  snappy: 'cubic-bezier(0.4, 0.0, 0.6, 1)',

  // Elastic, bouncy effect
  elastic: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Anticipation (slightly overshoots)
  anticipate: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
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

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyLarge' | 'bodySmall' | 'mono';

export const TYPOGRAPHY = {
  h1: 'text-4xl font-bold',
  h2: 'text-3xl font-bold',
  h3: 'text-2xl font-bold',
  h4: 'text-xl font-semibold',
  body: 'text-base',
  bodyLarge: 'text-lg',
  bodySmall: 'text-sm',
  mono: 'font-mono text-sm',
} as const;

/**
 * Get typography classes for the specified variant
 */
export function getTypography(variant: TypographyVariant): string {
  return TYPOGRAPHY[variant];
}

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
