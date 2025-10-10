import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft } from 'lucide-react';

interface Breadcrumb {
  label: string;
  onClick: () => void;
}

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  autoSaveStatus?: 'idle' | 'saving' | 'saved';
  initialWidth?: number; // Percentage
}

export function AppSidebar({
  isOpen,
  onClose,
  title,
  children,
  breadcrumbs = [],
  autoSaveStatus = 'idle',
  initialWidth = 35,
}: AppSidebarProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const MIN_WIDTH = 20; // Percentage
  const MAX_WIDTH = 60; // Percentage

  // Load saved width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebar-width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidth(parsed);
      }
    }
  }, []);

  // Save width to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-width', width.toString());
  }, [width]);

  // Handle drag to resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;

      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(Math.round(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-screen z-50 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: `${width}%` }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-gradient-to-b hover:from-cyan-500 hover:to-blue-500 transition-colors group ${
            isDragging ? 'bg-gradient-to-b from-cyan-500 to-blue-500' : ''
          }`}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-white/60 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Frosted Glass Container */}
        <div className="h-full ml-1.5 bg-white/70 backdrop-blur-2xl border-l-2 border-white/50 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b-2 border-white/50 bg-white/30 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              {/* Breadcrumbs */}
              {breadcrumbs.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        onClick={crumb.onClick}
                        className="hover:text-cyan-600 transition-colors flex items-center gap-1 font-medium"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        {crumb.label}
                      </button>
                      {index < breadcrumbs.length - 1 && (
                        <span className="text-gray-400">/</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/80 rounded-xl transition-all hover:scale-105 active:scale-95 ml-auto"
                aria-label="Close sidebar"
                title="Close (Esc)"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>

            {/* Auto-save Indicator */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              {autoSaveStatus === 'saving' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                  <span className="font-medium">Saving...</span>
                </div>
              )}
              {autoSaveStatus === 'saved' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                  <span className="font-medium">Saved</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
