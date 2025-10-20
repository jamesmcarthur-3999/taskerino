import { Menu } from 'lucide-react';

interface MenuButtonProps {
  onClick?: () => void;
  label?: string;
}

/**
 * MenuButton - Small compact menu button that appears next to logo when scrolled
 *
 * Positioned by CSS Grid in TopNavigation column 2.
 * Fades in when scrollY >= 100.
 */
export function MenuButton({ onClick, label = 'Menu' }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-white/40 backdrop-blur-xl border-2 border-white/50 rounded-[9999px] hover:bg-white/50 transition-colors pointer-events-auto"
    >
      <Menu size={16} className="text-gray-700" />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  );
}
