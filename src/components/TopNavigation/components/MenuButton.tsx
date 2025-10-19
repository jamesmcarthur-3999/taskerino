/**
 * MenuButton Component
 *
 * Menu button that reveals on scroll with elastic bounce animation
 * Takes over the position where LogoContainer fades out
 */

import { useRef, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { NAV_CONSTANTS } from '../constants';
import { easeOutElasticLight, clamp } from '../../../utils/easing';
import { useCompactNavigation } from '../../../hooks/useCompactNavigation';

interface MenuButtonProps {
  scrollY: number;
  onClick: () => void;
}

export function MenuButton({ scrollY, onClick }: MenuButtonProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isCompact = useCompactNavigation();

  // Direct DOM manipulation for scroll animations (60fps smooth)
  useEffect(() => {
    if (!menuButtonRef.current) return;

    // Menu button reveal: Use elastic easing for playful entrance
    // Delay start until logo is well into fade (150px scroll)
    const menuStartProgress = clamp((scrollY - NAV_CONSTANTS.MENU_REVEAL_START) / 150, 0, 1);
    const menuProgress = easeOutElasticLight(menuStartProgress);

    const menuOpacity = menuStartProgress; // Linear opacity for clean fade-in
    const menuScale = 0.6 + (menuProgress * 0.4); // Elastic bounce to full size

    menuButtonRef.current.style.opacity = menuOpacity.toString();
    menuButtonRef.current.style.transform = `scale(${menuScale})`;
    menuButtonRef.current.style.pointerEvents = menuOpacity > 0.7 ? 'auto' : 'none';
  }, [scrollY]);

  return (
    <button
      ref={menuButtonRef}
      onClick={onClick}
      className={`absolute ${isCompact ? 'top-3 left-3 h-10 w-10 justify-center p-0' : 'top-4 left-6 gap-3 px-5 py-4'} flex items-center bg-white/40 backdrop-blur-xl rounded-full shadow-xl border-2 border-white/50 ring-1 ring-black/5 pointer-events-auto transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:bg-white/50 active:scale-95 text-gray-800 group`}
      style={{
        opacity: 0,
        transitionProperty: 'box-shadow, background, transform',
        willChange: scrollY > 150 && scrollY < 300 ? 'opacity, transform' : 'auto'
      }}
      aria-label="Open navigation menu"
    >
      <Menu className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} group-hover:rotate-180 transition-transform duration-500`} />
      {!isCompact && <span className="font-semibold text-base tracking-wide">Menu</span>}
    </button>
  );
}
