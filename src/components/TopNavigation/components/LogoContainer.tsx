/**
 * LogoContainer Component
 *
 * Logo with scroll-based fade out animation
 * Morphs into the MenuButton as user scrolls down
 */

import { useRef, useEffect } from 'react';
import { NAV_CONSTANTS } from '../constants';
import { easeOutQuart, clamp } from '../../../utils/easing';
import { NAVIGATION } from '../../../design-system/theme';

interface LogoContainerProps {
  scrollY: number;
}

export function LogoContainer({ scrollY }: LogoContainerProps) {
  const logoContainerRef = useRef<HTMLDivElement>(null);

  // Direct DOM manipulation for scroll animations (60fps smooth)
  useEffect(() => {
    if (!logoContainerRef.current) return;

    // Logo fade-out: Use smooth ease-out for natural disappearance
    // Delay start to 50px for less eager fade
    const logoStartProgress = clamp((scrollY - NAV_CONSTANTS.LOGO_FADE_START) / 250, 0, 1);
    const logoProgress = easeOutQuart(logoStartProgress);
    const logoOpacity = 1 - logoProgress;
    const logoScale = 1 - (logoProgress * 0.25); // Subtle shrink
    const logoBlur = logoProgress * 4; // Add slight blur for polish

    logoContainerRef.current.style.opacity = logoOpacity.toString();
    logoContainerRef.current.style.transform = `scale(${logoScale})`;
    logoContainerRef.current.style.filter = `blur(${logoBlur}px)`;
    logoContainerRef.current.style.pointerEvents = logoOpacity < 0.3 ? 'none' : 'auto';
  }, [scrollY]);

  return (
    <div
      ref={logoContainerRef}
      className={`${NAVIGATION.logo.container} transition-shadow duration-300 hover:shadow-2xl`}
      style={{
        transitionProperty: 'box-shadow',
        willChange: scrollY > 50 && scrollY < 300 ? 'opacity, transform' : 'auto'
      }}
    >
      <div className={NAVIGATION.logo.iconBg}>
        <span className="text-white font-bold text-xs">T</span>
      </div>
      <span className={NAVIGATION.logo.text}>
        Taskerino
      </span>
    </div>
  );
}
