import { type ReactNode, useRef, cloneElement, isValidElement } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from './Button';
import { DropdownSelect } from './DropdownSelect';

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

  return (
    <div className={`mb-4 flex items-center justify-between ${className}`.trim()}>
      {/* Main toolbar wrapper with relative positioning for filter panel */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-white/40 backdrop-blur-xl
                        border-2 border-white/50 rounded-[24px] p-1.5 shadow-lg">

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
        </div>
      </div>

      {/* Filter panel (rendered via portal with position) */}
      {filters?.active && filters.panel && isValidElement(filters.panel) &&
        cloneElement(filters.panel, { buttonRef: filterButtonRef } as any)
      }

      {/* Stats display */}
      {stats && (
        <div className="flex items-center gap-2 text-sm text-gray-700
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
  );
}
