import { type ReactNode, useRef, cloneElement, isValidElement, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from './Button';
import { DropdownSelect } from './DropdownSelect';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { useUI } from '../context/UIContext';
import { easeOutCubic, easeOutQuart, clamp, smoothstep } from '../utils/easing';

interface PrimaryAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  gradient?: 'cyan' | 'purple' | 'green';
}

interface ViewControl {
  id: string;
  label: string;
  icon: ReactNode;
}

interface ViewControls {
  views: ViewControl[];
  activeView: string;
  onViewChange: (viewId: string) => void;
}

interface DropdownControl {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

interface FilterConfig {
  active: boolean;
  count: number;
  onToggle: () => void;
  panel?: ReactNode;
}

interface StatsDisplay {
  total: number;
  filtered?: number;
  label?: string;
}

interface SpaceMenuBarProps {
  primaryAction?: PrimaryAction;
  viewControls?: ViewControls;
  dropdowns?: DropdownControl[];
  filters?: FilterConfig;
  stats?: StatsDisplay;
  children?: ReactNode;
  className?: string;
}

function Divider() {
  return <div className="h-8 w-px bg-white/30" />;
}

function getGradientClass(type: 'cyan' | 'purple' | 'green') {
  switch (type) {
    case 'cyan':
      return 'bg-gradient-to-r from-cyan-500 to-blue-500';
    case 'purple':
      return 'bg-gradient-to-r from-purple-500 to-violet-600';
    case 'green':
      return 'bg-gradient-to-r from-green-500 to-emerald-600';
  }
}

export function SpaceMenuBar({
  primaryAction,
  viewControls,
  dropdowns = [],
  filters,
  stats,
  children,
  className = ''
}: SpaceMenuBarProps) {
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const statsPillRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScrollAnimation();
  const { state, dispatch } = useUI();
  const { showSubMenuOverlay } = state;
  const rafIdRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ESC key listener to close overlay
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSubMenuOverlay) {
        dispatch({ type: 'SET_SUBMENU_OVERLAY', payload: false });
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSubMenuOverlay, dispatch]);

  // Apply scroll-driven transformations with refined easing
  useEffect(() => {
    const applyTransforms = () => {
      if (!menuBarRef.current) return;

      // Menu bar transformations (0-300px range, synchronized with header)
      // Delay start to 50px for less eager fade
      const rawProgress = clamp((scrollY - 50) / 250, 0, 1);

      // Use ease-out-quart for smooth deceleration feel
      const easedProgress = easeOutQuart(rawProgress);

      // Opacity: faster fade (use cubic for snappier feel)
      const opacityProgress = easeOutCubic(rawProgress);
      const menuOpacity = 1 - opacityProgress;

      // Scale: subtle and smooth
      const menuScale = 1 - (easedProgress * 0.15);

      // TranslateY: slightly slower than opacity for layered effect
      const translateProgress = smoothstep(0, 1, rawProgress);
      const menuTranslateY = -(scrollY - 50) * translateProgress;

      menuBarRef.current.style.transform = `translateY(${menuTranslateY}px) scale(${menuScale})`;
      menuBarRef.current.style.opacity = String(menuOpacity);

      // Stats pill transformations (0-300px range) - synchronized timing
      if (statsPillRef.current) {
        const statsRawProgress = clamp((scrollY - 50) / 250, 0, 1);

        // Stats fades in sync with menu bar
        const statsOpacityProgress = easeOutCubic(statsRawProgress);
        const statsOpacity = 1 - statsOpacityProgress;

        // Very subtle scale for refinement
        const statsScaleProgress = easeOutQuart(statsRawProgress);
        const statsScale = 1 - (statsScaleProgress * 0.03);

        // Progressive blur for depth
        const statsBlur = statsRawProgress * 3;

        statsPillRef.current.style.opacity = String(statsOpacity);
        statsPillRef.current.style.transform = `scale(${statsScale})`;
        statsPillRef.current.style.filter = `blur(${statsBlur}px)`;
      }

      rafIdRef.current = null;
    };

    // Cancel any pending animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Schedule new animation frame
    rafIdRef.current = requestAnimationFrame(applyTransforms);

    // Manage will-change optimization
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      if (menuBarRef.current) {
        menuBarRef.current.style.willChange = 'transform, opacity';
      }
      if (statsPillRef.current) {
        statsPillRef.current.style.willChange = 'transform, opacity, filter';
      }
    }

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Remove will-change after scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      if (menuBarRef.current) {
        menuBarRef.current.style.willChange = 'auto';
      }
      if (statsPillRef.current) {
        statsPillRef.current.style.willChange = 'auto';
      }
    }, 150);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollY]);

  // Helper function to render menu bar controls
  const renderMenuBarControls = () => (
    <>
      {/* Primary Action Button */}
      {primaryAction && (
        <>
          <button
            onClick={primaryAction.onClick}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full
              shadow-md font-semibold text-sm transition-all
              hover:shadow-lg hover:scale-[1.02] active:scale-95
              border-2 border-transparent text-white
              ${getGradientClass(primaryAction.gradient || 'cyan')}
            `.trim()}
          >
            {primaryAction.icon}
            <span>{primaryAction.label}</span>
          </button>
          <Divider />
        </>
      )}

      {/* View Controls */}
      {viewControls && (
        <>
          {viewControls.views.map((view) => (
            <Button
              key={view.id}
              variant={viewControls.activeView === view.id ? 'primary' : 'secondary'}
              size="sm"
              icon={view.icon}
              onClick={() => viewControls.onViewChange(view.id)}
            >
              {view.label}
            </Button>
          ))}
          {dropdowns.length > 0 && <Divider />}
        </>
      )}

      {/* Dropdowns */}
      {dropdowns.map((dropdown, i) => (
        <div key={i} className="flex items-center">
          <DropdownSelect
            label={dropdown.label}
            value={dropdown.value}
            options={dropdown.options}
            onChange={dropdown.onChange}
          />
          {i < dropdowns.length - 1 && <Divider />}
        </div>
      ))}

      {/* Filters */}
      {filters && (
        <>
          {(viewControls || dropdowns.length > 0) && <Divider />}
          <button
            ref={filterButtonRef}
            onClick={filters.onToggle}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full
              transition-all text-sm font-semibold border-2
              ${filters.active
                ? 'bg-cyan-100 border-cyan-400 text-cyan-800'
                : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-cyan-300'
              }
              focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none
            `.trim()}
          >
            <SlidersHorizontal size={16} />
            <span>Filters</span>
            {filters.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-cyan-500 text-white
                             text-[10px] font-bold rounded-full">
                {filters.count}
              </span>
            )}
          </button>
        </>
      )}

      {/* Custom children */}
      {children}
    </>
  );

  // Determine if overlay should be shown
  const shouldShowOverlay = showSubMenuOverlay && scrollY > 100;

  return (
    <>
      {/* Overlay Mode */}
      {shouldShowOverlay && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-[90] animate-in fade-in duration-300"
            onClick={() => dispatch({ type: 'SET_SUBMENU_OVERLAY', payload: false })}
          />

          {/* Overlay Menu Bar */}
          <div className="fixed top-[80px] left-[24px] z-[95] animate-in slide-in-from-top duration-300 origin-top-left">
            <div className="flex items-center gap-3 bg-white/40 backdrop-blur-xl
                          border-2 border-white/50 rounded-[24px] p-1.5 shadow-lg">
              {renderMenuBarControls()}
            </div>
          </div>
        </>
      )}

      {/* Normal Mode */}
      <div className={`flex items-center justify-between mb-4 ${className}`.trim()}>
        {/* Main toolbar wrapper with relative positioning for filter panel */}
        <div className="relative">
          <div
            ref={menuBarRef}
            className="flex items-center gap-3 bg-white/40 backdrop-blur-xl
                          border-2 border-white/50 rounded-[24px] p-1.5 shadow-lg">
            {renderMenuBarControls()}
          </div>
        </div>

        {/* Filter panel (rendered via portal with position) */}
        {filters?.active && filters.panel && isValidElement(filters.panel) &&
          cloneElement(filters.panel, { buttonRef: filterButtonRef } as any)
        }

        {/* Stats display */}
        {stats && (
          <div
            ref={statsPillRef}
            className="flex items-center gap-2 text-sm text-gray-700
                          bg-white/30 backdrop-blur-sm px-4 py-2 rounded-[24px]
                          border border-white/60">
            <span>{stats.total} total</span>
            {stats.filtered !== undefined && stats.filtered !== stats.total && (
              <>
                <span className="text-gray-300">•</span>
                <span>{stats.filtered} {stats.label || 'shown'}</span>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
