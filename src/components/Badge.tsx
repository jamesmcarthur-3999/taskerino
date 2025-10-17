import React, { type ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  RADIUS,
  getGlassClasses,
  getRadiusClass,
  getSuccessGradient,
  getWarningGradient,
  getDangerGradient,
  getInfoGradient
} from '../design-system/theme';
import type { ColorScheme } from '../design-system/theme';

interface BadgeProps {
  children?: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  rounded?: boolean;
}

export const Badge = React.memo(function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  rounded = false,
}: BadgeProps) {
  const { colorScheme } = useTheme();

  // Size classes
  const sizeClasses = {
    sm: dot ? 'w-2 h-2' : 'text-xs px-2 py-0.5',
    md: dot ? 'w-2.5 h-2.5' : 'text-sm px-3 py-1',
    lg: dot ? 'w-3 h-3' : 'text-base px-4 py-1.5',
  };

  // Get variant classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'default':
        return `${getGlassClasses('subtle')} text-gray-700`;

      case 'primary':
        return getPrimaryGradient(colorScheme);

      case 'success':
        const successGradient = getSuccessGradient('light');
        return `${successGradient.container} ${successGradient.textPrimary}`;

      case 'warning':
        const warningGradient = getWarningGradient('light');
        return `${warningGradient.container} ${warningGradient.textPrimary}`;

      case 'danger':
        const dangerGradient = getDangerGradient('light');
        return `${dangerGradient.container} ${dangerGradient.textPrimary}`;

      case 'info':
        const infoGradient = getInfoGradient('light');
        return `${infoGradient.container} ${infoGradient.textPrimary}`;
    }
  };

  // Get primary gradient based on color scheme
  const getPrimaryGradient = (scheme: ColorScheme) => {
    switch (scheme) {
      case 'ocean':
        return 'bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 border border-cyan-200/60 backdrop-blur-sm';
      case 'sunset':
        return 'bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 border border-orange-200/60 backdrop-blur-sm';
      case 'forest':
        return 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm';
      case 'lavender':
        return 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200/60 backdrop-blur-sm';
      case 'monochrome':
        return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300/60 backdrop-blur-sm';
    }
  };

  // Dot variant - just show a colored circle
  if (dot) {
    return (
      <span
        className={`
          inline-block
          ${sizeClasses[size]}
          ${getRadiusClass('pill')}
          ${getVariantClasses()}
        `.trim()}
      />
    );
  }

  // Badge with text
  return (
    <span
      className={`
        inline-flex
        items-center
        justify-center
        font-medium
        ${sizeClasses[size]}
        ${rounded ? getRadiusClass('pill') : getRadiusClass('element')}
        ${getVariantClasses()}
        whitespace-nowrap
      `.trim()}
    >
      {children}
    </span>
  );
});
