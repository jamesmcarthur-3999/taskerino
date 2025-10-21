import { Menu } from 'lucide-react';

interface MenuButtonProps {
  onClick?: () => void;
  label?: string;
  isActive?: boolean;
}

/**
 * MenuButton - Small compact menu button that appears next to logo when scrolled
 *
 * Positioned by CSS Grid in TopNavigation column 2.
 * Fades in when scrollY >= 100.
 * Shows toggle state - active when zone menu is pinned visible.
 */
export function MenuButton({ onClick, label = 'Menu', isActive = false }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 h-14 backdrop-blur-xl border-2 rounded-[9999px] transition-all pointer-events-auto ${
        isActive
          ? 'bg-white/60 border-white/70 hover:bg-white/70'
          : 'bg-white/40 border-white/50 hover:bg-white/50'
      }`}
    >
      <Menu size={16} className="text-gray-700" />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  );
}
