import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';

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
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function StandardFilterPanel({
  sections,
  onClearAll,
  showClearButton = true,
  title = 'Filters',
  className = '',
  buttonRef,
  searchable = false,
  searchPlaceholder = 'Search filters...'
}: StandardFilterPanelProps) {
  const hasActiveFilters = sections.some(s => s.selectedIds.length > 0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Update position dynamically - recalculates on mount, resize, and button position changes
  useEffect(() => {
    const updatePosition = () => {
      if (!buttonRef?.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      updatePosition();
    });

    // Update on window resize
    window.addEventListener('resize', updatePosition);

    // Update on scroll (in case button position changes)
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [buttonRef]);

  // Also update position when buttonRef changes
  useEffect(() => {
    if (buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  }, [buttonRef?.current]);

  // Filter sections based on search query
  const filteredSections = searchable && searchQuery.trim()
    ? sections.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }))
    : sections;

  const panel = (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{
        duration: 0.25,
        ease: [0.34, 1.56, 0.64, 1], // Bouncy easing
      }}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
        width: '320px',
      }}
      className={`
        bg-white/98 backdrop-blur-xl
        border-2 border-cyan-400/80
        rounded-[20px]
        shadow-2xl shadow-cyan-200/20
        ring-1 ring-cyan-400/30
        overflow-hidden flex flex-col
        max-h-[500px]
        ${className}
      `.trim()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-gray-200/50">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {showClearButton && hasActiveFilters && onClearAll && (
          <motion.button
            onClick={onClearAll}
            className="text-xs text-cyan-600 hover:text-cyan-700
                     font-semibold underline transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear all
          </motion.button>
        )}
      </div>

      {/* Search Input */}
      {searchable && (
        <div className="p-3 border-b-2 border-gray-200/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full pl-10 pr-3 py-2 text-sm
                bg-white/50 backdrop-blur-sm
                border border-white/60 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400
                transition-all
              "
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Filter Sections - Scrollable */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {filteredSections.map((section) => (
          section.items.length > 0 && (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h4 className="text-xs font-semibold text-gray-600
                           uppercase tracking-wide mb-2.5">
                {section.title} {searchQuery && `(${section.items.length})`}
              </h4>
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => {
                  const isSelected = section.selectedIds.includes(item.id);

                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => section.onToggle(item.id)}
                      className={`
                        px-3 py-1.5 rounded-xl text-sm
                        font-medium transition-all
                        ${isSelected
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-200/30 border-2 border-transparent'
                          : 'bg-white/40 backdrop-blur-sm text-gray-700 hover:bg-white/60 hover:shadow-sm border-2 border-white/60 hover:border-cyan-300'
                        }
                      `.trim()}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                      {item.count !== undefined && (
                        <span className={`ml-1.5 text-xs ${isSelected ? 'opacity-80' : 'opacity-60'}`}>
                          ({item.count})
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )
        ))}

        {/* Empty State */}
        {filteredSections.every(s => s.items.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-gray-500 text-sm"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            {searchQuery ? 'No matching filters' : 'No filters available'}
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  return createPortal(panel, document.body);
}
