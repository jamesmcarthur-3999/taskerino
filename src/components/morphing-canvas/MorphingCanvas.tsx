/**
 * Morphing Canvas
 *
 * Main container component for the morphing canvas system.
 * Renders modules in a responsive CSS Grid layout with smooth transitions.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { LayoutGroup } from 'framer-motion';
import { Layout, Maximize2, Minimize2 } from 'lucide-react';
import { ModuleRenderer } from './ModuleRenderer';
import type {
  MorphingCanvasConfig,
  SessionData,
  ModuleAction,
  LayoutTemplate,
  Breakpoint,
} from './types';
import { useReducedMotion } from './animations/transitions';
import { cn } from '../../lib/utils';
import { getGlassClasses, getRadiusClass, DROPDOWN_STYLES, SHADOWS } from '../../design-system/theme';

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

/**
 * Get current breakpoint based on window width
 */
function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    if (width < 1920) return 'desktop';
    return 'wide';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Debounce helper
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        let newBreakpoint: Breakpoint;

        if (width < 768) {
          newBreakpoint = 'mobile';
        } else if (width < 1024) {
          newBreakpoint = 'tablet';
        } else if (width < 1920) {
          newBreakpoint = 'desktop';
        } else {
          newBreakpoint = 'wide';
        }

        setBreakpoint(newBreakpoint);
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return breakpoint;
}

/**
 * Get grid slot styles for a module at current breakpoint
 */
function getGridSlotStyles(
  slotId: string,
  layout: LayoutTemplate,
  breakpoint: Breakpoint
): React.CSSProperties {
  const slot = layout.slots[slotId];

  if (!slot) {
    console.warn(`Slot "${slotId}" not found in layout "${layout.id}"`);
    return {};
  }

  // Get slot for current breakpoint with fallback
  const responsiveSlot =
    slot[breakpoint] ||
    slot.desktop ||
    (breakpoint === 'wide' && slot.desktop) ||
    (breakpoint === 'tablet' && slot.desktop) ||
    (breakpoint === 'mobile' && slot.tablet) ||
    slot.desktop;

  if (!responsiveSlot) {
    return {};
  }

  return {
    gridColumn: responsiveSlot.column,
    gridRow: responsiveSlot.row,
  };
}

// ============================================================================
// VIEW TOGGLE COMPONENT
// ============================================================================

interface ViewToggleProps {
  currentLayout: LayoutTemplate;
  alternativeLayouts: LayoutTemplate[];
  onLayoutChange: (layout: LayoutTemplate) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function ViewToggle({
  currentLayout,
  alternativeLayouts,
  onLayoutChange,
  isExpanded,
  onToggleExpand,
}: ViewToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (alternativeLayouts.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      {/* Expand/Collapse Toggle */}
      <button
        onClick={onToggleExpand}
        className={`p-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} ${SHADOWS.button} hover:shadow-lg transition-all border border-gray-200`}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        {isExpanded ? (
          <Minimize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        ) : (
          <Maximize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      {/* Layout Selector */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-4 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} ${SHADOWS.button} hover:shadow-lg transition-all border border-gray-200`}
        >
          <Layout className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentLayout.name}
          </span>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className={DROPDOWN_STYLES.backdrop}
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className={`${DROPDOWN_STYLES.menu('card')} right-0 top-full mt-2 w-56 overflow-hidden z-20`}>
              <div className="py-2">
                {/* Current Layout */}
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Current Layout
                </div>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="font-medium">{currentLayout.name}</div>
                  {currentLayout.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {currentLayout.description}
                    </div>
                  )}
                </button>

                {/* Divider */}
                {alternativeLayouts.length > 0 && (
                  <div className={DROPDOWN_STYLES.divider} />
                )}

                {/* Alternative Layouts */}
                {alternativeLayouts.length > 0 && (
                  <>
                    <div className="px-3 py-1 mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Switch to
                    </div>
                    {alternativeLayouts.map((layout) => (
                      <button
                        key={layout.id}
                        className={DROPDOWN_STYLES.item}
                        onClick={() => {
                          onLayoutChange(layout);
                          setIsOpen(false);
                        }}
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {layout.name}
                        </div>
                        {layout.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {layout.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface MorphingCanvasProps {
  config: MorphingCanvasConfig;
  sessionData?: SessionData;
  onAction?: (action: ModuleAction) => void;
  onLayoutChange?: (layoutId: string) => void;
  className?: string;
}

export function MorphingCanvas({
  config,
  sessionData,
  onAction,
  onLayoutChange,
  className,
}: MorphingCanvasProps) {
  const reducedMotion = useReducedMotion();
  const breakpoint = useBreakpoint();
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<LayoutTemplate>(
    config.layout
  );

  // Handle layout change
  const handleLayoutChange = useCallback(
    (newLayout: LayoutTemplate) => {
      setCurrentLayout(newLayout);
      if (onLayoutChange) {
        onLayoutChange(newLayout.id);
      }
    },
    [onLayoutChange]
  );

  // Handle expand/collapse
  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle module actions
  const handleModuleAction = useCallback(
    (action: ModuleAction) => {
      console.log('Module action:', action);
      if (onAction) {
        onAction(action);
      }
    },
    [onAction]
  );

  // Check if animations are enabled
  const animationsEnabled = useMemo(() => {
    if (config.behavior?.respectReducedMotion && reducedMotion) {
      return false;
    }
    return config.behavior?.enableAnimations !== false;
  }, [config.behavior, reducedMotion]);

  // Grid configuration
  const gridConfig = currentLayout.gridConfig;
  const gridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
    gap: gridConfig.gap,
    minHeight: gridConfig.minHeight || '100vh',
  };

  // Filter enabled modules
  const enabledModules = useMemo(() => {
    return config.modules.filter((module) => module.enabled !== false);
  }, [config.modules]);

  return (
    <div
      className={cn(
        'morphing-canvas relative w-full',
        'transition-all duration-300',
        isExpanded && 'fixed inset-0 z-50 bg-white dark:bg-gray-950',
        className
      )}
      data-theme={config.theme.mode}
    >
      {/* View Toggle UI */}
      {(config.alternativeLayouts && config.alternativeLayouts.length > 0) ||
      !isExpanded ? (
        <ViewToggle
          currentLayout={currentLayout}
          alternativeLayouts={config.alternativeLayouts || []}
          onLayoutChange={handleLayoutChange}
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
        />
      ) : null}

      {/* Main Grid Container */}
      <LayoutGroup>
        <div
          className={cn(
            'morphing-canvas-grid',
            'p-6',
            isExpanded && 'h-screen overflow-y-auto'
          )}
          style={gridStyles}
        >
          {enabledModules.map((moduleConfig) => {
            const slotStyles = getGridSlotStyles(
              moduleConfig.slotId,
              currentLayout,
              breakpoint
            );

            return (
              <div
                key={moduleConfig.id}
                className="morphing-canvas-module-container"
                style={slotStyles}
              >
                <ModuleRenderer
                  config={moduleConfig}
                  sessionData={sessionData}
                  onAction={handleModuleAction}
                />
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`fixed bottom-4 left-4 text-xs bg-black/75 text-white px-3 py-2 ${getRadiusClass('element')} font-mono z-50`}>
          <div>Layout: {currentLayout.id}</div>
          <div>Breakpoint: {breakpoint}</div>
          <div>Modules: {enabledModules.length}</div>
          <div>Animations: {animationsEnabled ? 'On' : 'Off'}</div>
        </div>
      )}
    </div>
  );
}

MorphingCanvas.displayName = 'MorphingCanvas';
