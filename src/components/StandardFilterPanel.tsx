import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface FilterItem {
  id: string;
  label: string;
  count?: number;
}

interface FilterSection {
  title: string;
  items: FilterItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  multiSelect?: boolean;
}

interface StandardFilterPanelProps {
  sections: FilterSection[];
  onClearAll?: () => void;
  showClearButton?: boolean;
  title?: string;
  className?: string;
  buttonRef?: React.RefObject<HTMLElement>;
}

export function StandardFilterPanel({
  sections,
  onClearAll,
  showClearButton = true,
  title = 'Filters',
  className = '',
  buttonRef
}: StandardFilterPanelProps) {
  const hasActiveFilters = sections.some(s => s.selectedIds.length > 0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Update position when button ref is available
  useEffect(() => {
    if (buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  }, [buttonRef]);

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 99999
      }}
      className={`
        w-80
        bg-white backdrop-blur-xl rounded-[20px]
        border-2 border-cyan-400/80 shadow-2xl
        max-h-96 overflow-y-auto
        ${className}
      `.trim()}>
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-gray-200">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {showClearButton && hasActiveFilters && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-xs text-gray-500 hover:text-gray-700
                       font-semibold underline transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Filter Sections */}
        {sections.map((section) => (
          section.items.length > 0 && (
            <div key={section.title}>
              <h4 className="text-xs font-semibold text-gray-600
                           uppercase tracking-wide mb-2">
                {section.title}
              </h4>
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => {
                  const isSelected = section.selectedIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => section.onToggle(item.id)}
                      className={`
                        px-2.5 py-1.5 rounded-lg text-sm
                        font-medium transition-all
                        ${isSelected
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                          : 'bg-white/30 backdrop-blur-sm text-gray-700 hover:bg-white/50 border border-white/60'
                        }
                      `.trim()}
                    >
                      {item.label}
                      {item.count !== undefined && (
                        <span className="ml-1 opacity-70">({item.count})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}

        {/* Empty State */}
        {sections.every(s => s.items.length === 0) && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No filters available
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
