/**
 * LogoContainer Component
 *
 * Permanent logo that stays visible at all times
 * Menu button morphs to position next to it (not replacing it)
 */

import { NAVIGATION } from '../../../design-system/theme';

interface LogoContainerProps {
  scrollY: number;
}

export function LogoContainer({ scrollY }: LogoContainerProps) {
  return (
    <div
      className={`${NAVIGATION.logo.container} transition-shadow duration-300 hover:shadow-2xl`}
      style={{
        transitionProperty: 'box-shadow'
      }}
    >
      <div className={NAVIGATION.logo.iconBg}>
        <span className={NAVIGATION.logo.iconText}>T</span>
      </div>
      <span className={NAVIGATION.logo.text}>
        Taskerino
      </span>
    </div>
  );
}
