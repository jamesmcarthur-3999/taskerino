import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  RADIUS,
  TRANSITIONS,
  SCALE,
  getGlassClasses,
  EASING,
  getGradientClasses,
  getRadiusClass
} from '../design-system/theme';

type CardVariant = 'default' | 'elevated' | 'interactive' | 'flat';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
  active?: boolean;
  children: ReactNode;
  gradient?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hover = false,
      active = false,
      gradient = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const { colorScheme } = useTheme();

    // Base styles
    const baseStyles = `
      relative
      ${getRadiusClass('card')}
      ${TRANSITIONS.standard}
    `;

    // Variant styles
    const variantStyles = {
      default: getGlassClasses('medium'),
      elevated: getGlassClasses('strong'),
      interactive: `${getGlassClasses('medium')} cursor-pointer`,
      flat: getGlassClasses('subtle'),
    };

    // Hover effects
    const hoverStyles = hover ? `hover:shadow-xl hover:shadow-cyan-100/30 hover:-translate-y-1 ${SCALE.cardHover}` : '';

    // Active state
    const activeStyles = active
      ? `
        shadow-xl shadow-cyan-200/40
        border-cyan-300/60
        scale-[1.02]
      `
      : '';

    const combinedStyles = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${hoverStyles}
      ${activeStyles}
      ${className}
    `.trim();

    return (
      <div
        ref={ref}
        className={combinedStyles}
        style={{
          transitionTimingFunction: EASING.elastic,
        }}
        {...props}
      >
        {/* Gradient hover overlay */}
        {gradient && (
          <div className={`absolute inset-0 ${getRadiusClass('card')} opacity-0 group-hover:opacity-100 bg-gradient-to-br ${getGradientClasses(colorScheme, 'primary').replace('bg-gradient-to-r', '')} opacity-[0.05] transition-opacity duration-300`} />
        )}

        {/* Content with relative positioning for z-index */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

Card.displayName = 'Card';
